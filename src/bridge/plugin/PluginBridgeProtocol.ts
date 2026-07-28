export type PluginBridgeCommand =
  | "ping"
  | "get_capabilities"
  | "execute"
  | "list_plugins"
  | "list_parameters"
  | "get_parameter"
  | "set_parameter"
  | "load_preset"
  | "set_bypass"
  | "set_enabled"
  | "activate_sidechain"
  | "activate_output"
  | "set_multi_output_routing"
  | "import_midi_file"
  | "import_audio_file"
  | "get_job"
  | "cancel_job";

export interface PluginBridgeRequest<TPayload = unknown> {
  id: string;
  correlationId: string;
  protocol: "cubase-mcp-plugin-bridge";
  version: 1;
  command: PluginBridgeCommand;
  payload: TPayload;
  timestamp: string;
  auth?: { scheme: "bearer"; token: string };
}

export interface PluginBridgeResponse<TPayload = unknown> {
  id: string;
  correlationId?: string;
  protocol: "cubase-mcp-plugin-bridge";
  version: 1;
  ok: boolean;
  payload?: TPayload;
  job?: { id: string; type: "export" | "render" | "scan" | "backup" | "import"; status: "queued" | "running" | "completed" | "failed" | "cancelled"; progress: number };
  evidence?: {
    stateBefore?: unknown;
    stateAfter?: unknown;
    stateDiff?: unknown;
    outputFiles?: string[];
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
    recoverable?: boolean;
  };
}

export interface ExecuteBridgePayload {
  operation: string;
  input: Record<string, unknown>;
  dryRun: boolean;
  timeoutMs?: number;
}

export interface QuickControlParameter {
  index: number;
  objectTitle?: string;
  valueTitle?: string;
  displayValue?: string;
  normalizedValue?: number;
  processValue?: number;
}

export function makePluginBridgeRequest<T>(
  id: string,
  correlationId: string,
  command: PluginBridgeCommand,
  payload: T,
  authToken?: string
): PluginBridgeRequest<T> {
  return {
    id,
    correlationId,
    protocol: "cubase-mcp-plugin-bridge",
    version: 1,
    command,
    payload,
    timestamp: new Date().toISOString(),
    auth: authToken ? { scheme: "bearer", token: authToken } : undefined
  };
}

export function isPluginBridgeResponse(value: unknown): value is PluginBridgeResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { protocol?: unknown; version?: unknown; id?: unknown; ok?: unknown };
  return candidate.protocol === "cubase-mcp-plugin-bridge" && candidate.version === 1 && typeof candidate.id === "string" && typeof candidate.ok === "boolean";
}
