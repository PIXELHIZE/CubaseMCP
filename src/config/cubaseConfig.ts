import { loadMidiPortConfig, type MidiPortConfig } from "./midiPorts.js";
import { defaultCommandMappings, type MidiCommandMapping } from "./commandMappings.js";

export interface CubaseRuntimeConfig {
  adapter: "composite" | "mock" | "midiRemote";
  midi: MidiPortConfig;
  commandMappings: Record<string, MidiCommandMapping>;
  exportVerificationPollMs: number;
}

export function loadCubaseConfig(env: NodeJS.ProcessEnv = process.env): CubaseRuntimeConfig {
  const adapter = (env.CUBASE_ADAPTER ?? "composite") as CubaseRuntimeConfig["adapter"];
  return {
    adapter,
    midi: loadMidiPortConfig(env),
    commandMappings: defaultCommandMappings,
    exportVerificationPollMs: Number(env.CUBASE_EXPORT_VERIFY_POLL_MS ?? 500)
  };
}
