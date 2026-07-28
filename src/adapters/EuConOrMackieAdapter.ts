import type { AdapterCapability, CubaseAdapter, OperationContext, OperationResult } from "./CubaseAdapter.js";
import type { CubaseState, Job, Track } from "../schemas/state.js";
import type { RequestResponseRouter } from "../bridge/midi/RequestResponseRouter.js";
import { CubaseMcpError, ErrorCode } from "../safety/ErrorCodes.js";

const mackieTransportNotes: Record<string, number> = {
  transportRewind: 0x5b,
  transportForward: 0x5c,
  transportStop: 0x5d,
  transportPlay: 0x5e,
  transportRecord: 0x5f
};

export class EuConOrMackieAdapter implements CubaseAdapter {
  readonly name = "EuCon/Mackie Adapter";
  readonly mode = "mackie" as const;
  private connected = false;

  constructor(private readonly router?: RequestResponseRouter) {}

  async connect(): Promise<void> { this.connected = true; }
  async disconnect(): Promise<void> { this.connected = false; }
  async getCapabilities(): Promise<AdapterCapability[]> {
    return Object.keys(mackieTransportNotes).map((operation) => ({ operation, status: this.router ? "requiresUserMapping" : "requiresBridge", adapter: this.name, notes: "Mackie Control transport note; Cubase device mapping must be configured. EuCon proprietary SDK is not bundled." }));
  }
  async getState(): Promise<CubaseState> { return this.unsupported("state"); }
  async getProject(): Promise<unknown> { return this.unsupported("project"); }
  async listTracks(): Promise<Track[]> { return []; }
  async getTrack(trackId: string): Promise<Track> { return this.unsupported(`track ${trackId}`); }
  async listPlugins(): Promise<unknown> { return []; }
  async listJobs(): Promise<Job[]> { return []; }
  async getJob(jobId: string): Promise<Job> { return this.unsupported(`job ${jobId}`); }
  async createUndoSnapshot(label: string): Promise<string> { return `mackie-no-snapshot:${label}`; }
  async undo(): Promise<OperationResult> { return this.unsupported("undo"); }
  async redo(): Promise<OperationResult> { return this.unsupported("redo"); }

  async execute<T = unknown>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    if (!this.connected || !this.router) throw new CubaseMcpError(ErrorCode.NeedsUserSetup, "Mackie adapter requires the shared MIDI router and a Cubase Mackie Control mapping.");
    const note = mackieTransportNotes[operation];
    if (note === undefined) throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, `Mackie adapter does not claim support for ${operation}.`);
    if (context.dryRun) return { changed: false, adapter: this.name, preview: { protocol: "Mackie Control", note, operation, input } } as OperationResult<T>;
    this.router.sendControl({ kind: "note", channel: 0, number: note, value: 127 });
    this.router.sendControl({ kind: "note", channel: 0, number: note, value: 0 });
    return { changed: true, adapter: this.name, data: { protocol: "Mackie Control", note, operation } as T };
  }

  private unsupported(label: string): never {
    throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, `EuCon/Mackie adapter does not provide ${label}.`);
  }
}
