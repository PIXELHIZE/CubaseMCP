import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

export interface MidiFileNote {
  pitch: number;
  start: string;
  length: string;
  velocity?: number;
  channel?: number;
}

export interface MidiFileWriteOptions {
  notes: MidiFileNote[];
  tempo?: number;
  ppq?: number;
  outputPath?: string;
  trackName?: string;
}

export interface GeneratedMidiFile {
  filePath: string;
  bytes: number;
  sha256: string;
  ppq: number;
  tempo: number;
  noteCount: number;
}

interface MidiEvent {
  tick: number;
  order: number;
  bytes: number[];
}

function uint32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function uint16(value: number): number[] {
  return [(value >>> 8) & 0xff, value & 0xff];
}

function ascii(value: string): number[] {
  return [...value].map((character) => character.charCodeAt(0) & 0x7f);
}

function variableLength(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes: number[] = [];
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

export class MidiFileWriter {
  positionToTicks(position: string, ppq: number, asLength = false): number {
    const parts = position.split(".").map((part) => Number(part));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      throw new Error(`Unsupported Cubase position format: ${position}. Expected bars.beats.sixteenths.ticks.`);
    }
    const [bars, beats, sixteenths, ticks] = parts;
    if (asLength) return Math.max(1, Math.round(bars * 4 * ppq + beats * ppq + sixteenths * (ppq / 4) + ticks));
    return Math.max(0, Math.round((bars - 1) * 4 * ppq + (beats - 1) * ppq + (sixteenths - 1) * (ppq / 4) + ticks));
  }

  async write(options: MidiFileWriteOptions): Promise<GeneratedMidiFile> {
    const ppq = options.ppq ?? 480;
    const tempo = options.tempo ?? 120;
    if (!Number.isInteger(ppq) || ppq < 24 || ppq > 0x7fff) throw new Error(`Invalid MIDI PPQ: ${ppq}`);
    if (!Number.isFinite(tempo) || tempo <= 0) throw new Error(`Invalid MIDI tempo: ${tempo}`);
    const outputPath = resolve(options.outputPath ?? `${tmpdir()}\\cubase-mcp-generated\\part_${randomUUID()}.mid`);
    const trackName = ascii(options.trackName ?? "Cubase MCP Generated Part").slice(0, 127);
    const microsecondsPerQuarter = Math.round(60_000_000 / tempo);
    const events: MidiEvent[] = [
      { tick: 0, order: 0, bytes: [0xff, 0x03, trackName.length, ...trackName] },
      {
        tick: 0,
        order: 1,
        bytes: [0xff, 0x51, 0x03, (microsecondsPerQuarter >>> 16) & 0xff, (microsecondsPerQuarter >>> 8) & 0xff, microsecondsPerQuarter & 0xff]
      }
    ];

    for (const note of options.notes) {
      const pitch = Math.max(0, Math.min(127, Math.round(note.pitch)));
      const velocity = Math.max(1, Math.min(127, Math.round(note.velocity ?? 100)));
      const channel = Math.max(1, Math.min(16, Math.round(note.channel ?? 1))) - 1;
      const start = this.positionToTicks(note.start, ppq, false);
      const end = start + this.positionToTicks(note.length, ppq, true);
      events.push({ tick: start, order: 2, bytes: [0x90 | channel, pitch, velocity] });
      events.push({ tick: end, order: 1, bytes: [0x80 | channel, pitch, 0] });
    }
    events.sort((left, right) => left.tick - right.tick || left.order - right.order);

    const trackData: number[] = [];
    let previousTick = 0;
    for (const event of events) {
      trackData.push(...variableLength(event.tick - previousTick), ...event.bytes);
      previousTick = event.tick;
    }
    trackData.push(0x00, 0xff, 0x2f, 0x00);

    const bytes = Buffer.from([
      ...ascii("MThd"), ...uint32(6), ...uint16(0), ...uint16(1), ...uint16(ppq),
      ...ascii("MTrk"), ...uint32(trackData.length), ...trackData
    ]);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, bytes);
    return {
      filePath: outputPath,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      ppq,
      tempo,
      noteCount: options.notes.length
    };
  }
}
