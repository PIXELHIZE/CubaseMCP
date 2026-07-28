import { ErrorCode } from "../safety/ErrorCodes.js";
import { toolDefinitions, type ToolDefinition } from "../tools/index.js";

export type CapabilityStatus =
  | "real"
  | "partial_direct_access"
  | "partial_command_binding"
  | "partial_current_setting_only"
  | "partial_selection_dependent"
  | "partial_bridge_required"
  | "mock_only"
  | "unknown_not_tested"
  | "blocked_by_no_headless_api"
  | "blocked_by_missing_cubase_side_bridge"
  | "blocked_by_cubase_api";

export type BlockerReason =
  | "none"
  | "not_tested_yet"
  | "cubase_api_not_exposed"
  | "requires_cubase_15_api_1_3"
  | "requires_user_mapping"
  | "requires_existing_selection"
  | "requires_existing_export_settings"
  | "requires_dialog_but_screen_automation_disallowed"
  | "requires_cubase_side_binary_bridge"
  | "not_yet_implemented";

export interface Capability {
  toolName: string;
  status: CapabilityStatus;
  primaryAdapter: string;
  fallbackAdapters: string[];
  requiresUserSetup: boolean;
  requiresCubaseFocus: false;
  usesScreenAutomation: false;
  requiresExistingSelection: boolean;
  requiresExistingExportSettings: boolean;
  destructive: boolean;
  supportsDryRun: boolean;
  supportsUndo: boolean;
  testedWithRealCubase: boolean;
  blockerReason: BlockerReason;
  limitations: string[];
}

const midiRemoteOperations = new Set([
  "getStatus",
  "getProject",
  "getPosition",
  "getTempo",
  "transportPlay",
  "transportStop",
  "transportPause",
  "transportRecord",
  "transportRewind",
  "transportForward",
  "setCycle",
  "setMetronome",
  "setTrackVolume",
  "setTrackPan",
  "setTrackMute",
  "setTrackSolo",
  "setTrackRecordEnable",
  "setTrackMonitor",
  "setInputGain",
  "setPhaseInvert",
  "getMeterLevels"
]);

const selectedOperations = new Set([
  "listTracks",
  "getTrack",
  "setTrackVolume",
  "setTrackPan",
  "setTrackMute",
  "setTrackSolo",
  "setTrackRecordEnable",
  "setTrackMonitor",
  "setInputGain",
  "setPhaseInvert",
  "setSendLevel",
  "setSendEnable",
  "setEqBand",
  "setChannelStrip",
  "getMeterLevels",
  "getPluginParameters",
  "getPluginParameter",
  "setPluginParameter",
  "bypassPlugin",
  "enablePlugin",
  "disablePlugin",
  "openPluginWindow",
  "closePluginWindow"
]);

const directAccessOperations = new Set([
  "directAccessRequest",
  "directAccessGetCapabilities",
  "directAccessDiscoverObjectTree",
  "directAccessGetObjectMetadata",
  "directAccessGetChildObjects",
  "directAccessGetParameters",
  "directAccessGetParameter",
  "directAccessSetParameterProcessValue",
  "directAccessSetParameterPlainValue",
  "directAccessGetPluginCollections",
  "directAccessSetSlotPlugin",
  "directAccessResetSlotPlugin",
  "directAccessSubscribeObjectChanges",
  "directAccessSubscribeParameterChanges",
  "discoverDirectAccess",
  "getPluginParameters",
  "getPluginParameter",
  "setPluginParameter",
  "addInsertPlugin",
  "removeInsertPlugin",
  "loadEffect",
  "loadInstrument",
  "setSendLevel",
  "setSendEnable",
  "setEqBand",
  "setAutomationRead",
  "setAutomationWrite",
  "openPluginWindow",
  "closePluginWindow"
]);

const commandOperations = new Set([
  "triggerCommand",
  "executeMacro",
  "commandBindingGetRegistry",
  "commandBindingCanPerform",
  "auditCommandBindings",
  "createTrackDefaultAudio",
  "createTrackDefaultMidi",
  "createTrackDefaultInstrument",
  "createTrackDefaultGroup",
  "createTrackDefaultFx",
  "createTrackDefaultFolder",
  "createTrackDefaultMarker",
  "createTrackDefaultTempo",
  "createTrackDefaultChord",
  "createAudioTrack",
  "createMidiTrack",
  "createInstrumentTrack",
  "createGroupTrack",
  "createFxTrack",
  "createFolderTrack",
  "createMarkerTrack",
  "createTempoTrack",
  "createChordTrack",
  "duplicateTrack",
  "deleteTrack",
  "quantizeMidi",
  "applyLegato",
  "applyFixedLength",
  "bounceSelection",
  "createCrossfade",
  "setAudioFadeIn",
  "setAudioFadeOut",
  "addMarker",
  "addCycleMarker",
  "undo",
  "redo",
  "performCurrentAudioExport"
]);

const selectionDependentOperations = new Set([
  ...selectedOperations,
  "selectTracks",
  "duplicateTrack",
  "deleteTrack",
  "quantizeMidi",
  "applyLegato",
  "applyFixedLength",
  "bounceSelection",
  "createCrossfade",
  "setAudioFadeIn",
  "setAudioFadeOut",
  "quantizeAudio",
  "addMarker",
  "addCycleMarker",
  "exportSelectedTracks",
  "exportSelectedEvents",
  "exportSelectedEvent"
]);

const existingExportSettingsOperations = new Set(["performCurrentAudioExport"]);

const noHeadlessApiOperations = new Set<string>([]);

const projectStateOperations = new Set([
  "getProject",
  "getProjectPath",
  "getProjectMetadata",
  "listTracks",
  "getTrack",
  "getPosition",
  "getTempo",
  "getChordTrack",
  "getExportJobs",
  "cancelExportJob"
]);

function statusFor(definition: ToolDefinition): CapabilityStatus {
  if (noHeadlessApiOperations.has(definition.operation)) return "blocked_by_no_headless_api";
  if (definition.operation === "performCurrentAudioExport") return "partial_current_setting_only";
  if (definition.operation.startsWith("directAccess") || directAccessOperations.has(definition.operation)) return "partial_direct_access";
  if (commandOperations.has(definition.operation)) {
    return selectionDependentOperations.has(definition.operation) ? "partial_selection_dependent" : "partial_command_binding";
  }
  if (selectedOperations.has(definition.operation)) return "partial_selection_dependent";
  if (projectStateOperations.has(definition.operation) && definition.operation !== "getChordTrack") return "unknown_not_tested";
  if (midiRemoteOperations.has(definition.operation)) return "unknown_not_tested";
  if (!definition.safety.changesState && ["getCapabilities", "runDiagnostics"].includes(definition.operation)) return "unknown_not_tested";
  return "partial_bridge_required";
}

function adapterFor(definition: ToolDefinition, status: CapabilityStatus): string {
  if (projectStateOperations.has(definition.operation)) return "ProjectStateAdapter";
  if (status === "partial_direct_access") return "DirectAccessAdapter";
  if (status === "partial_command_binding" || status === "partial_current_setting_only") return "MidiCommandSurfaceAdapter";
  if (status === "partial_selection_dependent") {
    if (directAccessOperations.has(definition.operation)) return "DirectAccessAdapter";
    if (commandOperations.has(definition.operation)) return "MidiCommandSurfaceAdapter";
    return "MidiRemoteAdapter";
  }
  if (midiRemoteOperations.has(definition.operation)) return "MidiRemoteAdapter";
  if (/Plugin|Instrument|Effect|Sidechain|Output|Preset/.test(definition.operation)) return "PluginBridgeAdapter";
  if (/Export|Render|Scan|Hitpoint|Silence/.test(definition.operation)) return "PluginBridgeAdapter";
  return "CompositeCubaseAdapter";
}

function blockerFor(status: CapabilityStatus, definition: ToolDefinition): BlockerReason {
  if (status === "blocked_by_no_headless_api") return "requires_dialog_but_screen_automation_disallowed";
  if (status === "blocked_by_missing_cubase_side_bridge") return "requires_cubase_side_binary_bridge";
  if (status === "blocked_by_cubase_api") return "cubase_api_not_exposed";
  if (status === "partial_bridge_required") return "requires_cubase_side_binary_bridge";
  if (status === "partial_current_setting_only") return "requires_existing_export_settings";
  if (status === "partial_selection_dependent") return "requires_existing_selection";
  if (status === "partial_command_binding") return "requires_user_mapping";
  if (status === "unknown_not_tested") return "not_tested_yet";
  if (status === "partial_direct_access" && definition.operation.includes("Plugin")) return "requires_cubase_15_api_1_3";
  return "none";
}

function limitationFor(status: CapabilityStatus): string[] {
  switch (status) {
    case "partial_direct_access":
      return ["Limited to objects/parameters exposed by the connected Cubase DirectAccess tree; real evidence is project and selection specific."];
    case "partial_command_binding":
      return ["Command binding cannot pass arbitrary command parameters; canPerform and state-diff evidence are required."];
    case "partial_current_setting_only":
      return ["Uses Cubase's current export settings; path, format and range are not implied to be controllable."];
    case "partial_selection_dependent":
      return ["Addresses the current Cubase selection/focus unless a stable DirectAccess object ID is supplied."];
    case "partial_bridge_required":
      return ["A structured Cubase-side bridge request exists or is required; no screen/dialog automation fallback is allowed."];
    case "unknown_not_tested":
      return ["An implementation path exists but has no operation-level real Cubase evidence in this worktree."];
    case "blocked_by_no_headless_api":
      return ["The connected/control APIs expose no dialog-free path and screen automation is disallowed."];
    case "blocked_by_missing_cubase_side_bridge":
      return ["Requires an installed Cubase-side binary/plugin bridge."];
    case "blocked_by_cubase_api":
      return ["Cubase returned explicit API-not-exposed evidence."];
    case "mock_only":
      return ["Only the test adapter implements this operation."];
    case "real":
      return [];
  }
}

function makeCapability(definition: ToolDefinition): Capability {
  const status = statusFor(definition);
  const primaryAdapter = adapterFor(definition, status);
  const fallbackAdapters = primaryAdapter === "DirectAccessAdapter"
    ? ["PluginBridgeAdapter", "MidiCommandSurfaceAdapter"]
    : primaryAdapter === "MidiCommandSurfaceAdapter"
      ? ["DirectAccessAdapter", "PluginBridgeAdapter"]
      : primaryAdapter === "MidiRemoteAdapter"
        ? ["DirectAccessAdapter", "PluginBridgeAdapter"]
        : ["PluginBridgeAdapter"];
  return {
    toolName: definition.name,
    status,
    primaryAdapter,
    fallbackAdapters,
    requiresUserSetup: primaryAdapter !== "MockCubaseAdapter",
    requiresCubaseFocus: false,
    usesScreenAutomation: false,
    requiresExistingSelection: selectionDependentOperations.has(definition.operation),
    requiresExistingExportSettings: existingExportSettingsOperations.has(definition.operation),
    destructive: definition.safety.destructive === true,
    supportsDryRun: definition.safety.supportsDryRun,
    // Static pre-state captures are diagnostic evidence, not proof that Cubase can
    // undo a host mutation. A real report may establish native Undo separately.
    supportsUndo: false,
    testedWithRealCubase: false,
    blockerReason: blockerFor(status, definition),
    limitations: limitationFor(status)
  };
}

export const allRequestedToolNames = toolDefinitions.map((definition) => definition.name) as readonly string[];

export class CapabilityMatrix {
  private readonly capabilities = new Map<string, Capability>();

  constructor(capabilities: Capability[] = toolDefinitions.map(makeCapability)) {
    for (const capability of capabilities) this.capabilities.set(capability.toolName, capability);
  }

  get(toolName: string): Capability {
    const capability = this.capabilities.get(toolName);
    if (capability) return capability;
    const definition = toolDefinitions.find((candidate) => candidate.name === toolName);
    if (definition) return makeCapability(definition);
    return {
      toolName,
      status: "unknown_not_tested",
      primaryAdapter: "CompositeCubaseAdapter",
      fallbackAdapters: [],
      requiresUserSetup: true,
      requiresCubaseFocus: false,
      usesScreenAutomation: false,
      requiresExistingSelection: false,
      requiresExistingExportSettings: false,
      destructive: false,
      supportsDryRun: true,
      supportsUndo: false,
      testedWithRealCubase: false,
      blockerReason: "not_yet_implemented",
      limitations: ["Tool is not registered in the current MCP tool catalog."]
    };
  }

  list(): Capability[] {
    return [...this.capabilities.values()];
  }

  assertNoScreenAutomation(): void {
    const invalid = this.list().filter((capability) => capability.usesScreenAutomation);
    if (invalid.length > 0) throw new Error(`Screen automation is disallowed: ${invalid.map((item) => item.toolName).join(", ")}`);
  }

  errorCodeFor(capability: Capability): ErrorCode {
    switch (capability.status) {
      case "blocked_by_no_headless_api":
        return ErrorCode.BlockedByNoHeadlessApi;
      case "blocked_by_missing_cubase_side_bridge":
        return ErrorCode.NeedsCubaseSideBridge;
      case "blocked_by_cubase_api":
        return ErrorCode.BlockedByCubaseApi;
      default:
        return ErrorCode.CapabilityUnsupported;
    }
  }
}

export const defaultCapabilityMatrix = new CapabilityMatrix();
