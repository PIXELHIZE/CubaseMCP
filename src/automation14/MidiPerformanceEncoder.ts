import type { GeneratedSongNote } from "../song/models.js";
import type { Position } from "../v2/contracts.js";
import type { TimedMidiMessage } from "./types.js";

const TICKS_PER_BEAT = 480;

function positionBeats(position: Position): number {
  if (position.format !== "musical") {
    throw new Error("automation14 MIDI recording requires musical positions.");
  }
  return (position.bar - 1) * 4 + (position.beat - 1) + (position.sixteenth - 1) / 4 + position.tick / TICKS_PER_BEAT;
}

function lengthBeats(length: string): number {
  const match = length.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`Invalid Cubase musical length: ${length}`);
  return Number(match[1]) * 4 + Number(match[2]) + Number(match[3]) / 4 + Number(match[4]) / TICKS_PER_BEAT;
}

export class MidiPerformanceEncoder {
  encode(notes: GeneratedSongNote[], captureTempo: number, startDelayMs = 30): TimedMidiMessage[] {
    if (!Number.isFinite(captureTempo) || captureTempo <= 0) throw new Error(`Invalid capture tempo: ${captureTempo}`);
    const millisecondsPerBeat = 60_000 / captureTempo;
    const events = notes.flatMap((note): TimedMidiMessage[] => {
      const channel = Math.max(1, Math.min(16, note.channel)) - 1;
      const start = startDelayMs + positionBeats(note.start) * millisecondsPerBeat;
      const end = start + Math.max(10, lengthBeats(note.length) * millisecondsPerBeat);
      return [
        { atMs: start, message: [0x90 | channel, note.pitch, note.velocity] },
        { atMs: end, message: [0x80 | channel, note.pitch, 0] }
      ];
    });
    return events.sort((left, right) => left.atMs - right.atMs || left.message[0] - right.message[0]);
  }

  durationMs(events: TimedMidiMessage[]): number {
    return Math.ceil(events.at(-1)?.atMs ?? 0);
  }
}
