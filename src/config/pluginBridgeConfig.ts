export interface PluginBridgeConfig {
  enabled: boolean;
  pipeName: string;
  timeoutMs: number;
  fallbackToMidiRemote: boolean;
  authToken?: string;
}

export function loadPluginBridgeConfig(env: NodeJS.ProcessEnv = process.env): PluginBridgeConfig {
  return {
    enabled: env.CUBASE_EXPERIMENTAL_PLUGIN_BRIDGE === "true",
    pipeName: env.CUBASE_PLUGIN_BRIDGE_PIPE ?? "\\\\.\\pipe\\cubase-mcp-plugin-bridge",
    timeoutMs: Number(env.CUBASE_PLUGIN_BRIDGE_TIMEOUT_MS ?? 3000),
    fallbackToMidiRemote: env.CUBASE_EXPERIMENTAL_PLUGIN_BRIDGE === "true" && env.CUBASE_PLUGIN_BRIDGE_MIDI_FALLBACK === "true",
    authToken: env.CUBASE_PLUGIN_BRIDGE_TOKEN
  };
}
