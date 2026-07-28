import { Permission } from "../safety/PermissionModel.js";
import { AddInsertPluginInputShape, GetPluginParametersInputShape, ListPluginsInputShape, LoadInstrumentInputShape, LoadPluginPresetInputShape, PluginBooleanInputShape, PluginParameterInputShape, PluginTargetInputShape, LoadEffectInputShape, GetPluginParameterInputShape, PluginSidechainInputShape, InstrumentOutputInputShape, MultiOutputRoutingInputShape } from "../schemas/pluginSchemas.js";
import { readTool, writeTool, type ToolDefinition } from "./toolTypes.js";

export const pluginTools: ToolDefinition[] = [
  readTool("cubase.list_plugins", "List Plugins", "List plugin quick controls or bridge-provided plugin catalog.", "listPlugins", ListPluginsInputShape, Permission.Plugin),
  writeTool("cubase.load_instrument", "Load Instrument", "Load VST instrument. confirm:true is required because an occupied slot may be replaced.", "loadInstrument", LoadInstrumentInputShape, Permission.Plugin, { destructive: true }),
  writeTool("cubase.load_effect", "Load Effect", "Load a VST effect by DirectAccess plugin UID or companion bridge; occupied-slot replacement requires confirmation.", "loadEffect", LoadEffectInputShape, Permission.Plugin, { destructive: true }),
  writeTool("cubase.add_insert_plugin", "Add Insert Plugin", "Add or replace an insert plugin through DirectAccess/bridge; requires confirm:true.", "addInsertPlugin", AddInsertPluginInputShape, Permission.Plugin, { destructive: true }),
  writeTool("cubase.remove_insert_plugin", "Remove Insert Plugin", "Remove insert plugin. Destructive; requires bridge and confirm:true.", "removeInsertPlugin", PluginTargetInputShape, Permission.Plugin, { destructive: true }),
  writeTool("cubase.bypass_plugin", "Bypass Plugin", "Bypass plugin via quick control or bridge.", "bypassPlugin", PluginBooleanInputShape, Permission.Plugin),
  readTool("cubase.get_plugin_parameters", "Get Plugin Parameters", "Return focused/selected quick control parameters or bridge parameters.", "getPluginParameters", GetPluginParametersInputShape, Permission.Plugin),
  readTool("cubase.get_plugin_parameter", "Get Plugin Parameter", "Read one DirectAccess, Quick Control, or companion-bridge parameter.", "getPluginParameter", GetPluginParameterInputShape, Permission.Plugin),
  writeTool("cubase.set_plugin_parameter", "Set Plugin Parameter", "Set plugin quick control parameter now; arbitrary parameter IDs require VST3 companion bridge.", "setPluginParameter", PluginParameterInputShape, Permission.Plugin),
  writeTool("cubase.load_plugin_preset", "Load Plugin Preset", "Load plugin preset. Requires VST3 companion bridge for headless operation.", "loadPluginPreset", LoadPluginPresetInputShape, Permission.Plugin),
  writeTool("cubase.enable_plugin", "Enable Plugin", "Enable a plugin through DirectAccess or companion bridge.", "enablePlugin", PluginTargetInputShape, Permission.Plugin),
  writeTool("cubase.disable_plugin", "Disable Plugin", "Disable a plugin through DirectAccess or companion bridge.", "disablePlugin", PluginTargetInputShape, Permission.Plugin),
  writeTool("cubase.enable_sidechain", "Enable Sidechain", "Enable a plugin sidechain through DirectAccess or companion bridge.", "enableSidechain", PluginSidechainInputShape, Permission.Plugin),
  writeTool("cubase.open_plugin_window", "Open Plugin Window", "Set the plugin edit/open host parameter when exposed; no window interaction is performed.", "openPluginWindow", PluginTargetInputShape, Permission.Plugin),
  writeTool("cubase.close_plugin_window", "Close Plugin Window", "Clear the plugin edit/open host parameter when exposed; no window interaction is performed.", "closePluginWindow", PluginTargetInputShape, Permission.Plugin),
  writeTool("cubase.enable_instrument_output", "Enable Instrument Output", "Enable an instrument output through the companion bridge and routing layer.", "enableInstrumentOutput", InstrumentOutputInputShape, Permission.Plugin),
  writeTool("cubase.set_multi_output_routing", "Set Multi Output Routing", "Configure instrument multi-output routing through a Cubase-side bridge.", "setMultiOutputRouting", MultiOutputRoutingInputShape, Permission.Plugin)
];
