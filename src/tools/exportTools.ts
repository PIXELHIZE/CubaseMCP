import { Permission } from "../safety/PermissionModel.js";
import { BatchExportInputShape, CancelExportJobInputShape, CurrentExportInputShape, ExportBitDepthInputShape, ExportFilenamePatternInputShape, ExportFormatInputShape, ExportJobsInputShape, ExportLoudnessInputShape, ExportMixdownInputShape, ExportRangeInputShape, ExportRealtimeInputShape, ExportSampleRateInputShape, ExportSelectedInputShape, ExportSettingsInputShape, ExportStemsInputShape } from "../schemas/exportSchemas.js";
import { readTool, writeTool, type ToolDefinition } from "./toolTypes.js";

export const exportTools: ToolDefinition[] = [
  writeTool("cubase.export_mixdown", "Export Mixdown", "Headless mixdown export requires Cubase-side bridge; dialog automation is disallowed.", "exportMixdown", ExportMixdownInputShape, Permission.Export, { mayOverwriteFiles: true, longRunning: true }),
  writeTool("cubase.export_stems", "Export Stems", "Headless stems export requires Cubase-side bridge; dialog automation is disallowed.", "exportStems", ExportStemsInputShape, Permission.Export, { mayOverwriteFiles: true, longRunning: true }),
  writeTool("cubase.export_selected_tracks", "Export Selected Tracks", "Headless selected-track export requires Cubase-side bridge.", "exportSelectedTracks", ExportSelectedInputShape, Permission.Export, { mayOverwriteFiles: true, longRunning: true }),
  writeTool("cubase.export_selected_events", "Export Selected Events", "Headless selected-event export requires Cubase-side bridge.", "exportSelectedEvents", ExportSelectedInputShape, Permission.Export, { mayOverwriteFiles: true, longRunning: true }),
  writeTool("cubase.batch_export", "Batch Export", "Headless batch export requires Cubase-side bridge.", "batchExport", BatchExportInputShape, Permission.Export, { mayOverwriteFiles: true, longRunning: true }),
  writeTool("cubase.set_export_settings", "Set Export Settings", "Set export settings for a Cubase-side bridge export job.", "setExportSettings", ExportSettingsInputShape, Permission.Export),
  writeTool("cubase.set_export_filename_pattern", "Set Export Filename Pattern", "Set filename pattern through the export bridge.", "setExportFilenamePattern", ExportFilenamePatternInputShape, Permission.Export),
  writeTool("cubase.set_export_loudness_target", "Set Export Loudness Target", "Set loudness/true-peak targets through the export bridge.", "setExportLoudnessTarget", ExportLoudnessInputShape, Permission.Export),
  writeTool("cubase.set_export_format", "Set Export Format", "Set export format through the export bridge.", "setExportFormat", ExportFormatInputShape, Permission.Export),
  writeTool("cubase.set_export_sample_rate", "Set Export Sample Rate", "Set export sample rate through the export bridge.", "setExportSampleRate", ExportSampleRateInputShape, Permission.Export),
  writeTool("cubase.set_export_bit_depth", "Set Export Bit Depth", "Set export bit depth through the export bridge.", "setExportBitDepth", ExportBitDepthInputShape, Permission.Export),
  writeTool("cubase.set_export_range", "Set Export Range", "Set export range through the export bridge.", "setExportRange", ExportRangeInputShape, Permission.Export),
  writeTool("cubase.set_export_realtime", "Set Export Realtime", "Set realtime/offline export mode through the export bridge.", "setExportRealtime", ExportRealtimeInputShape, Permission.Export),
  readTool("cubase.get_export_jobs", "Get Export Jobs", "List export jobs and progress.", "getExportJobs", ExportJobsInputShape, Permission.Export),
  writeTool("cubase.cancel_export_job", "Cancel Export Job", "Cancel a queued/running export bridge job.", "cancelExportJob", CancelExportJobInputShape, Permission.Export, { createsUndoSnapshot: false }),
  writeTool("cubase.perform_current_audio_export", "Perform Current Audio Export", "Run MIDI Remote command binding Audio Export > Perform Audio Export using current Cubase export settings.", "performCurrentAudioExport", CurrentExportInputShape, Permission.Export, { destructive: true, longRunning: true, mayOverwriteFiles: true })
];
