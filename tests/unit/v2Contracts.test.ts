import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { v2ActionSchemas, v2ToolNames } from "../../src/v2/actionSchemas.js";
import { v2Actions } from "../../src/v2/actionManifest.js";
import { CapabilityRegistry, type CapabilityManifest } from "../../src/v2/CapabilityRegistry.js";
import { EvidenceMatrix, type EvidenceRecord } from "../../src/v2/EvidenceMatrix.js";
import { parseHostHandshake } from "../../src/v2/HostHandshake.js";
import { ActionRouter } from "../../src/v2/ActionRouter.js";
import { MockCubaseAdapter } from "../../src/adapters/MockCubaseAdapter.js";
import { auditLegacyMapping, legacyToolMappings } from "../../src/v2/legacyMapping.js";
import { v2ActionDocumentation } from "../../src/v2/ActionDocumentation.js";
import { V2Controller } from "../../src/v2/V2Controller.js";
import { detectHostProfile } from "../../src/v2/HostProfile.js";

describe("v2 contracts", () => {
  it("has 25 tools and a declared action contract for every action", () => {
    expect(v2ToolNames).toHaveLength(25);
    expect(v2Actions.length).toBeGreaterThan(100);
    for (const tool of v2ToolNames) expect(v2ActionSchemas[tool]).toBeDefined();
  });

  it("publishes one schema-validated example for every action", () => {
    expect(v2ActionDocumentation).toHaveLength(v2Actions.length);
    expect(new Set(v2ActionDocumentation.map((item) => item.key)).size).toBe(v2Actions.length);
    for (const document of v2ActionDocumentation) {
      expect(v2ActionSchemas[document.tool].safeParse(document.example).success, document.key).toBe(true);
    }
  });

  it("routes every non-server action and maps every legacy tool", async () => {
    const adapter = new MockCubaseAdapter();
    await adapter.connect();
    const router = new ActionRouter(adapter);
    const serverActions = v2Actions.filter((item) =>
      item.tool === "cubase.system" || item.tool === "cubase.song" || item.tool === "cubase.batch"
    ).length;
    expect(router.routeCount()).toBe(v2Actions.length - serverActions);
    expect(auditLegacyMapping()).toMatchObject({ total: 238, mapped: 238, removed: 0, missing: [] });
    expect(new Set(legacyToolMappings.map((mapping) => mapping.legacyTool)).size).toBe(238);
  });

  it("preflights nested batch steps against their actual action schemas", async () => {
    const adapter = new MockCubaseAdapter();
    await adapter.connect();
    const controller = new V2Controller(adapter, await detectHostProfile(adapter));
    const result = await controller.invoke("cubase.batch", {
      action: "preview",
      steps: [
        { tool: "cubase.system", action: "status" },
        { tool: "cubase.track", action: "rename", input: {} }
      ]
    });
    expect(result.ok).toBe(true);
    expect(result.preview).toMatchObject({
      validation: [
        { valid: true, tool: "cubase.system", action: "status" },
        { valid: false, tool: "cubase.track", action: "rename" }
      ]
    });
    await adapter.disconnect();
  });

  it("keeps safe15 as an unverified release profile, not an unsupported host version", () => {
    const registry = new CapabilityRegistry();
    const capability = registry.resolve({
      product: "Cubase",
      edition: "Pro",
      version: "15.0.20",
      midiRemoteApiVersion: "1.3",
      sessionId: "safe15",
      supportStatus: "unverified_host_profile",
      profile: "safe15"
    }, "cubase.track.list");
    expect(capability.status).toBe("unsupported_release_profile");
    expect(capability.constraints).toMatchObject({ hostSupportStatus: "unverified_host_profile" });
  });

  it("does not apply certified claims to a different product or patch version", () => {
    const capturedAt = new Date().toISOString();
    const manifest: CapabilityManifest = {
      protocolVersion: 2,
      transportVersion: 1,
      profile: "safe14",
      hostProduct: "Cubase Pro",
      hostVersion: "14.0.41",
      scriptBuild: "2.0.0-safe14",
      generatedAt: capturedAt,
      releaseCertified: true,
      actions: v2Actions.map((action) => ({
        key: action.key,
        profile: "safe14",
        status: "blocked_by_cubase_api",
        blockerReason: "api_method_missing",
        constraints: {},
        evidenceId: `evidence:${action.key}`
      }))
    };
    const registry = new CapabilityRegistry([manifest]);
    const wrongPatch = registry.resolve({
      product: "Cubase",
      edition: "Pro",
      version: "14.0.50",
      sessionId: "wrong-patch",
      supportStatus: "unverified_host_profile",
      profile: "safe14"
    }, "cubase.track.list");
    expect(wrongPatch.status).toBe("unsupported_release_profile");
    expect(registry.isCertifiedHost({
      product: "Cubase",
      edition: "Pro",
      version: "14.0.41",
      mcpProtocolVersion: 2,
      mcpTransportVersion: 1,
      scriptBuild: "2.0.0-safe14",
      sessionId: "exact",
      supportStatus: "unverified_host_profile",
      profile: "safe14"
    })).toBe(true);
  });

  it("parses only the v2 application handshake over transport v1", () => {
    expect(parseHostHandshake({
      mcpProtocol: { version: 2, transportVersion: 1, releaseProfile: "safe14", scriptBuild: "2.0.0-safe14" }
    })).toEqual({
      version: 2,
      transportVersion: 1,
      releaseProfile: "safe14",
      scriptBuild: "2.0.0-safe14"
    });
    expect(parseHostHandshake({ protocol: { version: 1 } })).toBeUndefined();
  });

  it("requires evidence for every real or blocked release action", () => {
    const capturedAt = new Date().toISOString();
    const records: EvidenceRecord[] = v2Actions.map((action) => ({
      id: `evidence:${action.key}`,
      actionKey: action.key,
      hostProfile: "safe14",
      hostProduct: "Cubase Pro",
      hostVersion: "14.0.41",
      scriptBuild: "2.0.0-safe14",
      mcpProtocolVersion: 2,
      transportVersion: 1,
      outcome: "blocked_by_cubase_api",
      method: "static_api_analysis",
      capturedAt,
      artifacts: [],
      notes: []
    }));
    const manifest: CapabilityManifest = {
      protocolVersion: 2,
      transportVersion: 1,
      profile: "safe14",
      hostProduct: "Cubase Pro",
      hostVersion: "14.0.41",
      scriptBuild: "2.0.0-safe14",
      generatedAt: capturedAt,
      releaseCertified: true,
      actions: v2Actions.map((action) => ({
        key: action.key,
        profile: "safe14",
        status: "blocked_by_cubase_api",
        blockerReason: "api_method_missing",
        constraints: {},
        evidenceId: `evidence:${action.key}`
      }))
    };
    expect(new EvidenceMatrix(records).audit(manifest)).toMatchObject({
      releasable: true,
      totalActions: v2Actions.length,
      realActions: 0,
      blockedActions: v2Actions.length,
      missingEvidence: []
    });
  });

  it("rejects wrong-host and incomplete mutation evidence", () => {
    const capturedAt = new Date().toISOString();
    const realKey = "cubase.track.rename";
    const records: EvidenceRecord[] = v2Actions.map((action) => ({
      id: `evidence:${action.key}`,
      actionKey: action.key,
      hostProfile: "safe14",
      hostProduct: action.key === realKey ? "Cubase Artist" : "Cubase Pro",
      hostVersion: "14.0.41",
      scriptBuild: "2.0.0-safe14",
      mcpProtocolVersion: 2,
      transportVersion: 1,
      outcome: action.key === realKey ? "real" : "blocked_by_cubase_api",
      method: action.key === realKey ? "real_hardware" : "static_api_analysis",
      capturedAt,
      crashDumpChecked: action.key === realKey,
      artifacts: [],
      notes: []
    }));
    const manifest: CapabilityManifest = {
      protocolVersion: 2,
      transportVersion: 1,
      profile: "safe14",
      hostProduct: "Cubase Pro",
      hostVersion: "14.0.41",
      scriptBuild: "2.0.0-safe14",
      generatedAt: capturedAt,
      releaseCertified: true,
      actions: v2Actions.map((action) => action.key === realKey ? {
        key: action.key,
        profile: "safe14",
        status: "real",
        constraints: {},
        evidenceId: `evidence:${action.key}`
      } : {
        key: action.key,
        profile: "safe14",
        status: "blocked_by_cubase_api",
        blockerReason: "api_method_missing",
        constraints: {},
        evidenceId: `evidence:${action.key}`
      })
    };
    expect(new EvidenceMatrix(records).audit(manifest)).toMatchObject({
      releasable: false,
      hostMismatches: [realKey],
      incompleteMutationEvidence: [realKey],
      unrestoredMutations: [realKey]
    });
  });

  it("verifies evidence artifact existence, byte length, and SHA-256", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cubase-v2-evidence-"));
    try {
      const content = Buffer.from("verified export");
      await writeFile(join(directory, "mix.wav"), content);
      const matrix = new EvidenceMatrix([{
        id: "export-evidence",
        actionKey: "cubase.export_run.mixdown_explicit",
        hostProfile: "safe14",
        hostProduct: "Cubase Pro",
        hostVersion: "14.0.41",
        scriptBuild: "2.0.0-safe14",
        mcpProtocolVersion: 2,
        transportVersion: 1,
        outcome: "real",
        method: "real_hardware",
        capturedAt: new Date().toISOString(),
        crashDumpChecked: true,
        artifacts: [{
          path: "mix.wav",
          bytes: content.length,
          sha256: createHash("sha256").update(content).digest("hex")
        }],
        notes: []
      }]);
      await expect(matrix.verifyArtifacts(directory, "safe14")).resolves.toEqual({
        valid: true,
        checked: 1,
        invalidArtifacts: []
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
