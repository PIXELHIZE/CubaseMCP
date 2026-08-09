import type { SongRole } from "./models.js";

const defaultInstruments: Partial<Record<SongRole, string>> = {
  drums: "HALion Sonic",
  bass: "HALion Sonic",
  chords: "HALion Sonic",
  lead: "HALion Sonic",
  pad: "HALion Sonic",
  arp: "HALion Sonic"
};

const defaultPrograms: Partial<Record<SongRole, string>> = {
  drums: "SR Studio A Kit",
  bass: "SR Smooth Bass",
  chords: "[GM 001] Acoustic Grand Piano",
  lead: "Butterfly Lead",
  pad: "Alaska Sweep",
  arp: "Easy Saw Comp"
};

export interface InstrumentCatalogEntry {
  name: string;
  uid?: string;
  type?: string;
}

export interface HalionProgramEntry {
  name: string;
  category: "drums" | "bass" | "keys" | "lead" | "pad" | "arp";
  roles: SongRole[];
  verifiedHostVersion: "14.0.32";
}

const validatedHalionPrograms: readonly HalionProgramEntry[] = [
  { name: "SR Studio A Kit", category: "drums", roles: ["drums"], verifiedHostVersion: "14.0.32" },
  { name: "SR Smooth Bass", category: "bass", roles: ["bass"], verifiedHostVersion: "14.0.32" },
  { name: "[GM 001] Acoustic Grand Piano", category: "keys", roles: ["chords", "lead"], verifiedHostVersion: "14.0.32" },
  { name: "Butterfly Lead", category: "lead", roles: ["lead"], verifiedHostVersion: "14.0.32" },
  { name: "Alaska Sweep", category: "pad", roles: ["pad"], verifiedHostVersion: "14.0.32" },
  { name: "Easy Saw Comp", category: "arp", roles: ["arp", "chords"], verifiedHostVersion: "14.0.32" }
];

export class InstrumentResolver {
  preferred(role: SongRole, requested?: string): string | undefined {
    return requested ?? defaultInstruments[role];
  }

  preferredProgram(role: SongRole, requested?: string): string | undefined {
    return requested ?? defaultPrograms[role];
  }

  programCatalog(query?: string, role?: SongRole): {
    plugin: "HALion Sonic";
    selection: "exact_mediabay_program_name";
    acceptsInstalledProgramName: true;
    verifiedPrograms: HalionProgramEntry[];
  } {
    const normalized = query?.trim().toLowerCase();
    return {
      plugin: "HALion Sonic",
      selection: "exact_mediabay_program_name",
      acceptsInstalledProgramName: true,
      verifiedPrograms: validatedHalionPrograms
        .filter((program) => !role || program.roles.includes(role))
        .filter((program) => !normalized || program.name.toLowerCase().includes(normalized))
        .map((program) => ({ ...program, roles: [...program.roles] }))
    };
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
