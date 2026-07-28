import { access, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CompositeCubaseAdapter } from "../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../src/config/cubaseConfig.js";
import { createCubaseMcpRuntime, type CubaseMcpRuntime } from "../src/server.js";

type ToolStatus =
  | "real" | "partial_direct_access" | "partial_command_binding" | "partial_current_setting_only"
  | "partial_selection_dependent" | "partial_bridge_required" | "mock_only" | "unknown_not_tested"
  | "blocked_by_no_headless_api" | "blocked_by_missing_cubase_side_bridge" | "blocked_by_cubase_api";

interface StructuredResult {
  ok: boolean;
  tool: string;
  status: ToolStatus;
  adapter: string;
  changed: boolean;
  data?: unknown;
  preview?: unknown;
  evidence?: unknown;
  jobId?: string;
  error?: { code?: string; message?: string; details?: unknown };
  warnings?: string[];
}

interface ToolCallRecord {
  step: number;
  tool: string;
  args: Record<string, unknown>;
  requestedAction: string;
  category: "project" | "track" | "midi" | "mixer" | "plugin" | "marker" | "transport" | "export" | "state";
  invokedThroughMcp: boolean;
  result: "success" | "partial" | "failed" | "not_invoked";
  status: ToolStatus | "connection_failed";
  adapter: string;
  usedMock: boolean;
  evidence?: unknown;
  limitation?: string;
  response?: StructuredResult;
}

interface ErrorRecord {
  step: number;
  tool: string;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

interface MidiNoteInput {
  pitch: number;
  start: string;
  length: string;
  velocity: number;
  channel?: number;
}

const reportDirectory = resolve("reports", "real-cubase", "project-create-test");
const expectedExportFile = resolve(process.env.CUBASE_EXPECTED_EXPORT_FILE ?? resolve(reportDirectory, "AI_MCP_Cubase_Test_Project_TestMix.wav"));
const requestedProjectPath = resolve(process.env.CUBASE_TEST_PROJECT_PATH ?? resolve(reportDirectory, "AI_MCP_Cubase_Test_Project.cpr"));
const uiFallbackUsed = process.env.CUBASE_UI_FALLBACK_USED === "true";
const skipTrackCreation = process.env.CUBASE_PROJECT_SKIP_TRACK_CREATION === "true";
const verifyOnly = process.env.CUBASE_PROJECT_VERIFY_ONLY === "true";
await mkdir(reportDirectory, { recursive: true });

process.env.CUBASE_ADAPTER = "composite";
process.env.CUBASE_REQUIRE_REAL = "true";

const calls: ToolCallRecord[] = [];
const errors: ErrorRecord[] = [];
const trackIds = new Map<string, string>();
let runtime: CubaseMcpRuntime | undefined;
let client: Client | undefined;
let stateBefore: unknown = { captured: false };
let stateAfter: unknown = { captured: false };
let projectCreationMode = "not_started";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function escapeCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

function addError(step: number, tool: string, code: string, message: string, details?: unknown): void {
  errors.push({ step, tool, code, message, details, timestamp: new Date().toISOString() });
}

async function callTool(
  tool: string,
  args: Record<string, unknown>,
  requestedAction: string,
  category: ToolCallRecord["category"]
): Promise<ToolCallRecord> {
  const step = calls.length + 1;
  if (!client) {
    const item: ToolCallRecord = { step, tool, args, requestedAction, category, invokedThroughMcp: false, result: "not_invoked", status: "connection_failed", adapter: "CompositeCubaseAdapter", usedMock: false, limitation: "MCP runtime did not start because the real Cubase bridge connection failed." };
    calls.push(item);
    return item;
  }
  try {
    const response = await client.callTool({ name: tool, arguments: args });
    const structured = response.structuredContent as StructuredResult | undefined;
    if (!structured) throw new Error("MCP response did not include structuredContent.");
    if (structured.status === "mock_only" || structured.adapter === "Mock Cubase Adapter") {
      throw new Error("MockCubaseAdapter was observed while CUBASE_REQUIRE_REAL=true.");
    }
    const item: ToolCallRecord = {
      step, tool, args, requestedAction, category, invokedThroughMcp: true,
      result: structured.ok ? (structured.status === "real" ? "success" : "partial") : "failed",
      status: structured.status,
      adapter: structured.adapter,
      usedMock: false,
      evidence: structured.evidence,
      limitation: structured.ok ? structured.warnings?.join("; ") : structured.error?.message,
      response: structured
    };
    calls.push(item);
    if (!structured.ok) addError(step, tool, structured.error?.code ?? "MCP_TOOL_FAILED", structured.error?.message ?? "MCP tool returned failure.", structured.error?.details);
    return item;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const item: ToolCallRecord = { step, tool, args, requestedAction, category, invokedThroughMcp: true, result: "failed", status: "unknown_not_tested", adapter: "CompositeCubaseAdapter", usedMock: false, limitation: message };
    calls.push(item);
    addError(step, tool, "MCP_CALL_FAILED", message);
    return item;
  }
}

function successful(call: ToolCallRecord): boolean {
  return (call.result === "success" || call.result === "partial") && call.response?.ok === true;
}

function findTrackId(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findTrackId(item); if (found) return found; }
    return undefined;
  }
  const object = record(value);
  if (typeof object.trackId === "string") return object.trackId;
  if (typeof object.id === "string" && (typeof object.name === "string" || typeof object.type === "string")) return object.id;
  for (const child of Object.values(object)) { const found = findTrackId(child); if (found) return found; }
  return undefined;
}

function stateDiff(before: unknown, after: unknown, prefix = "$"): Array<{ path: string; before: unknown; after: unknown }> {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (typeof before !== "object" || before === null || typeof after !== "object" || after === null) return [{ path: prefix, before, after }];
  const left = before as Record<string, unknown>;
  const right = after as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap((key) => stateDiff(left[key], right[key], `${prefix}.${key}`));
}

function drumNotes(): MidiNoteInput[] {
  const notes: MidiNoteInput[] = [];
  for (let bar = 1; bar <= 4; bar += 1) {
    for (let beat = 1; beat <= 4; beat += 1) {
      notes.push({ pitch: 36, start: `${bar}.${beat}.1.0`, length: "0.0.1.0", velocity: 112 + ((bar + beat) % 3) * 3 });
      notes.push({ pitch: 42, start: `${bar}.${beat}.1.0`, length: "0.0.1.0", velocity: 78 + ((bar + beat) % 4) * 4 });
      notes.push({ pitch: 42, start: `${bar}.${beat}.3.0`, length: "0.0.1.0", velocity: 72 + ((bar + beat + 1) % 4) * 4 });
      notes.push({ pitch: 46, start: `${bar}.${beat}.3.0`, length: "0.0.1.0", velocity: 88 + ((bar + beat) % 2) * 5 });
    }
    for (const beat of [2, 4]) notes.push({ pitch: 39, start: `${bar}.${beat}.1.0`, length: "0.0.1.0", velocity: 103 + (bar % 2) * 4 });
  }
  return notes;
}

function bassNotes(): MidiNoteInput[] {
  const roots = [45, 41, 48, 43];
  return roots.flatMap((pitch, index) => Array.from({ length: 8 }, (_, eighth) => ({
    pitch,
    start: `${index + 1}.${Math.floor(eighth / 2) + 1}.${eighth % 2 === 0 ? 1 : 3}.0`,
    length: "0.0.2.0",
    velocity: 88 + ((eighth + index) % 4) * 4
  })));
}

function chordNotes(): MidiNoteInput[] {
  const chords = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]];
  return chords.flatMap((pitches, bar) => pitches.map((pitch, voice) => ({ pitch, start: `${bar + 1}.1.1.0`, length: "1.0.0.0", velocity: 78 + voice * 3 })));
}

function leadNotes(): MidiNoteInput[] {
  const motif = [69, 72, 76, 72, 67, 71, 74, 71];
  return Array.from({ length: 16 }, (_, index) => ({
    pitch: motif[index % motif.length],
    start: `${Math.floor(index / 4) + 1}.${(index % 4) + 1}.1.0`,
    length: "0.0.2.0",
    velocity: 92 + (index % 4) * 3
  }));
}

interface TrackSpec {
  name: string;
  type: "audio" | "instrument" | "group" | "fx" | "marker" | "chord";
  typedTool: string;
  instrument?: string;
  uiBootstrapRequired?: boolean;
}

const trackSpecs: readonly TrackSpec[] = [
  { name: "Drum Instrument", type: "instrument", typedTool: "cubase.create_midi_track", instrument: "Groove Agent SE" },
  { name: "Bass Instrument", type: "instrument", typedTool: "cubase.create_midi_track", instrument: "Retrologue" },
  { name: "Chord Instrument", type: "instrument", typedTool: "cubase.create_midi_track", instrument: "HALion Sonic" },
  { name: "Lead Instrument", type: "instrument", typedTool: "cubase.create_midi_track", instrument: "Retrologue" },
  { name: "Vocal Placeholder", type: "audio", typedTool: "cubase.create_audio_track" },
  { name: "Drum Group", type: "group", typedTool: "cubase.create_group_track" },
  { name: "Music Group", type: "group", typedTool: "cubase.create_group_track" },
  { name: "Reverb FX", type: "fx", typedTool: "cubase.create_fx_track", uiBootstrapRequired: true },
  { name: "Delay FX", type: "fx", typedTool: "cubase.create_fx_track", uiBootstrapRequired: true },
  { name: "Chord Track", type: "chord", typedTool: "cubase.create_chord_track" },
  { name: "Marker Track", type: "marker", typedTool: "cubase.create_marker_track" }
] as const;

try {
  const config = loadCubaseConfig(process.env);
  if (config.adapter !== "composite") throw new Error(`CUBASE_ADAPTER must be composite, received ${config.adapter}.`);
  const adapter = new CompositeCubaseAdapter(config);
  if (!(adapter instanceof CompositeCubaseAdapter)) throw new Error("MockCubaseAdapter is forbidden for this run.");
  runtime = await createCubaseMcpRuntime(adapter);
  client = new Client({ name: "cubase-real-project-test", version: "1.0.0" }, { capabilities: {} });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([runtime.server.connect(serverTransport), client.connect(clientTransport)]);

  const beforeCall = await callTool("cubase.get_status", {}, "Capture connected Cubase state before mutation.", "state");
  if (!successful(beforeCall)) throw new Error("cubase.get_status failed after the composite adapter connected.");
  stateBefore = beforeCall.response?.data;
  const cubaseState = record(record(stateBefore).cubase);
  if (cubaseState.connected !== true) throw new Error("cubase.get_status did not report cubase.connected=true.");

  await callTool("cubase.get_capabilities", {}, "Capture adapter and tool capabilities.", "state");
  const projectWasOpen = cubaseState.projectOpen === true;
  if (!projectWasOpen) {
    await callTool("cubase.create_project", { name: "AI_MCP_Cubase_Test_Project", path: requestedProjectPath, sampleRate: 48000, bitDepth: 24, dryRun: true }, "Preview creation of the test project.", "project");
    const created = await callTool("cubase.create_project", { name: "AI_MCP_Cubase_Test_Project", path: requestedProjectPath, sampleRate: 48000, bitDepth: 24 }, "Create the test project through the Cubase-side bridge.", "project");
    projectCreationMode = successful(created) ? "new_project" : "new_project_failed";
    if (!successful(created)) throw new Error("No project was open and cubase.create_project failed; dependent mutations were not attempted.");
  } else {
    projectCreationMode = verifyOnly ? "existing_project_verify" : "existing_project_test_section";
  }

  if (verifyOnly) {
    await callTool("cubase.transport_play", {}, "Verify real MCP playback against the existing saved project.", "transport");
    await new Promise((resolveWait) => setTimeout(resolveWait, Number(process.env.CUBASE_PROJECT_PLAY_MS ?? 600)));
    await callTool("cubase.transport_stop", {}, "Restore the existing saved project to stopped state.", "transport");
  } else {
  for (const [tool, args, action] of [
    ["cubase.set_sample_rate", { sampleRate: 48000 }, "Set project sample rate to 48 kHz."],
    ["cubase.set_bit_depth", { bitDepth: 24 }, "Set project bit depth to 24 bit."],
    ["cubase.set_tempo", { bpm: 124 }, "Set fixed tempo to 124 BPM."],
    ["cubase.set_time_signature", { signature: "4/4" }, "Set time signature to 4/4."]
  ] as const) await callTool(tool, args, action, "project");

  for (const spec of trackSpecs) {
    if (skipTrackCreation) {
      addError(calls.length + 1, spec.typedTool, "TRACK_CREATION_SKIPPED_FOR_EXISTING_BOOTSTRAP", `${spec.name} was not recreated because CUBASE_PROJECT_SKIP_TRACK_CREATION=true.`);
      continue;
    }
    const typedArgs = { name: spec.name, ...(spec.instrument ? { instrumentName: spec.instrument } : {}) };
    await callTool(spec.typedTool, { ...typedArgs, dryRun: true }, `Preview command-binding creation for ${spec.name}.`, "track");
    if (spec.uiBootstrapRequired) {
      addError(calls.length + 1, spec.typedTool, "UI_BOOTSTRAP_REQUIRED", `${spec.name} uses a dialog-risk Add Track command; actual command execution was left to the explicit UI bootstrap phase.`);
      continue;
    }
    const created = await callTool(spec.typedTool, typedArgs, `Create the ${spec.name} backing track with MIDI Remote command binding/current defaults.`, "track");
    const selectedState = successful(created)
      ? await callTool("cubase.get_status", {}, `Capture selected-track ID after creating ${spec.name}.`, "state")
      : undefined;
    const id = findTrackId(selectedState?.response?.data) ?? findTrackId(created.response?.data);
    if (id) trackIds.set(spec.name, id);
  }

  const listedTracks = await callTool("cubase.list_tracks", { includeHidden: true }, "Read created tracks and stable IDs.", "state");
  const tracks = Array.isArray(listedTracks.response?.data) ? listedTracks.response.data : [];
  for (const item of tracks) {
    const track = record(item);
    if (typeof track.name === "string" && typeof track.id === "string") trackIds.set(track.name, track.id);
  }

  const midiPlans = [
    { track: "Drum Instrument", name: "Four Bar House Drums", notes: drumNotes() },
    { track: "Bass Instrument", name: "Four Bar House Bass", notes: bassNotes() },
    { track: "Chord Instrument", name: "Am F C G Chords", notes: chordNotes() },
    { track: "Lead Instrument", name: "House Lead Motif", notes: leadNotes() }
  ];
  for (const plan of midiPlans) {
    const trackId = trackIds.get(plan.track) ?? "selected";
    const outputPath = resolve(reportDirectory, `${plan.track.replaceAll(" ", "_")}.mid`);
    await callTool("cubase.create_midi_part_from_generated_file", { trackId, name: plan.name, position: "1.1.1.0", tempo: 124, outputPath, notes: plan.notes }, `Generate a Standard MIDI File and request headless import for ${plan.name}.`, "midi");
  }

  const instrumentPlans = [
    ["Drum Instrument", "Groove Agent SE"], ["Bass Instrument", "Retrologue"],
    ["Chord Instrument", "HALion Sonic"], ["Lead Instrument", "Retrologue"]
  ] as const;
  for (const [trackName, instrumentName] of instrumentPlans) {
    const trackId = trackIds.get(trackName);
    if (trackId) await callTool("cubase.load_instrument", { trackId, instrumentName, confirm: true }, `Load ${instrumentName} on ${trackName}.`, "plugin");
  }
  for (const [trackName, pluginName] of [["Reverb FX", "REVelation"], ["Delay FX", "StereoDelay"]] as const) {
    const trackId = trackIds.get(trackName);
    if (trackId) await callTool("cubase.load_effect", { trackId, pluginName, slot: 0, confirm: true }, `Load ${pluginName} on ${trackName}.`, "plugin");
  }

  const mixerPlans = [
    ["Drum Instrument", -8], ["Bass Instrument", -11], ["Chord Instrument", -16], ["Lead Instrument", -9], ["Vocal Placeholder", -12]
  ] as const;
  for (const [trackName, volumeDb] of mixerPlans) {
    const trackId = trackIds.get(trackName);
    if (!trackId) continue;
    const selected = await callTool("cubase.select_tracks", { trackIds: [trackId], mode: "replace" }, `Select ${trackName} before selected-channel mixer writes.`, "track");
    if (successful(selected)) await callTool("cubase.set_track_volume", { trackId: "selected", volumeDb }, `Set ${trackName} volume to ${volumeDb} dB.`, "mixer");
  }
  const vocalId = trackIds.get("Vocal Placeholder");
  if (vocalId) {
    const selected = await callTool("cubase.select_tracks", { trackIds: [vocalId], mode: "replace" }, "Select Vocal Placeholder before mute.", "track");
    if (successful(selected)) await callTool("cubase.set_track_mute", { trackId: "selected", enabled: true }, "Mute Vocal Placeholder.", "mixer");
  }

  const drumId = trackIds.get("Drum Instrument");
  const drumGroupId = trackIds.get("Drum Group");
  if (drumId && drumGroupId) await callTool("cubase.set_group_routing", { trackIds: [drumId], groupTrackId: drumGroupId }, "Route drums to Drum Group.", "mixer");
  const musicIds = ["Bass Instrument", "Chord Instrument", "Lead Instrument"].map((name) => trackIds.get(name)).filter((id): id is string => Boolean(id));
  const musicGroupId = trackIds.get("Music Group");
  if (musicIds.length === 3 && musicGroupId) await callTool("cubase.set_group_routing", { trackIds: musicIds, groupTrackId: musicGroupId }, "Route bass, chord and lead to Music Group.", "mixer");

  for (const [trackName, frequencyHz, gainDb, q, type] of [
    ["Bass Instrument", 35, 0, 0.8, "lowCut"], ["Chord Instrument", 120, 0, 0.8, "lowCut"], ["Lead Instrument", 3200, 1.5, 1, "peak"]
  ] as const) {
    const trackId = trackIds.get(trackName);
    if (trackId) await callTool("cubase.set_eq_band", { trackId, band: 1, enabled: true, frequencyHz, gainDb, q, type }, `Apply requested EQ move to ${trackName}.`, "mixer");
  }

  const reverbId = trackIds.get("Reverb FX");
  const delayId = trackIds.get("Delay FX");
  for (const trackName of ["Drum Instrument", "Chord Instrument", "Lead Instrument"] as const) {
    const trackId = trackIds.get(trackName);
    if (trackId && reverbId) await callTool("cubase.add_send", { trackId, destination: reverbId, levelDb: trackName === "Lead Instrument" ? -14 : -18 }, `Add Reverb FX send from ${trackName}.`, "mixer");
    if (trackId && delayId && trackName === "Lead Instrument") await callTool("cubase.add_send", { trackId, destination: delayId, levelDb: -16 }, "Add Delay FX send from Lead Instrument.", "mixer");
  }

  const chordTrackId = trackIds.get("Chord Track");
  if (chordTrackId) await callTool("cubase.create_chord_progression", { trackId: chordTrackId, chords: [
    { position: "1.1.1.0", chord: "Am", length: "1.0.0.0" }, { position: "2.1.1.0", chord: "F", length: "1.0.0.0" },
    { position: "3.1.1.0", chord: "C", length: "1.0.0.0" }, { position: "4.1.1.0", chord: "G", length: "1.0.0.0" }
  ] }, "Write Am - F - C - G to the Chord Track.", "midi");

  const markerTrackId = trackIds.get("Marker Track");
  if (markerTrackId) await callTool("cubase.select_tracks", { trackIds: [markerTrackId], mode: "replace" }, "Select Marker Track for marker commands.", "track");
  await callTool("cubase.set_position", { position: "1.1.1.0" }, "Move cursor to bar 1 before first marker.", "transport");
  await callTool("cubase.add_marker", { name: "Intro / Groove Start", position: "1.1.1.0" }, "Add Intro / Groove Start marker.", "marker");
  await callTool("cubase.set_position", { position: "5.1.1.0" }, "Move cursor to bar 5 before second marker.", "transport");
  await callTool("cubase.add_marker", { name: "Loop End", position: "5.1.1.0" }, "Add Loop End marker.", "marker");
  await callTool("cubase.add_cycle_marker", { name: "House Loop", start: "1.1.1.0", end: "5.1.1.0" }, "Add cycle marker covering bars 1 through 5.", "marker");
  await callTool("cubase.set_locators", { left: "1.1.1.0", right: "5.1.1.0" }, "Set locators to bars 1 through 5.", "transport");
  await callTool("cubase.set_cycle", { enabled: true }, "Enable cycle playback.", "transport");
  await callTool("cubase.transport_play", {}, "Brief playback smoke test.", "transport");
  await new Promise((resolveWait) => setTimeout(resolveWait, Number(process.env.CUBASE_PROJECT_PLAY_MS ?? 1200)));
  await callTool("cubase.transport_stop", {}, "Stop transport after smoke playback.", "transport");

  await callTool("cubase.save_project", {}, "Save the current Cubase project.", "project");
  await callTool("cubase.create_project_backup", { destination: resolve(reportDirectory, "AI_MCP_Cubase_Test_Project_Backup") }, "Create a project backup.", "project");
  await callTool("cubase.perform_current_audio_export", { expectedFiles: [expectedExportFile], confirm: true }, "Perform audio export using current Cubase settings and verify the expected file.", "export");
  await new Promise((resolveWait) => setTimeout(resolveWait, Number(process.env.CUBASE_EXPORT_SETTLE_MS ?? 2000)));
  await callTool("cubase.get_export_jobs", {}, "Read export job state.", "export");
  }

  const afterCall = await callTool("cubase.get_status", {}, "Capture Cubase state after all attempted operations.", "state");
  if (successful(afterCall)) stateAfter = afterCall.response?.data;
  await callTool("cubase.list_tracks", { includeHidden: true }, "Verify final track list.", "state");
  await callTool("cubase.get_project", {}, "Verify final project state and path.", "state");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const step = calls.length + 1;
  addError(step, "connection-or-workflow-gate", "REAL_CUBASE_PROJECT_CREATE_FAILED", message, {
    adapter: process.env.CUBASE_ADAPTER,
    requireReal: process.env.CUBASE_REQUIRE_REAL,
    midiInput: process.env.CUBASE_MIDI_IN ?? "AI MCP Bridge From Cubase",
    midiOutput: process.env.CUBASE_MIDI_OUT ?? "AI MCP Bridge To Cubase"
  });
  if (calls.length === 0) calls.push({
    step: 1,
    tool: "cubase.get_status",
    args: {},
    requestedAction: "Verify real Cubase connection before any project mutation.",
    category: "state",
    invokedThroughMcp: false,
    result: "not_invoked",
    status: "connection_failed",
    adapter: "CompositeCubaseAdapter",
    usedMock: false,
    limitation: `The composite adapter could not connect, so no MCP tool was invoked: ${message}`
  });
} finally {
  await client?.close().catch(() => undefined);
  await runtime?.close().catch(() => undefined);
}

let exportExists = false;
try { await access(expectedExportFile); exportExists = true; } catch { exportExists = false; }
const diff = stateDiff(stateBefore, stateAfter);
const finalState = record(stateAfter);
const finalCubase = record(finalState.cubase);
const projectCreated = projectCreationMode === "new_project" || projectCreationMode === "existing_project_test_section" || projectCreationMode === "existing_project_verify";
const connected = finalCubase.connected === true || record(record(stateBefore).cubase).connected === true;
const successfulMutations = calls.filter((item) => item.response?.changed === true && (item.result === "success" || item.result === "partial")).length;
const overallSuccess = connected && projectCreated && successfulMutations > 0 && calls.every((item) => item.status !== "mock_only");

const nextActions = connected ? [
  "Inspect errors.json and implement or install the production Cubase-side named-pipe/VST3 bridge for partial_bridge_required operations.",
  "Use DirectAccess discovery IDs for plugin/EQ/send parameters that were not exposed by semantic names.",
  "Configure current Audio Export settings to write exactly CUBASE_EXPECTED_EXPORT_FILE, then rerun the export step."
] : [
  "Create loopMIDI ports named AI MCP Bridge To Cubase and AI MCP Bridge From Cubase.",
  "Install src/cubase-remote-script/direct-access-bridge.js as a Cubase MIDI Remote local driver.",
  "In Cubase, bind device Input=AI MCP Bridge To Cubase and Output=AI MCP Bridge From Cubase.",
  "Open a saved test project with one selected audio track, an insert plugin, and a focused Quick Control.",
  "Run npm run cubase:discover, then npm run cubase:project-test."
];

const summaryRows = calls.map((item) => `| ${item.step} | ${escapeCell(item.tool)} | ${escapeCell(item.requestedAction)} | ${item.result} | ${item.status} | ${escapeCell(item.invokedThroughMcp ? "MCP structuredContent/evidence in tool-call-sequence.json" : "errors.json") } | ${escapeCell(item.limitation ?? "")} |`).join("\n");
const summary = [
  "# Real Cubase Project Create Test",
  "",
  `- Timestamp: ${new Date().toISOString()}`,
  `- Adapter forced: ${process.env.CUBASE_ADAPTER}`,
  `- Require real: ${process.env.CUBASE_REQUIRE_REAL}`,
  `- Connected: ${connected}`,
  `- Project creation mode: ${projectCreationMode}`,
  `- Successful state-changing MCP calls: ${successfulMutations}`,
  `- Mock calls observed: ${calls.filter((item) => item.status === "mock_only").length}`,
  `- UI fallback used: ${uiFallbackUsed}`,
  `- Expected export exists: ${exportExists}`,
  `- Overall success: ${overallSuccess}`,
  "",
  "| Step | Tool | Requested Action | Result | Status | Evidence | Limitation |",
  "| ---- | ---- | ---------------- | ------ | ------ | -------- | ---------- |",
  summaryRows,
  ""
].join("\n");

const byCategory = (category: ToolCallRecord["category"]): ToolCallRecord[] => calls.filter((item) => item.category === category);
await Promise.all([
  writeFile(resolve(reportDirectory, "summary.md"), summary, "utf8"),
  writeFile(resolve(reportDirectory, "tool-call-sequence.json"), `${stringify(calls)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "state-before.json"), `${stringify(stateBefore)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "state-after.json"), `${stringify(stateAfter)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "state-diff.json"), `${stringify({ changed: diff.length > 0, changes: diff })}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "created-project.json"), `${stringify({ projectCreated, projectCreationMode, requestedProjectPath, connected, state: record(stateAfter).project ?? record(stateBefore).project })}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "created-tracks.json"), `${stringify({ requested: trackSpecs, verifiedTrackIds: Object.fromEntries(trackIds), actions: byCategory("track") })}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "midi-generation.json"), `${stringify({ patterns: { drums: drumNotes(), bass: bassNotes(), chords: chordNotes(), lead: leadNotes() }, actions: byCategory("midi") })}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "mixer-actions.json"), `${stringify(byCategory("mixer"))}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "plugin-actions.json"), `${stringify(byCategory("plugin"))}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "marker-actions.json"), `${stringify(byCategory("marker"))}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "export-result.json"), `${stringify({ expectedExportFile, exists: exportExists, actions: byCategory("export") })}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "errors.json"), `${stringify(errors)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "next-actions.md"), ["# Next Actions", "", ...nextActions.map((item, index) => `${index + 1}. ${item}`), ""].join("\n"), "utf8")
]);

console.log(`Real Cubase project-create report: ${reportDirectory}`);
console.log(`connected=${connected} projectCreated=${projectCreated} successfulMutations=${successfulMutations} exportExists=${exportExists}`);
if (!overallSuccess) process.exitCode = 1;
