import type { CubaseState, TrackType } from "../schemas/state.js";
import type { Position, TargetRef, V2Evidence } from "../v2/contracts.js";

export type SongRole =
  | "drums"
  | "bass"
  | "chords"
  | "lead"
  | "pad"
  | "arp"
  | "vocal"
  | "guitar"
  | "audio_loop"
  | "stem"
  | "reverb"
  | "delay"
  | "drum_bus"
  | "music_bus"
  | "chord_progression"
  | "markers"
  | "external_hardware_synth"
  | "rack_multitimbral_channel";

export type SongSourceKind =
  | "software_instrument"
  | "external_midi"
  | "audio_recording"
  | "audio_loop"
  | "bus"
  | "send_fx"
  | "chord"
  | "marker";

export interface SongSection {
  id: string;
  name: string;
  startBar: number;
  bars: number;
}

export interface SongTrackIntent {
  id: string;
  role: SongRole;
  name: string;
  sourceKind: SongSourceKind;
  trackType: TrackType;
  instrument?: string;
  program?: string;
  required: boolean;
  noteDensity: "sparse" | "medium" | "dense";
  routeToRole?: SongRole;
  contentIntent: "generated_midi" | "recording_placeholder" | "audio_file" | "routing" | "chord_events" | "markers";
}

export interface SongPlan {
  id: string;
  songId: string;
  prompt: string;
  genre: string;
  tempo: number;
  timeSignature: string;
  key: string;
  bars: number;
  sections: SongSection[];
  tracks: SongTrackIntent[];
  createdAt: string;
  policyVersion: 2;
  warnings: string[];
}

export interface GeneratedSongNote {
  pitch: number;
  start: Position;
  length: string;
  velocity: number;
  channel: number;
}

export interface SongTrackBinding {
  intentId: string;
  role: SongRole;
  name: string;
  target: TargetRef;
  expectedType: TrackType;
  actualType?: TrackType;
  instrumentExpected?: string;
  programExpected?: string;
  programLoaded?: boolean;
  programEvidence?: unknown;
  instrumentLoaded?: boolean;
  audibleEvidence?: AudibleEvidence;
  partIds: string[];
  noteCount: number;
  audioEventIds: string[];
  routeToRole?: SongRole;
  routeValid?: boolean;
  ownedByPlanner: true;
}

export interface AudibleEvidence {
  verified: boolean;
  method: "meter" | "render" | "mock";
  details?: unknown;
}

export interface SongManifest {
  songId: string;
  planId: string;
  hostSessionId: string;
  projectFingerprint: string;
  createdAt: string;
  updatedAt: string;
  trackBindings: SongTrackBinding[];
  audibleEvidence?: AudibleEvidence;
  evidence: V2Evidence[];
}

export type SongIssueCode =
  | "TRACK_MISSING"
  | "TRACK_TYPE_MISMATCH"
  | "INSTRUMENT_NOT_LOADED"
  | "MIDI_PART_MISSING"
  | "MIDI_NOTES_MISSING"
  | "AUDIO_EVENT_MISSING"
  | "ROUTING_INVALID"
  | "TRACK_AUDIBILITY_NOT_VERIFIED"
  | "AUDIBILITY_NOT_VERIFIED"
  | "STALE_SONG_MANIFEST";

export interface SongValidationIssue {
  id: string;
  code: SongIssueCode;
  severity: "error" | "warning";
  intentId?: string;
  role?: SongRole;
  expected?: unknown;
  actual?: unknown;
  repairable: boolean;
  message: string;
}

export interface SongValidationResult {
  valid: boolean;
  songId: string;
  checkedAt: string;
  issues: SongValidationIssue[];
  summary: {
    expectedTracks: number;
    actualTracks: number;
    instrumentTracks: number;
    midiParts: number;
    notes: number;
    audioEvents: number;
    audible: boolean;
  };
}

export interface SongCreateResult {
  status: "succeeded" | "failed";
  plan: SongPlan;
  manifest: SongManifest;
  validation: SongValidationResult;
  state?: CubaseState;
  rollback?: {
    attempted: boolean;
    removedTargets: TargetRef[];
    failures: string[];
  };
}

export interface SongPlanRequest {
  prompt: string;
  genre?: string;
  tempo?: number;
  timeSignature?: string;
  key?: string;
  bars?: number;
  tracks?: Array<{
    role: SongRole;
    name?: string;
    sourceKind?: SongSourceKind;
    trackType?: TrackType;
    instrument?: string;
    program?: string;
    required?: boolean;
    noteDensity?: "sparse" | "medium" | "dense";
    routeToRole?: SongRole;
  }>;
}
