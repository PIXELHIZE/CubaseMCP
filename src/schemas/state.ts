import { z } from "zod/v4";

export const TrackTypeSchema = z.enum([
  "audio",
  "midi",
  "instrument",
  "group",
  "fx",
  "folder",
  "marker",
  "tempo",
  "chord",
  "vca"
]);

export const TransportStateSchema = z.enum([
  "stopped",
  "playing",
  "recording",
  "paused",
  "rewinding",
  "fastForwarding"
]);

export const PositionSchema = z.object({
  barsBeats: z.string(),
  seconds: z.number(),
  timecode: z.string()
});

export const PluginSchema = z.object({
  id: z.string(),
  name: z.string(),
  vendor: z.string().optional(),
  slot: z.number().int().min(0).optional(),
  bypassed: z.boolean().default(false),
  enabled: z.boolean().default(true),
  parameters: z.record(z.string(), z.unknown()).default({})
});

export const SendSchema = z.object({
  id: z.string(),
  destination: z.string(),
  levelDb: z.number(),
  enabled: z.boolean().default(true),
  preFader: z.boolean().default(false)
});

export const MidiNoteSchema = z.object({
  id: z.string(),
  pitch: z.number().int().min(0).max(127),
  start: z.string(),
  length: z.string(),
  velocity: z.number().int().min(1).max(127).default(100),
  channel: z.number().int().min(1).max(16).default(1)
});

export const MidiPartSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  start: z.string(),
  length: z.string(),
  name: z.string().optional(),
  notes: z.array(MidiNoteSchema).default([])
});

export const AudioEventSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  filePath: z.string(),
  start: z.string(),
  length: z.string().optional(),
  offset: z.string().optional(),
  gainDb: z.number().default(0),
  fades: z
    .object({
      in: z.string().optional(),
      out: z.string().optional()
    })
    .default({})
});

export const TrackSchema = z.object({
  id: z.string(),
  index: z.number().int().min(0),
  type: TrackTypeSchema,
  name: z.string(),
  color: z.string().optional(),
  mute: z.boolean().default(false),
  solo: z.boolean().default(false),
  recordEnabled: z.boolean().default(false),
  monitorEnabled: z.boolean().default(false),
  frozen: z.boolean().default(false),
  visible: z.boolean().default(true),
  folderId: z.string().optional(),
  volumeDb: z.number().default(0),
  pan: z.number().min(-1).max(1).default(0),
  routeTo: z.string().optional(),
  inserts: z.array(PluginSchema).default([]),
  sends: z.array(SendSchema).default([]),
  parts: z.array(MidiPartSchema).default([]),
  audioEvents: z.array(AudioEventSchema).default([]),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const MarkerSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string(),
  end: z.string().optional(),
  type: z.enum(["marker", "cycle"]).default("marker")
});

export const JobSchema = z.object({
  id: z.string(),
  type: z.enum(["export", "render", "scan", "backup", "import"]),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  progress: z.number().min(0).max(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  result: z.unknown().optional(),
  error: z.unknown().optional()
});

export const CubaseStateSchema = z.object({
  cubase: z.object({
    connected: z.boolean(),
    version: z.string(),
    midiRemoteApiVersion: z.string().default("unknown"),
    mcpProtocolVersion: z.number().int().optional(),
    hostProfile: z.string().optional(),
    scriptBuild: z.string().optional(),
    directAccessAvailable: z.boolean().default(false),
    projectOpen: z.boolean(),
    projectPath: z.string().optional()
  }),
  transport: z.object({
    state: TransportStateSchema,
    position: PositionSchema,
    cycleEnabled: z.boolean(),
    leftLocator: z.string(),
    rightLocator: z.string(),
    metronomeEnabled: z.boolean().default(false),
    countInEnabled: z.boolean().default(false),
    preRollBars: z.number().default(0),
    postRollBars: z.number().default(0)
  }),
  project: z.object({
    sampleRate: z.number().int(),
    bitDepth: z.number().int(),
    frameRate: z.string().default("30"),
    tempo: z.number(),
    timeSignature: z.string(),
    key: z.string()
  }),
  tracks: z.array(TrackSchema),
  plugins: z.array(PluginSchema).default([]),
  markers: z.array(MarkerSchema).default([]),
  automation: z.array(z.record(z.string(), z.unknown())).default([]),
  tempoMap: z.array(z.record(z.string(), z.unknown())).default([]),
  capabilities: z.array(z.record(z.string(), z.unknown())).default([]),
  visibleMixerBank: z.array(z.string()).default([]),
  selectedObjects: z.array(
    z.object({
      type: z.string(),
      id: z.string()
    })
  ),
  jobs: z.array(JobSchema).default([]),
  lastUpdatedAt: z.string(),
  stale: z.boolean().default(false)
});

export type TrackType = z.infer<typeof TrackTypeSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type Plugin = z.infer<typeof PluginSchema>;
export type MidiNote = z.infer<typeof MidiNoteSchema>;
export type MidiPart = z.infer<typeof MidiPartSchema>;
export type AudioEvent = z.infer<typeof AudioEventSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Marker = z.infer<typeof MarkerSchema>;
export type Job = z.infer<typeof JobSchema>;
export type CubaseState = z.infer<typeof CubaseStateSchema>;
