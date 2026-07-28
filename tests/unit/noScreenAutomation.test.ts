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
  it("does not contain forbidden automation adapters in src", () => {
    const matches = files("src").flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return forbidden.filter((term) => content.includes(term)).map((term) => ({ file, term }));
    });

    expect(matches).toEqual([]);
  });
});
