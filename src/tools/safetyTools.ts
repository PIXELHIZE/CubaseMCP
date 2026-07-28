import { z } from "zod/v4";
import { Permission } from "../safety/PermissionModel.js";
import { BaseInputShape } from "../schemas/commonSchemas.js";
import { readTool, writeTool, type ToolDefinition } from "./toolTypes.js";

const UndoRedoInputShape = { ...BaseInputShape, steps: z.number().int().min(1).max(100).default(1).optional() };
const UndoSnapshotInputShape = { ...BaseInputShape, label: z.string().default("manual").optional() };
const PreviewValidateInputShape = { ...BaseInputShape, toolName: z.string().optional(), operation: z.string().optional(), arguments: z.record(z.string(), z.unknown()).default({}).optional() };
const TriggerCommandInputShape = { ...BaseInputShape, name: z.string().min(1), arguments: z.record(z.string(), z.unknown()).default({}).optional() };
const DiagnosticsInputShape = { ...BaseInputShape, includeSmoke: z.boolean().default(false).optional(), executeSafeCommands: z.boolean().default(false).optional() };

export const safetyTools: ToolDefinition[] = [
  writeTool("cubase.undo", "Undo", "Trigger user-mapped Cubase undo command. Requires mapping in real mode.", "undo", UndoRedoInputShape, Permission.Project, { createsUndoSnapshot: false }),
  writeTool("cubase.redo", "Redo", "Trigger user-mapped Cubase redo command. Requires mapping in real mode.", "redo", UndoRedoInputShape, Permission.Project, { createsUndoSnapshot: false }),
  writeTool("cubase.create_undo_snapshot", "Create Undo Snapshot", "Create MCP state snapshot metadata; native Cubase undo requires Cubase support.", "createUndoSnapshot", UndoSnapshotInputShape, Permission.Project, { createsUndoSnapshot: false }),
  readTool("cubase.preview_operation", "Preview Operation", "Return dry-run/capability preview for an operation.", "previewOperation", PreviewValidateInputShape, Permission.Read),
  readTool("cubase.validate_operation", "Validate Operation", "Validate operation arguments and capability before execution.", "validateOperation", PreviewValidateInputShape, Permission.Read),
  writeTool("cubase.trigger_command", "Trigger Command", "Trigger a user-mapped Cubase command surface MIDI message.", "triggerCommand", TriggerCommandInputShape, Permission.Macro, { createsUndoSnapshot: false }),
  writeTool("cubase.execute_macro", "Execute Macro", "Execute an explicitly registered Cubase command/macro through MIDI Remote command binding.", "executeMacro", TriggerCommandInputShape, Permission.Macro, { createsUndoSnapshot: false }),
  readTool("cubase.get_capabilities", "Get Capabilities", "Return adapter and tool capability metadata without claiming unverified real support.", "getCapabilities", BaseInputShape, Permission.Read),
  writeTool("cubase.run_diagnostics", "Run Diagnostics", "Run connection/DirectAccess/command diagnostics as a job and return evidence paths.", "runDiagnostics", DiagnosticsInputShape, Permission.Read, { createsUndoSnapshot: false, requiresProject: false, longRunning: true }),
  readTool("cubase.discover_direct_access", "Discover DirectAccess", "Discover DirectAccess capabilities and root trees.", "discoverDirectAccess", BaseInputShape, Permission.Read),
  readTool("cubase.audit_command_bindings", "Audit Command Bindings", "Audit the Cubase-side command registry and canPerform values.", "auditCommandBindings", DiagnosticsInputShape, Permission.Read),
  readTool("cubase.command_binding_get_registry", "Command Binding Registry", "Return Cubase-side MIDI Remote command binding registry and canPerform data where available.", "commandBindingGetRegistry", BaseInputShape, Permission.Read),
  readTool("cubase.command_binding_can_perform", "Command Binding Can Perform", "Check canPerform for a registered Cubase command binding.", "commandBindingCanPerform", { ...BaseInputShape, key: z.string().min(1) }, Permission.Read)
];
