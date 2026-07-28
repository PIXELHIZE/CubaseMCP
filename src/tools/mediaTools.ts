import { Permission } from "../safety/PermissionModel.js";
import { CleanupMediaInputShape, EmptyInputShape, ExportSelectedEventInputShape, ImportMediaFileInputShape, MediaBaySearchInputShape, RelinkMediaInputShape } from "../schemas/mediaSchemas.js";
import { ExportMixdownInputShape } from "../schemas/exportSchemas.js";
import { readTool, writeTool, type ToolDefinition } from "./toolTypes.js";

export const mediaTools: ToolDefinition[] = [
  writeTool("cubase.import_audio_file", "Import Audio File", "Import an audio file through a verified Cubase-side bridge; no file picker automation.", "importAudioFile", ImportMediaFileInputShape, Permission.Media),
  writeTool("cubase.import_video_file", "Import Video File", "Import a video file through a Cubase-side bridge; no file picker automation.", "importVideoFile", ImportMediaFileInputShape, Permission.Media),
  writeTool("cubase.import_sample", "Import Sample", "Import a sample to a target track/plugin through a bridge.", "importSample", ImportMediaFileInputShape, Permission.Media),
  readTool("cubase.get_pool", "Get Pool", "Read media pool state exposed by the bridge/project cache.", "getPool", EmptyInputShape, Permission.Media),
  writeTool("cubase.clean_unused_media", "Clean Unused Media", "Remove unused pool entries; disk deletion requires confirm:true.", "cleanUnusedMedia", CleanupMediaInputShape, Permission.Media, { destructive: true }),
  writeTool("cubase.relink_missing_files", "Relink Missing Files", "Relink a missing media ID to an explicit path through the bridge.", "relinkMissingFiles", RelinkMediaInputShape, Permission.Media),
  readTool("cubase.search_media_bay", "Search MediaBay", "Search MediaBay through a Cubase-side bridge or return a bridge-required result.", "searchMediaBay", MediaBaySearchInputShape, Permission.Media),
  writeTool("cubase.export_selected_event", "Export Selected Event", "Export selected events through a bridge job.", "exportSelectedEvent", ExportSelectedEventInputShape, Permission.Export, { longRunning: true, mayOverwriteFiles: true }),
  writeTool("cubase.export_full_mix", "Export Full Mix", "Export the full mix through the headless export bridge.", "exportMixdown", ExportMixdownInputShape, Permission.Export, { longRunning: true, mayOverwriteFiles: true })
];
