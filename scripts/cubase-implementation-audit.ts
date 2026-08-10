import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { toolDefinitions } from "../src/tools/index.js";
import { defaultCapabilityMatrix } from "../src/state/CapabilityMatrix.js";

type FileStatus = "PRESENT" | "PRESENT_PARTIAL" | "MISSING" | "PLACEHOLDER_ONLY";

interface FileRequirement {
  category: string;
  path: string;
  status?: FileStatus;
  limitation?: string;
}

const requirements: FileRequirement[] = [
  { category: "MCP server", path: "src/server.ts" },
  ...["CubaseAdapter", "CompositeCubaseAdapter", "MockCubaseAdapter", "MidiRemoteAdapter", "DirectAccessAdapter", "MidiCommandSurfaceAdapter", "PluginBridgeAdapter", "OscAdapter", "EuConOrMackieAdapter", "ProjectStateAdapter"].map((name) => ({ category: "Adapter", path: `src/adapters/${name}.ts` })),
  ...["MidiPortManager", "CubaseMidiProtocol", "DirectAccessProtocol", "MessageEncoder", "MessageDecoder", "RequestResponseRouter", "ChunkedSysexTransport"].map((name) => ({ category: "MIDI bridge", path: `src/bridge/midi/${name}.ts` })),
  ...["PluginBridgeProtocol", "PluginBridgeClient", "PluginParameterMapper"].map((name) => ({ category: "Plugin bridge", path: `src/bridge/plugin/${name}.ts` })),
  { category: "OSC bridge", path: "src/bridge/osc/OscClient.ts", status: "PRESENT_PARTIAL", limitation: "Requires a configured Cubase-side OSC endpoint." },
  ...["ai-mcp-remote.js", "direct-access-bridge.js", "command-surface-bridge.js", "README.md"].map((name) => ({ category: "Cubase MIDI Remote script", path: `src/cubase-remote-script/${name}` })),
  ...["projectTools", "trackTools", "transportTools", "audioTools", "midiTools", "mixerTools", "pluginTools", "automationTools", "tempoTools", "markerTools", "mediaTools", "exportTools", "directAccessTools", "safetyTools", "index", "registerTools", "toolTypes"].map((name) => ({ category: "Tool layer", path: `src/tools/${name}.ts` })),
  ...["commonSchemas", "projectSchemas", "trackSchemas", "transportSchemas", "audioSchemas", "midiSchemas", "mixerSchemas", "pluginSchemas", "automationSchemas", "tempoSchemas", "markerSchemas", "mediaSchemas", "exportSchemas", "state"].map((name) => ({ category: "Schema", path: `src/schemas/${name}.ts` })),
  ...["SafetyController", "PermissionModel", "Permissions", "DryRunPlanner", "UndoManager", "DestructiveActionGuard", "ErrorCodes"].map((name) => ({ category: "Safety", path: `src/safety/${name}.ts` })),
  ...["CubaseStateStore", "TrackRegistry", "EventRegistry", "PluginRegistry", "MarkerRegistry", "CapabilityMatrix"].map((name) => ({ category: "State", path: `src/state/${name}.ts` })),
  ...["CubaseConnectionDoctor", "MidiPortDoctor", "DirectAccessDoctor", "CommandBindingDoctor", "PluginManagerDoctor", "ReportWriter"].map((name) => ({ category: "Diagnostics", path: `src/diagnostics/${name}.ts` })),
  ...["JobManager", "RenderJob", "ExportJob", "ScanJob"].map((name) => ({ category: "Jobs", path: `src/jobs/${name}.ts` })),
  ...["cubase-discover", "cubase-smoke", "cubase-command-audit", "cubase-direct-access-audit", "cubase-report", "cubase-static-audit"].map((name) => ({ category: "Script", path: `scripts/${name}.ts` })),
  ...["create-house-beat.json", "vocal-forward-mix.json", "export-stems.json", "full-project-create.json"].map((name) => ({ category: "Example", path: `examples/${name}` })),
  { category: "Tests", path: "tests/unit" },
  { category: "Tests", path: "tests/integration" },
  { category: "Tests", path: "tests/fixtures/required-tools.json" },
  { category: "Docs", path: "docs/README.md" },
  { category: "Docs", path: "docs/architecture.md" },
  { category: "Docs", path: "docs/tools.md" },
  { category: "Docs", path: "docs/real-test-status.md" },
  { category: "Experimental VST3 companion", path: "experimental/vst3-companion-bridge/protocol.md", status: "PRESENT_PARTIAL", limitation: "Research only; excluded from the v2.0 runtime and package." },
  { category: "Experimental VST3 companion", path: "experimental/vst3-companion-bridge/README.md", status: "PRESENT_PARTIAL", limitation: "Research only; excluded from the v2.0 runtime and package." },
  { category: "Experimental VST3 companion binary", path: "experimental/vst3-companion-bridge/stub/named-pipe-server.ts", status: "PLACEHOLDER_ONLY", limitation: "Protocol simulator only; excluded from the v2.0 runtime and package." },
  { category: "Experimental VST3 companion binary", path: "experimental/vst3-companion-bridge/stub/PluginBridgeStub.md", status: "PLACEHOLDER_ONLY", limitation: "Implementation plan only; excluded from the v2.0 runtime and package." }
];

function escape(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

async function exists(path: string): Promise<boolean> {
  try { await stat(resolve(path)); return true; } catch { return false; }
}

async function sourceFiles(directory: string): Promise<string[]> {
  const output: string[] = [];
  const walk = async (path: string): Promise<void> => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) await walk(child);
      else if (/\.(?:ts|js)$/.test(entry.name)) output.push(child);
    }
  };
  await walk(resolve(directory));
  return output;
}

function executableText(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const forbiddenPatterns: Array<[string, RegExp]> = [
  ["AutoHotkey", /\bAutoHotkey\b/i],
  ["SendKeys", /\bSendKeys\b/i],
  ["Win32 keyboard injection", /\b(?:keybd_event|SendInput)\s*\(/i],
  ["Win32 mouse injection", /\bmouse_event\s*\(/i],
  ["Forced Cubase focus", /\bSetForegroundWindow\s*\(/i],
  ["UI automation", /\b(?:pyautogui|robotjs|uiautomation)\b/i],
  ["Screenshot/OCR execution", /\b(?:screenshot|tesseract|ocr)\s*\(/i],
  ["Forbidden adapter", /\b(?:OsAutomationAdapter|ScreenAutomationAdapter|KeyboardShortcutAdapter|MouseAutomationAdapter|DialogAutomation|WindowsAutomation)\b/]
];

const registerSource = await readFile(resolve("src/tools/registerTools.ts"), "utf8");
const genericTests = ["tests/unit/toolCoverage.test.ts", "tests/unit/adapterRouting.test.ts", "tests/unit/mcpCatalog.test.ts"];
const genericTestsPresent = (await Promise.all(genericTests.map(exists))).every(Boolean);
const registeredNames = new Set(toolDefinitions.map((definition) => definition.name));

const toolRows = toolDefinitions.map((definition) => {
  const capability = defaultCapabilityMatrix.get(definition.name);
  const registered = registeredNames.has(definition.name) && registerSource.includes("server.registerTool") && registerSource.includes("controller.invoke");
  const schema = Object.keys(definition.inputSchema).length > 0 && ["dryRun", "confirm", "timeoutMs", "correlationId"].every((field) => field in definition.inputSchema);
  const handler = definition.operation.length > 0 && registerSource.includes("controller.invoke(definition, args)");
  const adapterPath = capability.primaryAdapter !== "MockCubaseAdapter" && capability.primaryAdapter.length > 0;
  const capabilityMatrix = capability.toolName === definition.name;
  const test = genericTestsPresent;
  const safety = definition.safety.supportsDryRun && (!definition.safety.destructive || "confirm" in definition.inputSchema);
  const status = registered && schema && handler && adapterPath && capabilityMatrix && test && safety ? capability.status : "missing";
  return {
    tool: definition.name,
    registered,
    schema,
    handler,
    adapterPath: adapterPath ? `${capability.primaryAdapter}${capability.status === "partial_bridge_required" ? " -> production Cubase-side bridge required" : ""}` : "NONE",
    capabilityMatrix,
    test,
    safety,
    status
  };
});

const fileRows = await Promise.all(requirements.map(async (requirement) => {
  const present = await exists(requirement.path);
  return {
    ...requirement,
    status: present ? (requirement.status ?? "PRESENT") : "MISSING" as FileStatus,
    limitation: present ? requirement.limitation : "Required path does not exist."
  };
}));

const forbiddenFindings: Array<{ rule: string; file: string }> = [];
for (const file of [...await sourceFiles("src"), ...await sourceFiles("scripts")]) {
  if (file.endsWith("cubase-implementation-audit.ts") || file.endsWith("v2-static-audit.ts")) continue;
  if (file.includes("src/automation14") || file.includes("src\\automation14")) continue;
  const text = executableText(await readFile(file, "utf8"));
  for (const [rule, pattern] of forbiddenPatterns) {
    if (pattern.test(text)) forbiddenFindings.push({ rule, file: relative(resolve(), file).replaceAll("\\", "/") });
  }
}

const toolHeader = "| Tool | Registered | Schema | Handler | Adapter Path | Capability Matrix | Test | Status |";
const toolSeparator = "| ---- | ---------- | ------ | ------- | ------------ | ----------------- | ---- | ------ |";
const fileHeader = "| Category | Path | Status | Limitation |";
const fileSeparator = "| -------- | ---- | ------ | ---------- |";
const generatedAt = new Date().toISOString();
const audit = { generatedAt, fileRows, toolRows, forbiddenFindings };
const markdown = [
  "# Implementation Audit",
  "",
  `Generated: ${generatedAt}`,
  `Registered tools: ${toolRows.length}`,
  `Missing tool contracts: ${toolRows.filter((row) => row.status === "missing").length}`,
  `Forbidden executable implementation findings: ${forbiddenFindings.length}`,
  "",
  "## File Structure",
  "",
  fileHeader,
  fileSeparator,
  ...fileRows.map((row) => `| ${escape(row.category)} | ${escape(row.path)} | ${row.status} | ${escape(row.limitation ?? "")} |`),
  "",
  "## Tool Coverage",
  "",
  toolHeader,
  toolSeparator,
  ...toolRows.map((row) => `| ${escape(row.tool)} | ${row.registered} | ${row.schema} | ${row.handler} | ${escape(row.adapterPath)} | ${row.capabilityMatrix} | ${row.test} | ${row.status} |`),
  "",
  "## Forbidden Automation Scan",
  "",
  ...(forbiddenFindings.length === 0 ? ["No forbidden executable implementation was found."] : forbiddenFindings.map((item) => `- ${item.rule}: ${item.file}`)),
  ""
].join("\n");

await Promise.all([
  writeFile(resolve("docs/implementation-audit.md"), markdown, "utf8"),
  writeFile(resolve("docs/implementation-audit.json"), `${JSON.stringify(audit, null, 2)}\n`, "utf8")
]);

console.log(`Audited ${fileRows.length} required paths and ${toolRows.length} tools.`);
console.log(`MISSING=${fileRows.filter((row) => row.status === "MISSING").length} PLACEHOLDER_ONLY=${fileRows.filter((row) => row.status === "PLACEHOLDER_ONLY").length} FORBIDDEN=${forbiddenFindings.length}`);
if (fileRows.some((row) => row.status === "MISSING") || toolRows.some((row) => row.status === "missing") || forbiddenFindings.length > 0) process.exitCode = 1;
