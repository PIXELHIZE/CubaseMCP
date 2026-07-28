import { Permission } from "../safety/PermissionModel.js";
import {
  AutomationCurveInputShape,
  AutomationModeInputShape,
  AutomationPointIdInputShape,
  AutomationPointInputShape,
  CreateAutomationLaneInputShape,
  EditAutomationPointInputShape,
  SmoothAutomationInputShape,
  TrimAutomationInputShape,
  WriteAutomationInputShape
} from "../schemas/automationSchemas.js";
import { writeTool, type ToolDefinition } from "./toolTypes.js";

export const automationTools: ToolDefinition[] = [
  writeTool("cubase.create_automation_lane", "Create Automation Lane", "Create/show an automation lane through DirectAccess or a Cubase-side bridge.", "createAutomationLane", CreateAutomationLaneInputShape, Permission.Automation),
  writeTool("cubase.add_automation_point", "Add Automation Point", "Add an automation point through the Cubase-side bridge.", "addAutomationPoint", AutomationPointInputShape, Permission.Automation),
  writeTool("cubase.delete_automation_point", "Delete Automation Point", "Delete an automation point; requires confirm:true.", "deleteAutomationPoint", AutomationPointIdInputShape, Permission.Automation, { destructive: true }),
  writeTool("cubase.edit_automation_point", "Edit Automation Point", "Edit an automation point through the bridge.", "editAutomationPoint", EditAutomationPointInputShape, Permission.Automation),
  writeTool("cubase.set_automation_curve", "Set Automation Curve", "Set curve shape/tension for automation points.", "setAutomationCurve", AutomationCurveInputShape, Permission.Automation),
  writeTool("cubase.set_automation_read", "Set Automation Read", "Set selected/arbitrary track automation read via DirectAccess or bridge.", "setAutomationRead", AutomationModeInputShape, Permission.Automation),
  writeTool("cubase.set_automation_write", "Set Automation Write", "Set selected/arbitrary track automation write via DirectAccess or bridge.", "setAutomationWrite", AutomationModeInputShape, Permission.Automation),
  writeTool("cubase.write_volume_automation", "Write Volume Automation", "Write volume automation points through the bridge.", "writeVolumeAutomation", WriteAutomationInputShape, Permission.Automation),
  writeTool("cubase.write_pan_automation", "Write Pan Automation", "Write pan automation points through the bridge.", "writePanAutomation", WriteAutomationInputShape, Permission.Automation),
  writeTool("cubase.write_plugin_parameter_automation", "Write Plugin Parameter Automation", "Write plugin parameter automation through DirectAccess/bridge parameter IDs.", "writePluginParameterAutomation", WriteAutomationInputShape, Permission.Automation),
  writeTool("cubase.write_send_automation", "Write Send Automation", "Write send automation points through the bridge.", "writeSendAutomation", WriteAutomationInputShape, Permission.Automation),
  writeTool("cubase.write_tempo_automation", "Write Tempo Automation", "Write tempo automation events through the bridge.", "writeTempoAutomation", WriteAutomationInputShape, Permission.Automation),
  writeTool("cubase.smooth_automation", "Smooth Automation", "Smooth automation values over a range.", "smoothAutomation", SmoothAutomationInputShape, Permission.Automation),
  writeTool("cubase.trim_automation", "Trim Automation", "Trim automation values by a delta over a range.", "trimAutomation", TrimAutomationInputShape, Permission.Automation)
];
