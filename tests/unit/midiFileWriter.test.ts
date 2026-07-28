import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MidiFileWriter } from "../../src/media/MidiFileWriter.js";

describe("MidiFileWriter", () => {
  it("writes a valid type-0 Standard MIDI File", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cubase-mcp-midi-"));
    try {
      const filePath = join(directory, "beat.mid");
      const result = await new MidiFileWriter().write({
        outputPath: filePath,
        tempo: 124,
        ppq: 480,
        notes: [
          { pitch: 36, start: "1.1.1.0", length: "0.1.0.0", velocity: 120 },
          { pitch: 42, start: "1.2.1.0", length: "0.0.2.0", velocity: 90 }
        ]
      });
      const bytes = await readFile(filePath);
      expect(bytes.subarray(0, 4).toString("ascii")).toBe("MThd");
      expect(bytes.subarray(14, 18).toString("ascii")).toBe("MTrk");
      expect(result.noteCount).toBe(2);
      expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
