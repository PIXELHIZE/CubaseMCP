import type { AdapterCapability, CubaseAdapter, OperationContext, OperationResult } from "./CubaseAdapter.js";
import type { CubaseState, Job, Track } from "../schemas/state.js";
import type { RequestResponseRouter } from "../bridge/midi/RequestResponseRouter.js";
import { makeDirectAccessEnvelope, type DirectAccessRequest, type DirectAccessResponse, type DirectAccessRoot } from "../bridge/midi/DirectAccessProtocol.js";
import { CubaseMcpError, ErrorCode } from "../safety/ErrorCodes.js";
import { EventEmitter } from "node:events";

export class DirectAccessAdapter implements CubaseAdapter {
  readonly name = "DirectAccess Adapter";
  readonly mode = "midiRemote" as const;
  private connected = false;
  private readonly events = new EventEmitter();

  constructor(private readonly router: RequestResponseRouter) {
    this.router.on("message", (message) => {
      if (message.type === "event" && message.command?.startsWith("direct_access_")) this.events.emit("change", message);
    });
  }

  subscribe(listener: (event: unknown) => void): () => void {
    this.events.on("change", listener);
    return () => this.events.off("change", listener);
  }

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getCapabilities(): Promise<AdapterCapability[]> {
    if (!this.connected) return [{ operation: "directAccess", status: "requiresBridge", adapter: this.name, notes: "Adapter is not connected." }];
    try {
      const response = await this.directAccess("capabilities", { type: "DA_GET_CAPABILITIES" });
      return [
        {
          operation: "directAccess",
          status: response.ok ? "partial" : "requiresBridge",
          adapter: this.name,
          notes: JSON.stringify(response.ok ? response.data : response.error)
        }
      ];
    } catch (error) {
      return [{ operation: "directAccess", status: "requiresBridge", adapter: this.name, notes: error instanceof Error ? error.message : String(error) }];
    }
  }

  async getState(): Promise<CubaseState> {
    throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, "DirectAccessAdapter does not own full Cubase state.");
  }

  async getProject(): Promise<unknown> {
    return this.directAccess("transport-tree", { type: "DA_DISCOVER_OBJECT_TREE", root: "transport" });
  }

  async listTracks(): Promise<Track[]> {
    throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, "Use cubase.direct_access_discover_object_tree for DirectAccess track tree discovery.");
  }

  async getTrack(trackId: string): Promise<Track> {
    throw new CubaseMcpError(ErrorCode.ObjectNotFound, `DirectAccessAdapter does not map track stable IDs directly: ${trackId}`);
  }

  async listPlugins(): Promise<unknown> {
    return this.directAccess("mixconsole-tree", { type: "DA_DISCOVER_OBJECT_TREE", root: "mixConsole" });
  }

  async listJobs(): Promise<Job[]> {
    return [];
  }

  async getJob(jobId: string): Promise<Job> {
    throw new CubaseMcpError(ErrorCode.JobNotFound, `DirectAccessAdapter has no job: ${jobId}`);
  }

  async createUndoSnapshot(label: string): Promise<string> {
    return `direct-access-native-undo-unavailable:${label}`;
  }

  async undo(): Promise<OperationResult> {
    throw new CubaseMcpError(ErrorCode.NeedsUserSetup, "Undo requires command binding or user mapping.");
  }

  async redo(): Promise<OperationResult> {
    throw new CubaseMcpError(ErrorCode.NeedsUserSetup, "Redo requires command binding or user mapping.");
  }

  async execute<T = unknown>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    this.ensureConnected();
    if (context.dryRun) {
      return {
        changed: false,
        preview: {
          adapter: this.name,
          operation,
          input,
          usesScreenAutomation: false
        }
      } as OperationResult<T>;
    }

    switch (operation) {
      case "directAccessRequest":
        return this.wrap(await this.directAccess(context.requestId, input.request as DirectAccessRequest)) as OperationResult<T>;
      case "directAccessGetCapabilities":
        return this.wrap(await this.directAccess(context.requestId, { type: "DA_GET_CAPABILITIES" })) as OperationResult<T>;
      case "directAccessGetApiVersion":
        return this.wrap(await this.directAccess(context.requestId, { type: "DA_GET_API_VERSION" })) as OperationResult<T>;
      case "directAccessDiscoverObjectTree":
        return this.wrap(await this.directAccess(context.requestId, { type: "DA_DISCOVER_OBJECT_TREE", root: String(input.root ?? "trackSelection") as DirectAccessRoot })) as OperationResult<T>;
      case "directAccessGetObjectMetadata":
        return this.wrap(await this.directAccess(context.requestId, { type: "DA_GET_OBJECT_METADATA", objectId: Number(input.objectId) })) as OperationResult<T>;
      case "directAccessGetChildObjects":
        return this.wrap(await this.directAccess(context.requestId, { type: "DA_GET_CHILD_OBJECTS", objectId: Number(input.objectId) })) as OperationResult<T>;
      case "directAccessGetParameters":
      case "getPluginParameters":
        return this.wrap(await this.directAccess(context.requestId, { type: "DA_GET_PARAMETERS", objectId: Number(input.objectId ?? input.pluginObjectId ?? input.pluginId) })) as OperationResult<T>;
      case "directAccessGetParameter":
        return this.wrap(await this.directAccess(context.requestId, { type: "DA_GET_PARAMETER", objectId: Number(input.objectId), parameterTag: Number(input.parameterTag) })) as OperationResult<T>;
      case "directAccessSetParameterProcessValue":
      case "setPluginParameter":
        return this.wrap(
          await this.directAccess(context.requestId, {
            type: "DA_SET_PARAMETER_PROCESS_VALUE",
            objectId: Number(input.objectId ?? input.pluginObjectId ?? input.pluginId),
            parameterTag: Number(input.parameterTag ?? input.parameterId),
            value: Number(input.value)
          }),
          true
        ) as OperationResult<T>;
      case "directAccessSetParameterPlainValue":
        return this.wrap(
          await this.directAccess(context.requestId, {
            type: "DA_SET_PARAMETER_PLAIN_VALUE",
            objectId: Number(input.objectId),
            parameterTag: Number(input.parameterTag),
            plainValue: Number(input.plainValue)
          }),
          true
        ) as OperationResult<T>;
      case "directAccessGetPluginCollections":
        return this.wrap(await this.directAccess(context.requestId, { type: "DA_GET_PLUGIN_COLLECTIONS", pluginSlotObjectId: Number(input.pluginSlotObjectId) })) as OperationResult<T>;
      case "directAccessSetSlotPlugin":
      case "addInsertPlugin":
        {
          const response = await this.directAccess(context.requestId, {
            type: "DA_SET_SLOT_PLUGIN",
            pluginSlotObjectId: Number(input.pluginSlotObjectId ?? input.objectId),
            pluginUid: String(input.pluginUid ?? input.pluginName)
          });
          if ((response.data as { accepted?: unknown } | undefined)?.accepted !== true) {
            throw new CubaseMcpError(ErrorCode.AdapterFailed, "Cubase DirectAccess plugin manager rejected the slot assignment.", response.data);
          }
          return this.wrap(response, true) as OperationResult<T>;
        }
      case "directAccessResetSlotPlugin":
        return this.wrap(await this.directAccess(context.requestId, {
          type: "DA_RESET_SLOT_PLUGIN",
          pluginSlotObjectId: Number(input.pluginSlotObjectId ?? input.objectId)
        }), true) as OperationResult<T>;
      case "directAccessSubscribeObjectChanges":
        return this.wrap(await this.directAccess(context.requestId, { type: "DA_SUBSCRIBE_OBJECT_CHANGES" })) as OperationResult<T>;
      case "directAccessSubscribeParameterChanges":
        return this.wrap(await this.directAccess(context.requestId, { type: "DA_SUBSCRIBE_PARAMETER_CHANGES", objectId: Number(input.objectId) })) as OperationResult<T>;
      default:
        throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, `DirectAccessAdapter does not implement operation ${operation}`);
    }
  }

  async directAccess(requestId: string, request: DirectAccessRequest): Promise<DirectAccessResponse> {
    this.ensureConnected();
    const response = await this.router.request("direct_access", makeDirectAccessEnvelope(requestId, request));
    const payload = response.payload as DirectAccessResponse;
    if (!payload?.ok) {
      throw new CubaseMcpError(this.mapErrorCode(payload?.error?.code), payload?.error?.message ?? "DirectAccess request failed.", payload?.error);
    }
    return payload;
  }

  private wrap(response: DirectAccessResponse, changed = false): OperationResult {
    return {
      changed,
      adapter: this.name,
      data: response.data,
      warnings: response.ok ? [] : [response.error?.message ?? "DirectAccess request failed."]
    };
  }

  private mapErrorCode(code?: string): ErrorCode {
    switch (code) {
      case "CAPABILITY_UNSUPPORTED":
        return ErrorCode.CapabilityUnsupported;
      case "DIRECT_ACCESS_UNAVAILABLE":
      case "REQUIRES_CUBASE_15_API_1_3":
        return ErrorCode.NeedsCubaseSideBridge;
      case "OBJECT_NOT_FOUND":
        return ErrorCode.ObjectNotFound;
      case "CUBASE_API_NOT_EXPOSED":
        return ErrorCode.BlockedByCubaseApi;
      default:
        return ErrorCode.AdapterFailed;
    }
  }

  private ensureConnected(): void {
    if (!this.connected) throw new CubaseMcpError(ErrorCode.CubaseNotConnected, "DirectAccess adapter is not connected.");
  }
}
