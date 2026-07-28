import { z } from "zod/v4";
import { describe, expect, it } from "vitest";
import { getToolDefinition } from "../../src/tools/index.js";

function parse(toolName: string, input: unknown): Record<string, unknown> {
  return z.object(getToolDefinition(toolName).inputSchema).parse(input) as Record<string, unknown>;
}

describe("tool schema validation", () => {
  it("preserves explicit DirectAccess addresses on semantic plugin and mixer tools", () => {
    expect(parse("cubase.set_plugin_parameter", {
      parameterId: "42",
      objectId: 1001,
      parameterTag: 42,
      valueMode: "process",
      value: 0.75
    })).toMatchObject({ objectId: 1001, parameterTag: 42, value: 0.75 });

    expect(parse("cubase.add_insert_plugin", {
      pluginName: "Frequency",
      pluginSlotObjectId: 2001,
      pluginUid: "00112233445566778899AABBCCDDEEFF"
    })).toMatchObject({ pluginSlotObjectId: 2001, pluginUid: "00112233445566778899AABBCCDDEEFF" });
    expect(parse("cubase.remove_insert_plugin", { pluginSlotObjectId: 2001, confirm: true })).toMatchObject({ pluginSlotObjectId: 2001, confirm: true });

    expect(parse("cubase.set_eq_band", {
      band: 1,
      frequencyHz: 120,
      gainDb: -2,
      directAccessWrites: [{ objectId: 3001, parameterTag: 7, valueMode: "plain", value: 120 }]
    })).toMatchObject({ directAccessWrites: [{ objectId: 3001, parameterTag: 7, value: 120 }] });
  });

  it("rejects invalid ranges and malformed common options", () => {
    expect(() => parse("cubase.set_track_pan", { pan: 2 })).toThrow();
    expect(() => parse("cubase.set_plugin_parameter", { parameterId: "x", value: 0.5, timeoutMs: 10 })).toThrow();
    expect(() => parse("cubase.add_midi_note", { partId: "part", notes: [{ pitch: 128, start: "1.1.1.0", length: "0.1.0.0" }] })).toThrow();
  });

  it("keeps parameterized project, track, stem and generated-MIDI settings", () => {
    expect(parse("cubase.create_project", { name: "Session", directory: "E:/Sessions", sampleRate: 48000, bitDepth: 24 })).toMatchObject({ directory: "E:/Sessions", sampleRate: 48000, bitDepth: 24 });
    expect(parse("cubase.create_track_parameterized", { type: "instrument", name: "Bass", preset: "Mono Bass", instrumentName: "Retrologue", outputBus: "Bass Group" })).toMatchObject({ preset: "Mono Bass", instrumentName: "Retrologue", outputBus: "Bass Group" });
    expect(parse("cubase.export_stems", { destinationDirectory: "E:/Stems", sampleRate: 48000, bitDepth: 24, filenamePattern: "{trackName}" })).toMatchObject({ sampleRate: 48000, bitDepth: 24, filenamePattern: "{trackName}" });
    expect(parse("cubase.create_midi_part_from_generated_file", { name: "Beat", notes: [{ pitch: 36, start: "1.1.1.0", length: "0.1.0.0" }] })).toMatchObject({ name: "Beat" });
  });
});
