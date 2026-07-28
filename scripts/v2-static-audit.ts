import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { MockCubaseAdapter } from "../src/adapters/MockCubaseAdapter.js";
import { ActionRouter } from "../src/v2/ActionRouter.js";
import { v2Actions } from "../src/v2/actionManifest.js";
import { v2ToolNames } from "../src/v2/actionSchemas.js";
import { auditLegacyMapping } from "../src/v2/legacyMapping.js";
import { v2ActionDocumentation } from "../src/v2/ActionDocumentation.js";

const forbidden = [
  "SendKeys",
  "AutoHotkey",
  "SetForegroundWindow",
  "SendInput(",
  "keybd_event(",
  "robotjs",
  "@nut-tree"
];

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory);
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry);
    const info = await stat(path);
    if (info.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.(?:ts|js)$/.test(path)) files.push(path);
  }
  return files;
}

const adapter = new MockCubaseAdapter();
await adapter.connect();
const router = new ActionRouter(adapter);
const serverActions = v2Actions.filter((item) =>
  item.tool === "cubase.system" || item.tool === "cubase.song" || item.tool === "cubase.batch"
).length;
const legacy = auditLegacyMapping();
const actionKeys = v2Actions.map((action) => action.key);
const duplicateActions = actionKeys.filter((key, index) => actionKeys.indexOf(key) !== index);
const automationMatches: Array<{ file: string; term: string }> = [];
for (const file of await sourceFiles(resolve("src"))) {
  const content = await readFile(file, "utf8");
  for (const term of forbidden) if (content.includes(term)) automationMatches.push({ file, term });
}
const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  version?: string;
  license?: string;
};
const checks = {
  toolCount: v2ToolNames.length === 25,
  uniqueActions: duplicateActions.length === 0,
  actionDocumentation: v2ActionDocumentation.length === v2Actions.length &&
    new Set(v2ActionDocumentation.map((document) => document.key)).size === v2Actions.length,
  routeCoverage: router.routeCount() === v2Actions.length - serverActions,
  legacyCoverage: legacy.total === 238 && legacy.mapped === 238 && legacy.removed === 0 && legacy.missing.length === 0,
  noScreenAutomation: automationMatches.length === 0,
  apacheLicense: packageJson.license === "Apache-2.0",
  version: packageJson.version === "2.0.0"
};
const report = {
  ok: Object.values(checks).every(Boolean),
  generatedAt: new Date().toISOString(),
  checks,
  counts: {
    tools: v2ToolNames.length,
    actions: v2Actions.length,
    adapterRoutes: router.routeCount(),
    serverActions,
    legacyTools: legacy.total
  },
  duplicateActions,
  automationMatches
};
console.log(JSON.stringify(report, null, 2));
await adapter.disconnect();
if (!report.ok) process.exitCode = 1;
