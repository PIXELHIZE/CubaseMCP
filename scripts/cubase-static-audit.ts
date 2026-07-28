import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { toolDefinitions } from "../src/tools/index.js";
import { defaultCapabilityMatrix } from "../src/state/CapabilityMatrix.js";

function feature(tool: string): string {
  const name = tool.slice("cubase.".length);
  if (/project|backup|sample_rate|bit_depth|frame_rate|template/.test(name)) return "Project";
  if (/track/.test(name) && !/chord_track|tempo_track|automation/.test(name)) return "Track";
  if (/transport|position|locator|cycle|punch|metronome|count_in|preroll|postroll/.test(name)) return "Transport";
  if (/audio|crossfade|hitpoint|silence|warp|comp_/.test(name)) return "Audio";
  if (/midi|legato|drum_map|scale_assistant/.test(name)) return "MIDI";
  if (/automation/.test(name)) return "Automation";
  if (/tempo|signature|chord|scale|arranger/.test(name)) return "Tempo/Arrangement";
  if (/marker|section|song_structure/.test(name)) return "Marker/Arrangement";
  if (/plugin|instrument|effect|sidechain|output/.test(name)) return "Plugin";
  if (/volume|pan|send|routing|vca|meter|phase|channel_strip|eq/.test(name)) return "Mixer";
  if (/export|render|job/.test(name)) return "Export/Job";
  if (/media|pool|relink|sample|video/.test(name)) return "Media";
  return "Safety/Diagnostics";
}

function cubasePath(adapter: string): string {
  if (adapter === "DirectAccessAdapter") return "MIDI Remote DirectAccess SysEx";
  if (adapter === "MidiCommandSurfaceAdapter") return "MIDI Remote command binding + MIDI CC";
  if (adapter === "MidiRemoteAdapter") return "MIDI Remote host-value binding";
  if (adapter === "PluginBridgeAdapter") return "Windows named-pipe Cubase-side bridge";
  return "Composite route to state/bridge adapter";
}

function escape(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

const rows = toolDefinitions.map((definition) => {
  const capability = defaultCapabilityMatrix.get(definition.name);
  return {
    feature: feature(definition.name),
    tool: definition.name,
    schema: `Zod (${Object.keys(definition.inputSchema).length} fields)`,
    adapterInterface: `execute(${definition.operation})`,
    mock: "dry-run for all; explicit mock behavior varies",
    realAdapter: capability.primaryAdapter,
    cubaseSidePath: cubasePath(capability.primaryAdapter),
    directAccess: capability.status === "partial_direct_access" ? "implemented/partial" : capability.fallbackAdapters.includes("DirectAccessAdapter") ? "fallback candidate" : "not identified",
    commandBinding: capability.status.includes("command") || capability.status === "partial_current_setting_only" ? "implemented/partial" : capability.fallbackAdapters.includes("MidiCommandSurfaceAdapter") ? "fallback candidate" : "not identified",
    status: capability.status,
    remaining: capability.testedWithRealCubase ? capability.limitations.join("; ") || "none" : `${capability.blockerReason}; real Cubase evidence required`
  };
});

const header = "| 기능 | Tool | Schema | Adapter Interface | Mock | Real Adapter | Cubase-side Path | DirectAccess 가능성 | Command Binding 가능성 | Status | 남은 작업 |";
const separator = "| -- | ---- | ------ | ----------------- | ---- | ------------ | ---------------- | ---------------- | ------------------- | ------ | ----- |";
const markdownRows = rows.map((row) => `| ${escape(row.feature)} | ${escape(row.tool)} | ${escape(row.schema)} | ${escape(row.adapterInterface)} | ${escape(row.mock)} | ${escape(row.realAdapter)} | ${escape(row.cubaseSidePath)} | ${escape(row.directAccess)} | ${escape(row.commandBinding)} | ${row.status} | ${escape(row.remaining)} |`);
const statusCounts = rows.reduce<Record<string, number>>((counts, row) => ({ ...counts, [row.status]: (counts[row.status] ?? 0) + 1 }), {});
const summary = Object.entries(statusCounts).map(([status, count]) => `- ${status}: ${count}`).join("\n");
const markdown = [
  "# Full Capability Audit",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Registered tools: ${rows.length}`,
  "",
  "## Status Summary",
  "",
  summary,
  "",
  "## Coverage",
  "",
  header,
  separator,
  ...markdownRows,
  ""
].join("\n");

await mkdir(resolve("docs"), { recursive: true });
await Promise.all([
  writeFile(resolve("docs", "full-capability-audit.md"), markdown, "utf8"),
  writeFile(resolve("docs", "full-capability-audit.json"), `${JSON.stringify(rows, null, 2)}\n`, "utf8")
]);
console.log(`Wrote ${rows.length} capability audit rows.`);
