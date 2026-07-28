import type { AdapterCapability, CubaseAdapter, OperationContext, OperationResult } from "./CubaseAdapter.js";
import type { CubaseState, Job, Track } from "../schemas/state.js";
import type { CubaseRuntimeConfig } from "../config/cubaseConfig.js";
import { CubaseStateStore } from "../state/CubaseStateStore.js";
import { defaultCapabilityMatrix } from "../state/CapabilityMatrix.js";
import { MidiRemoteAdapter } from "./MidiRemoteAdapter.js";
import { MidiCommandSurfaceAdapter } from "./MidiCommandSurfaceAdapter.js";
import { PluginBridgeAdapter } from "./PluginBridgeAdapter.js";
import { ProjectStateAdapter } from "./ProjectStateAdapter.js";
import { PluginBridgeClient } from "../bridge/plugin/PluginBridgeClient.js";
import { DirectAccessAdapter } from "./DirectAccessAdapter.js";
import { MidiFileWriter } from "../media/MidiFileWriter.js";
import { CubaseMcpError, ErrorCode } from "../safety/ErrorCodes.js";
import { OscAdapter } from "./OscAdapter.js";
import { EuConOrMackieAdapter } from "./EuConOrMackieAdapter.js";
import { JobManager, type JobType } from "../jobs/JobManager.js";
import { z } from "zod/v4";
import { toolDefinitions } from "../tools/index.js";
import { loadPluginBridgeConfig } from "../config/pluginBridgeConfig.js";

const midiRemoteOperations = new Set([
  "getStatus",
  "getProject",
  "listTracks",
  "getTrack",
  "transportPlay",
  "transportStop",
  "transportPause",
  "transportRecord",
  "transportRewind",
  "transportForward",
  "setCycle",
  "setMetronome",
  "setTrackVolume",
  "setTrackPan",
  "setTrackMute",
  "setTrackSolo",
  "setTrackRecordEnable",
  "setTrackMonitor",
  "setInputGain",
  "setPhaseInvert",
  "getMeters",
  "getMeterLevels"
]);

const commandSurfaceOperations = new Set([
  "triggerCommand",
  "executeMacro",
  "commandBindingGetRegistry",
  "commandBindingCanPerform",
  "createTrackDefaultAudio",
  "createTrackDefaultMidi",
  "createTrackDefaultInstrument",
  "createTrackDefaultGroup",
  "createTrackDefaultFx",
  "createTrackDefaultFolder",
  "createTrackDefaultMarker",
  "createTrackDefaultTempo",
  "createTrackDefaultChord",
  "createAudioTrack",
  "createMidiTrack",
  "createInstrumentTrack",
  "createGroupTrack",
  "createFxTrack",
  "createFolderTrack",
  "createMarkerTrack",
  "createTempoTrack",
  "createChordTrack",
  "duplicateTrack",
  "deleteTrack",
  "quantizeMidi",
  "applyLegato",
  "applyFixedLength",
  "bounceSelection",
  "createCrossfade",
  "setAudioFadeIn",
  "setAudioFadeOut",
  "performCurrentAudioExport",
  "addMarker",
  "addCycleMarker",
  "undo",
  "redo"
]);

const pluginOperations = new Set([
  "listPlugins",
  "getPluginParameters",
  "getPluginParameter",
  "setPluginParameter",
  "bypassPlugin",
  "loadPluginPreset",
  "openPluginWindow",
  "closePluginWindow"
]);

const projectStateOperations = new Set([
  "getProject",
  "getProjectPath",
  "getProjectMetadata",
  "listTracks",
  "getTrack",
  "getPosition",
  "getTempo",
  "getChordTrack",
  "getExportJobs",
  "cancelExportJob",
  "listJobs",
  "getJob"
]);

const directAccessOperations = new Set([
  "directAccessRequest",
  "directAccessGetCapabilities",
  "directAccessDiscoverObjectTree",
  "directAccessGetObjectMetadata",
  "directAccessGetChildObjects",
  "directAccessGetParameters",
  "directAccessGetParameter",
  "directAccessSetParameterProcessValue",
  "directAccessSetParameterPlainValue",
  "directAccessGetPluginCollections",
  "directAccessSetSlotPlugin",
  "directAccessResetSlotPlugin",
  "directAccessSubscribeObjectChanges",
  "directAccessSubscribeParameterChanges"
]);

const longRunningOperations = new Set([
  "createBackup",
  "exportMixdown",
  "exportStems",
  "exportSelectedTracks",
  "exportSelectedEvents",
  "exportSelectedEvent",
  "batchExport",
  "renderInPlace",
  "detectSilence",
  "analyzeHitpoints",
  "analyzeSongStructure",
  "searchMediaBay"
]);

export class CompositeCubaseAdapter implements CubaseAdapter {
  readonly name = "Composite Cubase Adapter";
  readonly mode = "composite" as const;

  private readonly stateStore = new CubaseStateStore();
  private readonly midiRemote: MidiRemoteAdapter;
  private readonly commandSurface: MidiCommandSurfaceAdapter;
  private readonly pluginBridge: PluginBridgeAdapter;
  private readonly projectState: ProjectStateAdapter;
  private readonly directAccess: DirectAccessAdapter;
  private readonly midiFileWriter = new MidiFileWriter();
  private readonly jobs = new JobManager();
  private readonly bridgeJobsByLocalId = new Map<string, string>();
  private readonly osc: OscAdapter;
  private readonly mackie: EuConOrMackieAdapter;

  constructor(private readonly config: CubaseRuntimeConfig) {
    this.midiRemote = new MidiRemoteAdapter(config.midi, this.stateStore);
    this.commandSurface = new MidiCommandSurfaceAdapter(this.midiRemote.getRouter(), config.commandMappings);
    const experimentalBridge = loadPluginBridgeConfig();
    this.pluginBridge = new PluginBridgeAdapter(new PluginBridgeClient(this.midiRemote.getRouter(), {
      ...experimentalBridge,
      enabled: false,
      fallbackToMidiRemote: false
    }));
    this.projectState = new ProjectStateAdapter(this.stateStore, this.jobs);
    this.directAccess = new DirectAccessAdapter(this.midiRemote.getRouter());
    this.osc = new OscAdapter();
    this.mackie = new EuConOrMackieAdapter(this.midiRemote.getRouter());
  }

  async connect(): Promise<void> {
    await this.midiRemote.connect();
    await this.directAccess.connect();
    await this.commandSurface.connect();
    await this.pluginBridge.connect();
    await this.projectState.connect();
    await this.osc.connect();
    await this.mackie.connect();
  }

  async disconnect(): Promise<void> {
    await this.pluginBridge.disconnect();
    await this.osc.disconnect();
    await this.mackie.disconnect();
    await this.commandSurface.disconnect();
    await this.projectState.disconnect();
    await this.directAccess.disconnect();
    await this.midiRemote.disconnect();
  }

  async getCapabilities(): Promise<AdapterCapability[]> {
    return [
      ...(await this.midiRemote.getCapabilities()),
      ...(await this.commandSurface.getCapabilities()),
      ...(await this.pluginBridge.getCapabilities()),
      ...(await this.projectState.getCapabilities()),
      ...(await this.directAccess.getCapabilities()),
      ...(await this.osc.getCapabilities()),
      ...(await this.mackie.getCapabilities())
    ];
  }

  async getState(): Promise<CubaseState> {
    const state = await this.projectState.getState();
    return {
      ...state,
      cubase: {
        ...state.cubase,
        connected: true
      }
    };
  }

  async getProject(): Promise<unknown> {
    return this.projectState.getProject();
  }

  async listTracks(filter?: { type?: string; includeHidden?: boolean }): Promise<Track[]> {
    const tracks = await this.projectState.listTracks();
    return tracks.filter((track) => {
      if (!filter?.includeHidden && !track.visible) return false;
      if (filter?.type && track.type !== filter.type) return false;
      return true;
    });
  }

  async getTrack(trackId: string): Promise<Track> {
    return this.projectState.getTrack(trackId);
  }

  async listPlugins(_filter?: { trackId?: string; query?: string; includeLoaded?: boolean }): Promise<unknown> {
    return this.pluginBridge.listPlugins();
  }

  async listJobs(): Promise<Job[]> {
    return this.projectState.listJobs();
  }

  async getJob(jobId: string): Promise<Job> {
    return this.projectState.getJob(jobId);
  }

  async createUndoSnapshot(label: string): Promise<string> {
    return this.projectState.createUndoSnapshot(label);
  }

  async undo(steps: number): Promise<OperationResult> {
    return this.commandSurface.undo(steps);
  }

  async redo(steps: number): Promise<OperationResult> {
    return this.commandSurface.redo(steps);
  }

  async execute<T = unknown>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    if (context.dryRun) {
      return {
        changed: false,
        preview: {
          operation,
          adapter: this.routeName(operation),
          capability: this.capabilityForOperation(operation),
          input,
          usesScreenAutomation: false
        }
      } as OperationResult<T>;
    }
    if (operation === "getStatus") {
      const state = await this.getState();
      return {
        changed: false,
        data: {
          ...state,
          capabilities: defaultCapabilityMatrix.list()
        } as T
      };
    }
    const semanticDirectAccess = await this.executeSemanticDirectAccess<T>(operation, input, context);
    if (semanticDirectAccess) return semanticDirectAccess;
    if (operation === "cancelExportJob") return this.cancelBridgeBackedJob<T>(String(input.jobId), context);
    if (projectStateOperations.has(operation)) return this.projectState.execute(operation, input, context);
    if (midiRemoteOperations.has(operation)) return this.midiRemote.execute(operation, input, context);
    if (directAccessOperations.has(operation)) return this.directAccess.execute(operation, input, context);
    if (pluginOperations.has(operation)) return this.executePluginBridge(operation, input, context);
    if (operation === "performCurrentAudioExport") return this.enqueueCurrentExport<T>(input, context);
    if (commandSurfaceOperations.has(operation)) return this.commandSurface.execute(operation, input, context);
    if (operation === "previewOperation" || operation === "validateOperation") {
      const target = toolDefinitions.find((definition) => definition.name === input.toolName || definition.operation === input.operation);
      if (!target || target.operation === operation) {
        throw new CubaseMcpError(ErrorCode.ValidationFailed, "A registered target toolName or operation is required.", { toolName: input.toolName, operation: input.operation });
      }
      const args = this.record(input.arguments);
      let validated: Record<string, unknown>;
      try {
        validated = z.object(target.inputSchema).parse(args) as Record<string, unknown>;
      } catch (error) {
        throw new CubaseMcpError(ErrorCode.ValidationFailed, `Arguments are invalid for ${target.name}.`, error);
      }
      const preview = operation === "previewOperation"
        ? await this.execute(target.operation, { ...validated, dryRun: true }, { ...context, toolName: target.name, dryRun: true })
        : undefined;
      return {
        changed: false,
        data: {
          operation: target.operation,
          toolName: target.name,
          capability: defaultCapabilityMatrix.get(target.name),
          valid: true,
          validatedArguments: validated,
          preview: preview?.preview ?? preview?.data
        } as T
      };
    }
    if (operation === "createUndoSnapshot") {
      return { changed: false, data: { snapshotId: await this.createUndoSnapshot(String(input.label ?? "manual")) } as T };
    }
    if (operation === "getCapabilities") {
      return { changed: false, adapter: this.name, data: { adapters: await this.getCapabilities(), tools: defaultCapabilityMatrix.list() } as T };
    }
    if (operation === "discoverDirectAccess") {
      return this.directAccess.execute("directAccessGetCapabilities", input, context);
    }
    if (operation === "auditCommandBindings") {
      return this.commandSurface.execute("commandBindingGetRegistry", input, context);
    }
    if (operation === "runDiagnostics") {
      return this.enqueueDiagnostics<T>(input, context);
    }
    if (operation === "createMidiPartFromGeneratedFile") {
      const generatedFile = await this.midiFileWriter.write({
        notes: input.notes as Array<{ pitch: number; start: string; length: string; velocity?: number; channel?: number }>,
        tempo: Number(input.tempo ?? 120),
        ppq: Number(input.ppq ?? 480),
        outputPath: typeof input.outputPath === "string" ? input.outputPath : undefined,
        trackName: typeof input.name === "string" ? input.name : undefined
      });
      try {
        const imported = await this.executePluginBridge<T>("importMidiFile", { ...input, filePath: generatedFile.filePath }, context);
        return {
          ...imported,
          adapter: this.pluginBridge.name,
          evidence: { ...imported.evidence, stateBefore: { generatedFile } }
        };
      } catch (error) {
        throw new CubaseMcpError(
          ErrorCode.NeedsCubaseSideBridge,
          "MIDI file was generated, but Cubase headless import requires the Cubase-side bridge.",
          { generatedFile, bridgeError: error instanceof Error ? error.message : String(error), fallbackStatus: "partial_bridge_required" },
          true
        );
      }
    }
    if (["importMidiFile", "importAudio", "importAudioFile", "importVideoFile", "importSample"].includes(operation)) {
      return this.executePreparedFileImport<T>(operation, input, context);
    }
    if (longRunningOperations.has(operation)) return this.enqueueBridgeJob<T>(operation, input, context);
    return this.executePluginBridge(operation, input, context);
  }

  private routeName(operation: string): string {
    if (midiRemoteOperations.has(operation)) return this.midiRemote.name;
    if (directAccessOperations.has(operation)) return this.directAccess.name;
    if (projectStateOperations.has(operation)) return this.projectState.name;
    if (pluginOperations.has(operation)) return this.pluginBridge.name;
    if (commandSurfaceOperations.has(operation)) return this.commandSurface.name;
    return this.pluginBridge.name;
  }

  private async executeSemanticDirectAccess<T>(
    operation: string,
    input: Record<string, unknown>,
    context: OperationContext
  ): Promise<OperationResult<T> | undefined> {
    if ((operation === "getPluginParameters" || operation === "getPluginParameter") && input.objectId !== undefined) {
      return this.directAccess.execute(operation === "getPluginParameters" ? "directAccessGetParameters" : "directAccessGetParameter", input, context);
    }
    if ((operation === "addInsertPlugin" || operation === "loadEffect" || operation === "loadInstrument") && input.pluginSlotObjectId !== undefined && input.pluginUid !== undefined) {
      return this.directAccess.execute("directAccessSetSlotPlugin", input, context);
    }
    if (operation === "removeInsertPlugin" && input.pluginSlotObjectId !== undefined) {
      return this.directAccess.execute("directAccessResetSlotPlugin", input, context);
    }
    if (operation === "setPluginParameter" && input.objectId !== undefined && input.parameterTag !== undefined) {
      const mode = input.valueMode === "plain" ? "directAccessSetParameterPlainValue" : "directAccessSetParameterProcessValue";
      return this.directAccess.execute(mode, {
        objectId: input.objectId,
        parameterTag: input.parameterTag,
        ...(mode === "directAccessSetParameterPlainValue" ? { plainValue: Number(input.value) } : { value: Number(input.value) })
      }, context);
    }
    if (operation === "setEqBand" && Array.isArray(input.directAccessWrites)) {
      const writes: OperationResult[] = [];
      for (const candidate of input.directAccessWrites) {
        const write = this.record(candidate);
        const mode = write.valueMode === "plain" ? "directAccessSetParameterPlainValue" : "directAccessSetParameterProcessValue";
        writes.push(await this.directAccess.execute(mode, {
          objectId: write.objectId,
          parameterTag: write.parameterTag,
          ...(mode === "directAccessSetParameterPlainValue" ? { plainValue: Number(write.value) } : { value: Number(write.value) })
        }, context));
      }
      return {
        changed: writes.some((write) => write.changed),
        adapter: this.directAccess.name,
        data: { writes: writes.map((write) => write.data) } as T,
        evidence: { requestId: context.requestId, stateAfter: writes.map((write) => write.evidence ?? write.data) }
      };
    }

    const target = this.record(input.directAccess);
    if (target.objectId === undefined || target.parameterTag === undefined) return undefined;
    const value = target.value === undefined ? this.semanticValue(operation, input) : Number(target.value);
    if (value === undefined || !Number.isFinite(value)) return undefined;
    const valueMode = target.valueMode ?? this.semanticValueMode(operation);
    return this.directAccess.execute(
      valueMode === "plain" ? "directAccessSetParameterPlainValue" : "directAccessSetParameterProcessValue",
      {
        objectId: Number(target.objectId),
        parameterTag: Number(target.parameterTag),
        ...(valueMode === "plain" ? { plainValue: value } : { value })
      },
      context
    );
  }

  private semanticValue(operation: string, input: Record<string, unknown>): number | undefined {
    if (operation === "setTrackVolume" || operation === "setSendLevel") return Number(input.volumeDb ?? input.levelDb);
    if (operation === "setTrackPan") return Number(input.pan);
    if (operation === "setInputGain") return Number(input.gainDb);
    if (["setTrackMute", "setTrackSolo", "setTrackRecordEnable", "setTrackMonitor", "setPhaseInvert", "setSendEnable", "setAutomationRead", "setAutomationWrite", "bypassPlugin", "enableSidechain"].includes(operation)) {
      return Boolean(input.enabled) ? 1 : 0;
    }
    if (["enablePlugin", "openPluginWindow"].includes(operation)) return 1;
    if (["disablePlugin", "closePluginWindow"].includes(operation)) return 0;
    return undefined;
  }

  private semanticValueMode(operation: string): "process" | "plain" {
    return ["setTrackVolume", "setTrackPan", "setInputGain", "setSendLevel"].includes(operation) ? "plain" : "process";
  }

  private record(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  }

  private capabilityForOperation(operation: string): unknown {
    const capability = defaultCapabilityMatrix.list().find((item) => item.toolName.endsWith(this.toolSuffixForOperation(operation)));
    return capability;
  }

  private toolSuffixForOperation(operation: string): string {
    return operation.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
  }

  private async executePluginBridge<T>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    const result = await this.pluginBridge.execute<T>(operation, input, context);
    if (result.job) this.jobs.register(result.job, result.data);
    return result;
  }

  private enqueueBridgeJob<T>(operation: string, input: Record<string, unknown>, context: OperationContext): OperationResult<T> {
    const job = this.jobs.enqueue(
      { type: this.jobType(operation), metadata: { operation, input } },
      async (localJob) => {
        const result = await this.executePluginBridge(operation, input, context);
        if (!result.job || result.job.status === "completed") return { data: result.data, evidence: result.evidence, bridgeJob: result.job };
        this.bridgeJobsByLocalId.set(localJob.id, result.job.id);
        const bridgeResult = await this.waitForBridgeJob(localJob.id, result.job, context);
        this.bridgeJobsByLocalId.delete(localJob.id);
        return { data: result.data, evidence: result.evidence, bridgeJob: bridgeResult };
      }
    );
    return {
      changed: true,
      adapter: this.pluginBridge.name,
      data: { jobId: job.id, operation } as T,
      job: { id: job.id, type: job.type, status: job.status, progress: job.progress }
    };
  }

  private enqueueCurrentExport<T>(input: Record<string, unknown>, context: OperationContext): OperationResult<T> {
    const job = this.jobs.enqueue(
      { type: "export", metadata: { operation: "performCurrentAudioExport", expectedFiles: input.expectedFiles } },
      async () => {
        const command = await this.commandSurface.execute("performCurrentAudioExport", input, context);
        const expectedFiles = Array.isArray(input.expectedFiles) ? input.expectedFiles.map(String) : [];
        if (expectedFiles.length === 0) return { command, verification: "No expectedFiles supplied; completion cannot be filesystem-verified." };
        const deadline = Date.now() + Number(context.timeoutMs ?? 30_000);
        while (Date.now() < deadline) {
          const results = await Promise.all(expectedFiles.map((path) => this.projectState.verifyExportResult(path)));
          if (results.every((result) => result.exists && (result.bytes ?? 0) > 0)) return { command, files: results };
          await new Promise((resolve) => setTimeout(resolve, this.config.exportVerificationPollMs));
        }
        throw new CubaseMcpError(ErrorCode.AdapterTimeout, "Current audio export command ran, but expected files were not observed before timeout.", { expectedFiles }, true);
      }
    );
    return {
      changed: true,
      adapter: this.commandSurface.name,
      data: { jobId: job.id, currentSettingsOnly: true } as T,
      job: { id: job.id, type: job.type, status: job.status, progress: job.progress },
      warnings: ["Export uses Cubase's current settings; expectedFiles enables filesystem completion verification."]
    };
  }

  private jobType(operation: string): JobType {
    if (/render/i.test(operation)) return "render";
    if (/scan|analyze|silence|mediaBay/i.test(operation)) return "scan";
    if (/backup/i.test(operation)) return "backup";
    if (/import/i.test(operation)) return "import";
    return "export";
  }

  private async waitForBridgeJob(
    localJobId: string,
    initial: NonNullable<OperationResult["job"]>,
    context: OperationContext
  ): Promise<NonNullable<OperationResult["job"]>> {
    let current = initial;
    const deadline = Date.now() + Number(context.timeoutMs ?? 600_000);
    while (current.status === "queued" || current.status === "running") {
      if (this.jobs.get(localJobId).status === "cancelled") return { ...current, status: "cancelled" };
      if (Date.now() >= deadline) throw new CubaseMcpError(ErrorCode.AdapterTimeout, `Bridge job ${current.id} did not complete before timeout.`, { bridgeJob: current }, true);
      this.jobs.progress(localJobId, current.progress, { bridgeJob: current });
      await new Promise((resolve) => setTimeout(resolve, this.config.exportVerificationPollMs));
      const polled = await this.pluginBridge.execute<Record<string, unknown>>("getBridgeJob", { jobId: current.id }, {
        ...context,
        requestId: `${context.requestId}:poll:${Date.now()}`
      });
      const payload = this.record(polled.data);
      current = polled.job ?? {
        id: String(payload.id ?? current.id),
        type: (payload.type ?? current.type) as NonNullable<OperationResult["job"]>["type"],
        status: (payload.status ?? current.status) as NonNullable<OperationResult["job"]>["status"],
        progress: Number(payload.progress ?? current.progress)
      };
    }
    if (current.status === "failed") throw new CubaseMcpError(ErrorCode.AdapterFailed, `Bridge job ${current.id} failed.`, { bridgeJob: current });
    if (current.status === "cancelled") throw new CubaseMcpError(ErrorCode.AdapterFailed, `Bridge job ${current.id} was cancelled.`, { bridgeJob: current }, true);
    return current;
  }

  private async cancelBridgeBackedJob<T>(localJobId: string, context: OperationContext): Promise<OperationResult<T>> {
    const bridgeJobId = this.bridgeJobsByLocalId.get(localJobId);
    const local = this.jobs.cancel(localJobId);
    let bridge: OperationResult | undefined;
    if (bridgeJobId) {
      bridge = await this.pluginBridge.execute("cancelBridgeJob", { jobId: bridgeJobId }, {
        ...context,
        requestId: `${context.requestId}:cancel-bridge`
      });
      this.bridgeJobsByLocalId.delete(localJobId);
    }
    return {
      changed: true,
      adapter: bridge ? this.pluginBridge.name : this.projectState.name,
      data: { localJob: local, bridgeJobId, bridge: bridge?.data } as T,
      job: { id: local.id, type: local.type, status: local.status, progress: local.progress }
    };
  }

  private enqueueDiagnostics<T>(input: Record<string, unknown>, context: OperationContext): OperationResult<T> {
    const job = this.jobs.enqueue(
      { type: "scan", metadata: { operation: "runDiagnostics", includeSmokeRequested: input.includeSmoke === true } },
      async () => {
        const errors: Array<{ stage: string; message: string }> = [];
        const capture = async (stage: string, worker: () => Promise<unknown>): Promise<unknown> => {
          try {
            return await worker();
          } catch (error) {
            errors.push({ stage, message: error instanceof Error ? error.message : String(error) });
            return undefined;
          }
        };
        const capabilities = await capture("direct-access-capabilities", async () => (await this.directAccess.execute("directAccessGetCapabilities", {}, context)).data);
        const trees: Record<string, unknown> = {};
        for (const root of ["transport", "trackSelection", "mixConsole", "focusedQuickControls"] as const) {
          trees[root] = await capture(`direct-access-${root}`, async () => (await this.directAccess.execute("directAccessDiscoverObjectTree", { root }, context)).data);
        }
        const commands = await capture("command-registry", async () => (await this.commandSurface.execute("commandBindingGetRegistry", {}, context)).data);
        return {
          state: await this.getState(),
          capabilities,
          trees,
          commands,
          errors,
          smokeExecuted: false,
          limitation: input.includeSmoke === true ? "MCP diagnostics never mutate mixer/transport values; run npm run cubase:smoke for restore-checked smoke evidence." : undefined
        };
      }
    );
    return {
      changed: false,
      adapter: this.name,
      data: { jobId: job.id, type: job.type } as T,
      job: { id: job.id, type: job.type, status: job.status, progress: job.progress }
    };
  }

  private async executePreparedFileImport<T>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    const filePath = String(input.filePath ?? "");
    if (!filePath) throw new CubaseMcpError(ErrorCode.ValidationFailed, `${operation} requires filePath.`);
    const prepared = await this.projectState.verifyExportResult(filePath);
    if (!prepared.exists || (prepared.bytes ?? 0) < 1) {
      throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Import source file does not exist or is empty: ${filePath}`, { file: prepared });
    }
    const result = await this.executePluginBridge<T>(operation, input, context);
    return {
      ...result,
      evidence: {
        ...result.evidence,
        requestId: context.requestId,
        stateBefore: { preparedFile: prepared, ...(this.record(result.evidence?.stateBefore)) }
      }
    };
  }
}
