import { Permission } from "../safety/PermissionModel.js";
import { AddMidiNoteInputShape, ApplyDrumMapInputShape, ChordProgressionInputShape, CreateMidiPartInputShape, DeleteMidiNotesInputShape, EditMidiNotesInputShape, HumanizeMidiInputShape, MidiPartIdInputShape, QuantizeMidiInputShape, TransposeMidiInputShape, CopyMidiPartInputShape, MoveMidiPartInputShape, MidiNoteIdInputShape, EditMidiNoteInputShape, MidiVelocityInputShape, MidiControllerInputShape, MidiTransformInputShape, CreateChordInputShape, ImportMidiFileInputShape, GeneratedMidiPartInputShape } from "../schemas/midiSchemas.js";
import { writeTool, type ToolDefinition } from "./toolTypes.js";

export const midiTools: ToolDefinition[] = [
  writeTool("cubase.create_midi_part", "Create MIDI Part", "Create MIDI part through Cubase-side bridge.", "createMidiPart", CreateMidiPartInputShape, Permission.EditMidi),
  writeTool("cubase.delete_midi_part", "Delete MIDI Part", "Delete MIDI part. Requires bridge and confirm:true.", "deleteMidiPart", MidiPartIdInputShape, Permission.EditMidi, { destructive: true }),
  writeTool("cubase.copy_midi_part", "Copy MIDI Part", "Copy a MIDI part through the bridge or generated-file workflow.", "copyMidiPart", CopyMidiPartInputShape, Permission.EditMidi),
  writeTool("cubase.move_midi_part", "Move MIDI Part", "Move a MIDI part through the Cubase-side bridge.", "moveMidiPart", MoveMidiPartInputShape, Permission.EditMidi),
  writeTool("cubase.add_midi_note", "Add MIDI Note", "Add MIDI notes through Cubase-side bridge.", "addMidiNote", AddMidiNoteInputShape, Permission.EditMidi),
  writeTool("cubase.delete_midi_note", "Delete MIDI Note", "Delete one MIDI note; requires confirm:true.", "deleteMidiNote", MidiNoteIdInputShape, Permission.EditMidi, { destructive: true }),
  writeTool("cubase.edit_midi_note", "Edit MIDI Note", "Edit one MIDI note through a bridge or regenerate the source MIDI file.", "editMidiNote", EditMidiNoteInputShape, Permission.EditMidi),
  writeTool("cubase.edit_midi_notes", "Edit MIDI Notes", "Edit MIDI notes through Cubase-side bridge.", "editMidiNotes", EditMidiNotesInputShape, Permission.EditMidi),
  writeTool("cubase.delete_midi_notes", "Delete MIDI Notes", "Delete MIDI notes. Requires confirm:true.", "deleteMidiNotes", DeleteMidiNotesInputShape, Permission.EditMidi, { destructive: true }),
  writeTool("cubase.set_midi_velocity", "Set MIDI Velocity", "Set note velocity through a bridge or generated-file regeneration.", "setMidiVelocity", MidiVelocityInputShape, Permission.EditMidi),
  writeTool("cubase.edit_midi_controller", "Edit MIDI Controller", "Write controller-lane events through a bridge or generated MIDI file.", "editMidiController", MidiControllerInputShape, Permission.EditMidi),
  writeTool("cubase.edit_pitch_bend", "Edit Pitch Bend", "Write pitch-bend events through a bridge or generated MIDI file.", "editPitchBend", MidiControllerInputShape, Permission.EditMidi),
  writeTool("cubase.edit_modulation", "Edit Modulation", "Write modulation events through a bridge or generated MIDI file.", "editModulation", MidiControllerInputShape, Permission.EditMidi),
  writeTool("cubase.edit_sustain_pedal", "Edit Sustain Pedal", "Write sustain-pedal events through a bridge or generated MIDI file.", "editSustainPedal", MidiControllerInputShape, Permission.EditMidi),
  writeTool("cubase.quantize_midi", "Quantize MIDI", "Quantize MIDI through Cubase-side bridge.", "quantizeMidi", QuantizeMidiInputShape, Permission.EditMidi),
  writeTool("cubase.humanize_midi", "Humanize MIDI", "Humanize MIDI through Cubase-side bridge.", "humanizeMidi", HumanizeMidiInputShape, Permission.EditMidi),
  writeTool("cubase.transpose_midi", "Transpose MIDI", "Transpose MIDI through Cubase-side bridge.", "transposeMidi", TransposeMidiInputShape, Permission.EditMidi),
  writeTool("cubase.apply_legato", "Apply Legato", "Apply the selection-dependent MIDI Legato command or bridge operation.", "applyLegato", MidiTransformInputShape, Permission.EditMidi),
  writeTool("cubase.apply_fixed_length", "Apply Fixed Length", "Apply fixed note length through a command binding or bridge.", "applyFixedLength", MidiTransformInputShape, Permission.EditMidi),
  writeTool("cubase.apply_drum_map", "Apply Drum Map", "Apply drum map through Cubase-side bridge.", "applyDrumMap", ApplyDrumMapInputShape, Permission.EditMidi),
  writeTool("cubase.apply_scale_assistant", "Apply Scale Assistant", "Apply Scale Assistant settings through a Cubase-side bridge.", "applyScaleAssistant", MidiTransformInputShape, Permission.EditMidi),
  writeTool("cubase.create_chord", "Create Chord", "Create a chord as MIDI notes or a chord-track event through the bridge.", "createChord", CreateChordInputShape, Permission.EditMidi),
  writeTool("cubase.create_chord_progression", "Create Chord Progression", "Create chord progression through Cubase-side bridge.", "createChordProgression", ChordProgressionInputShape, Permission.EditMidi),
  writeTool("cubase.import_midi_file", "Import MIDI File", "Import a MIDI file through a verified headless bridge; file-picker automation is not used.", "importMidiFile", ImportMidiFileInputShape, Permission.Media),
  writeTool("cubase.create_midi_part_from_generated_file", "Create MIDI Part From Generated File", "Generate a Standard MIDI File locally and ask the Cubase-side bridge to import it.", "createMidiPartFromGeneratedFile", GeneratedMidiPartInputShape, Permission.EditMidi)
];
