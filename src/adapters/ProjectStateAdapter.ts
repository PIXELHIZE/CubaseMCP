import { stat } from "node:fs/promises";
import type { AdapterCapability, CubaseAdapter, OperationContext, OperationResult } from "./CubaseAdapter.js";
import type { CubaseState, Job, Track } from "../schemas/state.js";
import { CubaseStateStore, type StateDiff } from "../state/CubaseStateStore.js";
import { CubaseMcpError, ErrorCode } from "../safety/ErrorCodes.js";
import { JobManager } from "../jobs/JobManager.js";

export class ProjectStateAdapter implements CubaseAdapter {
  readonly name = "Project State Adapter";
  readonly mode = "projectState" as const;
  private connected = false;
  private lastSnapshot?: CubaseState;

  constructor(
    private readonly stateStore: CubaseStateStore,
    private readonly jobs = new JobManager()
  ) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getCapabilities(): Promise<AdapterCapability[]> {
    return [
      { operation: "getStatus", status: "partial", adapter: this.name, notes: "State cache from MIDI Remote events." },
      { operation: "verifyExportResult", status: "supported", adapter: this.name, notes: "Filesystem-based export result verification." }
    ];
  }

  async getState(): Promise<CubaseState> {
    this.ensureConnected();
    return { ...this.stateStore.snapshot(), jobs: this.jobs.list() };
  }

  async getProject(): Promise<unknown> {
    this.ensureConnected();
    const state = this.stateStore.snapshot();
    return { ...state.project, ...state.cubase };
  }

  async listTracks(): Promise<Track[]> {
    this.ensureConnected();
    return this.stateStore.snapshot().tracks;
  }

  async getTrack(trackId: string): Promise<Track> {
    const track = (await this.listTracks()).find((candidate) => candidate.id === trackId);
    if (!track) throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Track not in state cache: ${trackId}`);
    return track;
  }

  async listPlugins(): Promise<unknown> {
    return [];
  }

  async listJobs(): Promise<Job[]> {
    return this.jobs.list();
  }

  async getJob(jobId: string): Promise<Job> {
    return this.jobs.get(jobId);
  }

  async createUndoSnapshot(label: string): Promise<string> {
    this.lastSnapshot = this.stateStore.snapshot();
    return `state-snapshot:${label}`;
  }

  async undo(): Promise<OperationResult> {
    throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, "ProjectStateAdapter cannot undo Cubase host operations.");
  }

  async redo(): Promise<OperationResult> {
    throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, "ProjectStateAdapter cannot redo Cubase host operations.");
  }

  async execute<T = unknown>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    this.ensureConnected();
    if (context.dryRun) return { changed: false, preview: { adapter: this.name, operation, input } } as OperationResult<T>;
    switch (operation) {
      case "getStatus":
        return { changed: false, data: (await this.getState()) as T };
      case "getProject":
        return { changed: false, data: (await this.getProject()) as T };
      case "getProjectPath":
        return { changed: false, data: { projectPath: this.stateStore.snapshot().cubase.projectPath } as T };
      case "getProjectMetadata": {
        const state = this.stateStore.snapshot();
        return { changed: false, data: { cubase: state.cubase, project: state.project, trackCount: state.tracks.length, pluginCount: state.plugins.length, markerCount: state.markers.length, stale: state.stale } as T };
      }
      case "listTracks":
        return { changed: false, data: (await this.listTracks()) as T };
      case "getTrack":
        return { changed: false, data: (await this.getTrack(String(input.trackId))) as T };
      case "getPosition":
        return { changed: false, data: this.stateStore.snapshot().transport.position as T };
      case "getTempo": {
        const state = this.stateStore.snapshot();
        return { changed: false, data: { bpm: state.project.tempo, tempoMap: state.tempoMap, source: "MIDI Remote/project state cache", stale: state.stale } as T };
      }
      case "getChordTrack":
        return { changed: false, data: { key: this.stateStore.snapshot().project.key, events: [], source: "state cache", limitation: "Chord events are empty until a Cubase-side bridge publishes them." } as T };
      case "getExportJobs":
        return { changed: false, data: this.jobs.list({ type: "export", status: input.status as Job["status"] | undefined }) as T };
      case "listJobs":
        return { changed: false, data: this.jobs.list() as T };
      case "getJob":
        return { changed: false, data: this.jobs.get(String(input.jobId)) as T };
      case "cancelExportJob":
        return { changed: true, data: this.jobs.cancel(String(input.jobId)) as T };
      case "refreshState":
        return { changed: false, data: { state: await this.getState(), diff: this.diffSinceLastSnapshot() } as T };
      case "verifyExportResult":
        return { changed: false, data: (await this.verifyExportResult(String(input.path))) as T };
      default:
        throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, `Project state adapter cannot execute ${operation}`);
    }
  }

  async verifyExportResult(path: string): Promise<{ path: string; exists: boolean; bytes?: number; modifiedAt?: string }> {
    try {
      const result = await stat(path);
      return { path, exists: true, bytes: result.size, modifiedAt: result.mtime.toISOString() };
    } catch {
      return { path, exists: false };
    }
  }

  diffSinceLastSnapshot(): StateDiff | undefined {
    if (!this.lastSnapshot) return undefined;
    const after = this.stateStore.snapshot();
    return {
      before: this.lastSnapshot,
      after,
      changedKeys: Object.keys(after).filter((key) => JSON.stringify(this.lastSnapshot?.[key as keyof CubaseState]) !== JSON.stringify(after[key as keyof CubaseState]))
    };
  }

  private ensureConnected(): void {
    if (!this.connected) throw new CubaseMcpError(ErrorCode.CubaseNotConnected, "Project state adapter is not connected.");
  }
}
