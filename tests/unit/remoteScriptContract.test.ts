import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Cubase MIDI Remote script contract", () => {
  it("emits typed hello events and uses chunk framing in both installable scripts", async () => {
    const sources = await Promise.all([
      readFile(resolve("src/cubase-remote-script/direct-access-bridge.js"), "utf8"),
      readFile(resolve("src/cubase-remote-script/command-surface-bridge.js"), "utf8")
    ]);
    for (const source of sources) {
      expect(source).toContain("'cubase-mcp-midi-chunk'");
      expect(source).toContain("'hello'");
      expect(source).toMatch(/send(?:Protocol|WithType)\('hello'/);
      expect(source).toMatch(/MALFORMED_REQUEST|BRIDGE_EXCEPTION/);
    }
  });

  it("uses command category/name pairs from the official command registry", async () => {
    const source = await readFile(resolve("src/cubase-remote-script/direct-access-bridge.js"), "utf8");
    expect(source).toContain("category: 'Project', name: 'Remove Selected Tracks'");
    expect(source).toContain("category: 'Marker', name: 'Add Position Marker on Selected Track'");
    expect(source).toContain("category: 'Audio Export', name: 'Perform Audio Export'");
    expect(source).toContain("category: 'AddTrack', name: 'FX Channel'");
    expect(source).toContain("category: 'AddTrack', name: 'Group Channel'");
    expect(source).toContain("category: 'Quantize Category', name: 'Quantize'");
    expect(source).toContain("category: 'Marker', name: 'Add Position Marker on Active Track'");
    expect(source).toContain("category: 'Edit', name: 'Rename First Selected Track'");
    expect(source).toContain("category: 'Render in Place', name: 'Render (with Current Settings)'");
    expect(source).toMatch(/key: 'track\.duplicate'[^\n]+destructive: true/);
    expect(source).toMatch(/key: 'midi\.quantize'[^\n]+destructive: true/);
    expect(source).toMatch(/key: 'export\.perform_current_audio_export'[^\n]+destructive: true/);
    expect(source).not.toContain("category: 'Markers'");
  });

  it("wires DirectAccess lifecycle, callbacks, subscriptions and idle updates", async () => {
    const source = await readFile(resolve("src/cubase-remote-script/direct-access-bridge.js"), "utf8");
    for (const token of ["makeDirectAccess", ".activate(activeMappingRef)", ".deactivate(activeMapping)", "mOnObjectChange", "mOnObjectWillBeRemoved", "mOnParameterChange", "DA_SUBSCRIBE_OBJECT_CHANGES", "DA_SUBSCRIBE_PARAMETER_CHANGES", ".update(activeMappingRef)"]) {
      expect(source).toContain(token);
    }
  });
});
