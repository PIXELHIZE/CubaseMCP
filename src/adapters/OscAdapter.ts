import type { AdapterCapability, CubaseAdapter, OperationContext, OperationResult } from "./CubaseAdapter.js";
import type { CubaseState, Job, Track } from "../schemas/state.js";
import { OscClient } from "../bridge/osc/OscClient.js";
import { CubaseMcpError, ErrorCode } from "../safety/ErrorCodes.js";

export class OscAdapter implements CubaseAdapter {
  readonly name = "OSC Adapter";
  readonly mode = "osc" as const;
  private connected = false;

  constructor(private readonly client = new OscClient()) {}

  async connect(): Promise<void> {
    if (this.client.enabled) await this.client.open();
    this.connected = true;
  }
  async disconnect(): Promise<void> { this.client.close(); this.connected = false; }
  async getCapabilities(): Promise<AdapterCapability[]> { return [{ operation: "osc.execute", status: this.client.enabled ? "partial" : "requiresUserMapping", adapter: this.name, notes: "Requires a Cubase-side OSC endpoint; disabled by default." }]; }
  async getState(): Promise<CubaseState> { return this.unsupported("getState"); }
  async getProject(): Promise<unknown> { return this.unsupported("getProject"); }
  async listTracks(): Promise<Track[]> { return this.unsupported("listTracks"); }
  async getTrack(trackId: string): Promise<Track> { return this.unsupported(`getTrack:${trackId}`); }
  async listPlugins(): Promise<unknown> { return this.unsupported("listPlugins"); }
  async listJobs(): Promise<Job[]> { return []; }
  async getJob(jobId: string): Promise<Job> { return this.unsupported(`getJob:${jobId}`); }
  async createUndoSnapshot(label: string): Promise<string> { return `osc-bridge-undo:${label}`; }
  async undo(steps: number): Promise<OperationResult> { return this.execute("undo", { steps }, { requestId: "osc-undo", toolName: "cubase.undo", dryRun: false }); }
  async redo(steps: number): Promise<OperationResult> { return this.execute("redo", { steps }, { requestId: "osc-redo", toolName: "cubase.redo", dryRun: false }); }

  async execute<T = unknown>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    if (!this.connected) throw new CubaseMcpError(ErrorCode.CubaseNotConnected, "OSC adapter is not connected.");
    if (context.dryRun) return { changed: false, adapter: this.name, preview: { operation, input, endpointRequired: true, usesScreenAutomation: false } } as OperationResult<T>;
    try {
      const response = await this.client.request(operation, input, context.timeoutMs);
      return { changed: true, adapter: this.name, data: response.payload as T, evidence: { requestId: response.id } };
    } catch (error) {
      throw new CubaseMcpError(ErrorCode.NeedsCubaseSideBridge, `OSC operation failed: ${operation}`, { cause: error instanceof Error ? error.message : String(error) }, true);
    }
  }

  private unsupported(label: string): never {
    throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, `OSC adapter does not provide ${label} without a configured endpoint.`);
  }
}
