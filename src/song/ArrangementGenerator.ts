import { randomUUID } from "node:crypto";
import type { SongSection } from "./models.js";

export class ArrangementGenerator {
  generate(bars: number, genre = ""): SongSection[] {
    if (/j\s*-?\s*pop|jpop/i.test(genre) && bars >= 40) return this.jpop(bars);
    if (bars <= 8) {
      return [{ id: randomUUID(), name: "Main", startBar: 1, bars }];
    }
    if (bars <= 16) {
      const first = Math.floor(bars / 2);
      return [
        { id: randomUUID(), name: "A", startBar: 1, bars: first },
        { id: randomUUID(), name: "B", startBar: first + 1, bars: bars - first }
      ];
    }
    const intro = Math.min(4, Math.floor(bars / 4));
    const outro = intro;
    const body = bars - intro - outro;
    const firstBody = Math.floor(body / 2);
    return [
      { id: randomUUID(), name: "Intro", startBar: 1, bars: intro },
      { id: randomUUID(), name: "A", startBar: intro + 1, bars: firstBody },
      { id: randomUUID(), name: "B", startBar: intro + firstBody + 1, bars: body - firstBody },
      { id: randomUUID(), name: "Outro", startBar: bars - outro + 1, bars: outro }
    ];
  }

  private jpop(bars: number): SongSection[] {
    const template = [
      ["Intro", 8], ["Verse 1", 16], ["Pre-Chorus 1", 8], ["Chorus 1", 16],
      ["Verse 2", 16], ["Pre-Chorus 2", 8], ["Chorus 2", 16], ["Bridge", 8],
      ["Final Chorus", 16], ["Outro", 8]
    ] as const;
    const templateBars = template.reduce((sum, section) => sum + section[1], 0);
    const scaled = template.map(([name, length]) => ({
      name,
      exact: length * bars / templateBars,
      bars: Math.max(2, Math.floor(length * bars / templateBars))
    }));
    let remaining = bars - scaled.reduce((sum, section) => sum + section.bars, 0);
    for (const section of [...scaled].sort((left, right) =>
      (right.exact - Math.floor(right.exact)) - (left.exact - Math.floor(left.exact)))) {
      if (remaining <= 0) break;
      section.bars += 1;
      remaining -= 1;
    }
    while (remaining < 0) {
      const candidate = [...scaled].sort((left, right) => right.bars - left.bars).find((section) => section.bars > 2);
      if (!candidate) break;
      candidate.bars -= 1;
      remaining += 1;
    }
    let startBar = 1;
    return scaled.map((section) => {
      const result = { id: randomUUID(), name: section.name, startBar, bars: section.bars };
      startBar += section.bars;
      return result;
    });
  }
}
