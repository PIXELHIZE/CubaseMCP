import { describe, expect, it } from "vitest";
import { CapabilityRegistry } from "../../src/v2/CapabilityRegistry.js";
import { EvidenceMatrix } from "../../src/v2/EvidenceMatrix.js";
import {
  SAFE14_HOST,
  assembleSafe14Certification,
  safe14RealObservationActionKeys,
  type Safe14Observation
} from "../../src/v2/Safe14Certification.js";
import { v2Actions } from "../../src/v2/actionManifest.js";

const capturedAt = "2026-07-29T00:00:00.000Z";

function blockedObservation(actionKey: string): Safe14Observation {
  return {
    id: `real:safe14:${actionKey}`,
    actionKey,
    hostProfile: SAFE14_HOST.profile,
    hostProduct: SAFE14_HOST.product,
    hostVersion: SAFE14_HOST.version,
    scriptBuild: SAFE14_HOST.scriptBuild,
    mcpProtocolVersion: SAFE14_HOST.mcpProtocolVersion,
    transportVersion: SAFE14_HOST.transportVersion,
    outcome: "blocked_by_cubase_api",
    blockerReason: "api_method_missing",
    method: "real_hardware",
    capturedAt,
    crashDumpChecked: true,
    artifacts: [],
    notes: ["Synthetic real-host blocker fixture."],
    constraints: {}
  };
}

describe("safe14 certification assembly", () => {
  it("covers all actions but remains uncertified while real observations are missing", () => {
    const bundle = assembleSafe14Certification([], capturedAt);

    expect(bundle.manifest.actions).toHaveLength(v2Actions.length);
    expect(bundle.manifest.releaseCertified).toBe(false);
    expect(bundle.unresolved).toHaveLength(safe14RealObservationActionKeys.size);
    expect(bundle.manifest.actions.filter((item) =>
      item.status === "unsupported_release_profile"
    ).map((item) => item.key)).toEqual(bundle.unresolved);
  });

  it("becomes releasable only when every real-hardware candidate has evidence", () => {
    const observations = [...safe14RealObservationActionKeys].map(blockedObservation);
    const bundle = assembleSafe14Certification(observations, capturedAt);
    const registry = new CapabilityRegistry([bundle.manifest]);
    const audit = new EvidenceMatrix(bundle.evidence).audit(bundle.manifest);

    expect(bundle.manifest.releaseCertified).toBe(true);
    expect(bundle.unresolved).toEqual([]);
    expect(registry.releaseAudit("safe14").releasable).toBe(true);
    expect(audit.releasable).toBe(true);
  });

  it("rejects observations from a different host patch", () => {
    const [key] = safe14RealObservationActionKeys;
    const observation = {
      ...blockedObservation(key),
      hostVersion: "14.0.32"
    };

    expect(() => assembleSafe14Certification([observation], capturedAt))
      .toThrow(/host contract mismatch/i);
  });
});
