import { z } from "zod/v4";
import { Permission } from "../safety/PermissionModel.js";
import { BaseInputShape } from "../schemas/commonSchemas.js";
import { readTool, writeTool, type ToolDefinition } from "./toolTypes.js";

const DirectAccessRequestShape = {
  ...BaseInputShape,
  request: z.record(z.string(), z.unknown())
};

const DirectAccessRootShape = {
  ...BaseInputShape,
  root: z.enum(["trackSelection", "mixConsole", "focusedQuickControls", "transport"])
};

const ObjectIdShape = {
  ...BaseInputShape,
  objectId: z.number().int().nonnegative()
};

const ParameterShape = {
  ...BaseInputShape,
  objectId: z.number().int().nonnegative(),
  parameterTag: z.number().int().nonnegative()
};

const SetProcessValueShape = {
  ...ParameterShape,
  value: z.number().min(0).max(1)
};

const SetPlainValueShape = {
  ...ParameterShape,
  plainValue: z.number()
};

const PluginCollectionsShape = {
  ...BaseInputShape,
  pluginSlotObjectId: z.number().int().nonnegative()
};

const SetSlotPluginShape = {
  ...PluginCollectionsShape,
  pluginUid: z.string().min(1)
};

export const directAccessTools: ToolDefinition[] = [
  readTool("cubase.direct_access_get_capabilities", "DirectAccess Capabilities", "Return Cubase DirectAccess feature-detection result.", "directAccessGetCapabilities", BaseInputShape, Permission.Read),
  readTool("cubase.direct_access_request", "DirectAccess Request", "Send a structured DirectAccess request to the Cubase-side bridge.", "directAccessRequest", DirectAccessRequestShape, Permission.Read),
  readTool("cubase.direct_access_discover_object_tree", "DirectAccess Discover Object Tree", "Discover DirectAccess object tree from a supported root.", "directAccessDiscoverObjectTree", DirectAccessRootShape, Permission.Read),
  readTool("cubase.direct_access_get_object_metadata", "DirectAccess Object Metadata", "Get DirectAccess object metadata.", "directAccessGetObjectMetadata", ObjectIdShape, Permission.Read),
  readTool("cubase.direct_access_get_child_objects", "DirectAccess Child Objects", "Get child objects for a DirectAccess object.", "directAccessGetChildObjects", ObjectIdShape, Permission.Read),
  readTool("cubase.direct_access_get_parameters", "DirectAccess Parameters", "Get parameters for a DirectAccess object.", "directAccessGetParameters", ObjectIdShape, Permission.Read),
  readTool("cubase.direct_access_get_parameter", "DirectAccess Parameter", "Get one DirectAccess parameter.", "directAccessGetParameter", ParameterShape, Permission.Read),
  writeTool("cubase.direct_access_set_parameter_process_value", "DirectAccess Set Process Value", "Set a DirectAccess parameter process value.", "directAccessSetParameterProcessValue", SetProcessValueShape, Permission.Mixer),
  writeTool("cubase.direct_access_set_parameter_plain_value", "DirectAccess Set Plain Value", "Set a DirectAccess parameter plain value when conversion is exposed.", "directAccessSetParameterPlainValue", SetPlainValueShape, Permission.Mixer),
  readTool("cubase.direct_access_get_plugin_collections", "DirectAccess Plugin Collections", "Get plugin manager collections for a slot object.", "directAccessGetPluginCollections", PluginCollectionsShape, Permission.Plugin),
  writeTool("cubase.direct_access_set_slot_plugin", "DirectAccess Set Slot Plugin", "Set a plugin slot by plugin UID through DirectAccess plugin manager.", "directAccessSetSlotPlugin", SetSlotPluginShape, Permission.Plugin, { destructive: true }),
  writeTool("cubase.direct_access_reset_slot_plugin", "DirectAccess Reset Slot Plugin", "Remove the plugin from a DirectAccess slot through the API 1.3 plugin manager.", "directAccessResetSlotPlugin", PluginCollectionsShape, Permission.Plugin, { destructive: true }),
  readTool("cubase.direct_access_subscribe_object_changes", "DirectAccess Subscribe Object Changes", "Subscribe the bridge session to DirectAccess object change/removal events.", "directAccessSubscribeObjectChanges", BaseInputShape, Permission.Read),
  readTool("cubase.direct_access_subscribe_parameter_changes", "DirectAccess Subscribe Parameter Changes", "Subscribe the bridge session to parameter changes for one DirectAccess object.", "directAccessSubscribeParameterChanges", ObjectIdShape, Permission.Read)
];
