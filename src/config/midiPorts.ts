export interface MidiPortConfig {
  inputName: string;
  outputName: string;
  timeoutMs: number;
  retries: number;
  maximumSysexFrameBytes: number;
  maximumPayloadBytes: number;
  chunkAssemblyTimeoutMs: number;
  pollIntervalMs: number;
}

export function loadMidiPortConfig(env: NodeJS.ProcessEnv = process.env): MidiPortConfig {
  return {
    inputName: env.CUBASE_MIDI_IN ?? env.CUBASE_MIDI_INPUT ?? "AI MCP Bridge From Cubase",
    outputName: env.CUBASE_MIDI_OUT ?? env.CUBASE_MIDI_OUTPUT ?? "AI MCP Bridge To Cubase",
    timeoutMs: Number(env.CUBASE_MIDI_TIMEOUT_MS ?? 1500),
    retries: Number(env.CUBASE_MIDI_RETRIES ?? 1),
    maximumSysexFrameBytes: Number(env.CUBASE_MIDI_MAX_FRAME_BYTES ?? 1024),
    maximumPayloadBytes: Number(env.CUBASE_MIDI_MAX_PAYLOAD_BYTES ?? 4 * 1024 * 1024),
    chunkAssemblyTimeoutMs: Number(env.CUBASE_MIDI_CHUNK_TIMEOUT_MS ?? 5000),
    pollIntervalMs: Number(env.CUBASE_STATE_POLL_MS ?? 1000)
  };
}
