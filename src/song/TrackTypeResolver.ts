import type { TrackType } from "../schemas/state.js";
import type { SongRole, SongSourceKind } from "./models.js";

const roleDefaults: Record<SongRole, { sourceKind: SongSourceKind; trackType: TrackType }> = {
  drums: { sourceKind: "software_instrument", trackType: "instrument" },
  bass: { sourceKind: "software_instrument", trackType: "instrument" },
  chords: { sourceKind: "software_instrument", trackType: "instrument" },
  lead: { sourceKind: "software_instrument", trackType: "instrument" },
  pad: { sourceKind: "software_instrument", trackType: "instrument" },
  arp: { sourceKind: "software_instrument", trackType: "instrument" },
  vocal: { sourceKind: "audio_recording", trackType: "audio" },
  guitar: { sourceKind: "audio_recording", trackType: "audio" },
  audio_loop: { sourceKind: "audio_loop", trackType: "audio" },
  stem: { sourceKind: "audio_loop", trackType: "audio" },
  reverb: { sourceKind: "send_fx", trackType: "fx" },
  delay: { sourceKind: "send_fx", trackType: "fx" },
  drum_bus: { sourceKind: "bus", trackType: "group" },
  music_bus: { sourceKind: "bus", trackType: "group" },
  chord_progression: { sourceKind: "chord", trackType: "chord" },
  markers: { sourceKind: "marker", trackType: "marker" },
  external_hardware_synth: { sourceKind: "external_midi", trackType: "midi" },
  rack_multitimbral_channel: { sourceKind: "external_midi", trackType: "midi" }
};

const sourceTrackTypes: Record<SongSourceKind, TrackType> = {
  software_instrument: "instrument",
  external_midi: "midi",
  audio_recording: "audio",
  audio_loop: "audio",
  bus: "group",
  send_fx: "fx",
  chord: "chord",
  marker: "marker"
};

export class SongPolicyError extends Error {
  constructor(
    public readonly code: "SONG_TRACK_TYPE_CONFLICT" | "SONG_SOFTWARE_ROLE_MIDI_FORBIDDEN",
    message: string,
    public readonly details: Record<string, unknown>
  ) {
    super(message);
    this.name = "SongPolicyError";
  }
}

export class TrackTypeResolver {
  resolve(
    role: SongRole,
    explicitSourceKind?: SongSourceKind,
    explicitTrackType?: TrackType
  ): { sourceKind: SongSourceKind; trackType: TrackType } {
    const roleDefault = roleDefaults[role];
    const sourceKind = explicitSourceKind ?? roleDefault.sourceKind;
    const expectedFromSource = sourceTrackTypes[sourceKind];
    const trackType = explicitTrackType ?? expectedFromSource;

    if (sourceKind === "software_instrument" && trackType === "midi") {
      throw new SongPolicyError(
        "SONG_SOFTWARE_ROLE_MIDI_FORBIDDEN",
        `Software instrument role "${role}" must use an Instrument Track, not a MIDI Track.`,
        { role, sourceKind, requestedTrackType: trackType, requiredTrackType: "instrument" }
      );
    }
    if (trackType !== expectedFromSource) {
      throw new SongPolicyError(
        "SONG_TRACK_TYPE_CONFLICT",
        `Source kind "${sourceKind}" requires track type "${expectedFromSource}", received "${trackType}".`,
        { role, sourceKind, requestedTrackType: trackType, requiredTrackType: expectedFromSource }
      );
    }
    return { sourceKind, trackType };
  }

  defaultsFor(role: SongRole): { sourceKind: SongSourceKind; trackType: TrackType } {
    return { ...roleDefaults[role] };
  }
}

