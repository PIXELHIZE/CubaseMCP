import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const forbidden = [
  "SendKeys",
  "AutoHotkey",
  "OsAutomationAdapter",
  "KeyboardShortcutAdapter",
  "MouseAutomationAdapter",
  "ScreenAutomationAdapter",
  "DialogAutomation",
  "WindowsAutomation",
  "SetForegroundWindow",
  "SendInput(",
  "keybd_event(",
  "robotjs",
  "@nut-tree"
];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (path.includes("node_modules") || path.includes("dist")) return [];
    return statSync(path).isDirectory() ? files(path) : /\.(?:ts|js)$/.test(path) ? [path] : [];
  });
}

describe("screen automation exclusion", () => {
  it("keeps forbidden automation out of the official safe14 runtime", () => {
    const matches = files("src").filter((file) => !file.includes(join("src", "automation14"))).flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return forbidden.filter((term) => content.includes(term)).map((term) => ({ file, term }));
    });

    expect(matches).toEqual([]);
  });

  it("isolates the explicitly opt-in non-official driver", () => {
    const automationFiles = files(join("src", "automation14"));
    expect(automationFiles.some((file) => readFileSync(file, "utf8").includes("SetForegroundWindow"))).toBe(true);
    expect(readFileSync(join("src", "server.ts"), "utf8")).toContain('host.profile === "automation14"');
  });
});
