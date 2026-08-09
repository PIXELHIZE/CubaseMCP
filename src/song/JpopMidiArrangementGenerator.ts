import type { GeneratedSongNote, SongPlan, SongRole } from "./models.js";

interface Chord { root: number; minor: boolean }

function note(pitch: number, bar: number, beat: number, length: string, velocity: number, sixteenth = 1): GeneratedSongNote {
  return {
    pitch,
    start: { format: "musical", bar, beat, sixteenth, tick: 0 },
    length,
    velocity,
    channel: 1
  };
}

function sectionAt(plan: SongPlan, bar: number): string {
  return plan.sections.find((section) => bar >= section.startBar && bar < section.startBar + section.bars)?.name ?? "Main";
}

function chordForBar(bar: number, section: string): Chord {
  const progression = /chorus/i.test(section)
    ? [{ root: 59, minor: true }, { root: 55, minor: false }, { root: 62, minor: false }, { root: 57, minor: false }]
    : /bridge/i.test(section)
      ? [{ root: 55, minor: false }, { root: 57, minor: false }, { root: 54, minor: true }, { root: 59, minor: true }]
      : [{ root: 62, minor: false }, { root: 57, minor: false }, { root: 59, minor: true }, { root: 55, minor: false }];
  return progression[(bar - 1) % progression.length] as Chord;
}

export class JpopMidiArrangementGenerator {
  generate(role: SongRole, plan: SongPlan): GeneratedSongNote[] {
    const notes: GeneratedSongNote[] = [];
    for (let bar = 1; bar <= plan.bars; bar += 1) {
      const section = sectionAt(plan, bar);
      const chord = chordForBar(bar, section);
      if (role === "drums") this.drums(notes, bar, section);
      if (role === "bass") this.bass(notes, bar, chord, section);
      if (role === "chords") this.chords(notes, bar, chord, section);
      if (role === "pad") this.pad(notes, bar, chord, section);
      if (role === "arp") this.arp(notes, bar, chord, section);
      if (role === "lead") this.lead(notes, bar, chord, section);
    }
    return notes;
  }

  private drums(out: GeneratedSongNote[], bar: number, section: string): void {
    const chorus = /chorus|main/i.test(section);
    const sparse = /intro|outro/i.test(section);
    const kicks = chorus ? [1, 2, 3, 4] : sparse ? [1, 3] : [1, 3];
    for (const beat of kicks) out.push(note(36, bar, beat, "0.0.1.0", 112));
    if (!/intro/i.test(section) || bar % 2 === 0) {
      out.push(note(38, bar, 2, "0.0.1.0", 106), note(38, bar, 4, "0.0.1.0", 108));
    }
    const sixteenthStep = chorus ? 1 : 2;
    for (let index = 0; index < 16; index += sixteenthStep) {
      const beat = Math.floor(index / 4) + 1;
      const sixteenth = index % 4 + 1;
      out.push(note(42, bar, beat, "0.0.1.0", index % 4 === 0 ? 84 : 72, sixteenth));
    }
    if (bar % 8 === 0 && !/outro/i.test(section)) {
      for (let sixteenth = 1; sixteenth <= 4; sixteenth += 1) out.push(note(38, bar, 4, "0.0.1.0", 82 + sixteenth * 5, sixteenth));
    }
  }

  private bass(out: GeneratedSongNote[], bar: number, chord: Chord, section: string): void {
    const root = chord.root - 24;
    const dense = /chorus|pre-chorus/i.test(section);
    for (let eighth = 0; eighth < (dense ? 8 : 4); eighth += 1) {
      const beat = dense ? Math.floor(eighth / 2) + 1 : eighth + 1;
      const sixteenth = dense && eighth % 2 ? 3 : 1;
      const pickup = dense && eighth === 7 ? 7 : 0;
      out.push(note(root + pickup, bar, beat, dense ? "0.0.2.0" : "0.0.3.0", 96, sixteenth));
    }
  }

  private chords(out: GeneratedSongNote[], bar: number, chord: Chord, section: string): void {
    const intervals = chord.minor ? [0, 3, 7, 12] : [0, 4, 7, 12];
    const beats = /intro|outro/i.test(section) ? [1] : [1, 3];
    for (const beat of beats) for (const interval of intervals) out.push(note(chord.root + interval, bar, beat, beats.length === 1 ? "0.3.3.0" : "0.1.3.0", 76 + interval % 5));
  }

  private pad(out: GeneratedSongNote[], bar: number, chord: Chord, section: string): void {
    if (/verse 1/i.test(section) && bar % 2 === 1) return;
    const intervals = chord.minor ? [0, 3, 7] : [0, 4, 7];
    for (const interval of intervals) out.push(note(chord.root + interval + 12, bar, 1, "0.3.3.0", 62));
  }

  private arp(out: GeneratedSongNote[], bar: number, chord: Chord, section: string): void {
    if (/verse/i.test(section) && bar % 2 === 1) return;
    const intervals = chord.minor ? [0, 7, 12, 15, 12, 7, 3, 7] : [0, 7, 12, 16, 12, 7, 4, 7];
    for (let step = 0; step < intervals.length; step += 1) {
      out.push(note(chord.root + 12 + (intervals[step] ?? 0), bar, Math.floor(step / 2) + 1, "0.0.2.0", 78 + step % 2 * 6, step % 2 ? 3 : 1));
    }
  }

  private lead(out: GeneratedSongNote[], bar: number, _chord: Chord, section: string): void {
    const chorus = /chorus|main/i.test(section);
    const bridge = /bridge/i.test(section);
    const pickup = /verse/i.test(section) && bar % 8 >= 6;
    if (!chorus && !bridge && !pickup) return;
    const scale = [0, 2, 4, 6, 7, 9, 11, 12];
    const motif = chorus ? [4, 4, 5, 7, 6, 5, 4, 2] : bridge ? [2, 3, 4, 6, 5, 4, 2, 1] : [0, 2, 4, 2];
    for (let step = 0; step < motif.length; step += 1) {
      const degree = motif[step] ?? 0;
      out.push(note(74 + (scale[degree % scale.length] ?? 0), bar, Math.floor(step / 2) + 1, "0.0.2.0", 90, step % 2 ? 3 : 1));
    }
  }
}
