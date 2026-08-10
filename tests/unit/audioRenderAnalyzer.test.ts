import { describe, expect, it } from "vitest";
import { parseFfmpegAudioAnalysis } from "../../src/automation14/AudioRenderAnalyzer.js";

describe("AudioRenderAnalyzer", () => {
  it("extracts the final FFmpeg loudness, peak, RMS, and silence measurements", () => {
    const parsed = parseFfmpegAudioAnalysis(`
      Peak level dB: -0.971402
      RMS level dB: -18.783883
      I: -16.1 LUFS
      silence_start: 12.5
      silence_end: 13.25 | silence_duration: 0.75
      True peak:
      Peak: -1.0 dBFS
    `);
    expect(parsed).toEqual({
      peakDbfs: -0.971402,
      truePeakDbfs: -1,
      rmsDb: -18.783883,
      integratedLufs: -16.1,
      silenceStarts: [12.5],
      silenceEnds: [13.25]
    });
  });
});
