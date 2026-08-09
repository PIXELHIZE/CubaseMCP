import { randomUUID } from "node:crypto";
import { ArrangementGenerator } from "./ArrangementGenerator.js";
import { InstrumentResolver } from "./InstrumentResolver.js";
import type { SongPlan, SongPlanRequest, SongRole, SongTrackIntent } from "./models.js";
import { TrackTypeResolver } from "./TrackTypeResolver.js";

const roleNames: Record<SongRole, string> = {
  drums: "Drums",
  bass: "Bass",
  chords: "Chords",
  lead: "Lead",
  pad: "Pad",
  arp: "Arp",
  vocal: "Vocal",
  guitar: "Guitar",
  audio_loop: "Audio Loop",
  stem: "Stem",
  reverb: "Reverb FX",
  delay: "Delay FX",
  drum_bus: "Drum Bus",
  music_bus: "Music Bus",
  chord_progression: "Chord Track",
  markers: "Markers",
  external_hardware_synth: "External Synth",
  rack_multitimbral_channel: "Rack Instrument MIDI"
};

export class SongProjectPlanner {
  constructor(
    private readonly trackTypes = new TrackTypeResolver(),
    private readonly instruments = new InstrumentResolver(),
    private readonly arrangements = new ArrangementGenerator()
  ) {}

  plan(request: SongPlanRequest): SongPlan {
    const bars = request.bars ?? this.barsFromPrompt(request.prompt);
    const genre = request.genre ?? this.genreFromPrompt(request.prompt);
    const requestedTracks = request.tracks ?? this.defaultTracks(genre);
    const tracks = requestedTracks.map((requested): SongTrackIntent => {
      const resolved = this.trackTypes.resolve(requested.role, requested.sourceKind, requested.trackType);
      return {
        id: randomUUID(),
        role: requested.role,
        name: requested.name ?? roleNames[requested.role],
        sourceKind: resolved.sourceKind,
        trackType: resolved.trackType,
        instrument: resolved.sourceKind === "software_instrument"
          ? this.instruments.preferred(requested.role, requested.instrument)
          : requested.instrument,
        required: requested.required ?? true,
        noteDensity: requested.noteDensity ?? "medium",
        routeToRole: requested.routeToRole ?? this.defaultRoute(requested.role),
        contentIntent: this.contentIntent(resolved.sourceKind)
      };
    });
    this.assertNoSoftwareMidiTracks(tracks);
    const songId = randomUUID();
    return {
      id: randomUUID(),
      songId,
      prompt: request.prompt,
      genre,
      tempo: request.tempo ?? this.tempoForGenre(genre),
      timeSignature: request.timeSignature ?? "4/4",
      key: request.key ?? "C major",
      bars,
      sections: this.arrangements.generate(bars, genre),
      tracks,
      createdAt: new Date().toISOString(),
      policyVersion: 2,
      warnings: []
    };
  }

  private defaultTracks(genre: string): NonNullable<SongPlanRequest["tracks"]> {
    const core: NonNullable<SongPlanRequest["tracks"]> = [
      { role: "drums" },
      { role: "bass" },
      { role: "chords" },
      { role: "lead" }
    ];
    if (/j\s*-?\s*pop|jpop/i.test(genre)) {
      return [
        ...core,
        { role: "pad", required: false },
        { role: "arp", required: false },
        { role: "drum_bus" },
        { role: "music_bus" },
        { role: "reverb" },
        { role: "delay", required: false },
        { role: "markers" }
      ];
    }
    if (/house|dance|edm|electro|techno/i.test(genre)) {
      return [
        ...core,
        { role: "pad", required: false },
        { role: "drum_bus" },
        { role: "music_bus" },
        { role: "reverb" },
        { role: "delay", required: false },
        { role: "markers" }
      ];
    }
    return [...core, { role: "drum_bus" }, { role: "music_bus" }, { role: "reverb" }, { role: "markers" }];
  }

  private defaultRoute(role: SongRole): SongRole | undefined {
    if (role === "drums") return "drum_bus";
    if (["bass", "chords", "lead", "pad", "arp", "vocal", "guitar", "audio_loop", "stem"].includes(role)) return "music_bus";
    return undefined;
  }

  private contentIntent(sourceKind: SongTrackIntent["sourceKind"]): SongTrackIntent["contentIntent"] {
    switch (sourceKind) {
      case "software_instrument":
      case "external_midi":
        return "generated_midi";
      case "audio_recording":
        return "recording_placeholder";
      case "audio_loop":
        return "audio_file";
      case "bus":
      case "send_fx":
        return "routing";
      case "chord":
        return "chord_events";
      case "marker":
        return "markers";
    }
  }

  private assertNoSoftwareMidiTracks(tracks: SongTrackIntent[]): void {
    const invalid = tracks.filter((track) => track.sourceKind === "software_instrument" && track.trackType === "midi");
    if (invalid.length > 0) {
      throw new Error(`Song policy rejected software roles on MIDI Tracks: ${invalid.map((track) => track.role).join(", ")}`);
    }
  }

  private genreFromPrompt(prompt: string): string {
    const normalized = prompt.toLowerCase();
    if (/j\s*-?\s*pop|제이팝/.test(normalized)) return "jpop";
    for (const genre of ["house", "techno", "edm", "dance", "rock", "pop", "hip hop", "ambient"]) {
      if (normalized.includes(genre)) return genre;
    }
    return "pop";
  }

  private barsFromPrompt(prompt: string): number {
    const match = prompt.match(/(\d+)\s*(?:bars?|마디)/i);
    return match ? Math.max(1, Math.min(512, Number(match[1]))) : 4;
  }

  private tempoForGenre(genre: string): number {
    if (/j\s*-?\s*pop|jpop/i.test(genre)) return 138;
    if (/house|dance/i.test(genre)) return 124;
    if (/techno/i.test(genre)) return 130;
    if (/edm/i.test(genre)) return 128;
    if (/hip hop/i.test(genre)) return 92;
    if (/ambient/i.test(genre)) return 80;
    if (/rock/i.test(genre)) return 120;
    return 110;
  }
}
