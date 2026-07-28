import { resolve } from "node:path";
import { loadCubaseConfig } from "../src/config/cubaseConfig.js";
import { allRequestedToolNames, defaultCapabilityMatrix } from "../src/state/CapabilityMatrix.js";
import { toolDefinitions } from "../src/tools/index.js";
import { CubaseConnectionDoctor } from "../src/diagnostics/CubaseConnectionDoctor.js";
import { DirectAccessDoctor, type DirectAccessAuditResult, type DirectAccessParameterEvidence } from "../src/diagnostics/DirectAccessDoctor.js";
import { CommandBindingDoctor, type CommandAuditResult } from "../src/diagnostics/CommandBindingDoctor.js";
import { PluginManagerDoctor, type PluginManagerAuditResult } from "../src/diagnostics/PluginManagerDoctor.js";
import {
  ReportWriter,
  type DiagnosticErrorRecord,
  type RealCapabilityStatus,
  type RealCubaseReport,
  type ToolCapabilityEvidence
} from "../src/diagnostics/ReportWriter.js";

export interface ReportRunOptions {
  mode: RealCubaseReport["mode"];
  executeDestructive?: boolean;
  executePluginAssignment?: boolean;
}

export interface ReportRunResult {
  success: boolean;
  reportDirectory: string;
  errors: DiagnosticErrorRecord[];
}

export interface SmokeTestResult {
  name: string;
  passed: boolean;
  before?: unknown;
  executionValue?: unknown;
  after?: unknown;
  restoreAttempted: boolean;
  restored?: boolean;
  restoredValue?: unknown;
  error?: string;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function number(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function boolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorRecord(stage: string, code: string, error: unknown): DiagnosticErrorRecord {
  return {
    stage,
    code,
    message: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString()
  };
}

function initialCapabilities(): ToolCapabilityEvidence[] {
  const names = new Set<string>([...allRequestedToolNames, ...toolDefinitions.map((tool) => tool.name)]);
  return [...names]
    .sort()
    .map((tool) => {
      const capability = defaultCapabilityMatrix.get(tool);
      return {
        tool,
        status: "unknown_not_tested" as const,
        adapter: capability.primaryAdapter,
        testedWithRealCubase: false,
        evidenceFile: "errors.json",
        limitation: "No operation-level real Cubase evidence was collected for this tool in this run."
      };
    });
}

function setCapability(
  capabilities: ToolCapabilityEvidence[],
  tool: string,
  status: RealCapabilityStatus,
  adapter: string,
  testedWithRealCubase: boolean,
  evidenceFile: string,
  limitation: string
): void {
  const index = capabilities.findIndex((item) => item.tool === tool);
  const value = { tool, status, adapter, testedWithRealCubase, evidenceFile, limitation };
  if (status === "real" && !testedWithRealCubase) throw new Error(`Cannot classify untested tool as real: ${tool}`);
  if (index >= 0 && capabilities[index].testedWithRealCubase && !testedWithRealCubase) return;
  if (index >= 0) capabilities[index] = value;
  else capabilities.push(value);
}

const commandToolMap: Record<string, { tools: string[]; status: RealCapabilityStatus }> = {
  "track.add.audio": { tools: ["cubase.create_track_default_audio", "cubase.create_audio_track"], status: "partial_command_binding" },
  "track.add.midi": { tools: ["cubase.create_track_default_midi", "cubase.create_midi_track"], status: "partial_command_binding" },
  "track.add.instrument": { tools: ["cubase.create_track_default_instrument", "cubase.create_instrument_track"], status: "partial_command_binding" },
  "track.add.group": { tools: ["cubase.create_track_default_group", "cubase.create_group_track"], status: "partial_command_binding" },
  "track.add.fx": { tools: ["cubase.create_track_default_fx", "cubase.create_fx_track"], status: "partial_command_binding" },
  "track.add.folder": { tools: ["cubase.create_track_default_folder", "cubase.create_folder_track"], status: "partial_command_binding" },
  "track.add.marker": { tools: ["cubase.create_track_default_marker", "cubase.create_marker_track"], status: "partial_command_binding" },
  "track.add.tempo": { tools: ["cubase.create_track_default_tempo", "cubase.create_tempo_track"], status: "partial_command_binding" },
  "track.add.chord": { tools: ["cubase.create_track_default_chord", "cubase.create_chord_track"], status: "partial_command_binding" },
  "track.duplicate": { tools: ["cubase.duplicate_track"], status: "partial_selection_dependent" },
  "track.remove_selected": { tools: ["cubase.delete_track"], status: "partial_selection_dependent" },
  "midi.quantize": { tools: ["cubase.quantize_midi"], status: "partial_selection_dependent" },
  "audio.bounce_selection": { tools: ["cubase.bounce_selection"], status: "partial_selection_dependent" },
  "audio.crossfade": { tools: ["cubase.create_crossfade"], status: "partial_selection_dependent" },
  "audio.fade_in": { tools: ["cubase.set_audio_fade_in"], status: "partial_selection_dependent" },
  "audio.fade_out": { tools: ["cubase.set_audio_fade_out"], status: "partial_selection_dependent" },
  "audio.delete_overlaps": { tools: ["cubase.edit_audio_event"], status: "partial_selection_dependent" },
  "audio.dissolve_part": { tools: ["cubase.edit_midi_notes"], status: "partial_selection_dependent" },
  "marker.add_position_selected": { tools: ["cubase.add_marker"], status: "partial_selection_dependent" },
  "marker.add_cycle_selected": { tools: ["cubase.add_cycle_marker"], status: "partial_selection_dependent" },
  "marker.add_position_active": { tools: ["cubase.add_marker"], status: "partial_selection_dependent" },
  "marker.add_cycle_active": { tools: ["cubase.add_cycle_marker"], status: "partial_selection_dependent" },
  "track.rename_selected": { tools: ["cubase.rename_track"], status: "partial_command_binding" },
  "render.current_settings": { tools: ["cubase.render_in_place"], status: "partial_current_setting_only" },
  "export.perform_current_audio_export": { tools: ["cubase.perform_current_audio_export"], status: "partial_current_setting_only" },
  "edit.undo": { tools: ["cubase.undo"], status: "partial_command_binding" },
  "edit.redo": { tools: ["cubase.redo"], status: "partial_command_binding" }
};

function classifyCapabilities(input: {
  connected: boolean;
  direct?: DirectAccessAuditResult;
  commands?: CommandAuditResult[];
  plugin?: PluginManagerAuditResult;
  smoke?: SmokeTestResult[];
}): ToolCapabilityEvidence[] {
  const capabilities = initialCapabilities();
  if (!input.connected) return capabilities;

  setCapability(capabilities, "cubase.get_status", "real", "MidiRemoteAdapter", true, "raw-handshake.json", "Handshake and structured bridge state were read from the connected Cubase process.");

  if (input.direct?.capabilities && input.direct.objects.length > 0) {
    const directReadTools = [
      "cubase.direct_access_get_capabilities",
      "cubase.direct_access_request",
      "cubase.direct_access_discover_object_tree",
      "cubase.direct_access_get_object_metadata",
      "cubase.direct_access_get_child_objects",
      "cubase.direct_access_get_parameters",
      "cubase.direct_access_get_parameter"
    ];
    for (const tool of directReadTools) {
      setCapability(capabilities, tool, "partial_direct_access", "DirectAccessAdapter", true, "direct-access-tree.json", "Verified against discovered DirectAccess roots; coverage remains limited to objects exposed by this Cubase project and selection.");
    }
    if (input.direct.subscriptions.objectChanges) {
      setCapability(capabilities, "cubase.direct_access_subscribe_object_changes", "partial_direct_access", "DirectAccessAdapter", true, "direct-access-tree.json", "The connected bridge acknowledged object change/removal subscription for this session.");
    }
    if (input.direct.subscriptions.parameterChanges.some((subscription) => subscription.response !== undefined)) {
      setCapability(capabilities, "cubase.direct_access_subscribe_parameter_changes", "partial_direct_access", "DirectAccessAdapter", true, "direct-access-tree.json", "The connected bridge acknowledged parameter subscriptions for discovered objects in this session.");
    }
    if (input.direct.parameters.length > 0) {
      setCapability(capabilities, "cubase.get_plugin_parameters", "partial_direct_access", "DirectAccessAdapter", true, "direct-access-parameters.json", "Parameter discovery was verified for currently exposed objects only.");
    }
    const acceptedWrite = input.direct.writeTests.some((test) => test.writeAccepted && test.valueChanged && test.restored);
    if (acceptedWrite) {
      setCapability(capabilities, "cubase.direct_access_set_parameter_process_value", "partial_direct_access", "DirectAccessAdapter", true, "direct-access-parameters.json", "At least one exposed writable parameter accepted a write and was restored.");
      setCapability(capabilities, "cubase.set_plugin_parameter", "partial_direct_access", "DirectAccessAdapter", true, "direct-access-parameters.json", "A currently exposed parameter write path was verified; arbitrary plugin coverage is not implied.");
    }
    if ((input.direct.categories.eq?.length ?? 0) > 0) {
      const eqIds = new Set(input.direct.categories.eq);
      const eqWrite = input.direct.writeTests.some((test) => eqIds.has(test.objectId) && test.writeAccepted && test.valueChanged && test.restored);
      setCapability(capabilities, "cubase.set_eq_band", "partial_direct_access", "DirectAccessAdapter", eqWrite, "direct-access-parameters.json", "EQ objects were discovered; testedWithRealCubase is true only when an EQ parameter has its own accepted/restored write record.");
    }
    if ((input.direct.categories.sendSlots?.length ?? 0) > 0) {
      const sendIds = new Set(input.direct.categories.sendSlots);
      const sendWrite = input.direct.writeTests.some((test) => sendIds.has(test.objectId) && test.writeAccepted && test.valueChanged && test.restored);
      setCapability(capabilities, "cubase.set_send_level", "partial_direct_access", "DirectAccessAdapter", sendWrite, "direct-access-parameters.json", "Send slot objects were discovered; testedWithRealCubase is true only for a send parameter with accepted/restored write evidence.");
      setCapability(capabilities, "cubase.set_send_enable", "partial_direct_access", "DirectAccessAdapter", sendWrite, "direct-access-parameters.json", "Send slot objects were discovered; testedWithRealCubase is true only for a send parameter with accepted/restored write evidence.");
    }
  }

  if (input.plugin?.available) {
    setCapability(capabilities, "cubase.list_plugins", "partial_direct_access", "DirectAccessAdapter", true, "plugin-manager.json", "Plugin collections were read for discovered slot objects, not a global MediaBay/VST catalog.");
    setCapability(capabilities, "cubase.direct_access_get_plugin_collections", "partial_direct_access", "DirectAccessAdapter", true, "plugin-manager.json", "Plugin manager collections were returned by Cubase MIDI Remote API 1.3 feature detection.");
    if (input.plugin.assignmentExecuted && input.plugin.assignmentRestored) {
      setCapability(capabilities, "cubase.direct_access_set_slot_plugin", "partial_direct_access", "DirectAccessAdapter", true, "plugin-manager.json", "A replacement slot assignment was accepted and the original plugin UID was restored.");
      setCapability(capabilities, "cubase.add_insert_plugin", "partial_direct_access", "DirectAccessAdapter", true, "plugin-manager.json", "One replacement assignment and restoration were verified; arbitrary slot routing remains contextual.");
    }
  } else if (input.plugin && !input.plugin.capabilityReported && input.plugin.slotsExamined > 0) {
    setCapability(capabilities, "cubase.direct_access_get_plugin_collections", "blocked_by_no_headless_api", "DirectAccessAdapter", true, "plugin-manager.json", "The connected Cubase host exposed plugin slots but did not expose the MIDI Remote API 1.3 plugin manager.");
    setCapability(capabilities, "cubase.direct_access_set_slot_plugin", "blocked_by_no_headless_api", "DirectAccessAdapter", true, "plugin-manager.json", "The connected Cubase host did not expose trySetSlotPlugin; upgrade or an allowed Cubase-side bridge is required.");
    setCapability(capabilities, "cubase.add_insert_plugin", "blocked_by_missing_cubase_side_bridge", "PluginBridgeAdapter", true, "plugin-manager.json", "DirectAccess plugin assignment is unavailable on the connected host; a Cubase-side bridge is required for headless assignment.");
  }

  if (input.commands) {
    setCapability(capabilities, "cubase.command_binding_get_registry", "real", "MidiCommandSurfaceAdapter", true, "command-bindings.json", "The complete bridge command registry was read from real Cubase.");
    setCapability(capabilities, "cubase.command_binding_can_perform", "real", "MidiCommandSurfaceAdapter", true, "command-bindings.json", "canPerform support/results were queried for every registered command candidate.");
    for (const command of input.commands) {
      const mapping = commandToolMap[command.key];
      if (!mapping) continue;
      const operationVerified = command.executedInAudit && command.result === "real";
      const status = mapping.status;
      for (const tool of mapping.tools) {
        setCapability(
          capabilities,
          tool,
          status,
          "MidiCommandSurfaceAdapter",
          operationVerified,
          "command-bindings.json",
          operationVerified
            ? "Command produced an observable state diff and Undo restored the pre-command snapshot; command parameters remain unavailable."
            : `Binding/canPerform evidence exists, but the operation was not verified with a reversible state diff (${command.result}).`
        );
      }
    }
  }

  const smokeByName = new Map((input.smoke ?? []).map((test) => [test.name, test]));
  const verified = (name: string): boolean => smokeByName.get(name)?.passed === true && smokeByName.get(name)?.restored !== false;
  if (verified("transport.play")) setCapability(capabilities, "cubase.transport_play", "real", "MidiRemoteAdapter", true, "smoke-tests.json", "Play state transition was observed in Cubase.");
  if (verified("transport.stop.final")) setCapability(capabilities, "cubase.transport_stop", "real", "MidiRemoteAdapter", true, "smoke-tests.json", "Stop state transition was observed after playback.");
  if (verified("transport.record")) setCapability(capabilities, "cubase.transport_record", "real", "MidiRemoteAdapter", true, "smoke-tests.json", "Record transport state was observed with no track armed, then Stop restored the transport.");
  if (verified("transport.cycle")) setCapability(capabilities, "cubase.set_cycle", "real", "MidiRemoteAdapter", true, "smoke-tests.json", "Cycle changed and was restored.");
  if (verified("transport.metronome")) setCapability(capabilities, "cubase.set_metronome", "real", "MidiRemoteAdapter", true, "smoke-tests.json", "Metronome changed and was restored.");
  const selectedMappings: Array<[string, string]> = [
    ["selected.volume", "cubase.set_track_volume"],
    ["selected.pan", "cubase.set_track_pan"],
    ["selected.mute", "cubase.set_track_mute"],
    ["selected.solo", "cubase.set_track_solo"]
  ];
  for (const [testName, tool] of selectedMappings) {
    if (verified(testName)) setCapability(capabilities, tool, "partial_selection_dependent", "MidiRemoteAdapter", true, "smoke-tests.json", "Verified for the currently selected track and restored; arbitrary track addressing is not implied.");
  }
  if (verified("focusedQuickControl.write")) {
    setCapability(capabilities, "cubase.set_plugin_parameter", "partial_selection_dependent", "MidiRemoteAdapter", true, "smoke-tests.json", "Verified through the currently focused Quick Control and restored.");
  }
  if (verified("directAccess.parameter.read")) {
    setCapability(capabilities, "cubase.direct_access_get_parameter", "partial_direct_access", "DirectAccessAdapter", true, "smoke-tests.json", "A parameter was read from a live DirectAccess object.");
  }
  if (verified("directAccess.parameter.write")) {
    setCapability(capabilities, "cubase.direct_access_set_parameter_process_value", "partial_direct_access", "DirectAccessAdapter", true, "smoke-tests.json", "A parameter changed through DirectAccess and was restored.");
  }
  return capabilities.sort((left, right) => left.tool.localeCompare(right.tool));
}

async function runSmokeTests(
  connection: CubaseConnectionDoctor,
  directAccess: DirectAccessDoctor,
  directAudit: DirectAccessAuditResult
): Promise<SmokeTestResult[]> {
  const router = connection.getRouter();
  const results: SmokeTestResult[] = [];
  const settleMs = Number(process.env.CUBASE_SMOKE_SETTLE_MS ?? 350);

  const transport = async (name: string, cc: number, expected: string): Promise<void> => {
    const result: SmokeTestResult = { name, passed: false, restoreAttempted: false };
    try {
      const before = await connection.getState();
      result.before = record(before.transport).state;
      result.executionValue = 127;
      router.sendControl({ kind: "cc", channel: 0, number: cc, value: 127 });
      await wait(settleMs);
      const after = await connection.getState();
      result.after = record(after.transport).state;
      result.passed = result.after === expected;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    results.push(result);
  };

  await transport("transport.stop.initial", 21, "stopped");
  if (process.env.CUBASE_REAL_RECORD_TEST === "true") {
    const recordTest: SmokeTestResult = { name: "transport.record", passed: false, restoreAttempted: false };
    try {
      const beforeState = await connection.getState();
      recordTest.before = record(beforeState.transport).state;
      if (record(record(beforeState).selectedTrack).recordEnabled === true) {
        throw new Error("Refusing record smoke test while the selected track is record-enabled. Disarm every track first.");
      }
      recordTest.executionValue = 127;
      router.sendControl({ kind: "cc", channel: 0, number: 22, value: 127 });
      await wait(settleMs);
      const afterState = await connection.getState();
      recordTest.after = record(afterState.transport).state;
      recordTest.passed = recordTest.after === "recording";
      recordTest.restoreAttempted = true;
      router.sendControl({ kind: "cc", channel: 0, number: 21, value: 127 });
      await wait(settleMs);
      const restoredState = await connection.getState();
      recordTest.restoredValue = record(restoredState.transport).state;
      recordTest.restored = recordTest.restoredValue === "stopped";
      recordTest.passed &&= recordTest.restored;
    } catch (error) {
      router.sendControl({ kind: "cc", channel: 0, number: 21, value: 127 });
      recordTest.restoreAttempted = true;
      recordTest.error = error instanceof Error ? error.message : String(error);
    }
    results.push(recordTest);
  }
  await transport("transport.play", 20, "playing");
  await transport("transport.stop.final", 21, "stopped");

  const booleanControl = async (name: string, cc: number, area: "transport" | "selectedTrack", key: string): Promise<void> => {
    const result: SmokeTestResult = { name, passed: false, restoreAttempted: false };
    try {
      const beforeState = await connection.getState();
      const before = boolean(record(beforeState[area])[key]);
      result.before = before;
      if (before === undefined) throw new Error(`Bridge state did not expose ${area}.${key}.`);
      const execution = !before;
      result.executionValue = execution;
      router.sendControl({ kind: "cc", channel: 0, number: cc, value: execution ? 127 : 0 });
      await wait(settleMs);
      const afterState = await connection.getState();
      result.after = boolean(record(afterState[area])[key]);
      result.passed = result.after === execution;
      result.restoreAttempted = true;
      router.sendControl({ kind: "cc", channel: 0, number: cc, value: before ? 127 : 0 });
      await wait(settleMs);
      const restoredState = await connection.getState();
      result.restoredValue = boolean(record(restoredState[area])[key]);
      result.restored = result.restoredValue === before;
      result.passed &&= result.restored;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    results.push(result);
  };

  await booleanControl("transport.cycle", 25, "transport", "cycleEnabled");
  await booleanControl("transport.metronome", 26, "transport", "metronomeEnabled");

  const continuousControl = async (name: string, cc: number, area: "selectedTrack", key: string): Promise<void> => {
    const result: SmokeTestResult = { name, passed: false, restoreAttempted: false };
    try {
      const beforeState = await connection.getState();
      const before = number(record(beforeState[area])[key]);
      result.before = before;
      if (before === undefined) throw new Error(`Bridge state did not expose numeric ${area}.${key}.`);
      const execution = before > 0.9 ? before - 0.05 : before + 0.05;
      result.executionValue = execution;
      router.sendControl({ kind: "cc", channel: 0, number: cc, value: Math.max(0, Math.min(127, Math.round(execution * 127))) });
      await wait(settleMs);
      const afterState = await connection.getState();
      result.after = number(record(afterState[area])[key]);
      result.passed = number(result.after) !== undefined && Math.abs((number(result.after) ?? before) - before) > 0.001;
      result.restoreAttempted = true;
      router.sendControl({ kind: "cc", channel: 0, number: cc, value: Math.max(0, Math.min(127, Math.round(before * 127))) });
      await wait(settleMs);
      const restoredState = await connection.getState();
      result.restoredValue = number(record(restoredState[area])[key]);
      result.restored = number(result.restoredValue) !== undefined && Math.abs((number(result.restoredValue) ?? 99) - before) <= 1 / 127 + 0.001;
      result.passed &&= result.restored;
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    results.push(result);
  };

  await continuousControl("selected.volume", 30, "selectedTrack", "volumeProcessValue");
  await continuousControl("selected.pan", 31, "selectedTrack", "panProcessValue");
  await booleanControl("selected.mute", 32, "selectedTrack", "mute");
  await booleanControl("selected.solo", 33, "selectedTrack", "solo");

  const quickControl: SmokeTestResult = { name: "focusedQuickControl.write", passed: false, restoreAttempted: false };
  try {
    const beforeState = await connection.getState();
    const controls = Array.isArray(beforeState.focusedQuickControls) ? beforeState.focusedQuickControls : [];
    const first = record(controls.find((value) => number(record(value).processValue) !== undefined));
    const index = number(first.index);
    const before = number(first.processValue);
    quickControl.before = first;
    if (index === undefined || before === undefined) throw new Error("No focused Quick Control with a numeric process value is available.");
    const execution = before > 0.9 ? before - 0.05 : before + 0.05;
    quickControl.executionValue = execution;
    router.sendControl({ kind: "cc", channel: 0, number: 50 + index, value: Math.round(execution * 127) });
    await wait(settleMs);
    const afterState = await connection.getState();
    const after = record((Array.isArray(afterState.focusedQuickControls) ? afterState.focusedQuickControls : [])[index]);
    quickControl.after = after;
    quickControl.passed = number(after.processValue) !== undefined && Math.abs((number(after.processValue) ?? before) - before) > 0.001;
    quickControl.restoreAttempted = true;
    router.sendControl({ kind: "cc", channel: 0, number: 50 + index, value: Math.round(before * 127) });
    await wait(settleMs);
    const restoredState = await connection.getState();
    const restored = record((Array.isArray(restoredState.focusedQuickControls) ? restoredState.focusedQuickControls : [])[index]);
    quickControl.restoredValue = restored;
    quickControl.restored = number(restored.processValue) !== undefined && Math.abs((number(restored.processValue) ?? 99) - before) <= 1 / 127 + 0.001;
    quickControl.passed &&= quickControl.restored;
  } catch (error) {
    quickControl.error = error instanceof Error ? error.message : String(error);
  }
  results.push(quickControl);

  const candidate = safeDirectParameter(directAudit.parameters);
  const directRead: SmokeTestResult = { name: "directAccess.parameter.read", passed: false, restoreAttempted: false };
  const directWrite: SmokeTestResult = { name: "directAccess.parameter.write", passed: false, restoreAttempted: false };
  if (!candidate) {
    directRead.error = "No writable DirectAccess parameter with a numeric process value was discovered.";
    directWrite.error = directRead.error;
  } else {
    try {
      const before = record((await directAccess.request({ type: "DA_GET_PARAMETER", objectId: candidate.objectId, parameterTag: candidate.parameterTag })).data);
      directRead.before = { objectId: candidate.objectId, parameterTag: candidate.parameterTag };
      directRead.after = before;
      directRead.passed = number(before.processValue) !== undefined;
      const original = number(before.processValue);
      if (original === undefined) throw new Error("DirectAccess parameter read did not return a numeric process value.");
      const execution = original > 0.9 ? original - 0.01 : original + 0.01;
      directWrite.before = before;
      directWrite.executionValue = execution;
      await directAccess.request({ type: "DA_SET_PARAMETER_PROCESS_VALUE", objectId: candidate.objectId, parameterTag: candidate.parameterTag, value: execution });
      await wait(100);
      const after = record((await directAccess.request({ type: "DA_GET_PARAMETER", objectId: candidate.objectId, parameterTag: candidate.parameterTag })).data);
      directWrite.after = after;
      directWrite.passed = number(after.processValue) !== undefined && Math.abs((number(after.processValue) ?? original) - original) > 0.0001;
      directWrite.restoreAttempted = true;
      await directAccess.request({ type: "DA_SET_PARAMETER_PROCESS_VALUE", objectId: candidate.objectId, parameterTag: candidate.parameterTag, value: original });
      await wait(100);
      const restored = record((await directAccess.request({ type: "DA_GET_PARAMETER", objectId: candidate.objectId, parameterTag: candidate.parameterTag })).data);
      directWrite.restoredValue = restored;
      directWrite.restored = number(restored.processValue) !== undefined && Math.abs((number(restored.processValue) ?? 99) - original) < 0.0001;
      directWrite.passed &&= directWrite.restored;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      directRead.error ??= message;
      directWrite.error = message;
    }
  }
  results.push(directRead, directWrite);
  return results;
}

function safeDirectParameter(parameters: DirectAccessParameterEvidence[]): DirectAccessParameterEvidence | undefined {
  const unsafe = /record|play|start|stop|rewind|forward|delete|remove|reset|open|close|export/i;
  return parameters
    .filter((parameter) => parameter.writeTestPossible && !unsafe.test(`${parameter.objectPath} ${parameter.title ?? ""}`))
    .sort((left, right) => (/quick.?control/i.test(left.objectPath) ? -1 : 1) - (/quick.?control/i.test(right.objectPath) ? -1 : 1))[0];
}

function nextActions(input: {
  connected: boolean;
  handshake: unknown;
  direct?: DirectAccessAuditResult;
  commands?: CommandAuditResult[];
  plugin?: PluginManagerAuditResult;
  smoke?: SmokeTestResult[];
}): string[] {
  const actions: string[] = [];
  if (!input.connected) {
    const handshake = record(input.handshake);
    const ports = record(handshake.ports);
    for (const diagnosis of Array.isArray(ports.diagnoses) ? ports.diagnoses : []) actions.push(String(diagnosis));
    actions.push("Verify that the AI MCP DirectAccess MIDI Remote device is active in Cubase, then rerun npm run cubase:discover.");
    return actions;
  }
  if (!input.direct?.capabilities || input.direct.errors.length > 0) actions.push("Inspect direct-access-tree.json and update/reload direct-access-bridge.js before classifying DirectAccess-dependent tools.");
  if (!input.plugin?.available) actions.push("Select a track with at least one insert plugin and inspect plugin-manager.json; no plugin slot collection was verified.");
  const unverifiedCommands = input.commands?.filter((command) => command.result !== "real").length ?? 0;
  if (unverifiedCommands > 0) actions.push(`Review ${unverifiedCommands} command results in command-bindings.json; do not promote them without an observable state diff.`);
  const failedSmoke = input.smoke?.filter((test) => !test.passed).length ?? 0;
  if (failedSmoke > 0) actions.push(`Review ${failedSmoke} failed smoke records in smoke-tests.json, including restore status, before using those controls.`);
  return actions;
}

export async function runRealCubaseReport(options: ReportRunOptions): Promise<ReportRunResult> {
  const timestamp = new Date().toISOString();
  const config = loadCubaseConfig(process.env);
  const connection = new CubaseConnectionDoctor(config.midi);
  const errors: DiagnosticErrorRecord[] = [];
  let handshake: unknown = {};
  let directAudit: DirectAccessAuditResult | undefined;
  let commandAudit: CommandAuditResult[] | undefined;
  let pluginAudit: PluginManagerAuditResult | undefined;
  let smokeTests: SmokeTestResult[] | undefined;
  let connected = false;

  try {
    handshake = await connection.connect();
    connected = record(handshake).connected === true;
    if (!connected) {
      errors.push(errorRecord("connection", "CUBASE_HANDSHAKE_FAILED", record(record(handshake).error).message ?? "Cubase handshake failed."));
    } else {
      const directAccess = new DirectAccessDoctor(connection.getRouter());
      try {
        directAudit = await directAccess.audit({ testWrites: options.mode !== "smoke", mutateWrites: false });
        for (const error of directAudit.errors) errors.push(errorRecord("direct-access", "DIRECT_ACCESS_AUDIT_ERROR", error.message));
      } catch (error) {
        errors.push(errorRecord("direct-access", "DIRECT_ACCESS_AUDIT_FAILED", error));
      }

      if (directAudit && (options.mode === "discover" || options.mode === "direct-access")) {
        try {
          pluginAudit = await new PluginManagerDoctor(directAccess).audit(directAudit, {
            executePluginAssignment: options.executePluginAssignment
          });
          for (const error of pluginAudit.errors) errors.push(errorRecord("plugin-manager", "PLUGIN_MANAGER_AUDIT_ERROR", error.message));
        } catch (error) {
          errors.push(errorRecord("plugin-manager", "PLUGIN_MANAGER_AUDIT_FAILED", error));
        }
      }

      // Run reversible control smoke tests before command candidates that could unexpectedly open a host dialog.
      if (directAudit && (options.mode === "discover" || options.mode === "smoke")) {
        try {
          smokeTests = await runSmokeTests(connection, directAccess, directAudit);
          for (const test of smokeTests.filter((item) => item.error)) errors.push(errorRecord("smoke", "SMOKE_TEST_ERROR", `${test.name}: ${test.error}`));
        } catch (error) {
          errors.push(errorRecord("smoke", "SMOKE_TEST_RUN_FAILED", error));
        }
      }

      if (directAudit && options.mode !== "direct-access") {
        try {
          commandAudit = await new CommandBindingDoctor(connection.getRouter(), directAccess).audit({
            executeDestructive: options.executeDestructive,
            executeSafe: options.mode !== "smoke"
          });
        } catch (error) {
          errors.push(errorRecord("command-bindings", "COMMAND_AUDIT_FAILED", error));
        }
      }
    }
  } catch (error) {
    errors.push(errorRecord("runner", "DISCOVERY_RUN_FAILED", error));
  } finally {
    await connection.disconnect().catch((error) => errors.push(errorRecord("connection", "DISCONNECT_FAILED", error)));
  }

  const capabilities = classifyCapabilities({ connected, direct: directAudit, commands: commandAudit, plugin: pluginAudit, smoke: smokeTests });
  const report: RealCubaseReport = {
    mode: options.mode,
    timestamp,
    connected,
    handshake,
    directAccessTree: directAudit
      ? { apiVersion: directAudit.apiVersion, capabilities: directAudit.capabilities, roots: directAudit.roots, trees: directAudit.trees, objects: directAudit.objects, categories: directAudit.categories, subscriptions: directAudit.subscriptions }
      : {},
    directAccessParameters: directAudit ? { parameters: directAudit.parameters, writeTests: directAudit.writeTests } : {},
    commandBindings: commandAudit ?? [],
    pluginManager: pluginAudit ?? {},
    toolCapabilities: capabilities,
    errors,
    nextActions: nextActions({ connected, handshake, direct: directAudit, commands: commandAudit, plugin: pluginAudit, smoke: smokeTests }),
    smokeTests
  };
  const reportDirectory = await new ReportWriter(resolve("reports", "real-cubase")).write(report);
  return { success: connected && errors.every((error) => !["CUBASE_HANDSHAKE_FAILED", "DISCOVERY_RUN_FAILED"].includes(error.code)), reportDirectory, errors };
}
