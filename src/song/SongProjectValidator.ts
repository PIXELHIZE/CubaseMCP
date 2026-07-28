import type { CubaseState, Track } from "../schemas/state.js";
import type {
  SongManifest,
  SongTrackBinding,
  SongValidationIssue,
  SongValidationResult
} from "./models.js";

function issue(
  binding: SongTrackBinding | undefined,
  code: SongValidationIssue["code"],
  message: string,
  expected?: unknown,
  actual?: unknown,
  repairable = true
): SongValidationIssue {
  return {
    id: `${binding?.intentId ?? "song"}:${code}`,
    code,
    severity: "error",
    intentId: binding?.intentId,
    role: binding?.role,
    expected,
    actual,
    repairable,
    message
  };
}

export class SongProjectValidator {
  validate(manifest: SongManifest, state: CubaseState): SongValidationResult {
    const issues: SongValidationIssue[] = [];
    const tracksById = new Map(state.tracks.map((track) => [track.id, track]));

    for (const binding of manifest.trackBindings) {
      if (binding.target.kind !== "uniqueId") {
        issues.push(issue(binding, "STALE_SONG_MANIFEST", "Song validation requires a stable unique track ID.", "uniqueId", binding.target.kind, false));
        continue;
      }
      const track = tracksById.get(binding.target.uniqueId);
      if (!track) {
        issues.push(issue(binding, "TRACK_MISSING", `Required ${binding.role} track is missing.`, binding.name));
        continue;
      }
      this.validateTrack(binding, track, issues);
    }

    if (!manifest.audibleEvidence?.verified) {
      issues.push(issue(undefined, "AUDIBILITY_NOT_VERIFIED", "No meter or render evidence proves the song is audible.", true, false, false));
    }

    const tracks = manifest.trackBindings
      .filter((binding) => binding.target.kind === "uniqueId")
      .map((binding) => tracksById.get(binding.target.kind === "uniqueId" ? binding.target.uniqueId : ""))
      .filter((track): track is Track => Boolean(track));
    return {
      valid: issues.every((candidate) => candidate.severity !== "error"),
      songId: manifest.songId,
      checkedAt: new Date().toISOString(),
      issues,
      summary: {
        expectedTracks: manifest.trackBindings.length,
        actualTracks: tracks.length,
        instrumentTracks: tracks.filter((track) => track.type === "instrument").length,
        midiParts: tracks.reduce((count, track) => count + track.parts.length, 0),
        notes: tracks.reduce((count, track) => count + track.parts.reduce((inner, part) => inner + part.notes.length, 0), 0),
        audioEvents: tracks.reduce((count, track) => count + track.audioEvents.length, 0),
        audible: manifest.audibleEvidence?.verified ?? false
      }
    };
  }

  private validateTrack(binding: SongTrackBinding, track: Track, issues: SongValidationIssue[]): void {
    if (track.type !== binding.expectedType) {
      issues.push(issue(
        binding,
        "TRACK_TYPE_MISMATCH",
        `${binding.role} expected ${binding.expectedType} track, received ${track.type}.`,
        binding.expectedType,
        track.type,
        false
      ));
    }
    if (binding.expectedType === "instrument" && track.type === "midi") {
      issues.push(issue(
        binding,
        "TRACK_TYPE_MISMATCH",
        `Software ${binding.role} was created as a MIDI Track. This is forbidden by Song Creation Policy.`,
        "instrument",
        "midi",
        false
      ));
    }
    const instrumentName = typeof track.metadata.instrumentName === "string"
      ? track.metadata.instrumentName
      : undefined;
    if (binding.expectedType === "instrument" && track.inserts.length === 0 && !instrumentName) {
      issues.push(issue(binding, "INSTRUMENT_NOT_LOADED", `${binding.role} Instrument Track has no loaded instrument.`, binding.instrumentExpected));
    }
    if (["instrument", "midi"].includes(binding.expectedType) && track.parts.length === 0) {
      issues.push(issue(binding, "MIDI_PART_MISSING", `${binding.role} has no MIDI part.`));
    } else if (
      ["instrument", "midi"].includes(binding.expectedType) &&
      track.parts.reduce((count, part) => count + part.notes.length, 0) === 0
    ) {
      issues.push(issue(binding, "MIDI_NOTES_MISSING", `${binding.role} MIDI parts contain no notes.`));
    }
    if (binding.expectedType === "audio" && track.audioEvents.length === 0) {
      issues.push(issue(binding, "AUDIO_EVENT_MISSING", `${binding.role} Audio Track has no media event.`));
    }
    if (binding.routeToRole && !binding.routeValid) {
      issues.push(issue(binding, "ROUTING_INVALID", `${binding.role} is not routed to ${binding.routeToRole}.`, binding.routeToRole, track.routeTo));
    }
  }
}
