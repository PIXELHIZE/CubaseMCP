import { describe, expect, it, beforeEach } from "vitest";
import { MockCubaseAdapter } from "../src/adapters/MockCubaseAdapter.js";
import { SafetyController } from "../src/safety/SafetyController.js";
import { getToolDefinition } from "../src/tools/definitions.js";

describe("MockCubaseAdapter workflows", () => {
  let adapter: MockCubaseAdapter;
  let controller: SafetyController;

  beforeEach(async () => {
    adapter = new MockCubaseAdapter();
    await adapter.connect();
    controller = new SafetyController(adapter);
    await controller.invoke(getToolDefinition("cubase.create_project"), { name: "Workflow" });
  });

  it("builds a MIDI instrument workflow", async () => {
    const trackResult = await controller.invoke(getToolDefinition("cubase.create_track"), {
      type: "instrument",
      name: "Drums",
      instrumentName: "Groove Agent"
    });
    const trackId = (trackResult.data as { tracks: Array<{ id: string }> }).tracks[0].id;

    const pluginResult = await controller.invoke(getToolDefinition("cubase.add_insert_plugin"), {
      trackId,
      pluginName: "Groove Agent",
      slot: 0,
      confirm: true
    });
    expect(pluginResult.ok).toBe(true);

    const partResult = await controller.invoke(getToolDefinition("cubase.create_midi_part"), {
      trackId,
      start: "1.1.1.0",
      length: "4.0.0.0"
    });
    const partId = (partResult.data as { part: { id: string } }).part.id;

    const noteResult = await controller.invoke(getToolDefinition("cubase.add_midi_note"), {
      partId,
      notes: [{ pitch: 36, start: "1.1.1.0", length: "0.1.0.0", velocity: 120 }]
    });

    expect(noteResult.ok).toBe(true);
    const track = await adapter.getTrack(trackId);
    expect(track.inserts[0].name).toBe("Groove Agent");
    expect(track.parts[0].notes).toHaveLength(1);
  });

  it("returns job id for export", async () => {
    const exportResult = await controller.invoke(getToolDefinition("cubase.export_mixdown"), {
      path: "E:/Exports/mix.wav",
      confirm: true
    });

    expect(exportResult.ok).toBe(true);
    expect(exportResult.job?.id).toMatch(/^job_/);
    expect(exportResult.job?.status).toBe("completed");
  });

  it("undo restores previous snapshot", async () => {
    const created = await controller.invoke(getToolDefinition("cubase.create_track"), {
      type: "audio",
      name: "Guitar"
    });
    expect(created.ok).toBe(true);
    expect(await adapter.listTracks({ includeHidden: true })).toHaveLength(1);

    const undo = await controller.invoke(getToolDefinition("cubase.undo"), { steps: 1 });

    expect(undo.ok).toBe(true);
    expect(await adapter.listTracks({ includeHidden: true })).toHaveLength(0);
  });
});
