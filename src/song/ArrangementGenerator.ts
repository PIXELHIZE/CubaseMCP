import { randomUUID } from "node:crypto";
import type { SongSection } from "./models.js";

export class ArrangementGenerator {
  generate(bars: number): SongSection[] {
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
}

