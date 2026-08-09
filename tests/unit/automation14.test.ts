import { describe, expect, it, vi } from "vitest";
import { Automation14SongExecutor } from "../../src/automation14/Automation14SongExecutor.js";
import { MidiPerformanceEncoder } from "../../src/automation14/MidiPerformanceEncoder.js";
import type { Automation14PlaybackProbe, Automation14Preflight, Automation14UiDriver } from "../../src/automation14/types.js";
import { MockCubaseAdapter } from "../../src/adapters/MockCubaseAdapter.js";
import { JpopMidiArrangementGenerator } from "../../src/song/JpopMidiArrangementGenerator.js";
import { SongProjectPlanner } from "../../src/song/SongProjectPlanner.js";
import { CapabilityRegistry } from "../../src/v2/CapabilityRegistry.js";
import type { HostDescriptor } from "../../src/v2/contracts.js";

class FakeUiDriver implements Automation14UiDriver {
  readonly calls: string[] = [];
  async preflight(): Promise<Automation14Preflight> { return { ok: true, processId: 14, hostVersion: "14.0.32", display: { width: 2560, height: 1080 }, midiPort: "AI MCP Bridge To Cubase", failures: [] }; }
  async setTempo(bpm: number): Promise<void> { this.calls.push(`tempo:${bpm}`); }
  async locateStart(): Promise<void> { this.calls.push("locate"); }
  async addInstrumentTrack(name: string, _plugin: string, midiInput?: string, output?: string): Promise<void> { this.calls.push(`instrument:${name}:${midiInput}:${output}`); }
  async loadHalionProgram(program: string): Promise<void> { this.calls.push(`program:${program}`); }
  async setSelectedMidiInput(port: string): Promise<void> { this.calls.push(`input:${port}`); }
  async setSelectedOutput(destination: string): Promise<void> { this.calls.push(`output:${destination}`); }
  async startRecording(): Promise<void> { this.calls.push("record"); }
  async stopTransport(): Promise<void> { this.calls.push("stop"); }
  async addGroupTrack(name: string, output?: string): Promise<void> { this.calls.push(`group:${name}:${output}`); }
  async addFxTrack(name: string): Promise<void> { this.calls.push(`fx:${name}`); }
  async addMarkerTrack(name: string): Promise<void> { this.calls.push(`marker:${name}`); }
  async commitRename(name: string): Promise<void> { this.calls.push(`rename:${name}`); }
  async saveProject(): Promise<void> { this.calls.push("save"); }
  async playFromStart(durationMs: number): Promise<Automation14PlaybackProbe> { this.calls.push(`play:${durationMs}`); return { verified: true, durationMs, sampledFrames: 3, changedMeterPixels: 42 }; }
  async playFromPosition(position: string, durationMs: number): Promise<Automation14PlaybackProbe> { this.calls.push(`play:${position}:${durationMs}`); return { verified: true, durationMs, sampledFrames: 3, changedMeterPixels: 42 }; }
}

describe("automation14", () => {
  it("encodes musical notes into ordered MIDI note-on/off messages", () => {
    const events = new MidiPerformanceEncoder().encode([{
      pitch: 60,
      start: { format: "musical", bar: 2, beat: 1, sixteenth: 1, tick: 0 },
      length: "0.1.0.0",
      velocity: 90,
      channel: 1
    }], 120, 0);
    expect(events).toEqual([
      { atMs: 2000, message: [0x90, 60, 90] },
      { atMs: 2500, message: [0x80, 60, 0] }
    ]);
  });

  it("builds section-aware J-pop parts for every software role", () => {
    const plan = new SongProjectPlanner().plan({ prompt: "8-bar J-pop", genre: "jpop", bars: 8, key: "D major" });
    const generator = new JpopMidiArrangementGenerator();
    for (const role of ["drums", "bass", "chords", "lead", "pad", "arp"] as const) {
      expect(generator.generate(role, plan).length, role).toBeGreaterThan(0);
    }
  });

  it("exposes only the isolated, opt-in song surface as real", () => {
    const host: HostDescriptor = {
      product: "Cubase", edition: "Pro", version: "14.0.32", sessionId: "test",
      supportStatus: "unverified_host_profile", profile: "automation14"
    };
    const registry = new CapabilityRegistry();
    expect(registry.resolve(host, "cubase.song.create")).toMatchObject({ status: "real", profile: "automation14" });
    expect(registry.resolve(host, "cubase.track.create_parameterized")).toMatchObject({ status: "blocked_by_no_headless_api" });
  });

  it("creates Instrument/Group/FX bindings and records generated MIDI through the adapter", async () => {
    const adapter = new MockCubaseAdapter();
    await adapter.connect();
    await adapter.execute("createProject", { name: "Automation14 Test" }, { requestId: "project", toolName: "test", dryRun: false });
    const originalExecute = adapter.execute.bind(adapter);
    const execute = vi.spyOn(adapter, "execute").mockImplementation(async (operation, input, context) => {
      if (operation === "automation14PlayMidi") return { changed: true, data: { eventCount: (input.events as unknown[]).length } };
      return originalExecute(operation, input, context);
    });
    const plan = new SongProjectPlanner().plan({
      prompt: "2-bar automation loop", genre: "jpop", bars: 2,
      tracks: [
        { role: "music_bus" },
        { role: "reverb" },
        { role: "chords", routeToRole: "music_bus", program: "[GM 001] Acoustic Grand Piano" }
      ]
    });
    const ui = new FakeUiDriver();
    const result = await new Automation14SongExecutor(adapter, ui).execute(plan, { rollbackOnFailure: false });
    expect(result.status).toBe("succeeded");
    expect(result.validation.summary.instrumentTracks).toBe(1);
    expect(result.validation.summary.notes).toBeGreaterThan(0);
    expect(ui.calls).toContain("group:Music Bus:Reverb FX");
    expect(ui.calls).toContain("fx:Reverb FX");
    expect(ui.calls).toContain("program:[GM 001] Acoustic Grand Piano");
    expect(ui.calls).toContain("instrument:Chords:AI MCP Bridge To Cubase:Music Bus");
    expect(execute).toHaveBeenCalledWith("automation14PlayMidi", expect.any(Object), expect.any(Object));
    await adapter.disconnect();
  });
});
