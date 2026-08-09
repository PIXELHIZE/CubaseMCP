import { z } from "zod/v4";
import { PositionSchema, TargetRefSchema, V2BaseInputShape } from "./contracts.js";

type ActionShapes = Record<string, z.ZodRawShape>;

function actionUnion(actions: ActionShapes): z.ZodTypeAny {
  const variants = Object.entries(actions).map(([action, shape]) =>
    z.object({
      ...V2BaseInputShape,
      action: z.literal(action),
      ...shape
    }).strict()
  );
  return z.discriminatedUnion("action", variants as never);
}

const Empty = {};
const Target = { target: TargetRefSchema };
const Path = { path: z.string().min(1) };
const OptionalPosition = { position: PositionSchema.optional() };
const TrackTypeSchema = z.enum([
  "audio",
  "midi",
  "instrument",
  "group",
  "fx",
  "folder",
  "marker",
  "tempo",
  "chord",
  "arranger",
  "video"
]);
const MidiNoteSchema = z.object({
  pitch: z.number().int().min(0).max(127),
  start: PositionSchema,
  length: z.string().min(1),
  velocity: z.number().int().min(1).max(127).default(100).optional(),
  channel: z.number().int().min(1).max(16).default(1).optional()
});
const SongRoleSchema = z.enum([
  "drums",
  "bass",
  "chords",
  "lead",
  "pad",
  "arp",
  "vocal",
  "guitar",
  "audio_loop",
  "stem",
  "reverb",
  "delay",
  "drum_bus",
  "music_bus",
  "chord_progression",
  "markers",
  "external_hardware_synth",
  "rack_multitimbral_channel"
]);
const SongSourceKindSchema = z.enum([
  "software_instrument",
  "external_midi",
  "audio_recording",
  "audio_loop",
  "bus",
  "send_fx",
  "chord",
  "marker"
]);
const SongTrackIntentSchema = z.object({
  role: SongRoleSchema,
  name: z.string().min(1).optional(),
  sourceKind: SongSourceKindSchema.optional(),
  trackType: TrackTypeSchema.optional(),
  instrument: z.string().min(1).optional(),
  program: z.string().min(1).optional(),
  required: z.boolean().default(true).optional(),
  noteDensity: z.enum(["sparse", "medium", "dense"]).default("medium").optional(),
  routeToRole: SongRoleSchema.optional()
});
const SongPlanTrackSchema = SongTrackIntentSchema.extend({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceKind: SongSourceKindSchema,
  trackType: TrackTypeSchema,
  required: z.boolean(),
  noteDensity: z.enum(["sparse", "medium", "dense"]),
  contentIntent: z.enum(["generated_midi", "recording_placeholder", "audio_file", "routing", "chord_events", "markers"])
});
const SongPlanSchema = z.object({
  id: z.string().min(1),
  songId: z.string().min(1),
  prompt: z.string().min(1),
  genre: z.string().min(1),
  tempo: z.number().min(20).max(400),
  timeSignature: z.string().regex(/^\d+\/\d+$/),
  key: z.string().min(1),
  bars: z.number().int().min(1).max(512),
  sections: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    startBar: z.number().int().min(1),
    bars: z.number().int().min(1)
  })).min(1),
  tracks: z.array(SongPlanTrackSchema).min(1).max(128),
  createdAt: z.string().datetime(),
  policyVersion: z.literal(2),
  warnings: z.array(z.string())
}).strict();
const MidiNoteEditSchema = z.object({
  noteId: z.string().min(1),
  pitch: z.number().int().min(0).max(127).optional(),
  start: PositionSchema.optional(),
  length: z.string().min(1).optional(),
  velocity: z.number().int().min(1).max(127).optional(),
  channel: z.number().int().min(1).max(16).optional()
}).strict().refine(
  (edit) => ["pitch", "start", "length", "velocity", "channel"].some((key) => key in edit),
  { message: "A MIDI note edit requires at least one changed field." }
);
const ChordEventSchema = z.object({
  position: PositionSchema,
  root: z.string().min(1),
  quality: z.string().min(1),
  length: z.string().min(1)
}).strict();
const AutomationPointSchema = z.object({
  position: PositionSchema,
  value: z.number(),
  curve: z.enum(["linear", "jump", "spline"]).optional()
}).strict();
const AutomationPointEditSchema = AutomationPointSchema.partial().extend({
  pointId: z.string().min(1)
}).strict();
const ExportBatchJobSchema = z.object({
  name: z.string().min(1).optional(),
  source: z.enum(["mixdown", "stems", "selected_tracks", "selected_events", "selected_event"]),
  destination: z.string().min(1),
  format: z.enum(["wav", "aiff", "flac", "mp3"]).optional()
}).strict();
const BatchStepSchema = z.object({
  tool: z.enum([
    "cubase.system", "cubase.project", "cubase.song", "cubase.track", "cubase.transport",
    "cubase.mixer_channel", "cubase.mixer_routing", "cubase.plugin", "cubase.midi_part",
    "cubase.midi_edit", "cubase.midi_transform", "cubase.audio_event", "cubase.audio_process",
    "cubase.tempo", "cubase.chord", "cubase.arrangement", "cubase.automation", "cubase.media",
    "cubase.export_config", "cubase.export_run", "cubase.job", "cubase.history", "cubase.batch",
    "cubase.debug.command", "cubase.debug.direct_access"
  ]),
  action: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}).optional()
}).strict();

export const v2ActionSchemas = {
  "cubase.system": actionUnion({
    status: Empty,
    capabilities: { tool: z.string().optional(), actionFilter: z.string().optional() },
    diagnose: { includeTransportProbe: z.boolean().default(false).optional() }
  }),
  "cubase.project": actionUnion({
    get: Empty,
    create: { name: z.string().min(1), directory: z.string().min(1).optional(), template: z.string().optional() },
    open: Path,
    save: Empty,
    save_as: { ...Path, overwrite: z.boolean().default(false).optional() },
    close: Empty,
    backup: { destination: z.string().min(1) },
    apply_template: { template: z.string().min(1) },
    configure: {
      sampleRate: z.number().int().positive().optional(),
      bitDepth: z.number().int().positive().optional(),
      frameRate: z.string().optional()
    }
  }),
  "cubase.song": actionUnion({
    program_catalog: {
      query: z.string().min(1).optional(),
      role: SongRoleSchema.optional()
    },
    plan: {
      prompt: z.string().min(1),
      genre: z.string().min(1).optional(),
      tempo: z.number().min(20).max(400).optional(),
      timeSignature: z.string().regex(/^\d+\/\d+$/).default("4/4").optional(),
      key: z.string().min(1).optional(),
      bars: z.number().int().min(1).max(512).default(4).optional(),
      tracks: z.array(SongTrackIntentSchema).max(128).optional()
    },
    create: {
      planId: z.string().min(1).optional(),
      plan: SongPlanSchema.optional(),
      rollbackOnFailure: z.boolean().default(true).optional()
    },
    validate: {
      songId: z.string().min(1),
      audibleVerification: z.enum(["meter", "render", "either"]).default("either").optional()
    },
    repair: {
      songId: z.string().min(1),
      issueIds: z.array(z.string().min(1)).optional()
    },
    describe: { songId: z.string().min(1).optional() }
  }).superRefine((value, context) => {
    const input = value as { action?: string; planId?: string; plan?: unknown };
    if (input.action === "create" && !input.planId && !input.plan) {
      context.addIssue({
        code: "custom",
        path: ["planId"],
        message: "Song creation requires planId or plan."
      });
    }
  }),
  "cubase.track": actionUnion({
    list: { type: TrackTypeSchema.optional(), includeHidden: z.boolean().default(false).optional() },
    get: Target,
    create_default_audio: { name: z.string().optional(), count: z.number().int().min(1).max(128).default(1).optional() },
    create_default_midi: { name: z.string().optional(), count: z.number().int().min(1).max(128).default(1).optional() },
    create_default_instrument: { name: z.string().optional(), count: z.number().int().min(1).max(128).default(1).optional() },
    create_default_group: { name: z.string().optional() },
    create_default_fx: { name: z.string().optional() },
    create_default_folder: { name: z.string().optional() },
    create_default_marker: { name: z.string().optional() },
    create_from_template: { template: z.string().min(1), name: z.string().optional() },
    create_parameterized: {
      type: TrackTypeSchema,
      name: z.string().min(1),
      count: z.number().int().min(1).max(128).default(1).optional(),
      instrument: z.string().optional(),
      outputBus: z.string().optional()
    },
    rename: { ...Target, name: z.string().min(1) },
    set_color: { ...Target, color: z.string().min(1) },
    select: { targets: z.array(TargetRefSchema).min(1), mode: z.enum(["replace", "add", "remove"]).default("replace").optional() },
    delete: Target,
    duplicate: Target,
    reorder: { ...Target, index: z.number().int().min(0) },
    move_to_folder: { ...Target, folder: TargetRefSchema },
    set_visibility: { ...Target, visible: z.boolean() },
    freeze: Target,
    unfreeze: Target
  }),
  "cubase.transport": actionUnion({
    get: Empty,
    play: Empty,
    stop: Empty,
    pause: Empty,
    record: { countIn: z.boolean().optional() },
    rewind: Empty,
    forward: Empty,
    locate: { position: PositionSchema },
    nudge: { amount: z.number(), unit: z.enum(["bars", "beats", "seconds", "frames"]) },
    set_locators: { left: PositionSchema, right: PositionSchema },
    set_cycle: { enabled: z.boolean() },
    set_metronome: { enabled: z.boolean() },
    set_punch: { enabled: z.boolean(), in: PositionSchema.optional(), out: PositionSchema.optional() },
    set_count_in: { enabled: z.boolean() },
    set_preroll: { bars: z.number().int().min(0).max(128) },
    set_postroll: { bars: z.number().int().min(0).max(128) }
  }),
  "cubase.mixer_channel": actionUnion({
    get: Target,
    set_level: { ...Target, db: z.number().min(-120).max(24) },
    set_pan: { ...Target, pan: z.number().min(-1).max(1) },
    set_input_gain: { ...Target, db: z.number().min(-120).max(24) },
    set_phase: { ...Target, inverted: z.boolean() },
    set_mute: { ...Target, enabled: z.boolean() },
    set_solo: { ...Target, enabled: z.boolean() },
    set_record_enable: { ...Target, enabled: z.boolean() },
    set_monitor: { ...Target, enabled: z.boolean() },
    get_meters: { targets: z.array(TargetRefSchema).optional() },
    set_eq_band: {
      ...Target,
      band: z.number().int().min(1).max(8),
      enabled: z.boolean().optional(),
      frequencyHz: z.number().positive().optional(),
      gainDb: z.number().optional(),
      q: z.number().positive().optional()
    },
    set_strip: { ...Target, module: z.string().min(1), parameters: z.record(z.string(), z.number()) },
    set_vca: { ...Target, vca: TargetRefSchema.optional() }
  }),
  "cubase.mixer_routing": actionUnion({
    set_output: { ...Target, destination: TargetRefSchema },
    route_to_group: { ...Target, group: TargetRefSchema },
    set_sidechain: { ...Target, plugin: TargetRefSchema, source: TargetRefSchema },
    set_send: {
      ...Target,
      slot: z.number().int().min(1).max(16),
      destination: TargetRefSchema,
      enabled: z.boolean().default(true).optional(),
      levelDb: z.number().optional()
    },
    remove_send: { ...Target, slot: z.number().int().min(1).max(16) }
  }),
  "cubase.plugin": actionUnion({
    list: { track: TargetRefSchema.optional(), query: z.string().optional() },
    assign: { slot: TargetRefSchema, pluginUid: z.string().min(1) },
    remove: { slot: TargetRefSchema },
    enable: { plugin: TargetRefSchema, enabled: z.boolean() },
    bypass: { plugin: TargetRefSchema, enabled: z.boolean() },
    list_parameters: { plugin: TargetRefSchema },
    get_parameter: { plugin: TargetRefSchema, parameterId: z.string().min(1) },
    set_parameter: {
      plugin: TargetRefSchema,
      parameterId: z.string().min(1),
      value: z.number(),
      valueMode: z.enum(["normalized", "plain"]).default("normalized").optional()
    },
    load_preset: { plugin: TargetRefSchema, preset: z.string().min(1) },
    set_sidechain: { plugin: TargetRefSchema, enabled: z.boolean() },
    set_output: { plugin: TargetRefSchema, output: z.string().min(1), enabled: z.boolean() },
    set_window: { plugin: TargetRefSchema, open: z.boolean() }
  }),
  "cubase.midi_part": actionUnion({
    create: { track: TargetRefSchema, start: PositionSchema, length: z.string().min(1), name: z.string().optional() },
    get: Target,
    delete: Target,
    copy: { ...Target, destinationTrack: TargetRefSchema, position: PositionSchema },
    move: { ...Target, destinationTrack: TargetRefSchema.optional(), position: PositionSchema },
    import_file: { ...Path, track: TargetRefSchema.optional(), position: PositionSchema.optional() },
    generate_file: {
      notes: z.array(MidiNoteSchema).min(1),
      outputPath: z.string().optional(),
      tempo: z.number().min(20).max(400).default(120).optional(),
      ppq: z.number().int().min(24).max(32767).default(480).optional()
    }
  }),
  "cubase.midi_edit": actionUnion({
    list_notes: Target,
    add_notes: { part: TargetRefSchema, notes: z.array(MidiNoteSchema).min(1) },
    update_notes: { part: TargetRefSchema, edits: z.array(MidiNoteEditSchema).min(1) },
    delete_notes: { part: TargetRefSchema, noteIds: z.array(z.string().min(1)).min(1) },
    edit_controller: {
      part: TargetRefSchema,
      controller: z.number().int().min(0).max(127),
      points: z.array(z.object({ position: PositionSchema, value: z.number().int().min(0).max(127) })).min(1)
    },
    edit_pitch_bend: {
      part: TargetRefSchema,
      points: z.array(z.object({
        position: PositionSchema,
        value: z.number().int().min(-8192).max(8191)
      }).strict()).min(1)
    }
  }),
  "cubase.midi_transform": actionUnion({
    quantize: { target: TargetRefSchema, grid: z.string().min(1), strength: z.number().min(0).max(100).default(100).optional() },
    humanize: { target: TargetRefSchema, timing: z.number().min(0), velocity: z.number().min(0) },
    transpose: { target: TargetRefSchema, semitones: z.number().int().min(-127).max(127) },
    legato: { target: TargetRefSchema },
    fixed_length: { target: TargetRefSchema, length: z.string().min(1) },
    apply_drum_map: { target: TargetRefSchema, drumMap: z.string().min(1) },
    apply_scale: { target: TargetRefSchema, key: z.string().min(1), scale: z.string().min(1) }
  }),
  "cubase.audio_event": actionUnion({
    import: { ...Path, track: TargetRefSchema.optional(), position: PositionSchema.optional() },
    create: { track: TargetRefSchema, filePath: z.string().min(1), position: PositionSchema },
    get: Target,
    update: { ...Target, position: PositionSchema.optional(), gainDb: z.number().optional(), muted: z.boolean().optional() },
    delete: Target,
    split: { ...Target, position: PositionSchema },
    copy: { ...Target, destinationTrack: TargetRefSchema, position: PositionSchema },
    move: { ...Target, destinationTrack: TargetRefSchema.optional(), position: PositionSchema },
    set_fade: { ...Target, fadeIn: z.string().optional(), fadeOut: z.string().optional() },
    crossfade: { left: TargetRefSchema, right: TargetRefSchema, length: z.string().optional() }
  }),
  "cubase.audio_process": actionUnion({
    normalize: { target: TargetRefSchema, peakDb: z.number().max(0).default(-1).optional() },
    reverse: Target,
    render: { targets: z.array(TargetRefSchema).min(1) },
    bounce: { targets: z.array(TargetRefSchema).min(1) },
    time_stretch: { ...Target, ratio: z.number().positive() },
    pitch_shift: { ...Target, semitones: z.number().min(-48).max(48) },
    quantize: { ...Target, grid: z.string().min(1) },
    detect_silence: { ...Target, thresholdDb: z.number() },
    set_warp: { ...Target, enabled: z.boolean() },
    analyze_hitpoints: Target,
    comp: { targets: z.array(TargetRefSchema).min(1) }
  }),
  "cubase.tempo": actionUnion({
    get: Empty,
    set: { bpm: z.number().min(20).max(400), ...OptionalPosition },
    add_event: { bpm: z.number().min(20).max(400), position: PositionSchema },
    update_event: { eventId: z.string().min(1), bpm: z.number().min(20).max(400), position: PositionSchema.optional() },
    delete_event: { eventId: z.string().min(1) },
    set_time_signature: { signature: z.string().regex(/^\d+\/\d+$/), position: PositionSchema.optional() },
    set_key: { key: z.string().min(1), scale: z.string().min(1), position: PositionSchema.optional() },
    set_scale: { key: z.string().min(1), scale: z.string().min(1) },
    create_map: { events: z.array(z.object({ position: PositionSchema, bpm: z.number().min(20).max(400) })).min(1) }
  }),
  "cubase.chord": actionUnion({
    get: Empty,
    create: { position: PositionSchema, root: z.string().min(1), quality: z.string().min(1), length: z.string().min(1) },
    update: { chordId: z.string().min(1), root: z.string().optional(), quality: z.string().optional(), position: PositionSchema.optional() },
    delete: { chordId: z.string().min(1) },
    create_progression: { chords: z.array(ChordEventSchema).min(1) }
  }),
  "cubase.arrangement": actionUnion({
    add_marker: { position: PositionSchema, name: z.string().optional() },
    update_marker: { markerId: z.string().min(1), position: PositionSchema.optional(), name: z.string().optional() },
    delete_marker: { markerId: z.string().min(1) },
    add_cycle_marker: { start: PositionSchema, end: PositionSchema, name: z.string().optional() },
    create_arranger_event: { start: PositionSchema, end: PositionSchema, name: z.string().min(1) },
    create_arranger_chain: { eventIds: z.array(z.string().min(1)).min(1) },
    reorder_arranger_chain: { eventIds: z.array(z.string().min(1)).min(1) },
    duplicate_section: { start: PositionSchema, end: PositionSchema, destination: PositionSchema },
    analyze_structure: Empty
  }),
  "cubase.automation": actionUnion({
    create_lane: { target: TargetRefSchema, parameter: z.string().min(1) },
    add_points: { lane: TargetRefSchema, points: z.array(AutomationPointSchema).min(1) },
    update_points: { lane: TargetRefSchema, points: z.array(AutomationPointEditSchema).min(1) },
    delete_points: { lane: TargetRefSchema, pointIds: z.array(z.string().min(1)).min(1) },
    set_curve: { lane: TargetRefSchema, curve: z.enum(["linear", "jump", "spline"]) },
    set_read: { target: TargetRefSchema, enabled: z.boolean() },
    set_write: { target: TargetRefSchema, enabled: z.boolean() },
    write_series: { target: TargetRefSchema, parameter: z.string().min(1), points: z.array(AutomationPointSchema).min(1) },
    smooth: { lane: TargetRefSchema, amount: z.number().min(0).max(1) },
    trim: { lane: TargetRefSchema, amount: z.number() }
  }),
  "cubase.media": actionUnion({
    get_pool: Empty,
    import_video: Path,
    import_sample: Path,
    clean_unused: { deleteFromDisk: z.boolean().default(false).optional() },
    relink: { missingFileId: z.string().min(1), newPath: z.string().min(1) },
    search: { query: z.string().min(1), mediaType: z.string().optional() }
  }),
  "cubase.export_config": actionUnion({
    get: Empty,
    set_format: { format: z.enum(["wav", "aiff", "flac", "mp3"]) },
    set_sample_rate: { sampleRate: z.number().int().positive() },
    set_bit_depth: { bitDepth: z.number().int().positive() },
    set_range: { start: PositionSchema, end: PositionSchema },
    set_path: { directory: z.string().min(1) },
    set_filename_pattern: { pattern: z.string().min(1) },
    set_loudness: { lufs: z.number() },
    set_realtime: { enabled: z.boolean() }
  }),
  "cubase.export_run": actionUnion({
    perform_current_settings: { expectedFiles: z.array(z.string().min(1)).optional() },
    mixdown_explicit: {
      path: z.string().min(1),
      format: z.enum(["wav", "aiff", "flac", "mp3"]),
      start: PositionSchema,
      end: PositionSchema
    },
    stems: { directory: z.string().min(1), tracks: z.array(TargetRefSchema).min(1) },
    selected_tracks: { directory: z.string().min(1) },
    selected_events: { directory: z.string().min(1) },
    selected_event: { path: z.string().min(1) },
    batch: { jobs: z.array(ExportBatchJobSchema).min(1) }
  }),
  "cubase.job": actionUnion({
    list: { type: z.string().optional(), status: z.string().optional() },
    get: { jobId: z.string().min(1) },
    cancel: { jobId: z.string().min(1) }
  }),
  "cubase.history": actionUnion({
    undo: { steps: z.number().int().min(1).max(100).default(1).optional() },
    redo: { steps: z.number().int().min(1).max(100).default(1).optional() },
    snapshot: { label: z.string().min(1) }
  }),
  "cubase.batch": actionUnion({
    preview: { steps: z.array(BatchStepSchema).min(1) },
    validate: { steps: z.array(BatchStepSchema).min(1) },
    execute: {
      steps: z.array(BatchStepSchema).min(1),
      stopOnError: z.boolean().default(true).optional()
    }
  }),
  "cubase.debug.command": actionUnion({
    get_registry: Empty,
    can_perform: { key: z.string().min(1) },
    trigger: { key: z.string().min(1), value: z.number().int().min(0).max(127).default(127).optional() }
  }),
  "cubase.debug.direct_access": actionUnion({
    get_capabilities: Empty,
    discover_tree: { root: z.enum(["transport", "trackSelection", "mixConsole", "focusedQuickControls"]), cursor: z.string().optional() },
    get_object: { objectId: z.number().int().nonnegative() },
    get_parameters: { objectId: z.number().int().nonnegative(), cursor: z.string().optional() },
    get_parameter: { objectId: z.number().int().nonnegative(), parameterTag: z.number().int().nonnegative() },
    set_parameter: {
      objectId: z.number().int().nonnegative(),
      parameterTag: z.number().int().nonnegative(),
      value: z.number(),
      valueMode: z.enum(["process", "plain"]).default("process").optional()
    }
  })
} satisfies Record<string, z.ZodTypeAny>;

export type V2ToolName = keyof typeof v2ActionSchemas;

export const v2ToolNames = Object.keys(v2ActionSchemas) as V2ToolName[];
