import { CubaseMcpError, ErrorCode } from "../safety/ErrorCodes.js";
import type { AdapterCapability, CubaseAdapter, OperationContext, OperationResult, PluginCatalogEntry } from "./CubaseAdapter.js";
import type { AudioEvent, CubaseState, Job, Marker, MidiNote, MidiPart, Plugin, Track, TrackType } from "../schemas/state.js";

type MutableState = CubaseState;

interface UndoSnapshot {
  id: string;
  label: string;
  state: MutableState;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function now(): string {
  return new Date().toISOString();
}

export class MockCubaseAdapter implements CubaseAdapter {
  readonly name = "Mock Cubase Adapter";
  readonly mode = "mock" as const;

  private connected = false;
  private counters = new Map<string, number>();
  private undoStack: UndoSnapshot[] = [];
  private redoStack: UndoSnapshot[] = [];
  private pluginCatalog: PluginCatalogEntry[] = [
    { name: "Groove Agent", vendor: "Steinberg", type: "instrument", supportsMultiOutput: true },
    { name: "HALion Sonic", vendor: "Steinberg", type: "instrument", supportsMultiOutput: true },
    { name: "Frequency", vendor: "Steinberg", type: "effect" },
    { name: "Compressor", vendor: "Steinberg", type: "effect", supportsSidechain: true },
    { name: "Reverence", vendor: "Steinberg", type: "effect" }
  ];

  private state: MutableState = {
    cubase: {
      connected: false,
      version: "Mock Cubase 15.0",
      midiRemoteApiVersion: "mock-1.3",
      directAccessAvailable: false,
      projectOpen: false,
      projectPath: undefined
    },
    transport: {
      state: "stopped",
      position: {
        barsBeats: "1.1.1.0",
        seconds: 0,
        timecode: "00:00:00:00"
      },
      cycleEnabled: false,
      leftLocator: "1.1.1.0",
      rightLocator: "5.1.1.0",
      metronomeEnabled: false,
      countInEnabled: false,
      preRollBars: 0,
      postRollBars: 0
    },
    project: {
      sampleRate: 48000,
      bitDepth: 24,
      frameRate: "30",
      tempo: 120,
      timeSignature: "4/4",
      key: "C major"
    },
    tracks: [],
    plugins: [],
    markers: [],
    automation: [],
    tempoMap: [],
    capabilities: [],
    visibleMixerBank: [],
    selectedObjects: [],
    jobs: [],
    lastUpdatedAt: new Date().toISOString(),
    stale: false
  };

  async connect(): Promise<void> {
    this.connected = true;
    this.state.cubase.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.state.cubase.connected = false;
  }

  async getCapabilities(): Promise<AdapterCapability[]> {
    return [
      { operation: "*", status: "supported", adapter: this.name, notes: "Mock implementation for tests and client integration." },
      {
        operation: "realCubaseControl",
        status: "requiresBridge",
        adapter: this.name,
        notes: "Real Cubase control requires MidiRemoteAdapter, explicit MIDI command mapping, or a Cubase-side plugin/script bridge."
      }
    ];
  }

  async getState(): Promise<CubaseState> {
    this.ensureConnected();
    return clone(this.state);
  }

  async getProject(): Promise<unknown> {
    this.ensureConnected();
    return {
      ...clone(this.state.project),
      projectOpen: this.state.cubase.projectOpen,
      projectPath: this.state.cubase.projectPath,
      trackCount: this.state.tracks.length,
      markerCount: this.state.markers.length
    };
  }

  async listTracks(filter?: { type?: string; includeHidden?: boolean }): Promise<Track[]> {
    this.ensureConnected();
    return clone(
      this.state.tracks.filter((track) => {
        if (!filter?.includeHidden && !track.visible) return false;
        if (filter?.type && track.type !== filter.type) return false;
        return true;
      })
    );
  }

  async getTrack(trackId: string): Promise<Track> {
    return clone(this.findTrack(trackId));
  }

  async listPlugins(filter?: { trackId?: string; query?: string; includeLoaded?: boolean }): Promise<unknown> {
    this.ensureConnected();
    const query = filter?.query?.toLowerCase();
    const availablePlugins = this.pluginCatalog.filter((plugin) => !query || plugin.name.toLowerCase().includes(query));
    const loadedPlugins = filter?.includeLoaded === false ? [] : this.state.tracks.flatMap((track) =>
      track.inserts
        .filter((plugin) => !filter?.trackId || track.id === filter.trackId)
        .map((plugin) => ({ ...plugin, trackId: track.id, trackName: track.name }))
    );
    return { availablePlugins, loadedPlugins };
  }

  async listJobs(): Promise<Job[]> {
    this.ensureConnected();
    return clone(this.state.jobs);
  }

  async getJob(jobId: string): Promise<Job> {
    this.ensureConnected();
    const job = this.state.jobs.find((candidate) => candidate.id === jobId);
    if (!job) throw new CubaseMcpError(ErrorCode.JobNotFound, `Job not found: ${jobId}`);
    return clone(job);
  }

  async createUndoSnapshot(label: string): Promise<string> {
    this.ensureConnected();
    const id = this.nextId("undo");
    this.undoStack.push({ id, label, state: clone(this.state) });
    this.redoStack = [];
    return id;
  }

  async undo(steps: number): Promise<OperationResult> {
    this.ensureConnected();
    let applied = 0;
    for (let index = 0; index < steps; index += 1) {
      const snapshot = this.undoStack.pop();
      if (!snapshot) break;
      this.redoStack.push({ id: this.nextId("redo"), label: `redo:${snapshot.label}`, state: clone(this.state) });
      this.state = clone(snapshot.state);
      applied += 1;
    }
    return { changed: applied > 0, data: { applied } };
  }

  async redo(steps: number): Promise<OperationResult> {
    this.ensureConnected();
    let applied = 0;
    for (let index = 0; index < steps; index += 1) {
      const snapshot = this.redoStack.pop();
      if (!snapshot) break;
      this.undoStack.push({ id: this.nextId("undo"), label: `undo:${snapshot.label}`, state: clone(this.state) });
      this.state = clone(snapshot.state);
      applied += 1;
    }
    return { changed: applied > 0, data: { applied } };
  }

  async execute<T = unknown>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    this.ensureConnected();
    if (context.dryRun) {
      return this.preview(operation, input) as OperationResult<T>;
    }

    switch (operation) {
      case "getStatus":
        return { changed: false, data: clone(this.state) as T };
      case "getProject":
        return { changed: false, data: (await this.getProject()) as T };
      case "createProject":
        return this.createProject(input) as OperationResult<T>;
      case "openProject":
        return this.openProject(input) as OperationResult<T>;
      case "saveProject":
        return this.saveProject(input) as OperationResult<T>;
      case "closeProject":
        return this.closeProject(input) as OperationResult<T>;
      case "setProjectSetup":
        return this.setProjectSetup(input) as OperationResult<T>;
      case "backupProject":
        return this.createCompletedJob("backup", { destination: input.destination ?? "mock-backups" }) as OperationResult<T>;
      case "listTracks":
        return { changed: false, data: (await this.listTracks(input as { type?: string; includeHidden?: boolean })) as T };
      case "getTrack":
        return { changed: false, data: this.findTrack(String(input.trackId)) as T };
      case "createTrack":
        return this.createTrack(input) as OperationResult<T>;
      case "deleteTrack":
        return this.deleteTracks(input) as OperationResult<T>;
      case "updateTrack":
        return this.updateTrack(input) as OperationResult<T>;
      case "selectTracks":
        return this.selectTracks(input) as OperationResult<T>;
      case "duplicateTrack":
        return this.duplicateTrack(input) as OperationResult<T>;
      case "reorderTrack":
        return this.reorderTrack(input) as OperationResult<T>;
      case "setTrackVolume":
        return this.updateTrackProperty(input, { volumeDb: Number(input.volumeDb) }) as OperationResult<T>;
      case "setTrackPan":
        return this.updateTrackProperty(input, { pan: Number(input.pan) }) as OperationResult<T>;
      case "setTrackMute":
        return this.updateTrackProperty(input, { mute: Boolean(input.enabled) }) as OperationResult<T>;
      case "setTrackSolo":
        return this.updateTrackProperty(input, { solo: Boolean(input.enabled) }) as OperationResult<T>;
      case "setTrackRecordEnable":
        return this.updateTrackProperty(input, { recordEnabled: Boolean(input.enabled) }) as OperationResult<T>;
      case "setTrackMonitor":
        return this.updateTrackProperty(input, { monitorEnabled: Boolean(input.enabled) }) as OperationResult<T>;
      case "listPlugins":
        return { changed: false, data: (await this.listPlugins(input as { trackId?: string; query?: string; includeLoaded?: boolean })) as T };
      case "addInsertPlugin":
        return this.addInsertPlugin(input) as OperationResult<T>;
      case "removeInsertPlugin":
        return this.removeInsertPlugin(input) as OperationResult<T>;
      case "setPluginParameter":
        return this.setPluginParameter(input) as OperationResult<T>;
      case "setPluginBypass":
        return this.setPluginBypass(input) as OperationResult<T>;
      case "setSend":
        return this.setSend(input) as OperationResult<T>;
      case "setEqBand":
        return this.setTrackMetadata(input, "eq", input) as OperationResult<T>;
      case "setRouting":
        return this.setRouting(input) as OperationResult<T>;
      case "getMeters":
        return this.getMeters(input) as OperationResult<T>;
      case "createMidiPart":
        return this.createMidiPart(input) as OperationResult<T>;
      case "addMidiNote":
        return this.addMidiNotes(input) as OperationResult<T>;
      case "editMidiNotes":
        return this.editMidiNotes(input) as OperationResult<T>;
      case "quantizeMidi":
        return this.setPartMetadata(input, "quantize", input) as OperationResult<T>;
      case "transformMidi":
        return this.setPartMetadata(input, "transform", input) as OperationResult<T>;
      case "importAudio":
        return this.importAudio(input) as OperationResult<T>;
      case "editAudioEvent":
        return this.editAudioEvent(input) as OperationResult<T>;
      case "processAudioEvent":
        return this.processAudioEvent(input) as OperationResult<T>;
      case "importMidi":
      case "importVideo":
        return this.createCompletedJob("import", { operation, filePath: input.filePath, targetTrackId: input.targetTrackId }) as OperationResult<T>;
      case "listPool":
        return { changed: false, data: this.listPool() as T };
      case "cleanupUnusedMedia":
        return { changed: true, data: { removedFromPool: 0, deletedFromDisk: Boolean(input.deleteFromDisk) } as T };
      case "relinkMissingMedia":
        return { changed: true, data: { missingFileId: input.missingFileId, newPath: input.newPath } as T };
      case "setTempo":
        return this.setTempo(input) as OperationResult<T>;
      case "setTimeSignature":
        this.state.project.timeSignature = String(input.signature);
        return { changed: true, data: { timeSignature: this.state.project.timeSignature, position: input.position } as T };
      case "setKeySignature":
        this.state.project.key = input.scale ? `${String(input.key)} ${String(input.scale)}` : String(input.key);
        return { changed: true, data: { key: this.state.project.key, position: input.position } as T };
      case "updateChordTrack":
        return this.setProjectMetadata("chords", input.chords) as OperationResult<T>;
      case "addMarker":
        return this.addMarker(input) as OperationResult<T>;
      case "updateMarker":
        return this.updateMarker(input) as OperationResult<T>;
      case "deleteMarker":
        return this.deleteMarker(input) as OperationResult<T>;
      case "setLocators":
        this.state.transport.leftLocator = String(input.left);
        this.state.transport.rightLocator = String(input.right);
        return { changed: true, data: { left: input.left, right: input.right } as T };
      case "locate":
        this.state.transport.position.barsBeats = String(input.position);
        return { changed: true, data: clone(this.state.transport.position) as T };
      case "setTransportOptions":
        return this.setTransportOptions(input) as OperationResult<T>;
      case "transportPlay":
        this.state.transport.state = "playing";
        return { changed: true, data: { state: this.state.transport.state } as T };
      case "transportStop":
        this.state.transport.state = "stopped";
        return { changed: true, data: { state: this.state.transport.state } as T };
      case "transportRecord":
        this.state.transport.state = "recording";
        return { changed: true, data: { state: this.state.transport.state, countIn: input.countIn } as T };
      case "exportMixdown":
        return this.createCompletedJob("export", { path: input.path, format: input.format ?? "wav" }) as OperationResult<T>;
      case "exportStems":
        return this.createCompletedJob("export", {
          destinationDirectory: input.destinationDirectory,
          trackIds: input.trackIds ?? this.state.tracks.map((track) => track.id),
          format: input.format ?? "wav"
        }) as OperationResult<T>;
      case "renderInPlace":
        return this.createCompletedJob("render", { trackIds: input.trackIds, eventIds: input.eventIds }) as OperationResult<T>;
      case "listJobs":
        return { changed: false, data: clone(this.state.jobs) as T };
      case "getJob":
        return { changed: false, data: (await this.getJob(String(input.jobId))) as T };
      case "executeMacro":
        return {
          changed: true,
          data: { name: input.name, arguments: input.arguments ?? {}, executedBy: "mockCommandSurface" } as T,
          warnings: []
        };
      case "undo":
        return (await this.undo(Number(input.steps ?? 1))) as OperationResult<T>;
      case "redo":
        return (await this.redo(Number(input.steps ?? 1))) as OperationResult<T>;
      default:
        throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, `Unsupported mock operation: ${operation}`, { operation });
    }
  }

  private preview(operation: string, input: Record<string, unknown>): OperationResult {
    return {
      changed: false,
      preview: {
        operation,
        summary: `Would execute ${operation}`,
        input: clone(input),
        affectedObjects: this.estimateAffectedObjects(input),
        directCubaseControl: "Mock only. Real Cubase control may require bridge implementation."
      }
    };
  }

  private createProject(input: Record<string, unknown>): OperationResult {
    this.state.cubase.projectOpen = true;
    this.state.cubase.projectPath = typeof input.path === "string" ? input.path : `mock://${String(input.name ?? "Untitled")}.cpr`;
    this.state.project.sampleRate = Number(input.sampleRate ?? 48000);
    this.state.project.bitDepth = Number(input.bitDepth ?? 24);
    this.state.project.frameRate = String(input.frameRate ?? "30");
    this.state.tracks = [];
    this.state.markers = [];
    this.state.selectedObjects = [];
    return { changed: true, data: { projectPath: this.state.cubase.projectPath, project: clone(this.state.project) } };
  }

  private openProject(input: Record<string, unknown>): OperationResult {
    this.state.cubase.projectOpen = true;
    this.state.cubase.projectPath = String(input.path);
    return { changed: true, data: { projectPath: this.state.cubase.projectPath } };
  }

  private saveProject(input: Record<string, unknown>): OperationResult {
    this.ensureProjectOpen();
    if (typeof input.saveAsPath === "string") this.state.cubase.projectPath = input.saveAsPath;
    return { changed: true, data: { projectPath: this.state.cubase.projectPath, overwrite: Boolean(input.overwrite) } };
  }

  private closeProject(_input: Record<string, unknown>): OperationResult {
    this.ensureProjectOpen();
    this.state.cubase.projectOpen = false;
    this.state.cubase.projectPath = undefined;
    this.state.tracks = [];
    this.state.markers = [];
    this.state.selectedObjects = [];
    return { changed: true, data: { projectOpen: false } };
  }

  private setProjectSetup(input: Record<string, unknown>): OperationResult {
    this.ensureProjectOpen();
    if (input.sampleRate !== undefined) this.state.project.sampleRate = Number(input.sampleRate);
    if (input.bitDepth !== undefined) this.state.project.bitDepth = Number(input.bitDepth);
    if (input.frameRate !== undefined) this.state.project.frameRate = String(input.frameRate);
    return { changed: true, data: clone(this.state.project) };
  }

  private createTrack(input: Record<string, unknown>): OperationResult {
    this.ensureProjectOpen();
    const count = Number(input.count ?? 1);
    const created: Track[] = [];
    for (let index = 0; index < count; index += 1) {
      const id = this.nextId("track");
      const type = String(input.type) as TrackType;
      const track: Track = {
        id,
        index: this.state.tracks.length,
        type,
        name: String(input.name ?? this.defaultTrackName(type, id)),
        color: typeof input.color === "string" ? input.color : undefined,
        mute: false,
        solo: false,
        recordEnabled: false,
        monitorEnabled: false,
        frozen: false,
        visible: true,
        folderId: typeof input.folderId === "string" ? input.folderId : undefined,
        volumeDb: 0,
        pan: 0,
        routeTo: typeof input.outputBus === "string" ? input.outputBus : undefined,
        inserts: [],
        sends: [],
        parts: [],
        audioEvents: [],
        metadata: {
          inputBus: input.inputBus,
          instrumentName: input.instrumentName
        }
      };
      this.state.tracks.push(track);
      created.push(track);
    }
    return { changed: true, data: { tracks: clone(created) } };
  }

  private deleteTracks(input: Record<string, unknown>): OperationResult {
    this.ensureProjectOpen();
    const ids = new Set(input.trackIds as string[]);
    const before = this.state.tracks.length;
    this.state.tracks = this.state.tracks.filter((track) => !ids.has(track.id));
    this.reindexTracks();
    return { changed: before !== this.state.tracks.length, data: { deletedTrackIds: [...ids], remainingTrackCount: this.state.tracks.length } };
  }

  private updateTrack(input: Record<string, unknown>): OperationResult {
    const track = this.findTrack(String(input.trackId));
    const mutableKeys: Array<keyof Track> = ["name", "color", "mute", "solo", "recordEnabled", "monitorEnabled", "frozen", "visible"];
    for (const key of mutableKeys) {
      if (input[key] !== undefined) {
        (track as Record<string, unknown>)[key] = input[key];
      }
    }
    if ("folderId" in input) {
      track.folderId = input.folderId === null ? undefined : String(input.folderId);
    }
    if (input.metadata && typeof input.metadata === "object") {
      track.metadata = { ...track.metadata, ...(input.metadata as Record<string, unknown>) };
    }
    return { changed: true, data: clone(track) };
  }

  private selectTracks(input: Record<string, unknown>): OperationResult {
    const ids = input.trackIds as string[];
    ids.forEach((id) => this.findTrack(id));
    const selection = ids.map((id) => ({ type: "track", id }));
    const mode = String(input.mode ?? "replace");
    if (mode === "replace") {
      this.state.selectedObjects = selection;
    } else if (mode === "add") {
      const existing = new Set(this.state.selectedObjects.map((item) => `${item.type}:${item.id}`));
      this.state.selectedObjects.push(...selection.filter((item) => !existing.has(`${item.type}:${item.id}`)));
    } else {
      const remove = new Set(selection.map((item) => item.id));
      this.state.selectedObjects = this.state.selectedObjects.filter((item) => item.type !== "track" || !remove.has(item.id));
    }
    return { changed: true, data: { selectedObjects: clone(this.state.selectedObjects) } };
  }

  private duplicateTrack(input: Record<string, unknown>): OperationResult {
    const source = this.findTrack(String(input.trackId));
    const duplicate = clone(source);
    duplicate.id = this.nextId("track");
    duplicate.name = `${source.name} Copy`;
    duplicate.index = this.state.tracks.length;
    if (!input.includeEvents) {
      duplicate.parts = [];
      duplicate.audioEvents = [];
    }
    if (!input.includePlugins) {
      duplicate.inserts = [];
    }
    this.state.tracks.push(duplicate);
    return { changed: true, data: { track: clone(duplicate) } };
  }

  private reorderTrack(input: Record<string, unknown>): OperationResult {
    const track = this.findTrack(String(input.trackId));
    const currentIndex = this.state.tracks.findIndex((candidate) => candidate.id === track.id);
    const [removed] = this.state.tracks.splice(currentIndex, 1);
    const targetIndex = Math.min(Number(input.targetIndex), this.state.tracks.length);
    this.state.tracks.splice(targetIndex, 0, removed);
    this.reindexTracks();
    return { changed: true, data: { trackId: track.id, targetIndex } };
  }

  private updateTrackProperty(input: Record<string, unknown>, patch: Partial<Track>): OperationResult {
    const track = this.findTrack(String(input.trackId));
    Object.assign(track, patch);
    return { changed: true, data: clone(track) };
  }

  private addInsertPlugin(input: Record<string, unknown>): OperationResult {
    const track = this.findTrack(String(input.trackId));
    const slot = Number(input.slot ?? track.inserts.length);
    const plugin: Plugin = {
      id: this.nextId("plugin"),
      name: String(input.pluginName),
      vendor: this.pluginCatalog.find((candidate) => candidate.name === input.pluginName)?.vendor,
      slot,
      bypassed: false,
      enabled: true,
      parameters: {
        preset: input.preset,
        sidechain: Boolean(input.sidechain),
        openWindow: Boolean(input.openWindow)
      }
    };
    track.inserts = track.inserts.filter((candidate) => candidate.slot !== slot);
    track.inserts.push(plugin);
    track.inserts.sort((left, right) => Number(left.slot ?? 0) - Number(right.slot ?? 0));
    return { changed: true, data: { plugin: clone(plugin), trackId: track.id } };
  }

  private removeInsertPlugin(input: Record<string, unknown>): OperationResult {
    const track = this.findTrack(String(input.trackId));
    const before = track.inserts.length;
    track.inserts = track.inserts.filter((plugin) => plugin.id !== input.pluginId);
    if (before === track.inserts.length) throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Plugin not found: ${String(input.pluginId)}`);
    return { changed: true, data: { pluginId: input.pluginId, trackId: track.id } };
  }

  private setPluginParameter(input: Record<string, unknown>): OperationResult {
    const plugin = this.findPlugin(String(input.trackId), String(input.pluginId));
    plugin.parameters[String(input.parameterId)] = input.value;
    return { changed: true, data: clone(plugin) };
  }

  private setPluginBypass(input: Record<string, unknown>): OperationResult {
    const plugin = this.findPlugin(String(input.trackId), String(input.pluginId));
    plugin.bypassed = Boolean(input.enabled);
    return { changed: true, data: clone(plugin) };
  }

  private setSend(input: Record<string, unknown>): OperationResult {
    const track = this.findTrack(String(input.trackId));
    const id = typeof input.sendId === "string" ? input.sendId : this.nextId("send");
    track.sends = track.sends.filter((send) => send.id !== id);
    track.sends.push({
      id,
      destination: String(input.destination),
      levelDb: Number(input.levelDb),
      enabled: Boolean(input.enabled ?? true),
      preFader: Boolean(input.preFader ?? false)
    });
    return { changed: true, data: { trackId: track.id, sends: clone(track.sends) } };
  }

  private setRouting(input: Record<string, unknown>): OperationResult {
    const track = this.findTrack(String(input.trackId));
    if (input.outputBus !== undefined) track.routeTo = String(input.outputBus);
    track.metadata = {
      ...track.metadata,
      inputBus: input.inputBus ?? track.metadata.inputBus,
      groupTrackId: input.groupTrackId ?? track.metadata.groupTrackId,
      sidechainSourceTrackId: input.sidechainSourceTrackId ?? track.metadata.sidechainSourceTrackId
    };
    return { changed: true, data: clone(track) };
  }

  private getMeters(input: Record<string, unknown>): OperationResult {
    const ids = (input.trackIds as string[] | undefined) ?? this.state.tracks.map((track) => track.id);
    return {
      changed: false,
      data: ids.map((trackId) => ({
        trackId,
        peakDb: -18,
        rmsDb: -24,
        clipped: false
      }))
    };
  }

  private createMidiPart(input: Record<string, unknown>): OperationResult {
    const track = this.findTrack(String(input.trackId));
    const part: MidiPart = {
      id: this.nextId("part"),
      trackId: track.id,
      start: String(input.start),
      length: String(input.length),
      name: typeof input.name === "string" ? input.name : undefined,
      notes: []
    };
    track.parts.push(part);
    return { changed: true, data: { part: clone(part) } };
  }

  private addMidiNotes(input: Record<string, unknown>): OperationResult {
    const { part } = this.findPart(String(input.partId));
    const created = (input.notes as Array<Omit<MidiNote, "id">>).map((note) => ({
      id: this.nextId("note"),
      pitch: note.pitch,
      start: note.start,
      length: note.length,
      velocity: note.velocity ?? 100,
      channel: note.channel ?? 1
    }));
    part.notes.push(...created);
    return { changed: true, data: { partId: part.id, notes: clone(created) } };
  }

  private editMidiNotes(input: Record<string, unknown>): OperationResult {
    const { part } = this.findPart(String(input.partId));
    const ids = input.noteIds ? new Set(input.noteIds as string[]) : undefined;
    const edited: MidiNote[] = [];
    for (const note of part.notes) {
      if (ids && !ids.has(note.id)) continue;
      if (input.pitchDelta !== undefined) note.pitch = Math.max(0, Math.min(127, note.pitch + Number(input.pitchDelta)));
      if (input.setLength !== undefined) note.length = String(input.setLength);
      if (input.setVelocity !== undefined) note.velocity = Number(input.setVelocity);
      if (input.velocityDelta !== undefined) note.velocity = Math.max(1, Math.min(127, note.velocity + Number(input.velocityDelta)));
      note.start = input.startDelta ? `${note.start}+${String(input.startDelta)}` : note.start;
      edited.push(clone(note));
    }
    return { changed: edited.length > 0, data: { partId: part.id, editedNotes: edited, controller: input.controller } };
  }

  private importAudio(input: Record<string, unknown>): OperationResult {
    let track: Track;
    if (input.trackId) {
      track = this.findTrack(String(input.trackId));
    } else if (input.createTrack) {
      const result = this.createTrack({ type: "audio", name: String(input.filePath).split(/[\\/]/).pop() ?? "Imported Audio" });
      track = (result.data as { tracks: Track[] }).tracks[0];
    } else {
      throw new CubaseMcpError(ErrorCode.ObjectNotFound, "trackId is required unless createTrack is true");
    }
    const event: AudioEvent = {
      id: this.nextId("audio"),
      trackId: track.id,
      filePath: String(input.filePath),
      start: String(input.position ?? "1.1.1.0"),
      length: undefined,
      offset: undefined,
      gainDb: 0,
      fades: {}
    };
    track.audioEvents.push(event);
    return { changed: true, data: { event: clone(event), copyToProject: Boolean(input.copyToProject ?? true) } };
  }

  private editAudioEvent(input: Record<string, unknown>): OperationResult {
    const { event, track } = this.findAudioEvent(String(input.eventId));
    switch (input.action) {
      case "move":
        if (input.position) event.start = String(input.position);
        if (input.targetTrackId) {
          const targetTrack = this.findTrack(String(input.targetTrackId));
          track.audioEvents = track.audioEvents.filter((candidate) => candidate.id !== event.id);
          event.trackId = targetTrack.id;
          targetTrack.audioEvents.push(event);
        }
        break;
      case "trim":
        if (input.length) event.length = String(input.length);
        break;
      case "gain":
        if (input.gainDb !== undefined) event.gainDb = Number(input.gainDb);
        break;
      case "fadeIn":
        event.fades.in = String(input.length ?? "0.1.0.0");
        break;
      case "fadeOut":
        event.fades.out = String(input.length ?? "0.1.0.0");
        break;
      case "delete":
        track.audioEvents = track.audioEvents.filter((candidate) => candidate.id !== event.id);
        return { changed: true, data: { deletedEventId: event.id } };
      case "copy": {
        const copy = clone(event);
        copy.id = this.nextId("audio");
        copy.start = String(input.position ?? event.start);
        track.audioEvents.push(copy);
        return { changed: true, data: { event: copy } };
      }
      case "crossfade":
        event.fades.out = String(input.length ?? "0.1.0.0");
        break;
    }
    return { changed: true, data: { event: clone(event) } };
  }

  private processAudioEvent(input: Record<string, unknown>): OperationResult {
    const { event } = this.findAudioEvent(String(input.eventId));
    event.gainDb = input.process === "normalize" ? 0 : event.gainDb;
    return {
      changed: true,
      data: {
        event: clone(event),
        process: input.process,
        parameters: input.parameters ?? {}
      },
      warnings: ["Mock adapter records the process request but does not perform DSP."]
    };
  }

  private setTempo(input: Record<string, unknown>): OperationResult {
    this.state.project.tempo = Number(input.bpm);
    return { changed: true, data: { tempo: this.state.project.tempo, mode: input.mode ?? "fixed", position: input.position } };
  }

  private addMarker(input: Record<string, unknown>): OperationResult {
    const marker: Marker = {
      id: this.nextId("marker"),
      name: String(input.name),
      position: String(input.position),
      end: typeof input.end === "string" ? input.end : undefined,
      type: input.type === "cycle" ? "cycle" : "marker"
    };
    this.state.markers.push(marker);
    return { changed: true, data: { marker: clone(marker) } };
  }

  private updateMarker(input: Record<string, unknown>): OperationResult {
    const marker = this.findMarker(String(input.markerId));
    if (input.name !== undefined) marker.name = String(input.name);
    if (input.position !== undefined) marker.position = String(input.position);
    if ("end" in input) marker.end = input.end === null ? undefined : String(input.end);
    return { changed: true, data: { marker: clone(marker) } };
  }

  private deleteMarker(input: Record<string, unknown>): OperationResult {
    const id = String(input.markerId);
    const before = this.state.markers.length;
    this.state.markers = this.state.markers.filter((marker) => marker.id !== id);
    if (before === this.state.markers.length) throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Marker not found: ${id}`);
    return { changed: true, data: { deletedMarkerId: id } };
  }

  private setTransportOptions(input: Record<string, unknown>): OperationResult {
    if (input.cycleEnabled !== undefined) this.state.transport.cycleEnabled = Boolean(input.cycleEnabled);
    if (input.metronomeEnabled !== undefined) this.state.transport.metronomeEnabled = Boolean(input.metronomeEnabled);
    if (input.countInEnabled !== undefined) this.state.transport.countInEnabled = Boolean(input.countInEnabled);
    if (input.preRollBars !== undefined) this.state.transport.preRollBars = Number(input.preRollBars);
    if (input.postRollBars !== undefined) this.state.transport.postRollBars = Number(input.postRollBars);
    return { changed: true, data: clone(this.state.transport) };
  }

  private setTrackMetadata(input: Record<string, unknown>, key: string, value: unknown): OperationResult {
    const track = this.findTrack(String(input.trackId));
    track.metadata[key] = value;
    return { changed: true, data: clone(track) };
  }

  private setProjectMetadata(key: string, value: unknown): OperationResult {
    const anyState = this.state as unknown as { projectMetadata?: Record<string, unknown> };
    anyState.projectMetadata = { ...(anyState.projectMetadata ?? {}), [key]: value };
    return { changed: true, data: { [key]: value } };
  }

  private setPartMetadata(input: Record<string, unknown>, key: string, value: unknown): OperationResult {
    const partId = input.partId as string | undefined;
    if (partId) {
      const { part } = this.findPart(partId);
      const mutablePart = part as MidiPart & { metadata?: Record<string, unknown> };
      mutablePart.metadata = { ...(mutablePart.metadata ?? {}), [key]: value };
      return { changed: true, data: clone(part) };
    }
    return { changed: true, data: { trackId: input.trackId, [key]: value } };
  }

  private createCompletedJob(type: Job["type"], result: unknown): OperationResult {
    const timestamp = now();
    const job: Job = {
      id: this.nextId("job"),
      type,
      status: "completed",
      progress: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      result
    };
    this.state.jobs.push(job);
    return {
      changed: true,
      data: { jobId: job.id, result },
      job: { id: job.id, type: job.type, status: job.status, progress: job.progress }
    };
  }

  private listPool(): unknown {
    return {
      audioFiles: this.state.tracks.flatMap((track) => track.audioEvents.map((event) => ({ eventId: event.id, filePath: event.filePath }))),
      missingFiles: [],
      unusedMedia: []
    };
  }

  private estimateAffectedObjects(input: Record<string, unknown>): unknown[] {
    const affected: unknown[] = [];
    for (const key of ["trackId", "trackIds", "partId", "eventId", "markerId", "pluginId", "jobId"]) {
      if (input[key] !== undefined) affected.push({ key, value: input[key] });
    }
    return affected;
  }

  private findTrack(trackId: string): Track {
    this.ensureConnected();
    const track = this.state.tracks.find((candidate) => candidate.id === trackId);
    if (!track) throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Track not found: ${trackId}`, { trackId });
    return track;
  }

  private findPlugin(trackId: string, pluginId: string): Plugin {
    const track = this.findTrack(trackId);
    const plugin = track.inserts.find((candidate) => candidate.id === pluginId);
    if (!plugin) throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Plugin not found: ${pluginId}`, { trackId, pluginId });
    return plugin;
  }

  private findPart(partId: string): { track: Track; part: MidiPart } {
    for (const track of this.state.tracks) {
      const part = track.parts.find((candidate) => candidate.id === partId);
      if (part) return { track, part };
    }
    throw new CubaseMcpError(ErrorCode.ObjectNotFound, `MIDI part not found: ${partId}`, { partId });
  }

  private findAudioEvent(eventId: string): { track: Track; event: AudioEvent } {
    for (const track of this.state.tracks) {
      const event = track.audioEvents.find((candidate) => candidate.id === eventId);
      if (event) return { track, event };
    }
    throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Audio event not found: ${eventId}`, { eventId });
  }

  private findMarker(markerId: string): Marker {
    const marker = this.state.markers.find((candidate) => candidate.id === markerId);
    if (!marker) throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Marker not found: ${markerId}`, { markerId });
    return marker;
  }

  private ensureConnected(): void {
    if (!this.connected) throw new CubaseMcpError(ErrorCode.CubaseNotConnected, "Cubase adapter is not connected.");
  }

  private ensureProjectOpen(): void {
    this.ensureConnected();
    if (!this.state.cubase.projectOpen) throw new CubaseMcpError(ErrorCode.ProjectNotOpen, "No Cubase project is open.");
  }

  private nextId(prefix: string): string {
    const next = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, next);
    return `${prefix}_${next}`;
  }

  private reindexTracks(): void {
    this.state.tracks.forEach((track, index) => {
      track.index = index;
    });
  }

  private defaultTrackName(type: TrackType, id: string): string {
    return `${type.charAt(0).toUpperCase()}${type.slice(1)} ${id.split("_")[1]}`;
  }
}
