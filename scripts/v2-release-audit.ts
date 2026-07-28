import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { CapabilityRegistry, type CapabilityManifest } from "../src/v2/CapabilityRegistry.js";
import { EvidenceMatrix } from "../src/v2/EvidenceMatrix.js";

const manifestPath = process.env.CUBASE_V2_CAPABILITY_MANIFEST;
const evidencePath = process.env.CUBASE_V2_EVIDENCE;
if (!manifestPath || !evidencePath) {
  console.error("CUBASE_V2_CAPABILITY_MANIFEST and CUBASE_V2_EVIDENCE are required.");
  process.exit(2);
}

const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8")) as CapabilityManifest;
const registry = new CapabilityRegistry();
registry.addManifest(manifest);
const matrix = new EvidenceMatrix();
await matrix.load(resolve(evidencePath));
const capabilityAudit = registry.releaseAudit(manifest.profile);
const evidenceAudit = matrix.audit(manifest);
const report = {
  ok: capabilityAudit.releasable && evidenceAudit.releasable,
  manifest: resolve(manifestPath),
  evidence: resolve(evidencePath),
  capabilityAudit,
  evidenceAudit
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;

