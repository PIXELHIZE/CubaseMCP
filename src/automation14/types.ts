import type { GeneratedSongNote, SongPlan, SongRole } from "../song/models.js";

export const AUTOMATION14_PROFILE = "automation14";
export const AUTOMATION14_TESTED_HOST = "14.0.32";

export interface Automation14Preflight {
  ok: boolean;
  processId?: number;
  hostVersion?: string;
  projectTitle?: string;
  display: { width: number; height: number };
  mainWindow?: { left: number; top: number; right: number; bottom: number };
  midiPort: string;
  failures: string[];
}

export interface Automation14ProgramSelection {
  plugin: "HALion Sonic";
  program: string;
  category?: string;
}

export interface Automation14TrackRecipe {
  role: SongRole;
  name: string;
  program: Automation14ProgramSelection;
  notes: GeneratedSongNote[];
  outputBus?: string;
}

export interface Automation14ExecutionOptions {
  midiPort?: string;
  captureTempoMultiplier?: number;
  testedHostVersion?: string;
}

export interface Automation14PlaybackProbe {
  verified: boolean;
  durationMs: number;
  sampledFrames: number;
  changedMeterPixels: number;
  activeMeterPixels?: number;
  mixConsoleTitle?: string;
  screenshotPath?: string;
  soloSelected?: boolean;
}

export interface Automation14ProgramLoadResult {
  requestedProgram: string;
  loaded: boolean;
  slotOccupied: boolean;
  slotTextPixels: number;
  screenshotPath?: string;
}

export interface Automation14MixerGainResult {
  requestedDb: number;
  observedDb?: number;
  applied: boolean;
  screenshotPath?: string;
}

export interface Automation14ExportUiResult {
  expectedFile: string;
  realtime: boolean;
  exportWindowObserved: boolean;
  completed: boolean;
  bytes: number;
  screenshotPath?: string;
}

export interface Automation14ProjectCreateResult {
  name: string;
  directory: string;
  projectPath: string;
  created: boolean;
  projectWindowTitle: string;
  screenshotPath?: string;
}

export interface Automation14UiDriver {
  preflight(): Promise<Automation14Preflight>;
  createEmptyProject(name: string, directory: string): Promise<Automation14ProjectCreateResult>;
  setTempo(bpm: number): Promise<void>;
  setProjectRange(bars: number): Promise<void>;
  locateStart(): Promise<void>;
  addInstrumentTrack(name: string, plugin: string, midiInput?: string, output?: string): Promise<void>;
  loadHalionProgram(program: string): Promise<Automation14ProgramLoadResult>;
  setSelectedMidiInput(port: string): Promise<void>;
  setSelectedOutput(destination: string): Promise<void>;
  startRecording(): Promise<void>;
  stopTransport(): Promise<void>;
  addGroupTrack(name: string, output?: string): Promise<void>;
  addFxTrack(name: string, effect?: string, output?: string): Promise<void>;
  addMarkerTrack(name: string): Promise<void>;
  commitRename(name: string): Promise<void>;
  saveProject(): Promise<void>;
  setStereoOutGain(db: number): Promise<Automation14MixerGainResult>;
  exportAudioMixdown(expectedFile: string, realtime: boolean, timeoutMs: number): Promise<Automation14ExportUiResult>;
  playFromStart(durationMs: number): Promise<Automation14PlaybackProbe>;
  playFromPosition(position: string, durationMs: number): Promise<Automation14PlaybackProbe>;
  playSelectedTrackFromPosition(position: string, durationMs: number): Promise<Automation14PlaybackProbe>;
}

export interface Automation14SongRun {
  plan: SongPlan;
  captureTempo: number;
  midiPort: string;
  tracks: Automation14TrackRecipe[];
  startedAt: string;
  completedAt: string;
}

export interface TimedMidiMessage {
  atMs: number;
  message: [number, number, number];
}
