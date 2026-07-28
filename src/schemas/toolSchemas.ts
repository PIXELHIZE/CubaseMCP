import { z } from "zod/v4";
import { TrackTypeSchema } from "./state.js";

const FileFormatSchema = z.enum(["wav", "aiff", "flac", "mp3"]);
const PositionInputSchema = z.string().min(1);
const RangeSchema = z.object({
  start: PositionInputSchema,
  end: PositionInputSchema
});

export const BaseInputShape = {
  dryRun: z.boolean().default(false).optional(),
  confirm: z.boolean().optional(),
  requestId: z.string().min(1).optional()
};

export const EmptyInputShape = {
  ...BaseInputShape
};

export const ProjectCreateInputShape = {
  ...BaseInputShape,
  path: z.string().optional(),
  template: z.string().optional(),
  sampleRate: z.number().int().positive().default(48000).optional(),
  bitDepth: z.number().int().positive().default(24).optional(),
  frameRate: z.string().default("30").optional(),
  name: z.string().optional()
};

export const ProjectPathInputShape = {
  ...BaseInputShape,
  path: z.string().min(1)
};

export const SaveProjectInputShape = {
  ...BaseInputShape,
  saveAsPath: z.string().optional(),
  overwrite: z.boolean().default(false).optional()
};

export const CloseProjectInputShape = {
  ...BaseInputShape,
  discardUnsavedChanges: z.boolean().default(false).optional()
};

export const ProjectSetupInputShape = {
  ...BaseInputShape,
  sampleRate: z.number().int().positive().optional(),
  bitDepth: z.number().int().positive().optional(),
  frameRate: z.string().optional()
};

export const BackupProjectInputShape = {
  ...BaseInputShape,
  destination: z.string().optional(),
  includeMedia: z.boolean().default(true).optional()
};

export const ListTracksInputShape = {
  ...BaseInputShape,
  type: TrackTypeSchema.optional(),
  includeHidden: z.boolean().default(false).optional()
};

export const TrackIdInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1)
};

export const CreateTrackInputShape = {
  ...BaseInputShape,
  type: TrackTypeSchema,
  name: z.string().optional(),
  count: z.number().int().min(1).max(128).default(1).optional(),
  color: z.string().optional(),
  folderId: z.string().optional(),
  instrumentName: z.string().optional(),
  inputBus: z.string().optional(),
  outputBus: z.string().optional()
};

export const DeleteTracksInputShape = {
  ...BaseInputShape,
  trackIds: z.array(z.string().min(1)).min(1)
};

export const UpdateTrackInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  name: z.string().optional(),
  color: z.string().optional(),
  mute: z.boolean().optional(),
  solo: z.boolean().optional(),
  recordEnabled: z.boolean().optional(),
  monitorEnabled: z.boolean().optional(),
  frozen: z.boolean().optional(),
  visible: z.boolean().optional(),
  folderId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
};

export const SelectTracksInputShape = {
  ...BaseInputShape,
  trackIds: z.array(z.string().min(1)),
  mode: z.enum(["replace", "add", "remove"]).default("replace").optional()
};

export const DuplicateTrackInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  includeEvents: z.boolean().default(true).optional(),
  includePlugins: z.boolean().default(true).optional()
};

export const ReorderTrackInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  targetIndex: z.number().int().min(0)
};

export const TrackVolumeInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  volumeDb: z.number().min(-144).max(24)
};

export const TrackPanInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  pan: z.number().min(-1).max(1)
};

export const TrackBooleanInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  enabled: z.boolean()
};

export const ListPluginsInputShape = {
  ...BaseInputShape,
  trackId: z.string().optional(),
  query: z.string().optional(),
  includeLoaded: z.boolean().default(true).optional()
};

export const AddInsertPluginInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  pluginName: z.string().min(1),
  slot: z.number().int().min(0).max(31).optional(),
  preset: z.string().optional(),
  sidechain: z.boolean().default(false).optional(),
  openWindow: z.boolean().default(false).optional()
};

export const PluginTargetInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  pluginId: z.string().min(1)
};

export const PluginParameterInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  pluginId: z.string().min(1),
  parameterId: z.string().min(1),
  value: z.union([z.number(), z.string(), z.boolean()])
};

export const PluginBooleanInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  pluginId: z.string().min(1),
  enabled: z.boolean()
};

export const SetSendInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  sendId: z.string().optional(),
  destination: z.string().min(1),
  levelDb: z.number().min(-144).max(24),
  enabled: z.boolean().default(true).optional(),
  preFader: z.boolean().default(false).optional()
};

export const SetEqBandInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  band: z.number().int().min(1).max(8),
  enabled: z.boolean().default(true).optional(),
  frequencyHz: z.number().positive(),
  gainDb: z.number().min(-24).max(24),
  q: z.number().positive().default(1).optional(),
  type: z.enum(["lowCut", "lowShelf", "peak", "highShelf", "highCut"]).default("peak").optional()
};

export const SetRoutingInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  inputBus: z.string().optional(),
  outputBus: z.string().optional(),
  groupTrackId: z.string().optional(),
  sidechainSourceTrackId: z.string().optional()
};

export const MetersInputShape = {
  ...BaseInputShape,
  trackIds: z.array(z.string()).optional(),
  includePeak: z.boolean().default(true).optional(),
  includeRms: z.boolean().default(true).optional()
};

export const CreateMidiPartInputShape = {
  ...BaseInputShape,
  trackId: z.string().min(1),
  start: PositionInputSchema,
  length: PositionInputSchema,
  name: z.string().optional()
};

const MidiNoteInputSchema = z.object({
  pitch: z.number().int().min(0).max(127),
  start: PositionInputSchema,
  length: PositionInputSchema,
  velocity: z.number().int().min(1).max(127).default(100).optional(),
  channel: z.number().int().min(1).max(16).default(1).optional()
});

export const AddMidiNoteInputShape = {
  ...BaseInputShape,
  partId: z.string().min(1),
  notes: z.array(MidiNoteInputSchema).min(1)
};

export const EditMidiNotesInputShape = {
  ...BaseInputShape,
  partId: z.string().min(1),
  noteIds: z.array(z.string()).optional(),
  pitchDelta: z.number().int().optional(),
  startDelta: z.string().optional(),
  setLength: z.string().optional(),
  velocityDelta: z.number().int().optional(),
  setVelocity: z.number().int().min(1).max(127).optional(),
  controller: z
    .object({
      lane: z.string(),
      value: z.number(),
      position: PositionInputSchema
    })
    .optional()
};

export const QuantizeMidiInputShape = {
  ...BaseInputShape,
  partId: z.string().optional(),
  trackId: z.string().optional(),
  grid: z.string().default("1/16").optional(),
  strength: z.number().min(0).max(1).default(1).optional(),
  swing: z.number().min(0).max(1).default(0).optional()
};

export const TransformMidiInputShape = {
  ...BaseInputShape,
  partId: z.string().optional(),
  trackId: z.string().optional(),
  operation: z.enum(["humanize", "transpose", "legato", "fixedLength", "drumMap", "scaleAssistant", "chord"]),
  parameters: z.record(z.string(), z.unknown()).default({}).optional()
};

export const ImportAudioInputShape = {
  ...BaseInputShape,
  filePath: z.string().min(1),
  trackId: z.string().optional(),
  createTrack: z.boolean().default(false).optional(),
  position: PositionInputSchema.default("1.1.1.0").optional(),
  copyToProject: z.boolean().default(true).optional()
};

export const EditAudioEventInputShape = {
  ...BaseInputShape,
  eventId: z.string().min(1),
  action: z.enum(["move", "trim", "copy", "delete", "fadeIn", "fadeOut", "crossfade", "gain"]),
  position: PositionInputSchema.optional(),
  length: PositionInputSchema.optional(),
  gainDb: z.number().min(-60).max(24).optional(),
  targetTrackId: z.string().optional()
};

export const ProcessAudioEventInputShape = {
  ...BaseInputShape,
  eventId: z.string().min(1),
  process: z.enum([
    "normalize",
    "reverse",
    "bounce",
    "renderInPlace",
    "timeStretch",
    "pitchShift",
    "quantize",
    "detectSilence",
    "audioWarp",
    "hitpointAnalysis",
    "comping"
  ]),
  parameters: z.record(z.string(), z.unknown()).default({}).optional()
};

export const ImportMediaInputShape = {
  ...BaseInputShape,
  filePath: z.string().min(1),
  position: PositionInputSchema.default("1.1.1.0").optional(),
  targetTrackId: z.string().optional()
};

export const CleanupMediaInputShape = {
  ...BaseInputShape,
  deleteFromDisk: z.boolean().default(false).optional()
};

export const RelinkMediaInputShape = {
  ...BaseInputShape,
  missingFileId: z.string().min(1),
  newPath: z.string().min(1)
};

export const SetTempoInputShape = {
  ...BaseInputShape,
  bpm: z.number().min(1).max(400),
  position: PositionInputSchema.optional(),
  mode: z.enum(["fixed", "tempoTrackEvent"]).default("fixed").optional()
};

export const TimeSignatureInputShape = {
  ...BaseInputShape,
  signature: z.string().regex(/^\d+\/\d+$/),
  position: PositionInputSchema.optional()
};

export const KeySignatureInputShape = {
  ...BaseInputShape,
  key: z.string().min(1),
  scale: z.string().optional(),
  position: PositionInputSchema.optional()
};

export const ChordTrackInputShape = {
  ...BaseInputShape,
  chords: z.array(
    z.object({
      position: PositionInputSchema,
      chord: z.string().min(1),
      length: PositionInputSchema.optional()
    })
  )
};

export const AddMarkerInputShape = {
  ...BaseInputShape,
  name: z.string().min(1),
  position: PositionInputSchema,
  end: PositionInputSchema.optional(),
  type: z.enum(["marker", "cycle"]).default("marker").optional()
};

export const UpdateMarkerInputShape = {
  ...BaseInputShape,
  markerId: z.string().min(1),
  name: z.string().optional(),
  position: PositionInputSchema.optional(),
  end: PositionInputSchema.nullable().optional()
};

export const MarkerIdInputShape = {
  ...BaseInputShape,
  markerId: z.string().min(1)
};

export const SetLocatorsInputShape = {
  ...BaseInputShape,
  left: PositionInputSchema,
  right: PositionInputSchema
};

export const LocateInputShape = {
  ...BaseInputShape,
  position: PositionInputSchema
};

export const TransportOptionsInputShape = {
  ...BaseInputShape,
  cycleEnabled: z.boolean().optional(),
  punchIn: z.string().optional(),
  punchOut: z.string().optional(),
  metronomeEnabled: z.boolean().optional(),
  countInEnabled: z.boolean().optional(),
  preRollBars: z.number().min(0).optional(),
  postRollBars: z.number().min(0).optional()
};

export const RecordInputShape = {
  ...BaseInputShape,
  countIn: z.boolean().optional(),
  punchIn: z.string().optional()
};

export const ExportMixdownInputShape = {
  ...BaseInputShape,
  path: z.string().min(1),
  format: FileFormatSchema.default("wav").optional(),
  sampleRate: z.number().int().positive().optional(),
  bitDepth: z.number().int().positive().optional(),
  range: RangeSchema.optional(),
  realTime: z.boolean().default(false).optional(),
  loudnessTargetLufs: z.number().optional(),
  filenamePattern: z.string().optional(),
  overwrite: z.boolean().default(false).optional()
};

export const ExportStemsInputShape = {
  ...BaseInputShape,
  destinationDirectory: z.string().min(1),
  trackIds: z.array(z.string()).optional(),
  selectedOnly: z.boolean().default(false).optional(),
  format: FileFormatSchema.default("wav").optional(),
  sampleRate: z.number().int().positive().optional(),
  bitDepth: z.number().int().positive().optional(),
  range: RangeSchema.optional(),
  realTime: z.boolean().default(false).optional(),
  filenamePattern: z.string().default("{trackName}").optional(),
  overwrite: z.boolean().default(false).optional()
};

export const RenderInPlaceInputShape = {
  ...BaseInputShape,
  trackIds: z.array(z.string()).optional(),
  eventIds: z.array(z.string()).optional(),
  settings: z.record(z.string(), z.unknown()).default({}).optional()
};

export const JobIdInputShape = {
  ...BaseInputShape,
  jobId: z.string().min(1)
};

export const ExecuteMacroInputShape = {
  ...BaseInputShape,
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).default({}).optional()
};

export const UndoRedoInputShape = {
  ...BaseInputShape,
  steps: z.number().int().min(1).max(100).default(1).optional()
};
