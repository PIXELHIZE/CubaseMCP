import { Permission } from "../safety/PermissionModel.js";
import { ChannelStripInputShape, EqBandInputShape, InputGainInputShape, MeterLevelsInputShape, PhaseInvertInputShape, RoutingInputShape, SendEnableInputShape, SendLevelInputShape, SidechainRoutingInputShape, TrackPanInputShape, TrackVolumeInputShape, AddSendInputShape, RemoveSendInputShape, GroupRoutingInputShape, VcaInputShape } from "../schemas/mixerSchemas.js";
import { PluginBooleanInputShape } from "../schemas/pluginSchemas.js";
import { readTool, writeTool, type ToolDefinition } from "./toolTypes.js";

export const mixerTools: ToolDefinition[] = [
  writeTool("cubase.set_track_volume", "Set Track Volume", "Set selected track volume through MIDI Remote.", "setTrackVolume", TrackVolumeInputShape, Permission.Mixer),
  writeTool("cubase.set_track_pan", "Set Track Pan", "Set selected track pan through MIDI Remote.", "setTrackPan", TrackPanInputShape, Permission.Mixer),
  writeTool("cubase.set_input_gain", "Set Input Gain", "Set selected track input gain through MIDI Remote mapped pre-filter gain.", "setInputGain", InputGainInputShape, Permission.Mixer),
  writeTool("cubase.set_phase_invert", "Set Phase Invert", "Set selected track phase invert through MIDI Remote mapped pre-filter phase.", "setPhaseInvert", PhaseInvertInputShape, Permission.Mixer),
  writeTool("cubase.set_send_level", "Set Send Level", "Set send level. Requires send mapped through MIDI Remote or Cubase-side bridge.", "setSendLevel", SendLevelInputShape, Permission.Mixer),
  writeTool("cubase.set_send_enable", "Set Send Enable", "Set send enable. Requires send mapped through MIDI Remote or Cubase-side bridge.", "setSendEnable", SendEnableInputShape, Permission.Mixer),
  writeTool("cubase.add_send", "Add Send", "Create/configure a send through DirectAccess where exposed or a bridge.", "addSend", AddSendInputShape, Permission.Mixer),
  writeTool("cubase.remove_send", "Remove Send", "Remove a send slot assignment; requires confirm:true.", "removeSend", RemoveSendInputShape, Permission.Mixer, { destructive: true }),
  writeTool("cubase.set_routing", "Set Routing", "Set routing through Cubase-side bridge.", "setRouting", RoutingInputShape, Permission.Mixer),
  writeTool("cubase.set_group_routing", "Set Group Routing", "Route tracks to a group through a Cubase-side bridge.", "setGroupRouting", GroupRoutingInputShape, Permission.Mixer),
  writeTool("cubase.set_sidechain_routing", "Set Sidechain Routing", "Set sidechain routing through Cubase-side bridge.", "setSidechainRouting", SidechainRoutingInputShape, Permission.Mixer),
  writeTool("cubase.set_eq_band", "Set EQ Band", "Set selected track EQ band if mapped, otherwise requires bridge.", "setEqBand", EqBandInputShape, Permission.Mixer),
  writeTool("cubase.set_channel_strip", "Set Channel Strip", "Set channel strip module through Cubase-side bridge or explicit mappings.", "setChannelStrip", ChannelStripInputShape, Permission.Mixer),
  writeTool("cubase.set_vca", "Set VCA", "Assign tracks to a VCA through a Cubase-side bridge.", "setVca", VcaInputShape, Permission.Mixer),
  writeTool("cubase.bypass_insert_plugin", "Bypass Insert Plugin", "Set insert bypass through DirectAccess or plugin bridge.", "bypassPlugin", PluginBooleanInputShape, Permission.Plugin),
  readTool("cubase.get_meter_levels", "Get Meter Levels", "Return cached meter levels from MIDI Remote host value events.", "getMeterLevels", MeterLevelsInputShape, Permission.Mixer)
];
