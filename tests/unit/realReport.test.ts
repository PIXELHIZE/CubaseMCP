import { describe, expect, it } from "vitest";
import { ReportWriter, type RealCubaseReport } from "../../src/diagnostics/ReportWriter.js";
import { loadMidiPortConfig } from "../../src/config/midiPorts.js";

describe("real Cubase report invariants", () => {
  it("rejects real status without real Cubase evidence", async () => {
    const report: RealCubaseReport = {
      mode: "discover",
      timestamp: new Date().toISOString(),
      connected: false,
      handshake: {},
      directAccessTree: {},
      directAccessParameters: {},
      commandBindings: [],
      pluginManager: {},
      errors: [],
      nextActions: [],
      toolCapabilities: [
        {
          tool: "cubase.transport_play",
          status: "real",
          adapter: "MidiRemoteAdapter",
          testedWithRealCubase: false,
          evidenceFile: "raw-handshake.json",
          limitation: "invalid test fixture"
        }
      ]
    };
    await expect(new ReportWriter("unused").write(report)).rejects.toThrow("untested tools cannot be real");
  });

  it("supports the documented CUBASE_MIDI_IN and CUBASE_MIDI_OUT aliases", () => {
    const config = loadMidiPortConfig({
      CUBASE_MIDI_IN: "From Test Cubase",
      CUBASE_MIDI_OUT: "To Test Cubase"
    } as NodeJS.ProcessEnv);
    expect(config.inputName).toBe("From Test Cubase");
    expect(config.outputName).toBe("To Test Cubase");
    expect(config.maximumSysexFrameBytes).toBeGreaterThanOrEqual(384);
  });
});
