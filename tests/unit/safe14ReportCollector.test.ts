import { describe, expect, it } from "vitest";
import type { CubaseHandshakeEvidence } from "../../src/diagnostics/CubaseConnectionDoctor.js";
import {
  collectSafe14ReportObservations,
  type Safe14RealReportInput
} from "../../src/v2/Safe14ReportCollector.js";

function handshake(): CubaseHandshakeEvidence {
  const mcpProtocol = {
    version: 2 as const,
    transportVersion: 1 as const,
    releaseProfile: "safe14",
    scriptBuild: "2.0.0-safe14"
  };
  return {
    connected: true,
    startedAt: "2026-07-29T00:00:00.000Z",
    completedAt: "2026-07-29T00:00:01.000Z",
    durationMs: 1000,
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
    response: {
      protocol: "cubase-mcp-midi",
      version: 1,
      type: "response",
      id: "ping-id",
      command: "ping",
      ok: true,
      payload: {
        appName: "Cubase",
        appVersion: "14.0.41",
        mcpProtocol,
        state: { transport: { state: "stopped" } }
      },
      timestamp: "2026-07-29T00:00:01.000Z"
    },
    appName: "Cubase",
    appVersion: "14.0.41",
    directAccessAvailable: true,
    mcpProtocol,
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
    }
  };
}

function report(): Safe14RealReportInput {
  return {
    handshake: handshake(),
    crashDumps: {
      checked: true,
      passed: true,
      checkedAt: "2026-07-29T00:00:02.000Z",
      directories: ["C:\\CrashDumps"],
      beforeCount: 0,
      afterCount: 0,
      newOrChangedDumps: []
    },
    smokeTests: [
      {
        name: "transport.stop.initial",
        passed: true,
        before: "stopped",
        after: "stopped",
        restoreAttempted: false
      },
      {
        name: "transport.play",
        passed: true,
        before: "stopped",
        after: "playing",
        restoreAttempted: false
      },
      {
        name: "transport.stop.final",
        passed: true,
        before: "playing",
        after: "stopped",
        restoreAttempted: false
      },
      {
        name: "transport.cycle",
        passed: true,
        before: false,
        after: true,
        restoreAttempted: true,
        restored: true,
        restoredValue: false
      }
    ],
    commandBindings: [{
      key: "track.add.audio",
      bindingCreated: true,
      canPerformSupported: false,
      executedInAudit: true,
      stateBefore: { tracks: 1 },
      stateAfter: { tracks: 2 },
      stateDiff: { changed: true },
      stateAfterRestore: { tracks: 1 },
      result: "real",
      restored: true
    }],
    directAccessTree: {
      capabilities: { makeDirectAccess: true },
      objects: [{ objectId: 1 }]
    },
    directAccessParameters: {
      parameters: [{ objectId: 1, parameterTag: 2 }],
      writeTests: []
    }
  };
}

describe("safe14 report observation collection", () => {
  it("translates only correlated, restored real-host scenarios", () => {
    const observations = collectSafe14ReportObservations(report(), "Pro");
    const byKey = new Map(observations.map((item) => [item.actionKey, item]));

    expect(byKey.get("cubase.transport.play")).toMatchObject({
      outcome: "real",
      restored: true,
      crashDumpChecked: true
    });
    expect(byKey.get("cubase.track.create_default_audio")).toMatchObject({
      outcome: "real",
      restored: true
    });
    expect(byKey.get("cubase.project.get")).toMatchObject({
      outcome: "blocked_by_cubase_api",
      blockerReason: "object_not_enumerable"
    });
    expect(byKey.has("cubase.export_run.perform_current_settings")).toBe(false);
  });

  it("rejects a report when a crash dump appeared", () => {
    const value = report();
    value.crashDumps.passed = false;
    value.crashDumps.newOrChangedDumps = [{
      path: "C:\\CrashDumps\\Cubase14.dmp",
      bytes: 1,
      modifiedAt: "2026-07-29T00:00:02.000Z"
    }];

    expect(() => collectSafe14ReportObservations(value, "Pro"))
      .toThrow(/crash-dump audit/i);
  });
});
