import type { CubaseState, Job, Plugin, Track } from "../schemas/state.js";

export type CapabilityStatus = "supported" | "unsupported" | "requiresBridge" | "requiresUserMapping" | "partial";

export interface AdapterCapability {
  operation: string;
  status: CapabilityStatus;
  adapter: string;
  notes?: string;
}

export interface OperationContext {
  requestId: string;
  correlationId?: string;
  toolName: string;
  dryRun: boolean;
  timeoutMs?: number;
  undoSnapshotId?: string;
}

export interface OperationResult<T = unknown> {
  changed: boolean;
  adapter?: string;
  data?: T;
  preview?: unknown;
  warnings?: string[];
  evidence?: {
    requestId?: string;
    stateBefore?: unknown;
    stateAfter?: unknown;
    stateDiff?: unknown;
    reportFile?: string;
  };
  job?: Pick<Job, "id" | "type" | "status" | "progress">;
}

export interface CubaseAdapter {
  readonly name: string;
  readonly mode:
    | "mock"
    | "midiRemote"
    | "midiCommandSurface"
    | "osc"
    | "mackie"
    | "pluginBridge"
    | "projectState"
    | "projectFile"
    | "composite";

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getCapabilities(): Promise<AdapterCapability[]>;
  getState(): Promise<CubaseState>;
  getProject(): Promise<unknown>;
  listTracks(filter?: { type?: string; includeHidden?: boolean }): Promise<Track[]>;
  getTrack(trackId: string): Promise<Track>;
  listPlugins(filter?: { trackId?: string; query?: string; includeLoaded?: boolean }): Promise<unknown>;
  listJobs(): Promise<Job[]>;
  getJob(jobId: string): Promise<Job>;
  createUndoSnapshot(label: string): Promise<string>;
  execute<T = unknown>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>>;
  undo(steps: number): Promise<OperationResult>;
  redo(steps: number): Promise<OperationResult>;
}

export interface PluginCatalogEntry {
  name: string;
  vendor?: string;
  type: "instrument" | "effect";
  supportsSidechain?: boolean;
  supportsMultiOutput?: boolean;
}

export function isPlugin(value: unknown): value is Plugin {
  return typeof value === "object" && value !== null && "id" in value && "name" in value;
}
