import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  assembleSafe14Certification
} from "../src/v2/Safe14Certification.js";
import {
  collectSafe14ReportObservations,
  type Safe14RealReportInput
} from "../src/v2/Safe14ReportCollector.js";

async function json<T>(directory: string, name: string): Promise<T> {
  return JSON.parse(await readFile(resolve(directory, name), "utf8")) as T;
}

async function latestReportDirectory(): Promise<string> {
  const root = resolve("reports", "real-cubase");
  const entries = await readdir(root, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse();
  const latest = directories[0];
  if (!latest) throw new Error("No real Cubase diagnostic report was found.");
  return resolve(root, latest);
}

const reportDirectory = process.env.CUBASE_REAL_REPORT_DIR
  ? resolve(process.env.CUBASE_REAL_REPORT_DIR)
  : await latestReportDirectory();
const report: Safe14RealReportInput = {
  handshake: await json(reportDirectory, "raw-handshake.json"),
  crashDumps: await json(reportDirectory, "crash-dumps.json"),
  smokeTests: await json(reportDirectory, "smoke-tests.json"),
  commandBindings: await json(reportDirectory, "command-bindings.json"),
  directAccessTree: await json(reportDirectory, "direct-access-tree.json"),
  directAccessParameters: await json(reportDirectory, "direct-access-parameters.json")
};

const maxAgeMs = Number(process.env.CUBASE_EVIDENCE_MAX_AGE_MS ?? 15 * 60 * 1000);
const ageMs = Date.now() - Date.parse(report.handshake.completedAt);
if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > maxAgeMs) {
  throw new Error(`Latest real Cubase report is stale (${ageMs}ms old; maximum ${maxAgeMs}ms).`);
}

const observations = collectSafe14ReportObservations(
  report,
  process.env.CUBASE_HOST_EDITION
);
const bundle = assembleSafe14Certification(observations);
const observationsPath = resolve(
  process.env.CUBASE_V2_OBSERVATIONS ?? "reports/v2/safe14.observations.json"
);
const manifestPath = resolve(
  process.env.CUBASE_V2_CAPABILITY_MANIFEST ?? "reports/v2/safe14.manifest.json"
);
const evidencePath = resolve(
  process.env.CUBASE_V2_EVIDENCE ?? "reports/v2/safe14.evidence.json"
);
const summaryPath = resolve("reports", "v2", "safe14.certification-summary.json");
await Promise.all([
  mkdir(dirname(observationsPath), { recursive: true }),
  mkdir(dirname(manifestPath), { recursive: true }),
  mkdir(dirname(evidencePath), { recursive: true }),
  mkdir(dirname(summaryPath), { recursive: true })
]);
await Promise.all([
  writeFile(observationsPath, `${JSON.stringify(observations, null, 2)}\n`, "utf8"),
  writeFile(manifestPath, `${JSON.stringify(bundle.manifest, null, 2)}\n`, "utf8"),
  writeFile(evidencePath, `${JSON.stringify(bundle.evidence, null, 2)}\n`, "utf8"),
  writeFile(summaryPath, `${JSON.stringify({
    policyVersion: bundle.policyVersion,
    reportDirectory,
    observations: observations.length,
    actions: bundle.manifest.actions.length,
    releaseCertified: bundle.manifest.releaseCertified,
    unresolved: bundle.unresolved,
    outputs: { observationsPath, manifestPath, evidencePath }
  }, null, 2)}\n`, "utf8")
]);

console.log(JSON.stringify({
  reportDirectory,
  observations: observations.length,
  actions: bundle.manifest.actions.length,
  releaseCertified: bundle.manifest.releaseCertified,
  unresolved: bundle.unresolved,
  manifestPath,
  evidencePath
}, null, 2));
