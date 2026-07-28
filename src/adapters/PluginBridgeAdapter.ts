import type { AdapterCapability, CubaseAdapter, OperationContext, OperationResult } from "./CubaseAdapter.js";
import type { CubaseState, Job, Track } from "../schemas/state.js";
import { PluginBridgeClient } from "../bridge/plugin/PluginBridgeClient.js";
import { PluginParameterMapper } from "../bridge/plugin/PluginParameterMapper.js";
import { CubaseMcpError, ErrorCode } from "../safety/ErrorCodes.js";

export class PluginBridgeAdapter implements CubaseAdapter {
  readonly name = "Plugin Bridge Adapter";
  readonly mode = "pluginBridge" as const;
  private connected = false;
  private readonly parameterMapper = new PluginParameterMapper();

  constructor(private readonly client: PluginBridgeClient) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async getCapabilities(): Promise<AdapterCapability[]> {
    return [
      { operation: "getPluginParameters", status: "partial", adapter: this.name, notes: "Focused/selected quick controls only unless a VST3 companion bridge is installed." },
      { operation: "setPluginParameter", status: "partial", adapter: this.name, notes: "Use parameterId focusedQuickControl:N or selectedQuickControl:N." },
      { operation: "loadPluginPreset", status: "requiresBridge", adapter: this.name, notes: "Requires VST3 companion bridge for headless preset loading." },
      { operation: "openPluginWindow", status: "unsupported", adapter: this.name, notes: "Opening windows is not a headless parameter operation." }
    ];
  }

  async getState(): Promise<CubaseState> {
    throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, "Plugin bridge adapter does not provide full Cubase state.");
  }

  async getProject(): Promise<unknown> {
    throw new CubaseMcpError(ErrorCode.CapabilityUnsupported, "Plugin bridge adapter does not provide project state.");
  }

  async listTracks(): Promise<Track[]> {
    return [];
  }

  async getTrack(trackId: string): Promise<Track> {
    throw new CubaseMcpError(ErrorCode.ObjectNotFound, `Plugin bridge adapter has no track cache: ${trackId}`);
  }

  async listPlugins(): Promise<unknown> {
    try {
      const response = await this.client.request("list_plugins", {});
      return response.payload;
    } catch (error) {
      const quickControls = await this.client.listQuickControlParameters(true);
      return {
        availablePlugins: [],
        focusedQuickControls: quickControls,
        limitation: "Global plugin catalog requires the Cubase-side bridge.",
        bridgeError: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async listJobs(): Promise<Job[]> {
    return [];
  }

  async getJob(jobId: string): Promise<Job> {
    throw new CubaseMcpError(ErrorCode.JobNotFound, `Plugin bridge adapter has no job: ${jobId}`);
  }

  async createUndoSnapshot(label: string): Promise<string> {
    return `plugin-bridge-no-snapshot:${label}`;
  }

  async undo(): Promise<OperationResult> {
    throw new CubaseMcpError(ErrorCode.NeedsUserSetup, "Plugin bridge undo requires Cubase command mapping.");
  }

  async redo(): Promise<OperationResult> {
    throw new CubaseMcpError(ErrorCode.NeedsUserSetup, "Plugin bridge redo requires Cubase command mapping.");
  }

  async execute<T = unknown>(operation: string, input: Record<string, unknown>, context: OperationContext): Promise<OperationResult<T>> {
    this.ensureConnected();
    if (context.dryRun) {
      return { changed: false, preview: { adapter: this.name, operation, input, usesScreenAutomation: false } } as OperationResult<T>;
    }
    switch (operation) {
      case "getPluginParameters":
        if (input.pluginId !== undefined || input.objectId !== undefined) {
          return this.fromBridge<T>(await this.client.request("list_parameters", input, context), false);
        }
        return { changed: false, adapter: this.name, data: (await this.client.listQuickControlParameters(Boolean(input.focused ?? true))) as T };
      case "getPluginParameter": {
        const address = this.parameterMapper.parse(input);
        if (address.quickControl) {
          const parameters = await this.client.listQuickControlParameters(address.quickControl.focused);
          return { changed: false, adapter: this.name, data: parameters.find((item) => item.index === address.quickControl?.index) as T };
        }
        return this.fromBridge<T>(await this.client.request("get_parameter", { ...input, address }, context), false);
      }
      case "listPlugins":
        return { changed: false, adapter: this.name, data: (await this.listPlugins()) as T };
      case "setPluginParameter": {
        const address = this.parameterMapper.parse(input);
        if (address.quickControl) {
          this.client.setQuickControl(address.quickControl.index, Number(input.value), address.quickControl.focused);
          return { changed: true, adapter: this.name, data: { address, normalizedValue: input.value, mode: "quickControls" } as T };
        }
        return this.fromBridge<T>(await this.client.request("set_parameter", { ...input, address }, context), true);
      }
      case "loadPluginPreset":
        return this.fromBridge<T>(await this.client.loadPresetByQuickControlFallback(String(input.presetName ?? input.preset), context), true);
      case "bypassPlugin":
      case "setPluginBypass":
        return this.fromBridge<T>(await this.client.request("set_bypass", input, context), true);
      case "enablePlugin":
      case "disablePlugin":
        return this.fromBridge<T>(await this.client.request("set_enabled", { ...input, enabled: operation === "enablePlugin" }, context), true);
      case "enableSidechain":
        return this.fromBridge<T>(await this.client.request("activate_sidechain", input, context), true);
      case "enableInstrumentOutput":
        return this.fromBridge<T>(await this.client.request("activate_output", input, context), true);
      case "setMultiOutputRouting":
        return this.fromBridge<T>(await this.client.request("set_multi_output_routing", input, context), true);
      case "importMidiFile":
        return this.fromBridge<T>(await this.client.request("import_midi_file", input, context), true);
      case "importAudio":
      case "importAudioFile":
        return this.fromBridge<T>(await this.client.request("import_audio_file", input, context), true);
      case "getBridgeJob":
        return this.fromBridge<T>(await this.client.request("get_job", input, context), false);
      case "cancelBridgeJob":
        return this.fromBridge<T>(await this.client.request("cancel_job", input, context), true);
      default:
        return this.fromBridge<T>(await this.client.executeOperation(operation, input, context), true);
    }
  }

  private fromBridge<T>(response: Awaited<ReturnType<PluginBridgeClient["executeOperation"]>>, changed: boolean): OperationResult<T> {
    return {
      changed,
      adapter: this.name,
      data: response.payload as T,
      job: response.job,
      evidence: response.evidence
    };
  }

  private ensureConnected(): void {
    if (!this.connected) throw new CubaseMcpError(ErrorCode.CubaseNotConnected, "Plugin bridge adapter is not connected.");
  }
}
