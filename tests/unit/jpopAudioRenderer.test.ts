import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { JpopAudioRenderer } from "../../src/song/JpopAudioRenderer.js";
import { SongProjectPlanner } from "../../src/song/SongProjectPlanner.js";

describe("JpopAudioRenderer", () => {
  it("renders deterministic audible stereo stems and a master WAV", async () => {
    const directory = await mkdtemp(join(tmpdir(), "cubase-jpop-render-"));
    try {
      const plan = new SongProjectPlanner().plan({ prompt: "1 bar J-pop loop", genre: "jpop", bars: 1, tempo: 138, key: "D major" });
      const result = await new JpopAudioRenderer().render(plan, { outputDirectory: directory, sampleRate: 8_000 });
      expect(result.files).toHaveLength(7);
      expect(result.files[0]).toMatchObject({ role: "master", peakDb: expect.any(Number), rmsDb: expect.any(Number) });
      expect(result.files[0]?.rmsDb).toBeGreaterThan(-60);
      expect(result.files.every((file) => file.rmsDb > -80)).toBe(true);
      const master = await readFile(result.files[0]?.path ?? "");
      expect(master.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(master.subarray(8, 12).toString("ascii")).toBe("WAVE");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("fails closed instead of rendering an incorrectly timed non-4/4 plan", async () => {
    const plan = new SongProjectPlanner().plan({
      prompt: "1 bar J-pop loop",
      genre: "jpop",
      bars: 1,
      tempo: 138,
      timeSignature: "3/4"
    });
    await expect(new JpopAudioRenderer().render(plan, {
      outputDirectory: join(tmpdir(), "cubase-jpop-unsupported-meter"),
      sampleRate: 8_000
    })).rejects.toThrow("supports 4/4");
  });
});
