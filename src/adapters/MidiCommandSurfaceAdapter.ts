import type { AdapterCapability, CubaseAdapter, OperationContext, OperationResult } from "./CubaseAdapter.js";
import type { CubaseState, Job, Track } from "../schemas/state.js";
import type { MidiCommandMapping } from "../config/commandMappings.js";
import type { RequestResponseRouter } from "../bridge/midi/RequestResponseRouter.js";
import { CubaseMcpError, ErrorCode } from "../safety/ErrorCodes.js";

export class MidiCommandSurfaceAdapter implements CubaseAdapter {
  readonly name = "MIDI Command Surface Adapter";
  readonly mode = "midiCommandSurface" as const;
  private connected = false;

  constructor(
    private readonly router: RequestResponseRouter,
    private readonly mappings: Record<string, MidiCommandMapping>
  ) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getCapabilities(): Promise<AdapterCapability[]> {
    return Object.keys(this.mappings).map((name) => ({
      operation: `trigger:${name}`,
      status: "requiresUserMapping" as const,
      adapter: this.name,
      notes: "Requires the DirectAccess bridge command binding or a user-created Cubase MIDI Remote/Generic Remote command mapping."
    }));
  }

  async getState(): Promise<CubaseState> {
    throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, "Command surface adapter does not provide full state.");
  }

  async getProject(): Promise<unknown> {
    throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, "Command surface adapter does not provide project state.");
  }

  async listTracks(): Promise<Track[]> {
    return [];
  }

  async getTrack(trackId: string): Promise<Track> {
    throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Command surface adapter has no track cache: ${trackId}`);
  }

  async listPlugins(): Promise<unknown> {
    return [];
  }

  async listJobs(): Promise<Job[]> {
    return [];
  }

  async getJob(jobId: string): Promise<Job> {
    throw new CubaseMcpError(ErrorCode.JobNotFound, `Command surface adapter has no job: ${jobId}`);
  }

  async createUndoSnapshot(label: string): Promise<string> {
    return `command-surface-no-snapshot:${label}`;
  }

  async undo(steps: number): Promise<OperationResult> {
    return this.triggerByName("undo", { steps });
  }

  async redo(steps: number): Promise<OperationResult> {
    return this.triggerByName("redo", { steps });
  }

  async execute<T = unknown>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    this.ensureConnected();
    if (context.dryRun) {
      return {
        changed: false,
        preview: {
          adapter: this.name,
          operation,
          mapping: input.name ?? input.commandName ?? operation,
          usesScreenAutomation: false
        }
      } as OperationResult<T>;
    }
    if (operation === "triggerCommand" || operation === "executeMacro") {
      return await this.triggerByName(String(input.name ?? input.commandName), input) as OperationResult<T>;
    }
    if (operation === "commandBindingGetRegistry") {
      return { changed: false, data: (await this.requestCommandBinding("COMMAND_GET_REGISTRY", {})) as T };
    }
    if (operation === "commandBindingCanPerform") {
      return { changed: false, data: (await this.requestCommandBinding("COMMAND_CAN_PERFORM", { key: input.key ?? input.name })) as T };
    }
    if (operation.startsWith("createTrackDefault")) {
      return await this.triggerByName(this.commandNameForDefaultTrack(operation), input) as OperationResult<T>;
    }
    const mappedCommand = this.commandNameForOperation(operation);
    if (mappedCommand) {
      const result = await this.triggerByName(mappedCommand, input);
      if (/^create(?:Audio|Midi|Instrument|Group|Fx|Folder|Marker|Tempo|Chord)Track$/.test(operation)) {
        return this.annotateDefaultTrackCreation(result, input) as OperationResult<T>;
      }
      return result as OperationResult<T>;
    }
    if (operation === "performCurrentAudioExport") {
      return await this.triggerByName("export.perform_current_audio_export", input) as OperationResult<T>;
    }
    return await this.triggerByName(operation, input) as OperationResult<T>;
  }

  private async triggerByName(name: string, data: unknown): Promise<OperationResult> {
    const mapping = this.mappings[name];
    if (!mapping) {
      throw new CubaseMcpError(
        ErrorCode.NeedsUserSetup,
        `No MIDI command surface mapping is registered for "${name}".`,
        { commandName: name, availableMappings: Object.keys(this.mappings) }
      );
    }
    const registryResult = await this.requestCommandBinding("COMMAND_CAN_PERFORM", { key: this.registryKey(name) }).catch(() => undefined);
    const registryEnvelope = this.record(registryResult);
    const registryData = this.record(registryEnvelope.data);
    if (registryData.canPerformSupported === true && registryData.canPerform === false) {
      throw new CubaseMcpError(
        ErrorCode.ExistingSelectionRequired,
        `Cubase command cannot currently be performed: ${name}`,
        { command: registryData.command, canPerform: false }
      );
    }
    const stateBefore = await this.readState().catch(() => undefined);
    this.router.sendControl({
      kind: mapping.kind,
      channel: mapping.channel,
      number: mapping.number,
      value: mapping.value ?? 127
    });
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.CUBASE_COMMAND_SETTLE_MS ?? 250)));
    const stateAfter = await this.readState().catch(() => undefined);
    const stateDiff = this.diff(stateBefore, stateAfter);
    const observedChange = this.record(stateDiff).changed === true;
    return {
      changed: observedChange,
      adapter: this.name,
      data: {
        adapter: this.name,
        mapping,
        data,
        verification: {
          beforeAfterDiff: "available when paired with DirectAccess state snapshots in integration tests",
          canPerform: "query with commandBindingCanPerform before execution"
        }
      },
      evidence: { stateBefore, stateAfter, stateDiff },
      warnings: [
        ...(mapping.requiresVerification ? ["Command was triggered by MIDI; verify via DirectAccess tree diff or expected file output."] : []),
        ...(!observedChange ? ["Cubase received the command trigger, but the post-command state snapshot showed no observable change."] : [])
      ]
    };
  }

  private async requestCommandBinding(type: string, payload: Record<string, unknown>): Promise<unknown> {
    const response = await this.router.request("command_binding", { type, ...payload });
    return response.payload;
  }

  private commandNameForDefaultTrack(operation: string): string {
    switch (operation) {
      case "createTrackDefaultAudio":
        return "track.add.audio";
      case "createTrackDefaultMidi":
        return "track.add.midi";
      case "createTrackDefaultInstrument":
        return "track.add.instrument";
      case "createTrackDefaultGroup":
        return "track.add.group";
      case "createTrackDefaultFx":
        return "track.add.fx";
      case "createTrackDefaultFolder":
        return "track.add.folder";
      case "createTrackDefaultMarker":
        return "track.add.marker";
      case "createTrackDefaultTempo":
        return "track.add.tempo";
      case "createTrackDefaultChord":
        return "track.add.chord";
      default:
        return operation;
    }
  }

  private commandNameForOperation(operation: string): string | undefined {
    const mappings: Record<string, string> = {
      createAudioTrack: "track.add.audio",
      createMidiTrack: "track.add.midi",
      createInstrumentTrack: "track.add.instrument",
      createGroupTrack: "track.add.group",
      createFxTrack: "track.add.fx",
      createFolderTrack: "track.add.folder",
      createMarkerTrack: "track.add.marker",
      createTempoTrack: "track.add.tempo",
      createChordTrack: "track.add.chord",
      duplicateTrack: "track.duplicate",
      deleteTrack: "track.remove_selected",
      quantizeMidi: "midi.quantize",
      applyLegato: "midi.legato",
      applyFixedLength: "midi.fixed_length",
      bounceSelection: "audio.bounce_selection",
      createCrossfade: "audio.crossfade",
      setAudioFadeIn: "audio.fade_in",
      setAudioFadeOut: "audio.fade_out",
      addMarker: "marker.add_position_selected",
      addCycleMarker: "marker.add_cycle_selected"
    };
    return mappings[operation];
  }

  private registryKey(name: string): string {
    if (name === "undo") return "edit.undo";
    if (name === "redo") return "edit.redo";
    return name;
  }

  private annotateDefaultTrackCreation(result: OperationResult, input: Record<string, unknown>): OperationResult {
    const common = new Set(["dryRun", "confirm", "timeoutMs", "correlationId", "requestId"]);
    const requestedParameters = Object.keys(input).filter((key) => !common.has(key) && input[key] !== undefined);
    return {
      ...result,
      data: {
        ...this.record(result.data),
        parameterizedCreation: false,
        currentOrDefaultSettingsOnly: true,
        requestedParameters,
        parameterApplicationVerified: false
      },
      warnings: [
        ...(result.warnings ?? []),
        requestedParameters.length > 0
          ? `Command binding created a default track; it cannot apply these requested parameters: ${requestedParameters.join(", ")}.`
          : "Command binding created a track with Cubase's current/default settings."
      ]
    };
  }

  private async readState(): Promise<unknown> {
    const response = await this.router.request("get_state", { source: "command-verification" });
    return this.record(response.payload).state ?? response.payload;
  }

  private diff(before: unknown, after: unknown): unknown {
    if (JSON.stringify(before) === JSON.stringify(after)) return { changed: false, changedKeys: [] };
    const left = this.record(before);
    const right = this.record(after);
    const changedKeys = [...new Set([...Object.keys(left), ...Object.keys(right)])].filter((key) => JSON.stringify(left[key]) !== JSON.stringify(right[key]));
    return { changed: true, changedKeys };
  }

  private record(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  }

  private ensureConnected(): void {
    if (!this.connected) throw new CubaseMcpError(ErrorCode.CubaseNotConnected, "MIDI command surface adapter is not connected.");
  }
}
