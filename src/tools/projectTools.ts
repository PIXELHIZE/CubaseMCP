import { Permission } from "../safety/PermissionModel.js";
import {
  CloseProjectInputShape,
  CreateBackupInputShape,
  CreateProjectInputShape,
  EmptyInputShape,
  ProjectPathInputShape,
  SaveProjectAsInputShape,
  SaveProjectInputShape,
  SetBitDepthInputShape,
  SetFrameRateInputShape,
  SetSampleRateInputShape,
  ApplyProjectTemplateInputShape
} from "../schemas/projectSchemas.js";
import { readTool, writeTool, type ToolDefinition } from "./toolTypes.js";

export const projectTools: ToolDefinition[] = [
  readTool("cubase.get_status", "Get Status", "Return Cubase state plus capability matrix.", "getStatus", EmptyInputShape),
  readTool("cubase.get_project", "Get Project", "Return cached project state exposed by the headless bridge.", "getProject", EmptyInputShape),
  readTool("cubase.get_project_path", "Get Project Path", "Return the project path when exposed by the Cubase-side bridge.", "getProjectPath", EmptyInputShape),
  readTool("cubase.get_project_metadata", "Get Project Metadata", "Return cached and bridge-discovered project metadata.", "getProjectMetadata", EmptyInputShape),
  writeTool("cubase.create_project", "Create Project", "Create a project through a Cubase-side headless bridge. Blocked without that bridge.", "createProject", CreateProjectInputShape, Permission.Project, { requiresProject: false }),
  writeTool("cubase.open_project", "Open Project", "Open a project path through a Cubase-side headless bridge. Blocked without that bridge.", "openProject", ProjectPathInputShape, Permission.Project, { requiresProject: false }),
  writeTool("cubase.save_project", "Save Project", "Save current project. Headless implementation requires Cubase-side bridge.", "saveProject", SaveProjectInputShape, Permission.Project, { mayOverwriteFiles: true }),
  writeTool("cubase.save_project_as", "Save Project As", "Save project to a new path. overwrite requires confirm:true.", "saveProjectAs", SaveProjectAsInputShape, Permission.Project, { mayOverwriteFiles: true }),
  writeTool("cubase.close_project", "Close Project", "Close project. Destructive and blocked without Cubase-side bridge.", "closeProject", CloseProjectInputShape, Permission.Project, { destructive: true }),
  writeTool("cubase.create_backup", "Create Backup", "Create a project backup through a Cubase-side bridge.", "createBackup", CreateBackupInputShape, Permission.Project),
  writeTool("cubase.create_project_backup", "Create Project Backup", "Create a project backup job through the Cubase-side bridge.", "createBackup", CreateBackupInputShape, Permission.Project, { longRunning: true }),
  writeTool("cubase.apply_project_template", "Apply Project Template", "Apply a project template through a Cubase-side bridge; command bindings cannot pass template paths.", "applyProjectTemplate", ApplyProjectTemplateInputShape, Permission.Project),
  writeTool("cubase.set_sample_rate", "Set Sample Rate", "Set project sample rate through a Cubase-side bridge.", "setSampleRate", SetSampleRateInputShape, Permission.Project),
  writeTool("cubase.set_bit_depth", "Set Bit Depth", "Set project bit depth through a Cubase-side bridge.", "setBitDepth", SetBitDepthInputShape, Permission.Project),
  writeTool("cubase.set_frame_rate", "Set Frame Rate", "Set project frame rate through a Cubase-side bridge.", "setFrameRate", SetFrameRateInputShape, Permission.Project)
];
