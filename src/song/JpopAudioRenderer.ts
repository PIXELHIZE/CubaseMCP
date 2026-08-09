import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { SongPlan } from "./models.js";

type RenderRole = "drums" | "bass" | "chords" | "pad" | "arp" | "lead";

export interface JpopAudioRenderOptions {
  outputDirectory: string;
  sampleRate?: number;
  title?: string;
}

export interface RenderedAudioFile {
  role: RenderRole | "master";
  path: string;
  bytes: number;
  sha256: string;
  peakDb: number;
  rmsDb: number;
}

export interface JpopAudioRenderResult {
  title: string;
  tempo: number;
  bars: number;
  durationSeconds: number;
  sampleRate: number;
  files: RenderedAudioFile[];
}

interface StereoBuffer {
  left: Float32Array;
  right: Float32Array;
}

interface Chord {
  root: number;
  minor: boolean;
}

const roles: RenderRole[] = ["drums", "bass", "chords", "pad", "arp", "lead"];

function midiFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function decibels(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -144;
}

function deterministicNoise(index: number, seed: number): number {
  const value = Math.sin((index + seed * 131) * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function chordForBar(bar: number, sectionName: string): Chord {
  const chorus = /chorus/i.test(sectionName);
  const bridge = /bridge/i.test(sectionName);
  const progressions: Chord[][] = chorus
    ? [[{ root: 59, minor: true }, { root: 55, minor: false }, { root: 62, minor: false }, { root: 57, minor: false }]]
    : bridge
      ? [[{ root: 55, minor: false }, { root: 57, minor: false }, { root: 54, minor: true }, { root: 59, minor: true }]]
      : [[{ root: 62, minor: false }, { root: 57, minor: false }, { root: 59, minor: true }, { root: 55, minor: false }]];
  return progressions[0][(bar - 1) % 4] as Chord;
}

function sectionAt(plan: SongPlan, bar: number): string {
  return plan.sections.find((section) => bar >= section.startBar && bar < section.startBar + section.bars)?.name ?? "Main";
}

function sectionIntensity(name: string): number {
  if (/final chorus/i.test(name)) return 1;
  if (/chorus/i.test(name)) return 0.94;
  if (/pre-chorus/i.test(name)) return 0.82;
  if (/bridge/i.test(name)) return 0.76;
  if (/verse/i.test(name)) return 0.66;
  if (/intro/i.test(name)) return 0.58;
  if (/outro/i.test(name)) return 0.5;
  return 0.82;
}

export class JpopAudioRenderer {
  async render(plan: SongPlan, options: JpopAudioRenderOptions): Promise<JpopAudioRenderResult> {
    if (plan.bars < 1) throw new Error("J-pop rendering requires at least one bar.");
    if (!Number.isFinite(plan.tempo) || plan.tempo <= 0) throw new Error(`Invalid render tempo: ${plan.tempo}`);
    if (plan.timeSignature !== "4/4") {
      throw new Error(`J-pop renderer supports 4/4 plans, received ${plan.timeSignature}.`);
    }
    const sampleRate = options.sampleRate ?? 48_000;
    if (!Number.isInteger(sampleRate) || sampleRate < 8_000 || sampleRate > 192_000) {
      throw new Error(`Unsupported render sample rate: ${sampleRate}`);
    }
    const secondsPerBeat = 60 / plan.tempo;
    const durationSeconds = plan.bars * 4 * secondsPerBeat + 2;
    const sampleCount = Math.ceil(durationSeconds * sampleRate);
    const outputDirectory = resolve(options.outputDirectory);
    const title = options.title ?? "Cubase MCP J-pop Demo";
    await mkdir(outputDirectory, { recursive: true });
    const master = this.buffer(sampleCount);
    const files: RenderedAudioFile[] = [];
    const stemGains: Record<RenderRole, number> = {
      drums: 0.9, bass: 0.82, chords: 0.68, pad: 0.48, arp: 0.54, lead: 0.72
    };

    for (const role of roles) {
      const stem = this.buffer(sampleCount);
      this.renderRole(role, stem, plan, sampleRate, secondsPerBeat);
      if (["chords", "pad", "arp", "lead"].includes(role)) this.addSpace(stem, sampleRate, role === "lead" ? 0.21 : 0.13);
      this.normalize(stem, 0.9);
      this.mix(master, stem, stemGains[role]);
      const stemPath = join(outputDirectory, `${String(roles.indexOf(role) + 1).padStart(2, "0")}_${role}.wav`);
      files.push(await this.writeWave(stemPath, role, stem, sampleRate));
    }

    this.fade(master, sampleRate, 1.5, 2);
    this.softLimit(master);
    this.normalize(master, 0.89);
    const masterPath = join(outputDirectory, "00_master.wav");
    files.unshift(await this.writeWave(masterPath, "master", master, sampleRate));
    return { title, tempo: plan.tempo, bars: plan.bars, durationSeconds, sampleRate, files };
  }

  private buffer(samples: number): StereoBuffer {
    return { left: new Float32Array(samples), right: new Float32Array(samples) };
  }

  private renderRole(role: RenderRole, output: StereoBuffer, plan: SongPlan, sampleRate: number, secondsPerBeat: number): void {
    for (let bar = 1; bar <= plan.bars; bar += 1) {
      const section = sectionAt(plan, bar);
      const intensity = sectionIntensity(section);
      const start = (bar - 1) * 4 * secondsPerBeat;
      const chord = chordForBar(bar, section);
      if (role === "drums") this.drums(output, start, secondsPerBeat, sampleRate, intensity, section, bar);
      if (role === "bass") this.bass(output, start, secondsPerBeat, sampleRate, chord, intensity, section);
      if (role === "chords") this.chords(output, start, secondsPerBeat, sampleRate, chord, intensity);
      if (role === "pad") this.pad(output, start, secondsPerBeat, sampleRate, chord, intensity, section);
      if (role === "arp") this.arp(output, start, secondsPerBeat, sampleRate, chord, intensity, section, bar);
      if (role === "lead") this.lead(output, start, secondsPerBeat, sampleRate, chord, intensity, section, bar);
    }
  }

  private addTone(
    output: StereoBuffer,
    midi: number,
    startSeconds: number,
    durationSeconds: number,
    amplitude: number,
    sampleRate: number,
    timbre: "bass" | "piano" | "pad" | "pluck" | "lead",
    pan = 0
  ): void {
    const start = Math.max(0, Math.floor(startSeconds * sampleRate));
    const length = Math.max(1, Math.floor(durationSeconds * sampleRate));
    const end = Math.min(output.left.length, start + length);
    const frequency = midiFrequency(midi);
    const leftGain = Math.sqrt((1 - clamp(pan, -1, 1)) / 2);
    const rightGain = Math.sqrt((1 + clamp(pan, -1, 1)) / 2);
    const attack = timbre === "pad" ? 0.18 : timbre === "lead" ? 0.025 : 0.008;
    const release = timbre === "pad" ? 0.38 : timbre === "piano" ? 0.3 : 0.12;
    for (let index = start; index < end; index += 1) {
      const time = (index - start) / sampleRate;
      const remaining = (end - index) / sampleRate;
      const envelope = Math.min(1, time / attack) * Math.min(1, remaining / release);
      const phase = 2 * Math.PI * frequency * time;
      let sample: number;
      if (timbre === "bass") sample = Math.sin(phase) * 0.78 + Math.sin(phase * 2) * 0.16 + (2 * ((frequency * time) % 1) - 1) * 0.06;
      else if (timbre === "piano") sample = (Math.sin(phase) + Math.sin(phase * 2) * 0.42 + Math.sin(phase * 3) * 0.18) * Math.exp(-time * 1.35);
      else if (timbre === "pad") sample = Math.sin(phase) * 0.65 + Math.sin(phase * 0.997) * 0.2 + Math.sin(phase * 2.003) * 0.15;
      else if (timbre === "pluck") sample = (Math.sin(phase) + Math.sin(phase * 2) * 0.35 + Math.sin(phase * 4) * 0.12) * Math.exp(-time * 4.3);
      else sample = Math.sin(phase + Math.sin(time * 5.3) * 0.16) * 0.7 + Math.sin(phase * 2) * 0.2 + Math.sin(phase * 0.5) * 0.1;
      const value = sample * envelope * amplitude;
      output.left[index] += value * leftGain;
      output.right[index] += value * rightGain;
    }
  }

  private drums(output: StereoBuffer, start: number, beat: number, sampleRate: number, intensity: number, section: string, bar: number): void {
    const chorus = /chorus|main/i.test(section);
    const sparse = /intro|outro/i.test(section);
    const kickBeats = chorus ? [0, 1, 2, 3] : sparse ? [0, 2] : [0, 2, 2.5];
    for (const offset of kickBeats) this.kick(output, start + offset * beat, sampleRate, 0.72 * intensity);
    if (!/intro/i.test(section) || bar % 2 === 0) {
      this.snare(output, start + beat, sampleRate, 0.46 * intensity, bar * 2);
      this.snare(output, start + beat * 3, sampleRate, 0.5 * intensity, bar * 3);
    }
    const hatStep = chorus ? 0.25 : 0.5;
    for (let offset = 0; offset < 4; offset += hatStep) {
      this.hat(output, start + offset * beat, sampleRate, (offset % 1 === 0 ? 0.16 : 0.11) * intensity, bar * 17 + Math.round(offset * 4));
    }
    if ((bar % 8 === 0) && !/outro/i.test(section)) {
      for (let step = 0; step < 4; step += 1) this.snare(output, start + beat * (3 + step / 4), sampleRate, 0.25 + step * 0.04, bar * 31 + step);
    }
  }

  private kick(output: StereoBuffer, startSeconds: number, sampleRate: number, amplitude: number): void {
    const start = Math.floor(startSeconds * sampleRate);
    const end = Math.min(output.left.length, start + Math.floor(sampleRate * 0.34));
    let phase = 0;
    for (let index = start; index < end; index += 1) {
      const time = (index - start) / sampleRate;
      const frequency = 48 + 105 * Math.exp(-time * 24);
      phase += 2 * Math.PI * frequency / sampleRate;
      const value = Math.sin(phase) * Math.exp(-time * 12) * amplitude;
      output.left[index] += value * 0.707;
      output.right[index] += value * 0.707;
    }
  }

  private snare(output: StereoBuffer, startSeconds: number, sampleRate: number, amplitude: number, seed: number): void {
    const start = Math.floor(startSeconds * sampleRate);
    const end = Math.min(output.left.length, start + Math.floor(sampleRate * 0.22));
    for (let index = start; index < end; index += 1) {
      const time = (index - start) / sampleRate;
      const noise = deterministicNoise(index, seed);
      const tone = Math.sin(2 * Math.PI * 185 * time);
      const value = (noise * 0.72 + tone * 0.28) * Math.exp(-time * 18) * amplitude;
      output.left[index] += value * 0.68;
      output.right[index] += value * 0.73;
    }
  }

  private hat(output: StereoBuffer, startSeconds: number, sampleRate: number, amplitude: number, seed: number): void {
    const start = Math.floor(startSeconds * sampleRate);
    const end = Math.min(output.left.length, start + Math.floor(sampleRate * 0.065));
    for (let index = start; index < end; index += 1) {
      const time = (index - start) / sampleRate;
      const noise = deterministicNoise(index * 7, seed) - deterministicNoise(index * 3, seed + 9) * 0.45;
      const value = noise * Math.exp(-time * 65) * amplitude;
      output.left[index] += value * 0.55;
      output.right[index] += value * 0.83;
    }
  }

  private bass(output: StereoBuffer, start: number, beat: number, sampleRate: number, chord: Chord, intensity: number, section: string): void {
    const root = chord.root - 24;
    const chorus = /chorus|pre-chorus/i.test(section);
    const steps = chorus ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] : [0, 1, 2, 3];
    for (const offset of steps) {
      const pickup = chorus && offset === 3.5 ? 7 : 0;
      this.addTone(output, root + pickup, start + offset * beat, beat * (chorus ? 0.42 : 0.78), 0.34 * intensity, sampleRate, "bass", -0.03);
    }
  }

  private chords(output: StereoBuffer, start: number, beat: number, sampleRate: number, chord: Chord, intensity: number): void {
    const intervals = chord.minor ? [0, 3, 7, 12] : [0, 4, 7, 12];
    for (const offset of [0, 2]) {
      for (const [index, interval] of intervals.entries()) {
        this.addTone(output, chord.root + interval, start + offset * beat, beat * 1.75, 0.11 * intensity, sampleRate, "piano", index % 2 === 0 ? -0.32 : 0.32);
      }
    }
  }

  private pad(output: StereoBuffer, start: number, beat: number, sampleRate: number, chord: Chord, intensity: number, section: string): void {
    if (/verse 1/i.test(section) && intensity < 0.7) return;
    const intervals = chord.minor ? [0, 3, 7] : [0, 4, 7];
    for (const [index, interval] of intervals.entries()) {
      this.addTone(output, chord.root + interval + 12, start, beat * 3.9, 0.055 * intensity, sampleRate, "pad", (index - 1) * 0.42);
    }
  }

  private arp(output: StereoBuffer, start: number, beat: number, sampleRate: number, chord: Chord, intensity: number, section: string, bar: number): void {
    if (/verse/i.test(section) && bar % 2 === 1) return;
    const intervals = chord.minor ? [0, 7, 12, 15, 12, 7, 3, 7] : [0, 7, 12, 16, 12, 7, 4, 7];
    for (let step = 0; step < 8; step += 1) {
      this.addTone(output, chord.root + 12 + (intervals[step] ?? 0), start + step * beat / 2, beat * 0.38, 0.1 * intensity, sampleRate, "pluck", step % 2 === 0 ? -0.48 : 0.48);
    }
  }

  private lead(output: StereoBuffer, start: number, beat: number, sampleRate: number, chord: Chord, intensity: number, section: string, bar: number): void {
    const chorus = /chorus|main/i.test(section);
    const bridge = /bridge/i.test(section);
    const versePickup = /verse/i.test(section) && bar % 8 >= 6;
    if (!chorus && !bridge && !versePickup) return;
    const majorScale = [0, 2, 4, 6, 7, 9, 11, 12];
    const motif = chorus
      ? [4, 4, 5, 7, 6, 5, 4, 2]
      : bridge
        ? [2, 3, 4, 6, 5, 4, 2, 1]
        : [0, 2, 4, 2];
    for (let step = 0; step < motif.length; step += 1) {
      const degree = motif[step] ?? 0;
      const note = 74 + (majorScale[degree % majorScale.length] ?? 0) + (bar % 4 === 3 && step >= motif.length - 2 ? 2 : 0);
      const stepLength = motif.length > 4 ? beat / 2 : beat;
      this.addTone(output, note, start + step * stepLength, stepLength * 0.78, 0.15 * intensity, sampleRate, "lead", Math.sin((bar + step) * 0.7) * 0.24);
    }
    if (chorus && bar % 4 === 0) this.addTone(output, chord.root + 24, start + beat * 3.5, beat * 0.45, 0.13 * intensity, sampleRate, "lead", 0.18);
  }

  private addSpace(output: StereoBuffer, sampleRate: number, amount: number): void {
    const taps = [[0.17, amount], [0.29, amount * 0.66], [0.43, amount * 0.42]] as const;
    for (const [seconds, gain] of taps) {
      const delay = Math.floor(seconds * sampleRate);
      for (let index = output.left.length - 1; index >= delay; index -= 1) {
        const sourceLeft = output.left[index - delay] ?? 0;
        const sourceRight = output.right[index - delay] ?? 0;
        output.left[index] += sourceRight * gain;
        output.right[index] += sourceLeft * gain;
      }
    }
  }

  private mix(destination: StereoBuffer, source: StereoBuffer, gain: number): void {
    for (let index = 0; index < destination.left.length; index += 1) {
      destination.left[index] += (source.left[index] ?? 0) * gain;
      destination.right[index] += (source.right[index] ?? 0) * gain;
    }
  }

  private fade(output: StereoBuffer, sampleRate: number, fadeInSeconds: number, fadeOutSeconds: number): void {
    const fadeIn = Math.min(output.left.length, Math.floor(sampleRate * fadeInSeconds));
    const fadeOut = Math.min(output.left.length, Math.floor(sampleRate * fadeOutSeconds));
    for (let index = 0; index < fadeIn; index += 1) {
      const gain = index / Math.max(1, fadeIn);
      output.left[index] *= gain;
      output.right[index] *= gain;
    }
    for (let index = 0; index < fadeOut; index += 1) {
      const gain = 1 - index / Math.max(1, fadeOut);
      const target = output.left.length - fadeOut + index;
      output.left[target] *= gain;
      output.right[target] *= gain;
    }
  }

  private softLimit(output: StereoBuffer): void {
    for (let index = 0; index < output.left.length; index += 1) {
      output.left[index] = Math.tanh(output.left[index] * 1.18);
      output.right[index] = Math.tanh(output.right[index] * 1.18);
    }
  }

  private normalize(output: StereoBuffer, targetPeak: number): void {
    let peak = 0;
    for (let index = 0; index < output.left.length; index += 1) {
      peak = Math.max(peak, Math.abs(output.left[index] ?? 0), Math.abs(output.right[index] ?? 0));
    }
    if (peak <= 0 || peak <= targetPeak) return;
    const gain = targetPeak / peak;
    for (let index = 0; index < output.left.length; index += 1) {
      output.left[index] *= gain;
      output.right[index] *= gain;
    }
  }

  private async writeWave(path: string, role: RenderedAudioFile["role"], output: StereoBuffer, sampleRate: number): Promise<RenderedAudioFile> {
    const dataBytes = output.left.length * 4;
    const bytes = Buffer.allocUnsafe(44 + dataBytes);
    bytes.write("RIFF", 0, "ascii");
    bytes.writeUInt32LE(36 + dataBytes, 4);
    bytes.write("WAVEfmt ", 8, "ascii");
    bytes.writeUInt32LE(16, 16);
    bytes.writeUInt16LE(1, 20);
    bytes.writeUInt16LE(2, 22);
    bytes.writeUInt32LE(sampleRate, 24);
    bytes.writeUInt32LE(sampleRate * 4, 28);
    bytes.writeUInt16LE(4, 32);
    bytes.writeUInt16LE(16, 34);
    bytes.write("data", 36, "ascii");
    bytes.writeUInt32LE(dataBytes, 40);
    let peak = 0;
    let sumSquares = 0;
    let offset = 44;
    for (let index = 0; index < output.left.length; index += 1) {
      const left = clamp(output.left[index] ?? 0, -1, 1);
      const right = clamp(output.right[index] ?? 0, -1, 1);
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      sumSquares += left * left + right * right;
      bytes.writeInt16LE(Math.round(left * 32767), offset);
      bytes.writeInt16LE(Math.round(right * 32767), offset + 2);
      offset += 4;
    }
    await writeFile(path, bytes);
    return {
      role,
      path,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      peakDb: decibels(peak),
      rmsDb: decibels(Math.sqrt(sumSquares / Math.max(1, output.left.length * 2)))
    };
  }
}
