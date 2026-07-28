import type { CubaseState, Track } from "../schemas/state.js";
import { TrackRegistry } from "./TrackRegistry.js";
import { EventRegistry } from "./EventRegistry.js";
import { PluginRegistry } from "./PluginRegistry.js";
import { MarkerRegistry } from "./MarkerRegistry.js";
import { EventEmitter } from "node:events";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface StateDiff {
  before: CubaseState;
  after: CubaseState;
  changedKeys: string[];
}

export class CubaseStateStore {
  readonly trackRegistry = new TrackRegistry();
  readonly eventRegistry = new EventRegistry();
  readonly pluginRegistry = new PluginRegistry();
  readonly markerRegistry = new MarkerRegistry();
  private readonly events = new EventEmitter();
  private state: CubaseState;

  constructor(initialState?: Partial<CubaseState>, private readonly staleAfterMs = Number(process.env.CUBASE_STATE_STALE_MS ?? 5000)) {
    const timestamp = new Date().toISOString();
    this.state = {
      cubase: {
        connected: false,
        version: "unknown",
        midiRemoteApiVersion: "unknown",
        directAccessAvailable: false,
        projectOpen: false,
        projectPath: undefined
      },
      transport: {
        state: "stopped",
        position: { barsBeats: "1.1.1.0", seconds: 0, timecode: "00:00:00:00" },
        cycleEnabled: false,
        leftLocator: "1.1.1.0",
        rightLocator: "1.1.1.0",
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
        key: "unknown"
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
      lastUpdatedAt: timestamp,
      stale: false,
      ...initialState
    };
  }

  snapshot(): CubaseState {
    const snapshot = clone(this.state);
    snapshot.stale = Date.now() - Date.parse(snapshot.lastUpdatedAt) > this.staleAfterMs;
    return snapshot;
  }

  subscribe(listener: (diff: StateDiff) => void): () => void {
    this.events.on("change", listener);
    return () => this.events.off("change", listener);
  }

  markConnected(version = this.state.cubase.version): StateDiff {
    return this.update({ cubase: { ...this.state.cubase, connected: true, version } });
  }

  markDisconnected(): StateDiff {
    return this.update({ cubase: { ...this.state.cubase, connected: false } });
  }

  update(partial: Partial<CubaseState>): StateDiff {
    const before = this.snapshot();
    const lastUpdatedAt = new Date().toISOString();
    this.state = {
      ...this.state,
      ...partial,
      cubase: { ...this.state.cubase, ...partial.cubase },
      transport: { ...this.state.transport, ...partial.transport },
      project: { ...this.state.project, ...partial.project },
      tracks: partial.tracks ?? this.state.tracks,
      plugins: partial.plugins ?? this.state.plugins,
      markers: partial.markers ?? this.state.markers,
      automation: partial.automation ?? this.state.automation,
      tempoMap: partial.tempoMap ?? this.state.tempoMap,
      capabilities: partial.capabilities ?? this.state.capabilities,
      visibleMixerBank: partial.visibleMixerBank ?? this.state.visibleMixerBank,
      selectedObjects: partial.selectedObjects ?? this.state.selectedObjects,
      jobs: partial.jobs ?? this.state.jobs,
      lastUpdatedAt,
      stale: false
    };
    const diff = { before, after: this.snapshot(), changedKeys: this.changedKeys(before, this.state) };
    this.events.emit("change", diff);
    return diff;
  }

  upsertSelectedTrack(input: { runtimeId?: number; uniqueId?: string; name?: string; volumeDb?: number; pan?: number; mute?: boolean; solo?: boolean; recordEnabled?: boolean; monitorEnabled?: boolean; inputGainProcessValue?: number; phaseInvert?: boolean }): Track {
    const identity = this.trackRegistry.upsert(input);
    const existing = this.state.tracks.find((track) => track.id === identity.stableId);
    const track: Track = {
      id: identity.stableId,
      index: 0,
      type: "audio",
      name: input.name ?? existing?.name ?? "Selected Track",
      mute: input.mute ?? existing?.mute ?? false,
      solo: input.solo ?? existing?.solo ?? false,
      recordEnabled: input.recordEnabled ?? existing?.recordEnabled ?? false,
      monitorEnabled: input.monitorEnabled ?? existing?.monitorEnabled ?? false,
      frozen: existing?.frozen ?? false,
      visible: true,
      volumeDb: input.volumeDb ?? existing?.volumeDb ?? 0,
      pan: input.pan ?? existing?.pan ?? 0,
      inserts: existing?.inserts ?? [],
      sends: existing?.sends ?? [],
      parts: existing?.parts ?? [],
      audioEvents: existing?.audioEvents ?? [],
      metadata: { ...(existing?.metadata ?? {}), runtimeId: input.runtimeId, uniqueId: input.uniqueId, inputGainProcessValue: input.inputGainProcessValue, phaseInvert: input.phaseInvert }
    };
    const tracks = [track, ...this.state.tracks.filter((candidate) => candidate.id !== track.id)];
    this.update({
      tracks,
      plugins: tracks.flatMap((candidate) => candidate.inserts),
      selectedObjects: [{ type: "track", id: track.id }]
    });
    return clone(track);
  }

  private changedKeys(before: CubaseState, after: CubaseState): string[] {
    const keys: string[] = [];
    for (const key of Object.keys(after) as Array<keyof CubaseState>) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) keys.push(String(key));
    }
    return keys;
  }
}
