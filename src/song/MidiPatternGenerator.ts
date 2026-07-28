import type { Position } from "../v2/contracts.js";
import type { GeneratedSongNote, SongRole } from "./models.js";

const pitchByKey: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11
};

function musical(bar: number, beat: number, sixteenth = 1): Position {
  return { format: "musical", bar, beat, sixteenth, tick: 0 };
}

function note(pitch: number, bar: number, beat: number, length: string, velocity = 100, sixteenth = 1): GeneratedSongNote {
  return { pitch, start: musical(bar, beat, sixteenth), length, velocity, channel: 1 };
}

export class MidiPatternGenerator {
  generate(role: SongRole, bars: number, key = "C", density: "sparse" | "medium" | "dense" = "medium"): GeneratedSongNote[] {
    const root = 36 + (pitchByKey[key.split(/\s+/)[0]] ?? 0);
    switch (role) {
      case "drums":
        return this.drums(bars, density);
      case "bass":
        return this.bass(bars, root, density);
      case "chords":
      case "pad":
        return this.chords(bars, root + 24, role === "pad" ? "1.0.0.0" : "0.3.0.0");
      case "lead":
      case "arp":
        return this.lead(bars, root + 24, density);
      default:
        return [];
    }
  }

  private drums(bars: number, density: "sparse" | "medium" | "dense"): GeneratedSongNote[] {
    const notes: GeneratedSongNote[] = [];
    for (let bar = 1; bar <= bars; bar += 1) {
      for (let beat = 1; beat <= 4; beat += 1) notes.push(note(36, bar, beat, "0.1.0.0", 110));
      notes.push(note(38, bar, 2, "0.1.0.0", 105), note(38, bar, 4, "0.1.0.0", 105));
      if (density !== "sparse") {
        for (let beat = 1; beat <= 4; beat += 1) {
          notes.push(note(42, bar, beat, "0.0.2.0", 82, 1), note(42, bar, beat, "0.0.2.0", 76, 3));
        }
      }
      if (density === "dense") notes.push(note(46, bar, 4, "0.1.0.0", 92, 3));
    }
    return notes;
  }

  private bass(bars: number, root: number, density: "sparse" | "medium" | "dense"): GeneratedSongNote[] {
    const notes: GeneratedSongNote[] = [];
    for (let bar = 1; bar <= bars; bar += 1) {
      const beats = density === "sparse" ? [1, 3] : [1, 2, 3, 4];
      for (const beat of beats) notes.push(note(root, bar, beat, density === "dense" ? "0.1.0.0" : "0.2.0.0", 96));
      if (density === "dense") {
        for (let beat = 1; beat <= 4; beat += 1) notes.push(note(root + 7, bar, beat, "0.0.2.0", 78, 3));
      }
    }
    return notes;
  }

  private chords(bars: number, root: number, length: string): GeneratedSongNote[] {
    const notes: GeneratedSongNote[] = [];
    for (let bar = 1; bar <= bars; bar += 1) {
      notes.push(note(root, bar, 1, length, 82), note(root + 4, bar, 1, length, 78), note(root + 7, bar, 1, length, 76));
    }
    return notes;
  }

  private lead(bars: number, root: number, density: "sparse" | "medium" | "dense"): GeneratedSongNote[] {
    const scale = [0, 2, 4, 7, 9, 7, 4, 2];
    const notes: GeneratedSongNote[] = [];
    for (let bar = 1; bar <= bars; bar += 1) {
      const count = density === "sparse" ? 2 : density === "dense" ? 8 : 4;
      for (let index = 0; index < count; index += 1) {
        const beat = Math.floor(index / 2) + 1;
        const sixteenth = index % 2 === 0 ? 1 : 3;
        notes.push(note(root + scale[index % scale.length], bar, beat, density === "dense" ? "0.0.2.0" : "0.1.0.0", 88, sixteenth));
      }
    }
    return notes;
  }
}

