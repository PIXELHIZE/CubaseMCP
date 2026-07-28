import { describe, expect, it } from "vitest";
import { defaultCommandMappings } from "../../src/config/commandMappings.js";

describe("command registry", () => {
  it("contains unique MIDI bindings for required command candidates", () => {
    const required = [
      "track.add.audio", "track.add.midi", "track.add.instrument", "track.add.group", "track.add.fx", "track.add.folder",
      "track.add.marker", "track.add.tempo", "track.add.chord", "track.duplicate", "track.remove_selected", "midi.quantize",
      "audio.bounce_selection", "audio.crossfade", "audio.fade_in", "audio.fade_out", "audio.delete_overlaps", "audio.dissolve_part",
      "marker.add_position_selected", "marker.add_cycle_selected", "export.perform_current_audio_export", "undo", "redo", "midi.legato", "midi.fixed_length",
      "marker.add_position_active", "marker.add_cycle_active", "track.rename_selected", "render.current_settings"
    ];
    expect(required.filter((key) => !defaultCommandMappings[key])).toEqual([]);
    const addresses = required.map((key) => `${defaultCommandMappings[key].kind}:${defaultCommandMappings[key].channel}:${defaultCommandMappings[key].number}`);
    expect(new Set(addresses).size).toBe(addresses.length);
  });
});
