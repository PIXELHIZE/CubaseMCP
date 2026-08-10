import type { GeneratedSongNote, SongPlan, SongRole, SongSection } from "./models.js";

export type JpopChordQuality = "major7" | "minor7" | "dominant7" | "add9" | "sus4";

export interface JpopChordEvent {
  bar: number;
  section: string;
  sectionBar: number;
  sectionBars: number;
  symbol: string;
  degree: number;
  rootPitchClass: number;
  bassPitchClass: number;
  quality: JpopChordQuality;
  pitchClasses: number[];
}

interface HarmonyToken {
  degree: number;
  quality: JpopChordQuality;
  bassDegree?: number;
}

interface MelodyEvent {
  step: number;
  degree: number;
  length: string;
  accent?: number;
}

type SectionKind = "intro" | "verse" | "pre_chorus" | "chorus" | "bridge" | "outro";

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11] as const;
const NOTE_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"] as const;
const NOTE_PITCH_CLASSES: Record<string, number> = {
  c: 0, "c#": 1, db: 1, d: 2, "d#": 3, eb: 3, e: 4,
  f: 5, "f#": 6, gb: 6, g: 7, "g#": 8, ab: 8, a: 9,
  "a#": 10, bb: 10, b: 11
};

const PROGRESSIONS = {
  intro: [
    { degree: 1, quality: "add9" }, { degree: 5, quality: "dominant7", bassDegree: 3 },
    { degree: 6, quality: "minor7" }, { degree: 4, quality: "major7" }
  ],
  verse: [
    { degree: 6, quality: "minor7" }, { degree: 4, quality: "major7" },
    { degree: 1, quality: "add9" }, { degree: 5, quality: "sus4" }
  ],
  preChorus: [
    { degree: 2, quality: "minor7" }, { degree: 3, quality: "minor7" },
    { degree: 4, quality: "major7" }, { degree: 5, quality: "dominant7" }
  ],
  chorus: [
    { degree: 4, quality: "major7" }, { degree: 5, quality: "dominant7" },
    { degree: 3, quality: "minor7" }, { degree: 6, quality: "minor7" },
    { degree: 2, quality: "minor7" }, { degree: 5, quality: "dominant7" },
    { degree: 1, quality: "add9" }, { degree: 5, quality: "dominant7", bassDegree: 3 }
  ],
  bridge: [
    { degree: 6, quality: "minor7" }, { degree: 5, quality: "dominant7" },
    { degree: 4, quality: "major7" }, { degree: 1, quality: "add9", bassDegree: 3 },
    { degree: 2, quality: "minor7" }, { degree: 3, quality: "minor7" },
    { degree: 4, quality: "major7" }, { degree: 5, quality: "dominant7" }
  ],
  outro: [
    { degree: 1, quality: "add9" }, { degree: 5, quality: "dominant7", bassDegree: 3 },
    { degree: 6, quality: "minor7" }, { degree: 4, quality: "major7" }
  ]
} satisfies Record<string, HarmonyToken[]>;

const QUALITY_INTERVALS: Record<JpopChordQuality, readonly number[]> = {
  major7: [0, 4, 7, 11],
  minor7: [0, 3, 7, 10],
  dominant7: [0, 4, 7, 10],
  add9: [0, 4, 7, 14],
  sus4: [0, 5, 7, 10]
};

function clampMidi(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function noteAtStep(
  pitch: number,
  bar: number,
  step: number,
  length: string,
  velocity: number,
  channel = 1
): GeneratedSongNote {
  return {
    pitch: clampMidi(pitch),
    start: {
      format: "musical",
      bar,
      beat: Math.floor(step / 4) + 1,
      sixteenth: step % 4 + 1,
      tick: 0
    },
    length,
    velocity: Math.max(1, Math.min(127, Math.round(velocity))),
    channel
  };
}

function sectionAt(plan: SongPlan, bar: number): SongSection {
  return plan.sections.find((section) => bar >= section.startBar && bar < section.startBar + section.bars)
    ?? { id: "main", name: "Main", startBar: 1, bars: plan.bars };
}

function progressionFor(sectionName: string): readonly HarmonyToken[] {
  if (/pre[- ]?chorus/i.test(sectionName)) return PROGRESSIONS.preChorus;
  if (/final chorus|chorus|main|\bb\b/i.test(sectionName)) return PROGRESSIONS.chorus;
  if (/bridge/i.test(sectionName)) return PROGRESSIONS.bridge;
  if (/verse|\ba\b/i.test(sectionName)) return PROGRESSIONS.verse;
  if (/outro/i.test(sectionName)) return PROGRESSIONS.outro;
  return PROGRESSIONS.intro;
}

function sectionKind(sectionName: string): SectionKind {
  if (/pre[- ]?chorus/i.test(sectionName)) return "pre_chorus";
  if (/final chorus|chorus|main|\bb\b/i.test(sectionName)) return "chorus";
  if (/bridge/i.test(sectionName)) return "bridge";
  if (/verse|\ba\b/i.test(sectionName)) return "verse";
  if (/outro/i.test(sectionName)) return "outro";
  return "intro";
}

function sectionBlock(sectionBar: number, blockBars = 4): number {
  return Math.floor((sectionBar - 1) / blockBars);
}

function firstHalf(event: JpopChordEvent): boolean {
  return event.sectionBar <= Math.ceil(event.sectionBars / 2);
}

function keyPitchClass(key: string): number {
  const token = key.trim().match(/^([A-Ga-g](?:#|b)?)/)?.[1]?.toLowerCase();
  return token === undefined ? 0 : (NOTE_PITCH_CLASSES[token] ?? 0);
}

function pitchClassForDegree(keyPc: number, degree: number): number {
  return (keyPc + (MAJOR_SCALE[(degree - 1) % MAJOR_SCALE.length] ?? 0)) % 12;
}

function symbolFor(rootPc: number, quality: JpopChordQuality, bassPc: number): string {
  const suffix = quality === "major7" ? "maj7"
    : quality === "minor7" ? "m7"
      : quality === "dominant7" ? "7"
        : quality === "add9" ? "add9"
          : "sus4";
  const root = NOTE_NAMES[rootPc] ?? "C";
  return `${root}${suffix}${bassPc === rootPc ? "" : `/${NOTE_NAMES[bassPc] ?? "C"}`}`;
}

function normalizeToRange(pitchClass: number, minimum: number, maximum: number, preferred = (minimum + maximum) / 2): number {
  const candidates: number[] = [];
  for (let pitch = pitchClass; pitch <= 127; pitch += 12) {
    if (pitch >= minimum && pitch <= maximum) candidates.push(pitch);
  }
  return candidates.sort((left, right) => Math.abs(left - preferred) - Math.abs(right - preferred))[0] ?? minimum;
}

function chordPitches(event: JpopChordEvent, minimum: number, maximum: number, previous?: readonly number[]): number[] {
  const root = normalizeToRange(event.rootPitchClass, minimum, maximum, (minimum + maximum) / 2 - 3);
  const base = QUALITY_INTERVALS[event.quality].map((interval) => root + interval);
  const candidates: number[][] = [];
  for (let inversion = 0; inversion < base.length; inversion += 1) {
    const voiced = base.map((pitch, index) => pitch + (index < inversion ? 12 : 0));
    while (voiced.at(-1)! > maximum) voiced.forEach((_, index) => { voiced[index] = (voiced[index] ?? 0) - 12; });
    while (voiced[0]! < minimum) voiced.forEach((_, index) => { voiced[index] = (voiced[index] ?? 0) + 12; });
    candidates.push([...voiced].sort((left, right) => left - right));
  }
  const center = (minimum + maximum) / 2;
  return candidates.sort((left, right) => {
    const score = (voicing: number[]) => voicing.reduce((sum, pitch, index) => {
      const target = previous?.[index] ?? center;
      return sum + Math.abs(pitch - target);
    }, 0) + Math.abs((voicing[0]! + voicing.at(-1)!) / 2 - center) * 0.25;
    return score(left) - score(right);
  })[0] ?? base;
}

function nearestPitchWithPitchClass(target: number, pitchClasses: readonly number[], minimum: number, maximum: number): number {
  const candidates: number[] = [];
  for (let pitch = minimum; pitch <= maximum; pitch += 1) {
    if (pitchClasses.includes(((pitch % 12) + 12) % 12)) candidates.push(pitch);
  }
  return candidates.sort((left, right) => Math.abs(left - target) - Math.abs(right - target))[0] ?? target;
}

function diatonicPitch(keyPc: number, degree: number, octaveBase: number): number {
  const zeroBased = degree - 1;
  const octave = Math.floor(zeroBased / 7);
  const scaleIndex = ((zeroBased % 7) + 7) % 7;
  return octaveBase + keyPc + (MAJOR_SCALE[scaleIndex] ?? 0) + octave * 12;
}

export class JpopMidiArrangementGenerator {
  generateHarmony(plan: SongPlan): JpopChordEvent[] {
    const keyPc = keyPitchClass(plan.key);
    return Array.from({ length: plan.bars }, (_, index): JpopChordEvent => {
      const bar = index + 1;
      const section = sectionAt(plan, bar);
      const sectionBar = bar - section.startBar + 1;
      const progression = progressionFor(section.name);
      const token = progression[(sectionBar - 1) % progression.length] ?? progression[0]!;
      const rootPitchClass = pitchClassForDegree(keyPc, token.degree);
      const bassPitchClass = pitchClassForDegree(keyPc, token.bassDegree ?? token.degree);
      const pitchClasses = [...new Set(QUALITY_INTERVALS[token.quality].map((interval) => (rootPitchClass + interval) % 12))];
      return {
        bar,
        section: section.name,
        sectionBar,
        sectionBars: section.bars,
        symbol: symbolFor(rootPitchClass, token.quality, bassPitchClass),
        degree: token.degree,
        rootPitchClass,
        bassPitchClass,
        quality: token.quality,
        pitchClasses
      };
    });
  }

  generate(role: SongRole, plan: SongPlan): GeneratedSongNote[] {
    const harmony = this.generateHarmony(plan);
    if (role === "drums") return this.drums(harmony);
    if (role === "bass") return this.bass(harmony);
    if (role === "chords") return this.chords(harmony);
    if (role === "pad") return this.pad(harmony);
    if (role === "arp") return this.arp(harmony);
    if (role === "lead") return this.lead(harmony, keyPitchClass(plan.key));
    return [];
  }

  private drums(harmony: readonly JpopChordEvent[]): GeneratedSongNote[] {
    const out: GeneratedSongNote[] = [];
    for (const chord of harmony) {
      const kind = sectionKind(chord.section);
      if (kind === "intro" && chord.sectionBar <= Math.min(2, Math.ceil(chord.sectionBars / 2))) {
        for (const step of [0, 4, 8, 12]) out.push(noteAtStep(42, chord.bar, step, "0.0.1.0", 54 + (step === 0 ? 12 : 0), 10));
        continue;
      }
      if (kind === "outro" && !firstHalf(chord)) {
        if (chord.sectionBar === Math.ceil(chord.sectionBars / 2) + 1) out.push(noteAtStep(49, chord.bar, 0, "0.1.0.0", 92, 10));
        continue;
      }
      const bridgeSparse = kind === "bridge" && firstHalf(chord);
      const kickSteps = kind === "chorus" ? [0, 6, 8, 14]
        : kind === "pre_chorus" ? [0, 6, 8, 14]
          : kind === "verse" ? [0, 6, 8]
            : bridgeSparse ? [0, 8]
              : [0, 8];
      for (const step of kickSteps) out.push(noteAtStep(36, chord.bar, step, "0.0.1.0", 104 + (step === 0 ? 10 : 0), 10));
      if (!bridgeSparse) {
        out.push(noteAtStep(38, chord.bar, 4, "0.0.1.0", 108, 10));
        out.push(noteAtStep(38, chord.bar, 12, "0.0.1.0", 112, 10));
      } else {
        out.push(noteAtStep(38, chord.bar, 8, "0.0.2.0", 96, 10));
      }
      const hatSpacing = kind === "chorus" && chord.sectionBar % 4 === 0 ? 1 : 2;
      for (let step = 0; step < 16; step += hatSpacing) {
        const pitch = kind === "pre_chorus" && step === 14 ? 46 : 42;
        out.push(noteAtStep(pitch, chord.bar, step, "0.0.1.0", 62 + (step % 4 === 0 ? 20 : step % 2 === 0 ? 9 : 0), 10));
      }
      if ((kind === "chorus" && chord.sectionBar % 8 === 1) || (kind === "bridge" && chord.sectionBar === 1)) {
        out.push(noteAtStep(49, chord.bar, 0, "0.1.0.0", 118, 10));
      }
      if (chord.sectionBar % 8 === 0 && kind !== "outro") {
        for (let step = 12; step < 16; step += 1) out.push(noteAtStep(step < 14 ? 45 : 47, chord.bar, step, "0.0.1.0", 84 + (step - 12) * 9, 10));
      }
    }
    return out;
  }

  private bass(harmony: readonly JpopChordEvent[]): GeneratedSongNote[] {
    const out: GeneratedSongNote[] = [];
    harmony.forEach((chord, index) => {
      const kind = sectionKind(chord.section);
      if ((kind === "intro" && chord.sectionBar < Math.ceil(chord.sectionBars / 2)) || (kind === "outro" && !firstHalf(chord))) return;
      const next = harmony[index + 1] ?? chord;
      const root = normalizeToRange(chord.bassPitchClass, 35, 47, 41);
      const chordThird = normalizeToRange(chord.pitchClasses[1] ?? chord.rootPitchClass, 36, 52, root + 4);
      const fifthPc = (chord.rootPitchClass + 7) % 12;
      const fifth = normalizeToRange(fifthPc, 36, 54, root + 7);
      const nextRoot = normalizeToRange(next.bassPitchClass, 35, 52, root);
      const approach = nextRoot > root ? nextRoot - 1 : nextRoot + 1;
      const sparse = kind === "intro" || kind === "outro" || (kind === "bridge" && firstHalf(chord));
      const pitches = sparse ? [root, fifth] : kind === "pre_chorus"
        ? [root, chordThird, fifth, approach]
        : kind === "chorus"
          ? [root, fifth, chordThird, approach]
          : [root, root, fifth, approach];
      const spacing = pitches.length === 2 ? 8 : 4;
      pitches.forEach((pitch, step) => out.push(noteAtStep(
        pitch,
        chord.bar,
        step * spacing,
        spacing === 8 ? "0.1.3.0" : "0.0.3.0",
        88 + (step === 0 ? 12 : step % 2 === 0 ? 5 : 0),
        2
      )));
    });
    return out;
  }

  private chords(harmony: readonly JpopChordEvent[]): GeneratedSongNote[] {
    const out: GeneratedSongNote[] = [];
    let previous: number[] | undefined;
    for (const chord of harmony) {
      const voicing = chordPitches(chord, 53, 79, previous);
      previous = voicing;
      const kind = sectionKind(chord.section);
      const hits = kind === "intro" ? (firstHalf(chord) ? [0] : [0, 10])
        : kind === "verse" ? [0, 10]
          : kind === "pre_chorus" ? [0, 8]
            : kind === "chorus" ? (chord.sectionBar % 2 === 0 ? [0, 10] : [0, 8])
              : kind === "bridge" ? (firstHalf(chord) ? [0] : [0, 8])
                : [0];
      hits.forEach((step, hitIndex) => {
        const length = hits.length === 1 ? "0.3.3.0" : step === 0 ? "0.1.3.0" : "0.1.1.0";
        voicing.forEach((pitch, voice) => out.push(noteAtStep(
          pitch,
          chord.bar,
          step,
          length,
          70 + (hitIndex === 0 ? 9 : 0) + voice * 2,
          3
        )));
      });
    }
    return out;
  }

  private pad(harmony: readonly JpopChordEvent[]): GeneratedSongNote[] {
    const out: GeneratedSongNote[] = [];
    let previous: number[] | undefined;
    for (const chord of harmony) {
      const kind = sectionKind(chord.section);
      const active = (kind === "intro" && firstHalf(chord))
        || (kind === "pre_chorus" && firstHalf(chord))
        || (kind === "chorus" && sectionBlock(chord.sectionBar) % 2 === 0)
        || (kind === "bridge" && firstHalf(chord))
        || (kind === "outro" && firstHalf(chord));
      if (!active) continue;
      const voicing = chordPitches(chord, 60, 84, previous);
      previous = voicing;
      voicing.forEach((pitch, voice) => out.push(noteAtStep(
        pitch,
        chord.bar,
        0,
        "0.3.3.0",
        46 + voice * 3 + (kind === "chorus" || kind === "bridge" ? 8 : 0),
        4
      )));
    }
    return out;
  }

  private arp(harmony: readonly JpopChordEvent[]): GeneratedSongNote[] {
    const out: GeneratedSongNote[] = [];
    const order = [0, 1, 2, 1, 3, 2, 1, 2, 0, 2, 3, 2, 1, 2, 3, 2];
    for (const chord of harmony) {
      const kind = sectionKind(chord.section);
      const active = (kind === "intro" && !firstHalf(chord))
        || (/verse 2/i.test(chord.section) && chord.sectionBar > Math.max(0, chord.sectionBars - 4))
        || (kind === "pre_chorus" && !firstHalf(chord))
        || (kind === "chorus" && sectionBlock(chord.sectionBar) % 2 === 1)
        || (kind === "bridge" && !firstHalf(chord));
      if (!active) continue;
      const voicing = chordPitches(chord, 65, 91).map((pitch) => pitch + (pitch < 72 ? 12 : 0));
      const spacing = /final chorus/i.test(chord.section) && chord.sectionBar > 12 ? 1 : 2;
      for (let step = 0; step < 16; step += spacing) {
        const index = order[step] ?? 0;
        out.push(noteAtStep(voicing[index % voicing.length]!, chord.bar, step, "0.0.1.0", 61 + (step % 4 === 0 ? 13 : 0), 5));
      }
    }
    return out;
  }

  private lead(harmony: readonly JpopChordEvent[], keyPc: number): GeneratedSongNote[] {
    const out: GeneratedSongNote[] = [];
    for (const chord of harmony) {
      const events = this.melodyPattern(chord);
      for (const event of events) {
        let target = diatonicPitch(keyPc, event.degree, 72 - keyPc);
        if (event.step % 4 === 0) target = nearestPitchWithPitchClass(target, chord.pitchClasses, 67, 88);
        out.push(noteAtStep(target, chord.bar, event.step, event.length, 82 + (event.accent ?? 0), 6));
      }
    }
    return out;
  }

  private melodyPattern(chord: JpopChordEvent): MelodyEvent[] {
    const phrase = (chord.sectionBar - 1) % 4;
    if (/intro/i.test(chord.section) && firstHalf(chord)) return [];
    if (/outro/i.test(chord.section)) return chord.sectionBar === 1
      ? [{ step: 0, degree: 8, length: "0.3.3.0", accent: 8 }]
      : [];
    if (/verse|\ba\b/i.test(chord.section)) {
      const versePatterns: MelodyEvent[][] = [
        [{ step: 0, degree: 3, length: "0.0.3.0" }, { step: 4, degree: 4, length: "0.1.0.0" }, { step: 10, degree: 5, length: "0.0.2.0" }],
        [],
        [{ step: 0, degree: 2, length: "0.1.0.0" }, { step: 6, degree: 3, length: "0.0.2.0" }, { step: 10, degree: 4, length: "0.0.2.0" }, { step: 13, degree: 5, length: "0.0.3.0" }],
        []
      ];
      return versePatterns[phrase] ?? [];
    }
    if (/pre/i.test(chord.section)) {
      const degrees = [[2, 3, 4, 5, 6], [3, 4, 5, 6, 7], [4, 5, 6, 7, 8], [5, 6, 7, 8, 9]][phrase] ?? [];
      return degrees.map((degree, index) => ({ step: index * 3, degree, length: index === degrees.length - 1 ? "0.1.0.0" : "0.0.2.0", accent: index * 2 }));
    }
    if (/bridge/i.test(chord.section)) {
      const bridgePatterns: MelodyEvent[][] = [
        [{ step: 0, degree: 10, length: "0.1.0.0", accent: 8 }, { step: 6, degree: 9, length: "0.0.2.0" }, { step: 10, degree: 8, length: "0.1.1.0" }],
        [{ step: 0, degree: 7, length: "0.0.3.0" }, { step: 4, degree: 8, length: "0.0.2.0" }, { step: 8, degree: 10, length: "0.1.3.0", accent: 7 }],
        [{ step: 0, degree: 9, length: "0.1.0.0" }, { step: 6, degree: 8, length: "0.0.2.0" }, { step: 10, degree: 6, length: "0.1.1.0" }],
        []
      ];
      return bridgePatterns[phrase] ?? [];
    }
    const chorusPatterns: MelodyEvent[][] = [
      [{ step: 0, degree: 5, length: "0.0.2.0", accent: 10 }, { step: 2, degree: 6, length: "0.0.2.0" }, { step: 4, degree: 8, length: "0.1.0.0", accent: 6 }, { step: 9, degree: 7, length: "0.0.2.0" }, { step: 12, degree: 6, length: "0.1.0.0" }],
      [{ step: 0, degree: 5, length: "0.0.3.0", accent: 7 }, { step: 3, degree: 3, length: "0.0.2.0" }, { step: 6, degree: 4, length: "0.0.2.0" }, { step: 8, degree: 5, length: "0.0.3.0" }, { step: 12, degree: 6, length: "0.1.0.0", accent: 5 }],
      [{ step: 0, degree: 8, length: "0.1.0.0", accent: 12 }, { step: 5, degree: 7, length: "0.0.2.0" }, { step: 8, degree: 6, length: "0.0.2.0" }, { step: 11, degree: 5, length: "0.0.2.0" }, { step: 14, degree: 4, length: "0.0.2.0" }],
      []
    ];
    return chorusPatterns[phrase] ?? [];
  }
}
