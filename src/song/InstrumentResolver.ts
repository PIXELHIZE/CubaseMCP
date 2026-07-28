import type { SongRole } from "./models.js";

const defaultInstruments: Partial<Record<SongRole, string>> = {
  drums: "Groove Agent",
  bass: "HALion Sonic",
  chords: "HALion Sonic",
  lead: "HALion Sonic",
  pad: "HALion Sonic",
  arp: "HALion Sonic"
};

export interface InstrumentCatalogEntry {
  name: string;
  uid?: string;
  type?: string;
}

export class InstrumentResolver {
  preferred(role: SongRole, requested?: string): string | undefined {
    return requested ?? defaultInstruments[role];
  }

  resolveAvailable(
    role: SongRole,
    catalog: InstrumentCatalogEntry[],
    requested?: string
  ): InstrumentCatalogEntry | undefined {
    const preferred = this.preferred(role, requested);
    if (!preferred) return undefined;
    return catalog.find((entry) => entry.name.toLowerCase() === preferred.toLowerCase());
  }
}

