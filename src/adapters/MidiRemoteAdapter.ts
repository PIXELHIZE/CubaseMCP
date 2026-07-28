import type { AdapterCapability, CubaseAdapter, OperationContext, OperationResult } from "./CubaseAdapter.js";
import type { CubaseState, Job, Track } from "../schemas/state.js";
import { CubaseStateStore } from "../state/CubaseStateStore.js";
import type { MidiPortConfig } from "../config/midiPorts.js";
import { defaultCommandMappings, quickControlMapping } from "../config/commandMappings.js";
import { MidiPortManager } from "../bridge/midi/MidiPortManager.js";
import { RequestResponseRouter } from "../bridge/midi/RequestResponseRouter.js";
import { CubaseMcpError, ErrorCode } from "../safety/ErrorCodes.js";
import { parseHostHandshake } from "../v2/HostHandshake.js";

function dbToMidiValue(db: number): number {
  const normalized = (Math.max(-60, Math.min(12, db)) + 60) / 72;
  return Math.round(normalized * 127);
}

function panToMidiValue(pan: number): number {
  return Math.round(((Math.max(-1, Math.min(1, pan)) + 1) / 2) * 127);
}

function boolToMidiValue(enabled: boolean): number {
  return enabled ? 127 : 0;
}

export class MidiRemoteAdapter implements CubaseAdapter {
  readonly name = "MIDI Remote Adapter";
  readonly mode = "midiRemote" as const;

  private readonly portManager: MidiPortManager;
  private readonly router: RequestResponseRouter;
  private connected = false;
  private pollTimer?: NodeJS.Timeout;
  private pollInFlight = false;

  constructor(
    private readonly config: MidiPortConfig,
    private readonly stateStore = new CubaseStateStore()
  ) {
    this.portManager = new MidiPortManager(config);
    this.router = new RequestResponseRouter(this.portManager, config);
    this.router.on("state", (message) => this.applyBridgeState(message.payload));
  }

  getRouter(): RequestResponseRouter {
    return this.router;
  }

  async connect(): Promise<void> {
    await this.router.open();
    this.connected = true;
    this.stateStore.markConnected("Cubase via MIDI Remote");
    try {
      const response = await this.router.request("ping", { client: "cubase-mcp" }, this.config.timeoutMs);
      const handshake = parseHostHandshake(response.payload);
      if (!handshake) {
        throw new Error("Cubase MIDI Remote script did not provide the required MCP v2 host handshake.");
      }
      this.applyBridgeState(response.payload);
      this.startPolling();
    } catch (error) {
      this.connected = false;
      throw new CubaseMcpError(
        ErrorCode.NeedsUserSetup,
        "MIDI ports opened, but Cubase MIDI Remote bridge did not answer ping.",
        { cause: error instanceof Error ? error.message : String(error) },
        true
      );
    }
  }

  async disconnect(): Promise<void> {
    this.router.close();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = undefined;
    this.connected = false;
    this.stateStore.markDisconnected();
  }

  async getCapabilities(): Promise<AdapterCapability[]> {
    return [
      { operation: "transportPlay", status: "supported", adapter: this.name },
      { operation: "transportStop", status: "supported", adapter: this.name },
      { operation: "transportRecord", status: "supported", adapter: this.name },
      { operation: "setTrackVolume", status: "partial", adapter: this.name, notes: "Selected track only; exact dB mapping is normalized MIDI Remote host value." },
      { operation: "setTrackPan", status: "partial", adapter: this.name, notes: "Selected track only." },
      { operation: "setTrackMute", status: "partial", adapter: this.name, notes: "Selected track only." },
      { operation: "setPluginParameter", status: "partial", adapter: this.name, notes: "Quick control indices only." },
      { operation: "exportMixdown", status: "requiresBridge", adapter: this.name, notes: "Cubase export dialogs are not automated." }
    ];
  }

  async getState(): Promise<CubaseState> {
    this.ensureConnected();
    return this.stateStore.snapshot();
  }

  async getProject(): Promise<unknown> {
    this.ensureConnected();
    const state = this.stateStore.snapshot();
    return {
      ...state.project,
      projectOpen: state.cubase.projectOpen,
      projectPath: state.cubase.projectPath,
      limitations: ["MIDI Remote does not expose full project metadata or file path."]
    };
  }

  async listTracks(): Promise<Track[]> {
    this.ensureConnected();
    return this.stateStore.snapshot().tracks;
  }

  async getTrack(trackId: string): Promise<Track> {
    this.ensureConnected();
    const track = this.stateStore.snapshot().tracks.find((candidate) => candidate.id === trackId || trackId === "selected");
    if (!track) throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Track not in MIDI Remote cache: ${trackId}`);
    return track;
  }

  async listPlugins(): Promise<unknown> {
    this.ensureConnected();
    const state = this.router.getCachedState();
    return {
      focusedQuickControls: (state?.payload as { focusedQuickControls?: unknown[] } | undefined)?.focusedQuickControls ?? [],
      selectedQuickControls: (state?.payload as { selectedQuickControls?: unknown[] } | undefined)?.selectedQuickControls ?? [],
      limitations: ["Full plugin catalog is not exposed through MIDI Remote."]
    };
  }

  async listJobs(): Promise<Job[]> {
    return [];
  }

  async getJob(jobId: string): Promise<Job> {
    throw new CubaseMcpError(ErrorCode.JobNotFound, `MIDI Remote adapter has no job: ${jobId}`);
  }

  async createUndoSnapshot(label: string): Promise<string> {
    return `midi-remote-native-undo-unavailable:${label}`;
  }

  async undo(steps: number): Promise<OperationResult> {
    throw new CubaseMcpError(ErrorCode.NeedsUserSetup, "Undo requires a user-mapped Cubase command surface trigger.", { steps });
  }

  async redo(steps: number): Promise<OperationResult> {
    throw new CubaseMcpError(ErrorCode.NeedsUserSetup, "Redo requires a user-mapped Cubase command surface trigger.", { steps });
  }

  async execute<T = unknown>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    this.ensureConnected();
    if (context.dryRun) return this.preview(operation, input) as OperationResult<T>;

    switch (operation) {
      case "getStatus":
        return { changed: false, data: (await this.getState()) as T };
      case "getProject":
        return { changed: false, data: (await this.getProject()) as T };
      case "listTracks":
        return { changed: false, data: (await this.listTracks()) as T };
      case "getTrack":
        return { changed: false, data: (await this.getTrack(String(input.trackId))) as T };
      case "transportPlay":
        return this.sendMapped("transport.play", { transportState: "playing" }) as OperationResult<T>;
      case "transportStop":
        return this.sendMapped("transport.stop", { transportState: "stopped" }) as OperationResult<T>;
      case "transportPause": {
        const result = this.sendMapped("transport.stop", { transportState: "stopped", requestedState: "paused" });
        result.warnings = [...(result.warnings ?? []), "Cubase MIDI Remote exposes Stop, not a distinct pause state; playback position is preserved by Stop."];
        return result as OperationResult<T>;
      }
      case "transportRecord":
        return this.sendMapped("transport.record", { transportState: "recording" }) as OperationResult<T>;
      case "transportRewind":
        return this.sendMapped("transport.rewind", { action: "rewind" }) as OperationResult<T>;
      case "transportForward":
        return this.sendMapped("transport.forward", { action: "forward" }) as OperationResult<T>;
      case "setCycle":
        return this.sendMapped("transport.cycle", { enabled: Boolean(input.enabled) }, boolToMidiValue(Boolean(input.enabled))) as OperationResult<T>;
      case "setMetronome":
        return this.sendMapped("transport.metronome", { enabled: Boolean(input.enabled) }, boolToMidiValue(Boolean(input.enabled))) as OperationResult<T>;
      case "setTrackVolume":
        this.assertSelectedTrackTarget(input);
        return this.sendMapped("selected.volume", { trackId: input.trackId, volumeDb: input.volumeDb }, dbToMidiValue(Number(input.volumeDb))) as OperationResult<T>;
      case "setTrackPan":
        this.assertSelectedTrackTarget(input);
        return this.sendMapped("selected.pan", { trackId: input.trackId, pan: input.pan }, panToMidiValue(Number(input.pan))) as OperationResult<T>;
      case "setTrackMute":
        this.assertSelectedTrackTarget(input);
        return this.sendMapped("selected.mute", { trackId: input.trackId, enabled: input.enabled }, boolToMidiValue(Boolean(input.enabled))) as OperationResult<T>;
      case "setTrackSolo":
        this.assertSelectedTrackTarget(input);
        return this.sendMapped("selected.solo", { trackId: input.trackId, enabled: input.enabled }, boolToMidiValue(Boolean(input.enabled))) as OperationResult<T>;
      case "setTrackRecordEnable":
        this.assertSelectedTrackTarget(input);
        return this.sendMapped("selected.recordEnable", { trackId: input.trackId, enabled: input.enabled }, boolToMidiValue(Boolean(input.enabled))) as OperationResult<T>;
      case "setTrackMonitor":
        this.assertSelectedTrackTarget(input);
        return this.sendMapped("selected.monitor", { trackId: input.trackId, enabled: input.enabled }, boolToMidiValue(Boolean(input.enabled))) as OperationResult<T>;
      case "setInputGain":
        this.assertSelectedTrackTarget(input);
        return this.sendMapped("selected.inputGain", { trackId: input.trackId, gainDb: input.gainDb }, dbToMidiValue(Number(input.gainDb))) as OperationResult<T>;
      case "setPhaseInvert":
        this.assertSelectedTrackTarget(input);
        return this.sendMapped("selected.phaseInvert", { trackId: input.trackId, enabled: input.enabled }, boolToMidiValue(Boolean(input.enabled))) as OperationResult<T>;
      case "getMeters":
      case "getMeterLevels":
        return { changed: false, data: { cachedState: this.router.getCachedState()?.payload ?? {}, source: "MIDI Remote state events" } as T };
      case "setPluginParameter":
        return this.setQuickControl(input) as OperationResult<T>;
      case "getPluginParameters":
        return { changed: false, data: (await this.listPlugins()) as T };
      default:
        throw new CubaseMcpError(
          ErrorCode.NeedsCubaseSideBridge,
          `${operation} is not exposed by the MIDI Remote adapter without a Cubase-side bridge.`,
          { operation }
        );
    }
  }

  private sendMapped(mappingName: string, data: Record<string, unknown>, overrideValue?: number): OperationResult {
    const mapping = defaultCommandMappings[mappingName];
    if (!mapping) throw new CubaseMcpError(ErrorCode.NeedsUserSetup, `Missing MIDI mapping: ${mappingName}`);
    this.router.sendControl({
      kind: mapping.kind,
      channel: mapping.channel,
      number: mapping.number,
      value: overrideValue ?? mapping.value ?? 127
    });
    return {
      changed: true,
      adapter: this.name,
      data: {
        adapter: this.name,
        mapping,
        ...data
      },
      warnings: ["Result verification depends on the next MIDI Remote state event from Cubase."]
    };
  }

  private setQuickControl(input: Record<string, unknown>): OperationResult {
    const parameterId = String(input.parameterId ?? "");
    const match = parameterId.match(/^(focusedQuickControl|selectedQuickControl|quickControl):(\d)$/);
    if (!match) {
      throw new CubaseMcpError(
        ErrorCode.NeedsCubaseSideBridge,
        "MIDI Remote can set plugin parameters only when they are exposed as selected/focused quick controls.",
        { parameterId }
      );
    }
    const focused = match[1] !== "selectedQuickControl";
    const index = Number(match[2]);
    const value = Number(input.value);
    const mapping = quickControlMapping(index, focused);
    this.router.sendControl({
      kind: mapping.kind,
      channel: mapping.channel,
      number: mapping.number,
      value: Math.max(0, Math.min(127, Math.round(value * 127)))
    });
    return { changed: true, adapter: this.name, data: { adapter: this.name, parameterId, normalizedValue: value, mapping } };
  }

  private preview(operation: string, input: Record<string, unknown>): OperationResult {
    return {
      changed: false,
      adapter: this.name,
      preview: {
        adapter: this.name,
        operation,
        input,
        headless: true,
        usesScreenAutomation: false
      }
    };
  }

  private assertSelectedTrackTarget(input: Record<string, unknown>): void {
    const trackId = String(input.trackId ?? "selected");
    const selectedId = this.stateStore.snapshot().selectedObjects.find((item) => item.type === "track")?.id;
    if (trackId !== "selected" && selectedId && trackId !== selectedId) {
      throw new CubaseMcpError(
        ErrorCode.NeedsCubaseSideBridge,
        "MIDI Remote selected-channel controls cannot address arbitrary track IDs. Select the track first through a headless bridge or use trackId:'selected'.",
        { requestedTrackId: trackId, selectedTrackId: selectedId }
      );
    }
  }

  private applyBridgeState(payload: unknown): void {
    if (!payload || typeof payload !== "object") return;
    const envelope = payload as { state?: unknown };
    const nestedState = envelope.state && typeof envelope.state === "object" ? envelope.state as Record<string, unknown> : {};
    const state = { ...(payload as Record<string, unknown>), ...nestedState } as {
      appVersion?: string;
      midiRemoteApiVersion?: string;
      directAccess?: { makeDirectAccess?: boolean; active?: boolean };
      mcpProtocol?: { version?: number; transportVersion?: number; releaseProfile?: string; scriptBuild?: string };
      transport?: Partial<CubaseState["transport"]>;
      project?: Partial<CubaseState["project"]>;
      projectOpen?: boolean;
      selectedTrack?: {
        runtimeId?: number;
        uniqueId?: string;
        name?: string;
        volumeDb?: number;
        pan?: number;
        volumeProcessValue?: number;
        panProcessValue?: number;
        mute?: boolean;
        solo?: boolean;
        recordEnabled?: boolean;
        monitorEnabled?: boolean;
        inputGainProcessValue?: number;
        phaseInvert?: boolean;
      };
    };
    const partial: Partial<CubaseState> = {};
    if (state.appVersion || state.midiRemoteApiVersion || state.directAccess) {
      partial.cubase = {
        ...this.stateStore.snapshot().cubase,
        connected: true,
        version: state.appVersion ?? this.stateStore.snapshot().cubase.version,
        midiRemoteApiVersion: state.midiRemoteApiVersion ?? this.stateStore.snapshot().cubase.midiRemoteApiVersion,
        mcpProtocolVersion: state.mcpProtocol?.version ?? this.stateStore.snapshot().cubase.mcpProtocolVersion,
        mcpTransportVersion: state.mcpProtocol?.transportVersion ?? this.stateStore.snapshot().cubase.mcpTransportVersion,
        hostProfile: state.mcpProtocol?.releaseProfile ?? this.stateStore.snapshot().cubase.hostProfile,
        scriptBuild: state.mcpProtocol?.scriptBuild ?? this.stateStore.snapshot().cubase.scriptBuild,
        directAccessAvailable: state.directAccess?.makeDirectAccess ?? this.stateStore.snapshot().cubase.directAccessAvailable,
        projectOpen: state.projectOpen ?? true
      };
    }
    if (state.transport) partial.transport = { ...this.stateStore.snapshot().transport, ...state.transport };
    if (state.project) partial.project = { ...this.stateStore.snapshot().project, ...state.project };
    this.stateStore.update(partial);
    if (state.selectedTrack) {
      this.stateStore.upsertSelectedTrack({
        ...state.selectedTrack,
        pan: state.selectedTrack.pan ?? (state.selectedTrack.panProcessValue === undefined ? undefined : state.selectedTrack.panProcessValue * 2 - 1)
      });
    }
  }

  private ensureConnected(): void {
    if (!this.connected) {
      throw new CubaseMcpError(ErrorCode.CubaseNotConnected, "MIDI Remote bridge is not connected.");
    }
  }

  private startPolling(): void {
    if (this.config.pollIntervalMs <= 0 || this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      if (!this.connected || this.pollInFlight) return;
      this.pollInFlight = true;
      void this.router.request("get_state", { source: "poll" }, this.config.timeoutMs)
        .then((response) => this.applyBridgeState(response.payload))
        .catch((error) => this.router.emit("pollError", error))
        .finally(() => {
          this.pollInFlight = false;
        });
    }, this.config.pollIntervalMs);
    this.pollTimer.unref?.();
  }
}
