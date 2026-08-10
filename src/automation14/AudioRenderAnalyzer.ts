import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface AudioAnalysisValues {
  peakDbfs?: number;
  truePeakDbfs?: number;
  rmsDb?: number;
  integratedLufs?: number;
  silenceStarts: number[];
  silenceEnds: number[];
}

export interface AudioRenderEvidence extends AudioAnalysisValues {
  verified: boolean;
  path: string;
  sha256: string;
  bytes: number;
  durationSeconds: number;
  codec: string;
  sampleFormat?: string;
  sampleRate: number;
  channels: number;
  bitRate: number;
  warnings: string[];
  analyzer: "ffprobe+ffmpeg";
}

function lastNumber(input: string, pattern: RegExp): number | undefined {
  const matches = [...input.matchAll(pattern)];
  const value = matches.at(-1)?.[1];
  return value === undefined ? undefined : Number(value);
}

export function parseFfmpegAudioAnalysis(output: string): AudioAnalysisValues {
  return {
    peakDbfs: lastNumber(output, /Peak level dB:\s*(-?[\d.]+)/g),
    truePeakDbfs: lastNumber(output, /Peak:\s*(-?[\d.]+) dBFS/g),
    rmsDb: lastNumber(output, /RMS level dB:\s*(-?[\d.]+)/g),
    integratedLufs: lastNumber(output, /I:\s*(-?[\d.]+) LUFS/g),
    silenceStarts: [...output.matchAll(/silence_start:\s*([\d.]+)/g)].map((match) => Number(match[1])),
    silenceEnds: [...output.matchAll(/silence_end:\s*([\d.]+)/g)].map((match) => Number(match[1]))
  };
}

async function sha256(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex").toUpperCase()));
  });
}

export class FfmpegAudioRenderAnalyzer {
  constructor(
    private readonly ffprobePath = "ffprobe",
    private readonly ffmpegPath = "ffmpeg"
  ) {}

  async analyze(path: string): Promise<AudioRenderEvidence> {
    const [file, digest, probe, analysis] = await Promise.all([
      stat(path),
      sha256(path),
      execFileAsync(this.ffprobePath, [
        "-v", "error",
        "-show_entries", "format=duration,size,bit_rate:stream=codec_name,sample_fmt,sample_rate,channels",
        "-of", "json",
        path
      ], { maxBuffer: 2 * 1024 * 1024 }),
      execFileAsync(this.ffmpegPath, [
        "-hide_banner", "-nostats", "-i", path,
        "-af", "astats=metadata=1:reset=0,ebur128=peak=true,silencedetect=noise=-50dB:d=0.5",
        "-f", "null", process.platform === "win32" ? "NUL" : "/dev/null"
      ], { maxBuffer: 8 * 1024 * 1024 })
    ]);
    const metadata = JSON.parse(probe.stdout) as {
      streams?: Array<{ codec_name?: string; sample_fmt?: string; sample_rate?: string; channels?: number }>;
      format?: { duration?: string; bit_rate?: string };
    };
    const stream = metadata.streams?.[0] ?? {};
    const values = parseFfmpegAudioAnalysis(`${analysis.stdout}\n${analysis.stderr}`);
    const durationSeconds = Number(metadata.format?.duration ?? 0);
    const sampleRate = Number(stream.sample_rate ?? 0);
    const channels = Number(stream.channels ?? 0);
    const warnings: string[] = [];
    if (values.truePeakDbfs !== undefined && values.truePeakDbfs > 0) warnings.push("true_peak_above_0_dbfs");
    if (
      (values.peakDbfs !== undefined && values.peakDbfs <= -80) ||
      (values.rmsDb !== undefined && values.rmsDb <= -70)
    ) warnings.push("render_effectively_silent");
    if (values.integratedLufs !== undefined && values.integratedLufs < -24) warnings.push("integrated_loudness_below_-24_lufs");
    if (values.integratedLufs !== undefined && values.integratedLufs > -8) warnings.push("integrated_loudness_above_-8_lufs");
    const verified = durationSeconds > 0 && sampleRate > 0 && channels > 0 &&
      values.peakDbfs !== undefined && values.peakDbfs > -80 &&
      values.truePeakDbfs !== undefined && values.truePeakDbfs <= 0 &&
      values.rmsDb !== undefined && values.rmsDb > -70 && values.integratedLufs !== undefined;
    return {
      verified,
      path,
      sha256: digest,
      bytes: file.size,
      durationSeconds,
      codec: stream.codec_name ?? "unknown",
      sampleFormat: stream.sample_fmt,
      sampleRate,
      channels,
      bitRate: Number(metadata.format?.bit_rate ?? 0),
      ...values,
      warnings,
      analyzer: "ffprobe+ffmpeg"
    };
  }
}
