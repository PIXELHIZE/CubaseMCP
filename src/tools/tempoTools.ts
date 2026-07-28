import { Permission } from "../safety/PermissionModel.js";
import { ArrangerControlInputShape, ChordTrackUpdateInputShape, EmptyInputShape, KeySignatureInputShape, ScaleInputShape, TempoEventIdInputShape, TempoMapInputShape } from "../schemas/tempoSchemas.js";
import { readTool, writeTool, type ToolDefinition } from "./toolTypes.js";

export const tempoTools: ToolDefinition[] = [
  writeTool("cubase.create_tempo_map", "Create Tempo Map", "Create or replace a tempo map through a Cubase-side bridge.", "createTempoMap", TempoMapInputShape, Permission.Project),
  writeTool("cubase.delete_tempo_event", "Delete Tempo Event", "Delete a tempo event; requires confirm:true.", "deleteTempoEvent", TempoEventIdInputShape, Permission.Project, { destructive: true }),
  writeTool("cubase.set_key_signature", "Set Key Signature", "Set key signature through the chord/key bridge path.", "setKeySignature", KeySignatureInputShape, Permission.Project),
  readTool("cubase.get_chord_track", "Get Chord Track", "Read cached or bridge-discovered chord track events.", "getChordTrack", EmptyInputShape, Permission.Project),
  writeTool("cubase.update_chord_track", "Update Chord Track", "Create/update chord track events through a bridge.", "updateChordTrack", ChordTrackUpdateInputShape, Permission.Project),
  writeTool("cubase.set_scale", "Set Scale", "Set Scale Assistant/chord track scale through a bridge.", "setScale", ScaleInputShape, Permission.Project),
  writeTool("cubase.control_arranger_track", "Control Arranger Track", "Control arranger playback/flattening through command binding or bridge.", "controlArrangerTrack", ArrangerControlInputShape, Permission.Project)
];
