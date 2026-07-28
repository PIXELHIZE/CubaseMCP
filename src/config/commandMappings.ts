export type MidiCommandKind = "cc" | "note" | "program";

export interface MidiCommandMapping {
  name: string;
  kind: MidiCommandKind;
  channel: number;
  number: number;
  value?: number;
  description?: string;
  requiresVerification?: boolean;
}

export const defaultCommandMappings: Record<string, MidiCommandMapping> = {
  "transport.play": { name: "transport.play", kind: "cc", channel: 0, number: 20, value: 127 },
  "transport.stop": { name: "transport.stop", kind: "cc", channel: 0, number: 21, value: 127 },
  "transport.record": { name: "transport.record", kind: "cc", channel: 0, number: 22, value: 127 },
  "transport.rewind": { name: "transport.rewind", kind: "cc", channel: 0, number: 23, value: 127 },
  "transport.forward": { name: "transport.forward", kind: "cc", channel: 0, number: 24, value: 127 },
  "transport.cycle": { name: "transport.cycle", kind: "cc", channel: 0, number: 25 },
  "transport.metronome": { name: "transport.metronome", kind: "cc", channel: 0, number: 26 },
  "selected.volume": { name: "selected.volume", kind: "cc", channel: 0, number: 30 },
  "selected.pan": { name: "selected.pan", kind: "cc", channel: 0, number: 31 },
  "selected.mute": { name: "selected.mute", kind: "cc", channel: 0, number: 32 },
  "selected.solo": { name: "selected.solo", kind: "cc", channel: 0, number: 33 },
  "selected.recordEnable": { name: "selected.recordEnable", kind: "cc", channel: 0, number: 34 },
  "selected.monitor": { name: "selected.monitor", kind: "cc", channel: 0, number: 35 },
  "selected.inputGain": { name: "selected.inputGain", kind: "cc", channel: 0, number: 36 },
  "selected.phaseInvert": { name: "selected.phaseInvert", kind: "cc", channel: 0, number: 37 },
  "track.add.audio": { name: "track.add.audio", kind: "cc", channel: 0, number: 80, value: 127, description: "MIDI Remote command binding: Add Track > Audio" },
  "track.add.midi": { name: "track.add.midi", kind: "cc", channel: 0, number: 81, value: 127, description: "MIDI Remote command binding: Add Track > MIDI" },
  "track.add.instrument": { name: "track.add.instrument", kind: "cc", channel: 0, number: 82, value: 127, description: "MIDI Remote command binding: Add Track > Instrument", requiresVerification: true },
  "track.add.group": { name: "track.add.group", kind: "cc", channel: 0, number: 83, value: 127, description: "MIDI Remote command binding: Add Track > Group" },
  "track.add.fx": { name: "track.add.fx", kind: "cc", channel: 0, number: 84, value: 127, description: "MIDI Remote command binding: Add Track > FX", requiresVerification: true },
  "track.add.folder": { name: "track.add.folder", kind: "cc", channel: 0, number: 85, value: 127, description: "MIDI Remote command binding: Add Track > Folder" },
  "track.add.marker": { name: "track.add.marker", kind: "cc", channel: 0, number: 86, value: 127, description: "MIDI Remote command binding: Add Track > Marker" },
  "track.add.tempo": { name: "track.add.tempo", kind: "cc", channel: 0, number: 87, value: 127, description: "MIDI Remote command binding: Add Track > Tempo" },
  "track.add.chord": { name: "track.add.chord", kind: "cc", channel: 0, number: 88, value: 127, description: "MIDI Remote command binding: Add Track > Chord" },
  "track.duplicate": { name: "track.duplicate", kind: "cc", channel: 0, number: 89, value: 127, description: "MIDI Remote command binding: Project > Duplicate Tracks", requiresVerification: true },
  "track.remove_selected": { name: "track.remove_selected", kind: "cc", channel: 0, number: 90, value: 127, description: "MIDI Remote command binding: Remove Selected Tracks", requiresVerification: true },
  "midi.quantize": { name: "midi.quantize", kind: "cc", channel: 0, number: 91, value: 127, description: "MIDI Remote command binding: Quantize", requiresVerification: true },
  "audio.bounce_selection": { name: "audio.bounce_selection", kind: "cc", channel: 0, number: 92, value: 127, description: "MIDI Remote command binding: Bounce Selection", requiresVerification: true },
  "audio.crossfade": { name: "audio.crossfade", kind: "cc", channel: 0, number: 93, value: 127, description: "MIDI Remote command binding: Crossfade", requiresVerification: true },
  "audio.fade_in": { name: "audio.fade_in", kind: "cc", channel: 0, number: 94, value: 127, description: "MIDI Remote command binding: Apply Standard Fade In", requiresVerification: true },
  "audio.fade_out": { name: "audio.fade_out", kind: "cc", channel: 0, number: 95, value: 127, description: "MIDI Remote command binding: Apply Standard Fade Out", requiresVerification: true },
  "audio.delete_overlaps": { name: "audio.delete_overlaps", kind: "cc", channel: 0, number: 96, value: 127, description: "MIDI Remote command binding: Delete Overlaps", requiresVerification: true },
  "audio.dissolve_part": { name: "audio.dissolve_part", kind: "cc", channel: 0, number: 97, value: 127, description: "MIDI Remote command binding: Dissolve Part", requiresVerification: true },
  "marker.add_position_selected": { name: "marker.add_position_selected", kind: "cc", channel: 0, number: 98, value: 127, description: "MIDI Remote command binding: Add Position Marker on Selected Track", requiresVerification: true },
  "marker.add_cycle_selected": { name: "marker.add_cycle_selected", kind: "cc", channel: 0, number: 99, value: 127, description: "MIDI Remote command binding: Add Cycle Marker on Selected Track", requiresVerification: true },
  "export.perform_current_audio_export": { name: "export.perform_current_audio_export", kind: "cc", channel: 0, number: 100, value: 127, description: "MIDI Remote command binding: Audio Export > Perform Audio Export", requiresVerification: true },
  "undo": { name: "undo", kind: "cc", channel: 0, number: 101, value: 127, description: "MIDI Remote command binding: Edit > Undo" },
  "redo": { name: "redo", kind: "cc", channel: 0, number: 102, value: 127, description: "MIDI Remote command binding: Edit > Redo" },
  "midi.legato": { name: "midi.legato", kind: "cc", channel: 0, number: 103, value: 127, description: "MIDI Remote command binding: MIDI > Legato", requiresVerification: true },
  "midi.fixed_length": { name: "midi.fixed_length", kind: "cc", channel: 0, number: 104, value: 127, description: "MIDI Remote command binding: MIDI > Fixed Lengths", requiresVerification: true },
  "marker.add_position_active": { name: "marker.add_position_active", kind: "cc", channel: 0, number: 105, value: 127, description: "MIDI Remote command binding: Marker > Add Position Marker on Active Track", requiresVerification: true },
  "marker.add_cycle_active": { name: "marker.add_cycle_active", kind: "cc", channel: 0, number: 106, value: 127, description: "MIDI Remote command binding: Marker > Add Cycle Marker on Active Track", requiresVerification: true },
  "track.rename_selected": { name: "track.rename_selected", kind: "cc", channel: 0, number: 107, value: 127, description: "MIDI Remote command binding: Edit > Rename First Selected Track", requiresVerification: true },
  "render.current_settings": { name: "render.current_settings", kind: "cc", channel: 0, number: 108, value: 127, description: "MIDI Remote command binding: Render in Place > Render (with Current Settings)", requiresVerification: true }
};

export function quickControlMapping(index: number, focused = false): MidiCommandMapping {
  if (index < 0 || index > 7) throw new Error(`Quick control index out of range: ${index}`);
  return {
    name: `${focused ? "focused" : "selected"}.quickControl.${index}`,
    kind: "cc",
    channel: 0,
    number: (focused ? 50 : 40) + index
  };
}
