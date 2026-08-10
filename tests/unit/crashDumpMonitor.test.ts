import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { CrashDumpMonitor } from "../../src/v2/CrashDumpMonitor.js";

const cleanup: string[] = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true
  })));
});

describe("Cubase crash-dump monitor", () => {
  it("passes when no Cubase dump appears during a scenario", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "cubase-mcp-dumps-"));
    cleanup.push(directory);
    const monitor = new CrashDumpMonitor([directory]);
    const before = await monitor.snapshot();
    await writeFile(resolve(directory, "unrelated.txt"), "not a dump", "utf8");
    const after = await monitor.snapshot();

    expect(monitor.audit(before, after)).toMatchObject({
      checked: true,
      passed: true,
      newOrChangedDumps: []
    });
  });

  it("fails when a new Cubase dump appears", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "cubase-mcp-dumps-"));
    cleanup.push(directory);
    const monitor = new CrashDumpMonitor([directory]);
    const before = await monitor.snapshot();
    await writeFile(resolve(directory, "Cubase14.exe.1234.dmp"), "crash", "utf8");
    const after = await monitor.snapshot();
    const audit = monitor.audit(before, after);

    expect(audit.checked).toBe(true);
    expect(audit.passed).toBe(false);
    expect(audit.newOrChangedDumps[0]?.path).toMatch(/Cubase14\.exe\.1234\.dmp$/);
  });
});
