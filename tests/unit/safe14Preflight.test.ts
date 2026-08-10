import { describe, expect, it } from "vitest";
import type { CubaseHandshakeEvidence } from "../../src/diagnostics/CubaseConnectionDoctor.js";
import { evaluateSafe14Preflight } from "../../src/v2/Safe14Preflight.js";

function handshake(overrides: Partial<CubaseHandshakeEvidence> = {}): CubaseHandshakeEvidence {
  return {
    connected: true,
    startedAt: "2026-07-29T00:00:00.000Z",
    completedAt: "2026-07-29T00:00:00.100Z",
    durationMs: 100,
    ports: {
      expected: {
        input: "AI MCP Bridge From Cubase",
        output: "AI MCP Bridge To Cubase"
      },
      available: {
        inputs: ["AI MCP Bridge From Cubase"],
        outputs: ["AI MCP Bridge To Cubase"]
      },
      inputFound: true,
      outputFound: true,
      likelyDirectionMismatch: false,
      valid: true,
      diagnoses: []
    },
    appName: "Cubase",
    appVersion: "14.0.41",
    mcpProtocol: {
      version: 2,
      transportVersion: 1,
      releaseProfile: "safe14",
      scriptBuild: "2.0.0-safe14"
    },
    routerDiagnostics: {
      requests: 1,
      retries: 0,
      framesSent: 1,
      framesReceived: 1,
      malformedFrames: 0,
      duplicateResponses: 0,
      orphanResponses: 0,
      reconnectEvents: 0,
      chunking: {
        chunksAccepted: 0,
        duplicateChunks: 0,
        conflictingChunks: 0,
        completedTransfers: 0,
        expiredTransfers: 0,
        checksumFailures: 0
      }
    },
    ...overrides
  };
}

describe("safe14 real-host preflight", () => {
  it("passes only the exact v2 Cubase Pro 14.0.41 contract without mutations", () => {
    const report = evaluateSafe14Preflight(handshake(), {
      edition: "Pro",
      checkedAt: "2026-07-29T00:00:01.000Z"
    });

    expect(report).toMatchObject({
      passed: true,
      screenAutomationUsed: false,
      mutatingOperationsExecuted: false,
      blockers: []
    });
    expect(report.checks).toHaveLength(9);
  });

  it("fails closed for an older host even when the bridge contract is valid", () => {
    const report = evaluateSafe14Preflight(handshake({ appVersion: "14.0.32.342" }), {
      edition: "Pro"
    });

    expect(report.passed).toBe(false);
    expect(report.blockers.map((item) => item.code)).toContain("host_version");
  });

  it("reports every missing v2 handshake and edition prerequisite", () => {
    const report = evaluateSafe14Preflight(handshake({
      connected: false,
      appName: undefined,
      appVersion: undefined,
      mcpProtocol: undefined,
      error: { code: "CUBASE_HANDSHAKE_FAILED", message: "MIDI request timed out: ping" }
    }));

    expect(report.passed).toBe(false);
    expect(report.blockers.map((item) => item.code)).toEqual(expect.arrayContaining([
      "bridge_ping",
      "host_application",
      "host_edition_attestation",
      "host_version",
      "release_profile",
      "script_build",
      "mcp_protocol",
      "transport_protocol"
    ]));
  });
});
