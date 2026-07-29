import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runRealCubaseReport, type ReportRunResult, type SmokeTestResult } from "../../scripts/cubase-report.js";
import { assertRealTestFixtureAuthorization } from "../../src/v2/RealTestSafety.js";

const requireReal = process.env.CUBASE_REQUIRE_REAL === "true" || process.env.npm_lifecycle_event === "test:real";
const describeReal = requireReal ? describe : describe.skip;

interface CapabilityEvidence {
  tool: string;
  status: string;
  testedWithRealCubase: boolean;
}

interface CommandEvidence {
  key: string;
  bindingCreated: boolean;
  canPerformSupported: boolean;
  executedInAudit: boolean;
  result: string;
}

async function json<T>(directory: string, fileName: string): Promise<T> {
  return JSON.parse(await readFile(resolve(directory, fileName), "utf8")) as T;
}

describeReal("real Cubase evidence report", () => {
  let run: ReportRunResult;

  beforeAll(async () => {
    assertRealTestFixtureAuthorization(process.env);
    run = await runRealCubaseReport({
      mode: "discover",
      executeDestructive: process.env.CUBASE_REAL_DESTRUCTIVE === "true"
    });
  }, 180_000);

  it("writes the complete evidence bundle from a correlated real handshake", async () => {
    expect(run.success, JSON.stringify(run.errors, null, 2)).toBe(true);
    const requiredFiles = [
      "summary.md",
      "raw-handshake.json",
      "direct-access-tree.json",
      "direct-access-parameters.json",
      "command-bindings.json",
      "plugin-manager.json",
      "tool-capability-matrix.json",
      "errors.json",
      "crash-dumps.json",
      "next-actions.md",
      "smoke-tests.json"
    ];
    await Promise.all(requiredFiles.map((file) => access(resolve(run.reportDirectory, file))));

    const handshake = await json<Record<string, unknown>>(run.reportDirectory, "raw-handshake.json");
    expect(handshake.connected).toBe(true);
    expect(handshake.midiRemoteApiVersion).toBeTypeOf("string");
    expect(handshake.routerDiagnostics).toBeDefined();
  });

  it("checks for new Cubase crash dumps during the real scenario", async () => {
    const crashDumps = await json<{
      checked: boolean;
      passed: boolean;
      newOrChangedDumps: unknown[];
    }>(run.reportDirectory, "crash-dumps.json");
    expect(crashDumps.checked).toBe(true);
    expect(crashDumps.passed).toBe(true);
    expect(crashDumps.newOrChangedDumps).toEqual([]);
  });

  it("records DirectAccess roots or an explicit feature-detection blocker", async () => {
    const tree = await json<{ roots: string[]; trees: Record<string, unknown>; objects: unknown[] }>(run.reportDirectory, "direct-access-tree.json");
    expect(tree.roots).toEqual(expect.arrayContaining(["transport", "trackSelection", "mixConsole", "focusedQuickControls"]));
    const parameters = await json<{ parameters: unknown[]; writeTests: unknown[] }>(run.reportDirectory, "direct-access-parameters.json");
    const handshake = await json<{ directAccessAvailable?: boolean }>(run.reportDirectory, "raw-handshake.json");
    if (handshake.directAccessAvailable) {
      expect(Object.keys(tree.trees)).toEqual(expect.arrayContaining(tree.roots));
      expect(tree.objects.length).toBeGreaterThan(0);
      expect(parameters.parameters.length).toBeGreaterThan(0);
    } else {
      const errors = await json<Array<{ stage: string; message: string }>>(run.reportDirectory, "errors.json");
      expect(tree.objects).toEqual([]);
      expect(parameters.parameters).toEqual([]);
      expect(errors.some((entry) => entry.stage === "direct-access" && /unsupported|command-surface-only/i.test(entry.message))).toBe(true);
    }
  });

  it("runs required transport smoke tests and records every optional probe", async () => {
    const smoke = await json<SmokeTestResult[]>(run.reportDirectory, "smoke-tests.json");
    const byName = new Map(smoke.map((entry) => [entry.name, entry]));
    const required = [
      "transport.stop.initial",
      "transport.play",
      "transport.stop.final",
      "transport.cycle",
      "transport.metronome"
    ];
    const optional = [
      "selected.volume",
      "selected.pan",
      "selected.mute",
      "selected.solo",
      "focusedQuickControl.write",
      "directAccess.parameter.read",
      "directAccess.parameter.write"
    ];
    for (const name of required) {
      expect(byName.get(name), `Missing smoke evidence: ${name}`).toBeDefined();
      expect(byName.get(name)?.passed, `${name}: ${byName.get(name)?.error ?? "failed"}`).toBe(true);
    }
    for (const name of optional) {
      const evidence = byName.get(name);
      expect(evidence, `Missing optional smoke evidence: ${name}`).toBeDefined();
      if (!evidence?.passed) expect(evidence?.error, `${name} failed without an explicit reason`).toBeTypeOf("string");
    }
  });

  it("audits every required command and records canPerform feature detection", async () => {
    const commands = await json<CommandEvidence[]>(run.reportDirectory, "command-bindings.json");
    expect(commands.length).toBeGreaterThanOrEqual(23);
    expect(commands.every((entry) => entry.bindingCreated)).toBe(true);
    expect(commands.every((entry) => typeof entry.canPerformSupported === "boolean")).toBe(true);

    for (const key of ["marker.add_position_selected", "marker.add_cycle_selected", "export.perform_current_audio_export"]) {
      expect(commands.find((entry) => entry.key === key)).toMatchObject({ bindingCreated: true });
    }
  });

  it("records plugin-manager availability or an explicit host-specific blocker", async () => {
    const plugin = await json<Record<string, unknown>>(run.reportDirectory, "plugin-manager.json");
    expect(plugin).toHaveProperty("capabilityReported");
    expect(plugin).toHaveProperty("available");
    expect(plugin).toHaveProperty("assignmentSupported");
    expect(plugin).toHaveProperty("errors");
  });

  it("never marks an untested capability as real", async () => {
    const capabilities = await json<CapabilityEvidence[]>(run.reportDirectory, "tool-capability-matrix.json");
    expect(capabilities.filter((item) => item.status === "real" && !item.testedWithRealCubase)).toEqual([]);
  });
});
