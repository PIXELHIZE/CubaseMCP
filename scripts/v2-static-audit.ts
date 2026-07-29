import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { MockCubaseAdapter } from "../src/adapters/MockCubaseAdapter.js";
import { ActionRouter } from "../src/v2/ActionRouter.js";
import { v2Actions } from "../src/v2/actionManifest.js";
import { v2ToolNames } from "../src/v2/actionSchemas.js";
import { auditLegacyMapping } from "../src/v2/legacyMapping.js";
import { v2ActionDocumentation } from "../src/v2/ActionDocumentation.js";
import { readOnlyActionKeys, unitEligibleRealActionKeys } from "../src/v2/ActionSemantics.js";
import {
  assembleSafe14Certification,
  safe14RealObservationActionKeys
} from "../src/v2/Safe14Certification.js";

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
const invalidSemanticKeys = [...readOnlyActionKeys, ...unitEligibleRealActionKeys]
  .filter((key) => !actionKeys.includes(key));
const invalidCertificationKeys = [...safe14RealObservationActionKeys]
  .filter((key) => !actionKeys.includes(key));
const overlappingCertificationKeys = [...safe14RealObservationActionKeys]
  .filter((key) => unitEligibleRealActionKeys.has(key));
const pendingCertification = assembleSafe14Certification([], new Date(0).toISOString());
const automationMatches: Array<{ file: string; term: string }> = [];
for (const file of await sourceFiles(resolve("src"))) {
  const content = await readFile(file, "utf8");
  for (const term of forbidden) if (content.includes(term)) automationMatches.push({ file, term });
}
const packageJson = JSON.parse(await readFile(resolve("package.json"), "utf8")) as {
  version?: string;
  license?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const dependencyNames = [
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {})
];
const forbiddenDependencies = dependencyNames.filter((name) => /vst3|steinberg|loopmidi/i.test(name));
const requiredDistributionFiles = ["LICENSE", "NOTICE", "THIRD_PARTY_LICENSES.md"];
const missingDistributionFiles: string[] = [];
for (const file of requiredDistributionFiles) {
  try {
    if (!(await stat(resolve(file))).isFile()) missingDistributionFiles.push(file);
  } catch {
    missingDistributionFiles.push(file);
  }
}
const buildConfig = await readFile(resolve("tsconfig.build.json"), "utf8");
const checks = {
  toolCount: v2ToolNames.length === 25,
  uniqueActions: duplicateActions.length === 0,
  actionDocumentation: v2ActionDocumentation.length === v2Actions.length &&
    new Set(v2ActionDocumentation.map((document) => document.key)).size === v2Actions.length,
  actionSemantics: invalidSemanticKeys.length === 0,
  certificationPolicy: invalidCertificationKeys.length === 0 &&
    overlappingCertificationKeys.length === 0 &&
    pendingCertification.manifest.actions.length === v2Actions.length &&
    pendingCertification.unresolved.length === safe14RealObservationActionKeys.size,
  routeCoverage: router.routeCount() === v2Actions.length - serverActions,
  legacyCoverage: legacy.total === 238 && legacy.mapped === 238 && legacy.removed === 0 && legacy.missing.length === 0,
  noScreenAutomation: automationMatches.length === 0,
  noForbiddenRuntimeDependency: forbiddenDependencies.length === 0,
  experimentalExcluded: buildConfig.includes("\"experimental\""),
  apacheLicense: packageJson.license === "Apache-2.0",
  distributionNotices: missingDistributionFiles.length === 0,
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
    safe14RealCandidates: safe14RealObservationActionKeys.size,
    legacyTools: legacy.total
  },
  duplicateActions,
  invalidSemanticKeys,
  invalidCertificationKeys,
  overlappingCertificationKeys,
  automationMatches,
  forbiddenDependencies,
  missingDistributionFiles
};
console.log(JSON.stringify(report, null, 2));
await adapter.disconnect();
if (!report.ok) process.exitCode = 1;
