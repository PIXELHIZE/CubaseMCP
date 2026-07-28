import { Permission } from "../safety/PermissionModel.js";
import { AddCycleMarkerInputShape, AddMarkerInputShape, AddTempoEventInputShape, ArrangerChainInputShape, ArrangerEventInputShape, EmptyInputShape, MarkerIdInputShape, SetTempoInputShape, TimeSignatureInputShape, UpdateMarkerInputShape, DuplicateSectionInputShape, ReorderSectionInputShape, SongStructureAnalysisInputShape } from "../schemas/markerSchemas.js";
import { readTool, writeTool, type ToolDefinition } from "./toolTypes.js";

export const markerTools: ToolDefinition[] = [
  readTool("cubase.get_tempo", "Get Tempo", "Return cached tempo from MIDI Remote state where available.", "getTempo", EmptyInputShape, Permission.Project),
  writeTool("cubase.set_tempo", "Set Tempo", "Set tempo through user mapping or Cubase-side bridge.", "setTempo", SetTempoInputShape, Permission.Project),
  writeTool("cubase.add_tempo_event", "Add Tempo Event", "Add tempo event through user mapping or Cubase-side bridge.", "addTempoEvent", AddTempoEventInputShape, Permission.Project),
  writeTool("cubase.set_time_signature", "Set Time Signature", "Set time signature through user mapping or Cubase-side bridge.", "setTimeSignature", TimeSignatureInputShape, Permission.Project),
  writeTool("cubase.add_marker", "Add Marker", "Add marker through user mapping or Cubase-side bridge.", "addMarker", AddMarkerInputShape, Permission.Project),
  writeTool("cubase.delete_marker", "Delete Marker", "Delete marker. Requires confirm:true.", "deleteMarker", MarkerIdInputShape, Permission.Project, { destructive: true }),
  writeTool("cubase.update_marker", "Update Marker", "Update marker through user mapping or Cubase-side bridge.", "updateMarker", UpdateMarkerInputShape, Permission.Project),
  writeTool("cubase.move_marker", "Move Marker", "Move a marker through the bridge.", "moveMarker", UpdateMarkerInputShape, Permission.Project),
  writeTool("cubase.rename_marker", "Rename Marker", "Rename a marker through the bridge.", "renameMarker", UpdateMarkerInputShape, Permission.Project),
  writeTool("cubase.add_cycle_marker", "Add Cycle Marker", "Add cycle marker through user mapping or Cubase-side bridge.", "addCycleMarker", AddCycleMarkerInputShape, Permission.Project),
  writeTool("cubase.create_arranger_event", "Create Arranger Event", "Create arranger event through Cubase-side bridge.", "createArrangerEvent", ArrangerEventInputShape, Permission.Project),
  writeTool("cubase.create_arranger_chain", "Create Arranger Chain", "Create an arranger chain through a Cubase-side bridge.", "createArrangerChain", ArrangerChainInputShape, Permission.Project),
  writeTool("cubase.reorder_arranger_chain", "Reorder Arranger Chain", "Reorder arranger chain through Cubase-side bridge.", "reorderArrangerChain", ArrangerChainInputShape, Permission.Project),
  writeTool("cubase.duplicate_section", "Duplicate Section", "Duplicate an arranger/range section through the bridge.", "duplicateSection", DuplicateSectionInputShape, Permission.Project),
  writeTool("cubase.reorder_section", "Reorder Section", "Reorder an arranger section through the bridge.", "reorderSection", ReorderSectionInputShape, Permission.Project),
  readTool("cubase.analyze_song_structure", "Analyze Song Structure", "Analyze markers, arranger events, tempo and optional bridge audio features as a job.", "analyzeSongStructure", SongStructureAnalysisInputShape, Permission.Project)
];
