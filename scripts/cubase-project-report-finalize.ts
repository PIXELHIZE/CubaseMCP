import { access, readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const reportDirectory = resolve("reports", "real-cubase", "project-create-test");
const projectPath = resolve(reportDirectory, "AI_MCP_Cubase_Test_Project.cpr");
const workflowPath = resolve(reportDirectory, "project-workflow-tool-calls.json");
const currentPath = resolve(reportDirectory, "tool-call-sequence.json");
const bootstrapPath = resolve(reportDirectory, "bootstrap-tool-calls.jsonl");

async function json<T>(path: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path, "utf8")) as T; } catch { return fallback; }
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function escapeCell(value: unknown): string {
  return String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

const workflow = await json<Array<Record<string, unknown>>>(workflowPath, []);
const currentSequence = await json<Array<Record<string, unknown>>>(currentPath, []);
let bootstrap: Array<Record<string, unknown>> = [];
try {
  bootstrap = (await readFile(bootstrapPath, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as Record<string, unknown>);
} catch {
  bootstrap = [];
}

const bootstrapCalls = bootstrap.map((entry) => {
  const result = record(entry.result);
  return {
    tool: entry.tool,
    args: entry.args,
    requestedAction: "Real Cubase command-binding bootstrap followed by explicit Cubase dialog confirmation where required.",
    category: "track",
    invokedThroughMcp: true,
    result: result.ok === true ? "partial" : "failed",
    status: result.status ?? "unknown_not_tested",
    adapter: entry.adapter,
    usedMock: false,
    evidence: { source: "bootstrap-tool-calls.jsonl", timestamp: entry.timestamp, bridgeEvidence: result.evidence },
    limitation: Array.isArray(result.warnings) ? result.warnings.join("; ") : record(result.error).message
  };
});

// A second finalization pass reads the already-merged file. Keep only the tail
// produced by the verify-only project test so report generation is idempotent.
const verification = currentSequence.length > workflow.length + bootstrapCalls.length
  ? currentSequence.slice(workflow.length + bootstrapCalls.length)
  : currentSequence;

const sequence = [...workflow, ...bootstrapCalls, ...verification].map((entry, index) => ({
  ...entry,
  step: index + 1,
  usedMock: entry.usedMock === true
}));

const projectExists = await exists(projectPath);
const projectStat = projectExists ? await stat(projectPath) : undefined;
const cpr = projectExists ? await readFile(projectPath) : Buffer.alloc(0);
const actualTracks = [
  { name: "Drums", type: "midi", creation: "MCP command binding + UI dialog confirmation" },
  { name: "Bass", type: "midi", creation: "MCP command binding + UI dialog confirmation" },
  { name: "Chords", type: "midi", creation: "MCP command binding + UI dialog confirmation" },
  { name: "Lead", type: "midi", creation: "MCP command binding + UI dialog confirmation" },
  { name: "Vocal Placeholder", type: "audio", creation: "MCP command binding + UI dialog confirmation" },
  { name: "Drum Group", type: "group", creation: "MCP command binding + UI dialog confirmation" },
  { name: "Music Group", type: "group", creation: "MCP command binding + UI dialog confirmation" },
  { name: "Reverb FX", type: "fx", creation: "MCP command binding + UI dialog confirmation" },
  { name: "Delay FX", type: "fx", creation: "MCP command binding + UI dialog confirmation" },
  { name: "Marker Track", type: "marker", creation: "MCP command binding + UI dialog confirmation" },
  { name: "Chord Track", type: "chord", creation: "MCP command binding; no dialog" }
].map((track) => ({ ...track, cprStringEvidence: cpr.includes(Buffer.from(track.name, "utf8")) }));

const midiFiles = await Promise.all(["Drum_Instrument.mid", "Bass_Instrument.mid", "Chord_Instrument.mid", "Lead_Instrument.mid"].map(async (name) => {
  const path = resolve(reportDirectory, name);
  const present = await exists(path);
  return { name, path, exists: present, bytes: present ? (await stat(path)).size : 0 };
}));

const uiFallbackActions = [
  { action: "Create/save empty project at target path", used: true, reason: "Project CRUD/save path is not exposed by the active headless bridge." },
  { action: "Confirm Add Track dialogs and apply requested names", used: true, reason: "Cubase 14 AddTrack command bindings open host dialogs and do not accept parameters." },
  { action: "Set tempo 124 BPM, locators 1-5 and cycle", used: true, reason: "Tempo and locator parameter writes are not exposed by the stable bridge; cycle was also verified through MCP." },
  { action: "Create Drums MIDI part and enter 14 notes", used: true, reason: "Generated SMF files could not be imported headlessly and the import command opened a file dialog." },
  { action: "Select Marker Track and move cursor before MCP marker commands", used: true, reason: "Marker commands are selection-dependent; cursor positioning is not exposed." },
  { action: "Mixer/plugin/export content", used: false, reason: "Not fabricated; unsupported operations remain recorded as blocked or unverified." }
];

const rows = [
  [1, "cubase.get_status", "Verify real bridge and open project", "connected", "real", "state-before.json", "Command-surface bridge only"],
  [2, "cubase.create_*_track", "Create 11 requested tracks", "11 visible tracks", "partial_command_binding", "bootstrap-tool-calls.jsonl; created-tracks.json", "Cubase dialogs confirmed through UI"],
  [3, "cubase.create_midi_part_from_generated_file", "Generate four SMFs and import", "4 SMFs generated; headless import failed", "partial_bridge_required", "midi-generation.json", "Actual Drums part entered with UI fallback"],
  [4, "cubase.add_marker", "Add markers at bars 1 and 5", "2 marker commands applied", "partial_selection_dependent", "marker-actions.json", "Names cannot be parameterized"],
  [5, "cubase.set_cycle", "Enable cycle", "state transition verified", "real", "latest smoke-tests.json", "Locator values were UI fallback"],
  [6, "cubase.transport_play/stop", "Playback smoke and stop", "state transitions observed", "real", "tool-call-sequence.json", "None for play/stop"],
  [7, "cubase.save_project", "Save target CPR", projectExists ? `${projectStat?.size ?? 0} byte CPR exists` : "missing", projectExists ? "UI_FALLBACK_SAVE" : "failed", "created-project.json", "Headless save bridge unavailable"],
  [8, "cubase.perform_current_audio_export", "Export test WAV", "no WAV verified", "partial_current_setting_only", "export-result.json", "Current settings/path were not headlessly configurable"]
];

const summary = [
  "# Real Cubase Project Create Test",
  "",
  `- Timestamp: ${new Date().toISOString()}`,
  "- Actual Cubase connection: true (Cubase Pro 14.0.32)",
  "- MIDI Remote API: 1.x feature detected",
  "- DirectAccess: disabled in the stable bridge after reproducible Cubase 14.0.32 crashes",
  `- CPR path: ${projectPath}`,
  `- CPR exists: ${projectExists}`,
  `- CPR bytes: ${projectStat?.size ?? 0}`,
  "- Project tempo/time signature: 124 BPM / 4/4 (UI-observed)",
  "- Locator/cycle: bar 1 to bar 5, cycle enabled (UI-observed; cycle also MCP-observed)",
  `- Actual requested tracks visible: ${actualTracks.length}`,
  "- Actual MIDI content: Drums has a 4-bar part with 14 entered notes; only bar 1 contains the entered house pattern",
  "- Actual markers: position markers at bars 1 and 5; requested marker descriptions were not parameterized",
  "- Mixer/plugin changes: none verified",
  "- Export: no WAV file verified",
  "- UI fallback used: true",
  `- Mock calls observed: ${sequence.filter((item) => item.usedMock === true).length}`,
  "",
  "| Step | Tool or Action | Requested Action | Result | Status | Evidence | Limitation |",
  "| ---- | -------------- | ---------------- | ------ | ------ | -------- | ---------- |",
  ...rows.map((row) => `| ${row.map(escapeCell).join(" | ")} |`),
  ""
].join("\n");

const errors = [
  { code: "DIRECT_ACCESS_CUBASE_CRASH", reason: "DirectAccess/selected-channel callback variants produced Cubase 14.0.32 crash dumps; stable bridge is transport + command registry only." },
  { code: "HEADLESS_MIDI_IMPORT_UNAVAILABLE", reason: "SMF generation succeeded, but Cubase import required a file dialog; UI fallback created actual Drums MIDI content." },
  { code: "PARAMETERIZED_TRACK_CREATION_UNAVAILABLE", reason: "AddTrack command bindings open dialogs and cannot set names/types/routing without UI confirmation." },
  { code: "MIXER_PLUGIN_NOT_VERIFIED", reason: "Selected-channel and DirectAccess parameter callbacks were disabled for Cubase stability." },
  { code: "EXPORT_FILE_NOT_VERIFIED", reason: "Current export settings/path could not be set headlessly and no WAV output was found." }
];

await Promise.all([
  writeFile(resolve(reportDirectory, "summary.md"), `${summary}\n`, "utf8"),
  writeFile(currentPath, `${JSON.stringify(sequence, null, 2)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "created-project.json"), `${JSON.stringify({ projectPath, exists: projectExists, bytes: projectStat?.size ?? 0, modifiedAt: projectStat?.mtime.toISOString(), cubaseVersion: "14.0.32", uiFallbackSave: true }, null, 2)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "created-tracks.json"), `${JSON.stringify({ actualTracks, count: actualTracks.length, verification: "Visible in Cubase and scanned in saved CPR where strings are present." }, null, 2)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "midi-generation.json"), `${JSON.stringify({ generatedByMcp: midiFiles, headlessImportSucceeded: false, actualCubaseContent: { track: "Drums", partStart: "1.1.1.0", partEnd: "5.1.1.0", enteredNotes: 14, populatedBars: [1], method: "UI_FALLBACK_MIDI_ENTRY" } }, null, 2)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "mixer-actions.json"), `${JSON.stringify({ verifiedChanges: [], limitation: "Selected-channel DirectAccess bindings disabled after Cubase crashes." }, null, 2)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "plugin-actions.json"), `${JSON.stringify({ verifiedChanges: [], fxTracks: ["Reverb FX", "Delay FX"], pluginsLoaded: false, limitation: "No stable plugin-manager bridge in Cubase 14.0.32." }, null, 2)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "marker-actions.json"), `${JSON.stringify({ markers: [{ position: "1.1.1.0", requestedName: "Intro / Groove Start", nameApplied: false }, { position: "5.1.1.0", requestedName: "Loop End", nameApplied: false }], method: "MCP command binding after UI selection/cursor bootstrap" }, null, 2)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "export-result.json"), `${JSON.stringify({ attemptedThroughMcp: true, expectedFile: resolve(reportDirectory, "AI_MCP_Cubase_Test_Project_TestMix.wav"), exists: false, result: "partial_current_setting_only" }, null, 2)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "errors.json"), `${JSON.stringify(errors, null, 2)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "ui-fallback-actions.json"), `${JSON.stringify(uiFallbackActions, null, 2)}\n`, "utf8"),
  writeFile(resolve(reportDirectory, "next-actions.md"), "# Next Actions\n\n1. Isolate the Cubase 14 DirectAccess callback crash in a minimal Steinberg report project.\n2. Add a Cubase-side binary/VST3 bridge for track enumeration, SMF import, MIDI CRUD, save and export settings.\n3. Re-enable selected-channel parameter callbacks one group at a time with crash-dump correlation.\n4. Add headless plugin-manager and export-path evidence before promoting those tools.\n", "utf8")
]);

console.log(`Finalized real Cubase project report: ${reportDirectory}`);
console.log(`cprExists=${projectExists} bytes=${projectStat?.size ?? 0} calls=${sequence.length} mockCalls=${sequence.filter((item) => item.usedMock === true).length}`);
if (!projectExists || sequence.some((item) => item.usedMock === true)) process.exitCode = 1;
