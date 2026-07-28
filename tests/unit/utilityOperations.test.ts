import { describe, expect, it } from "vitest";
import { CompositeCubaseAdapter } from "../../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../../src/config/cubaseConfig.js";
import { ErrorCode } from "../../src/safety/ErrorCodes.js";

const context = { requestId: "utility-test", correlationId: "utility-test", toolName: "cubase.validate_operation", dryRun: false };

describe("utility operations", () => {
  it("validates against the target tool schema and returns its capability", async () => {
    const adapter = new CompositeCubaseAdapter(loadCubaseConfig({} as NodeJS.ProcessEnv));
    const result = await adapter.execute("validateOperation", {
      toolName: "cubase.set_track_pan",
      arguments: { trackId: "selected", pan: 0.25 }
    }, context);
    expect(result.data).toMatchObject({ toolName: "cubase.set_track_pan", valid: true, validatedArguments: { pan: 0.25 } });
  });

  it("rejects invalid target arguments with a machine-readable code", async () => {
    const adapter = new CompositeCubaseAdapter(loadCubaseConfig({} as NodeJS.ProcessEnv));
    await expect(adapter.execute("validateOperation", {
      toolName: "cubase.set_track_pan",
      arguments: { pan: 9 }
    }, context)).rejects.toMatchObject({ code: ErrorCode.ValidationFailed });
  });

  it("returns the target adapter dry-run preview without connecting", async () => {
    const adapter = new CompositeCubaseAdapter(loadCubaseConfig({} as NodeJS.ProcessEnv));
    const result = await adapter.execute("previewOperation", {
      toolName: "cubase.export_mixdown",
      arguments: { path: "E:/Exports/mix.wav", overwrite: true }
    }, { ...context, toolName: "cubase.preview_operation" });
    expect(result.data).toMatchObject({ toolName: "cubase.export_mixdown", valid: true });
    expect((result.data as { preview: unknown }).preview).toBeDefined();
  });

  it("rejects a missing import source before contacting any Cubase-side bridge", async () => {
    const adapter = new CompositeCubaseAdapter(loadCubaseConfig({} as NodeJS.ProcessEnv));
    await expect(adapter.execute("importAudioFile", {
      filePath: "E:/definitely-missing/cubase-mcp-audio.wav"
    }, { ...context, toolName: "cubase.import_audio_file" })).rejects.toMatchObject({ code: ErrorCode.ObjectNotFound });
  });
});
