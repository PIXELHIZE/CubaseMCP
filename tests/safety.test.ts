import { describe, expect, it, beforeEach } from "vitest";
import { MockCubaseAdapter } from "../src/adapters/MockCubaseAdapter.js";
import { SafetyController } from "../src/safety/SafetyController.js";
import { ErrorCode } from "../src/safety/ErrorCodes.js";
import { getToolDefinition } from "../src/tools/definitions.js";

describe("SafetyController", () => {
  let adapter: MockCubaseAdapter;
  let controller: SafetyController;

  beforeEach(async () => {
    adapter = new MockCubaseAdapter();
    await adapter.connect();
    controller = new SafetyController(adapter);
    await controller.invoke(getToolDefinition("cubase.create_project"), { name: "Test" });
  });

  it("creates tracks through the tool pipeline", async () => {
    const result = await controller.invoke(getToolDefinition("cubase.create_track"), {
      type: "audio",
      name: "Vocal"
    });

    expect(result.ok).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.undoSnapshotId).toMatch(/^undo_/);
    expect((result.data as { tracks: Array<{ name: string }> }).tracks[0].name).toBe("Vocal");
  });

  it("does not mutate state during dryRun", async () => {
    const dryRun = await controller.invoke(getToolDefinition("cubase.create_track"), {
      type: "audio",
      name: "Dry Run Track",
      dryRun: true
    });
    const tracks = await adapter.listTracks({ includeHidden: true });

    expect(dryRun.ok).toBe(true);
    expect(dryRun.changed).toBe(false);
    expect(dryRun.preview).toBeDefined();
    expect(tracks).toHaveLength(0);
  });

  it("requires confirmation for destructive track deletion", async () => {
    const created = await controller.invoke(getToolDefinition("cubase.create_track"), {
      type: "audio",
      name: "Delete Me"
    });
    const trackId = (created.data as { tracks: Array<{ id: string }> }).tracks[0].id;

    const denied = await controller.invoke(getToolDefinition("cubase.delete_track"), {
      trackIds: [trackId]
    });

    expect(denied.ok).toBe(false);
    expect(denied.error?.code).toBe(ErrorCode.ConfirmationRequired);
    expect(denied.error?.details).toMatchObject({
      preview: {
        destructive: true,
        confirmationRequired: true,
        affectedObjects: [{ field: "trackIds", value: [trackId] }]
      }
    });
    expect(await adapter.listTracks({ includeHidden: true })).toHaveLength(1);
  });

  it("executes destructive action when confirmed", async () => {
    const created = await controller.invoke(getToolDefinition("cubase.create_track"), {
      type: "audio",
      name: "Delete Me"
    });
    const trackId = (created.data as { tracks: Array<{ id: string }> }).tracks[0].id;

    const deleted = await controller.invoke(getToolDefinition("cubase.delete_track"), {
      trackIds: [trackId],
      confirm: true
    });

    expect(deleted.ok).toBe(true);
    expect(await adapter.listTracks({ includeHidden: true })).toHaveLength(0);
  });

  it("blocks overwrite exports unless confirmed", async () => {
    const result = await controller.invoke(getToolDefinition("cubase.export_mixdown"), {
      path: "E:/Exports/mix.wav",
      overwrite: true
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe(ErrorCode.ConfirmationRequired);
  });

  it("serializes state-changing adapter calls", async () => {
    const originalExecute = adapter.execute.bind(adapter);
    let active = 0;
    let maximumActive = 0;
    adapter.execute = async (...args: Parameters<typeof adapter.execute>) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      try {
        return await originalExecute(...args);
      } finally {
        active -= 1;
      }
    };

    await Promise.all([
      controller.invoke(getToolDefinition("cubase.create_track"), { type: "audio", name: "A" }),
      controller.invoke(getToolDefinition("cubase.create_track"), { type: "audio", name: "B" })
    ]);
    expect(maximumActive).toBe(1);
  });
});
