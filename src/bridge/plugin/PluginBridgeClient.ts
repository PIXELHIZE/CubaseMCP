import { createConnection } from "node:net";
import { randomUUID } from "node:crypto";
import { CubaseMcpError, ErrorCode } from "../../safety/ErrorCodes.js";
import type { QuickControlParameter, PluginBridgeCommand, PluginBridgeRequest, PluginBridgeResponse, ExecuteBridgePayload } from "./PluginBridgeProtocol.js";
import { isPluginBridgeResponse, makePluginBridgeRequest } from "./PluginBridgeProtocol.js";
import type { RequestResponseRouter } from "../midi/RequestResponseRouter.js";
import { quickControlMapping } from "../../config/commandMappings.js";
import { loadPluginBridgeConfig, type PluginBridgeConfig } from "../../config/pluginBridgeConfig.js";

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export class PluginBridgeClient {
  constructor(
    private readonly router?: RequestResponseRouter,
    private readonly config: PluginBridgeConfig = loadPluginBridgeConfig()
  ) {}

  async probe(): Promise<PluginBridgeResponse> {
    return this.request("ping", { client: "cubase-mcp" });
  }

  async executeOperation(
    operation: string,
    input: Record<string, unknown>,
    context: { requestId?: string; correlationId?: string; dryRun: boolean; timeoutMs?: number }
  ): Promise<PluginBridgeResponse> {
    const payload: ExecuteBridgePayload = { operation, input, dryRun: context.dryRun, timeoutMs: context.timeoutMs };
    return this.request("execute", payload, context);
  }

  async request<TPayload = unknown>(
    command: PluginBridgeCommand,
    payload: unknown,
    context: { requestId?: string; correlationId?: string; timeoutMs?: number } = {}
  ): Promise<PluginBridgeResponse<TPayload>> {
    const id = context.requestId ?? randomUUID();
    const request = makePluginBridgeRequest(id, context.correlationId ?? id, command, payload, this.config.authToken);
    const attempts: Array<{ transport: string; error: string }> = [];

    if (this.config.enabled) {
      try {
        return await this.requestNamedPipe<TPayload>(request, context.timeoutMs ?? this.config.timeoutMs);
      } catch (error) {
        attempts.push({ transport: "windows-named-pipe", error: error instanceof Error ? error.message : String(error) });
      }
    }

    if (this.config.fallbackToMidiRemote && this.router) {
      try {
        const midiResponse = await this.router.request("plugin_bridge", request, context.timeoutMs ?? this.config.timeoutMs);
        if (isPluginBridgeResponse(midiResponse.payload)) return this.assertBridgeSuccess(midiResponse.payload as PluginBridgeResponse<TPayload>);
        const bridgeEnvelope = record(midiResponse.payload);
        if (isPluginBridgeResponse(bridgeEnvelope.data)) return this.assertBridgeSuccess(bridgeEnvelope.data as PluginBridgeResponse<TPayload>);
        throw new Error("MIDI Remote bridge did not return a plugin-bridge response envelope.");
      } catch (error) {
        attempts.push({ transport: "midi-remote-forwarder", error: error instanceof Error ? error.message : String(error) });
      }
    }

    throw new CubaseMcpError(
      ErrorCode.NeedsCubaseSideBridge,
      `Cubase-side plugin bridge is unavailable for ${command}.`,
      { pipeName: this.config.pipeName, command, attempts, protocol: "cubase-mcp-plugin-bridge/v1" },
      true
    );
  }

  async listQuickControlParameters(focused = true): Promise<QuickControlParameter[]> {
    if (!this.router) {
      throw new CubaseMcpError(ErrorCode.NeedsCubaseSideBridge, "Quick Control state requires the MIDI Remote bridge.");
    }
    const state = this.router.getCachedState();
    const payload = record(state?.payload);
    const nestedState = record(payload.state ?? payload);
    const values = focused ? nestedState.focusedQuickControls : nestedState.selectedQuickControls;
    return Array.isArray(values) ? (values as QuickControlParameter[]) : [];
  }

  setQuickControl(index: number, normalizedValue: number, focused = true): void {
    if (!this.router) throw new CubaseMcpError(ErrorCode.NeedsCubaseSideBridge, "Quick Control routing is unavailable without MIDI Remote.");
    const mapping = quickControlMapping(index, focused);
    this.router.sendControl({
      kind: mapping.kind,
      channel: mapping.channel,
      number: mapping.number,
      value: Math.max(0, Math.min(127, Math.round(normalizedValue * 127)))
    });
  }

  async loadPresetByQuickControlFallback(presetName: string, context: { requestId?: string; correlationId?: string; timeoutMs?: number } = {}): Promise<PluginBridgeResponse> {
    return this.request("load_preset", { presetName }, context);
  }

  private requestNamedPipe<TPayload>(request: PluginBridgeRequest, timeoutMs: number): Promise<PluginBridgeResponse<TPayload>> {
    return new Promise((resolve, reject) => {
      const socket = createConnection(this.config.pipeName);
      let buffer = "";
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`Plugin bridge named-pipe request timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      const finish = (callback: () => void): void => {
        clearTimeout(timer);
        socket.destroy();
        callback();
      };
      socket.setEncoding("utf8");
      socket.once("connect", () => socket.write(`${JSON.stringify(request)}\n`));
      socket.on("data", (chunk: string) => {
        buffer += chunk;
        const newline = buffer.indexOf("\n");
        if (newline < 0) return;
        try {
          const parsed = JSON.parse(buffer.slice(0, newline)) as unknown;
          if (!isPluginBridgeResponse(parsed)) throw new Error("Invalid plugin bridge response envelope.");
          if (parsed.id !== request.id) throw new Error(`Plugin bridge requestId mismatch: expected ${request.id}, received ${parsed.id}.`);
          if (!parsed.ok) {
            throw new CubaseMcpError(
              this.mapErrorCode(parsed.error?.code),
              parsed.error?.message ?? "Plugin bridge request failed.",
              parsed.error?.details,
              parsed.error?.recoverable ?? false
            );
          }
          finish(() => resolve(parsed as PluginBridgeResponse<TPayload>));
        } catch (error) {
          finish(() => reject(error));
        }
      });
      socket.once("error", (error) => finish(() => reject(error)));
      socket.once("end", () => {
        if (!buffer.includes("\n")) finish(() => reject(new Error("Plugin bridge closed before sending a complete JSON frame.")));
      });
    });
  }

  private mapErrorCode(code?: string): ErrorCode {
    switch (code) {
      case "BLOCKED_BY_CUBASE_API":
        return ErrorCode.BlockedByCubaseApi;
      case "BLOCKED_BY_NO_HEADLESS_API":
        return ErrorCode.BlockedByNoHeadlessApi;
      case "OBJECT_NOT_FOUND":
        return ErrorCode.ObjectNotFound;
      case "VALIDATION_FAILED":
        return ErrorCode.ValidationFailed;
      case "PERMISSION_DENIED":
        return ErrorCode.PermissionDenied;
      case "BLOCKED_BY_MISSING_CUBASE_SIDE_BRIDGE":
      case "NEEDS_CUBASE_SIDE_BRIDGE":
        return ErrorCode.NeedsCubaseSideBridge;
      case "REQUIRES_EXISTING_SELECTION":
        return ErrorCode.ExistingSelectionRequired;
      default:
        return ErrorCode.AdapterFailed;
    }
  }

  private assertBridgeSuccess<T>(response: PluginBridgeResponse<T>): PluginBridgeResponse<T> {
    if (response.ok) return response;
    throw new CubaseMcpError(
      this.mapErrorCode(response.error?.code),
      response.error?.message ?? "Plugin bridge request failed.",
      response.error?.details,
      response.error?.recoverable ?? false
    );
  }
}
