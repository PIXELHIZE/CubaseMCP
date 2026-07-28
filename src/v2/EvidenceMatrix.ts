import { readFile } from "node:fs/promises";
import { z } from "zod/v4";
import { v2Actions } from "./actionManifest.js";
import type { CapabilityManifest } from "./CapabilityRegistry.js";

export const EvidenceRecordSchema = z.object({
  id: z.string().min(1),
  actionKey: z.string().min(1),
  hostProfile: z.string().min(1),
  hostProduct: z.string().min(1),
  hostVersion: z.string().min(1),
  outcome: z.enum(["real", "blocked_by_cubase_api", "blocked_by_no_headless_api"]),
  method: z.enum(["unit", "protocol", "real_hardware", "static_api_analysis"]),
  capturedAt: z.string().datetime(),
  requestId: z.string().optional(),
  fixture: z.string().optional(),
  stateBefore: z.unknown().optional(),
  stateAfter: z.unknown().optional(),
  stateDiff: z.unknown().optional(),
  restored: z.boolean().optional(),
  crashDumpChecked: z.boolean().optional(),
  artifacts: z.array(z.object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/i).optional(),
    bytes: z.number().int().nonnegative().optional()
  })).default([]),
  notes: z.array(z.string()).default([])
});

export type EvidenceRecord = z.infer<typeof EvidenceRecordSchema>;

export interface EvidenceAudit {
  releasable: boolean;
  profile: string;
  totalActions: number;
  realActions: number;
  blockedActions: number;
  missingCapabilities: string[];
  missingEvidence: string[];
  mismatchedEvidence: string[];
  insufficientRealEvidence: string[];
  unrestoredMutations: string[];
  uncheckedCrashDumps: string[];
}

const serverSideReal = new Set([
  "cubase.system.status",
  "cubase.system.capabilities",
  "cubase.system.diagnose",
  "cubase.song.plan"
]);

export class EvidenceMatrix {
  private readonly evidence = new Map<string, EvidenceRecord>();

  constructor(records: EvidenceRecord[] = []) {
    for (const record of records) this.add(record);
  }

  add(record: EvidenceRecord): void {
    const parsed = EvidenceRecordSchema.parse(record);
    if (this.evidence.has(parsed.id)) throw new Error(`Duplicate evidence ID: ${parsed.id}`);
    this.evidence.set(parsed.id, parsed);
  }

  async load(path: string): Promise<void> {
    const content = JSON.parse(await readFile(path, "utf8")) as unknown;
    const records = z.array(EvidenceRecordSchema).parse(content);
    for (const record of records) this.add(record);
  }

  list(profile?: string): EvidenceRecord[] {
    return [...this.evidence.values()]
      .filter((record) => !profile || record.hostProfile === profile)
      .map((record) => structuredClone(record));
  }

  audit(manifest: CapabilityManifest): EvidenceAudit {
    const expected = new Set(v2Actions.map((action) => action.key));
    const capabilities = new Map(manifest.actions.map((capability) => [capability.key, capability]));
    const missingCapabilities = [...expected].filter((key) => !capabilities.has(key));
    const missingEvidence: string[] = [];
    const mismatchedEvidence: string[] = [];
    const insufficientRealEvidence: string[] = [];
    const unrestoredMutations: string[] = [];
    const uncheckedCrashDumps: string[] = [];

    for (const capability of manifest.actions) {
      if (capability.status === "unsupported_release_profile") {
        mismatchedEvidence.push(`${capability.key}:unsupported_release_profile`);
        continue;
      }
      const evidence = capability.evidenceId ? this.evidence.get(capability.evidenceId) : undefined;
      if (!evidence || evidence.id.startsWith("pending:")) {
        missingEvidence.push(capability.key);
        continue;
      }
      if (
        evidence.actionKey !== capability.key ||
        evidence.hostProfile !== manifest.profile ||
        evidence.outcome !== capability.status
      ) {
        mismatchedEvidence.push(capability.key);
      }
      if (
        capability.status === "real" &&
        !serverSideReal.has(capability.key) &&
        evidence.method !== "real_hardware"
      ) {
        insufficientRealEvidence.push(capability.key);
      }
      if (capability.status === "real" && evidence.stateDiff !== undefined && evidence.restored !== true) {
        unrestoredMutations.push(capability.key);
      }
      if (evidence.method === "real_hardware" && evidence.crashDumpChecked !== true) {
        uncheckedCrashDumps.push(capability.key);
      }
    }

    const releasable =
      manifest.releaseCertified &&
      missingCapabilities.length === 0 &&
      missingEvidence.length === 0 &&
      mismatchedEvidence.length === 0 &&
      insufficientRealEvidence.length === 0 &&
      unrestoredMutations.length === 0 &&
      uncheckedCrashDumps.length === 0;
    return {
      releasable,
      profile: manifest.profile,
      totalActions: manifest.actions.length,
      realActions: manifest.actions.filter((capability) => capability.status === "real").length,
      blockedActions: manifest.actions.filter((capability) => capability.status.startsWith("blocked_")).length,
      missingCapabilities,
      missingEvidence,
      mismatchedEvidence,
      insufficientRealEvidence,
      unrestoredMutations,
      uncheckedCrashDumps
    };
  }
}
