import { describe, expect, it, vi } from "vitest";
import { Automation14SongExecutor } from "../../src/automation14/Automation14SongExecutor.js";
import { Automation14ExportExecutor } from "../../src/automation14/Automation14ExportExecutor.js";
import { MidiPerformanceEncoder } from "../../src/automation14/MidiPerformanceEncoder.js";
import type {
  Automation14ExportUiResult,
  Automation14MixerGainResult,
  Automation14PlaybackProbe,
  Automation14Preflight,
  Automation14ProgramLoadResult,
  Automation14ProjectCreateResult,
  Automation14UiDriver
} from "../../src/automation14/types.js";
import { MockCubaseAdapter } from "../../src/adapters/MockCubaseAdapter.js";
import { JpopMidiArrangementGenerator } from "../../src/song/JpopMidiArrangementGenerator.js";
import { SongProjectPlanner } from "../../src/song/SongProjectPlanner.js";
import { CapabilityRegistry } from "../../src/v2/CapabilityRegistry.js";
import { V2Controller } from "../../src/v2/V2Controller.js";
import type { HostDescriptor } from "../../src/v2/contracts.js";

class FakeUiDriver implements Automation14UiDriver {
  readonly calls: string[] = [];
  async preflight(): Promise<Automation14Preflight> { return { ok: true, processId: 14, hostVersion: "14.0.32", display: { width: 2560, height: 1080 }, midiPort: "AI MCP Bridge To Cubase", failures: [] }; }
  async createEmptyProject(name: string, directory: string): Promise<Automation14ProjectCreateResult> {
    this.calls.push(`project:${directory}:${name}`);
    return { name, directory, projectPath: `${directory}\\${name}\\${name}.cpr`, created: true, projectWindowTitle: `Cubase Pro Project - ${name}` };
  }
  async setTempo(bpm: number): Promise<void> { this.calls.push(`tempo:${bpm}`); }
  async setProjectRange(bars: number): Promise<void> { this.calls.push(`range:${bars}`); }
  async locateStart(): Promise<void> { this.calls.push("locate"); }
  async addInstrumentTrack(name: string, _plugin: string, midiInput?: string, output?: string): Promise<void> { this.calls.push(`instrument:${name}:${midiInput}:${output}`); }
  async loadHalionProgram(program: string): Promise<Automation14ProgramLoadResult> {
    this.calls.push(`program:${program}`);
    return { requestedProgram: program, loaded: true, slotOccupied: true, slotTextPixels: 320, screenshotPath: "program.png" };
  }
  async setSelectedMidiInput(port: string): Promise<void> { this.calls.push(`input:${port}`); }
  async setSelectedOutput(destination: string): Promise<void> { this.calls.push(`output:${destination}`); }
  async startRecording(): Promise<void> { this.calls.push("record"); }
  async stopTransport(): Promise<void> { this.calls.push("stop"); }
  async addGroupTrack(name: string, output?: string): Promise<void> { this.calls.push(`group:${name}:${output}`); }
  async addFxTrack(name: string): Promise<void> { this.calls.push(`fx:${name}`); }
  async addMarkerTrack(name: string): Promise<void> { this.calls.push(`marker:${name}`); }
  async commitRename(name: string): Promise<void> { this.calls.push(`rename:${name}`); }
  async saveProject(): Promise<void> { this.calls.push("save"); }
  async setStereoOutGain(db: number): Promise<Automation14MixerGainResult> {
    this.calls.push(`master:${db}`);
    return { requestedDb: db, applied: true, screenshotPath: "master.png" };
  }
  async exportAudioMixdown(expectedFile: string, realtime: boolean): Promise<Automation14ExportUiResult> {
    this.calls.push(`export:${expectedFile}:${realtime}`);
    return { expectedFile, realtime, exportWindowObserved: true, completed: true, bytes: 1024, screenshotPath: "export.png" };
  }
  async playFromStart(durationMs: number): Promise<Automation14PlaybackProbe> { this.calls.push(`play:${durationMs}`); return { verified: true, durationMs, sampledFrames: 3, changedMeterPixels: 42 }; }
  async playFromPosition(position: string, durationMs: number): Promise<Automation14PlaybackProbe> { this.calls.push(`play:${position}:${durationMs}`); return { verified: true, durationMs, sampledFrames: 3, changedMeterPixels: 42 }; }
  async playSelectedTrackFromPosition(position: string, durationMs: number): Promise<Automation14PlaybackProbe> {
    this.calls.push(`solo-play:${position}:${durationMs}`);
    return { verified: true, durationMs, sampledFrames: 3, changedMeterPixels: 42, soloSelected: true };
  }
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

  it("uses a real section progression, chord-complete voicings and root-aware bass", () => {
    const plan = new SongProjectPlanner().plan({ prompt: "120-bar J-pop", genre: "jpop", bars: 120, key: "D major" });
    const generator = new JpopMidiArrangementGenerator();
    const harmony = generator.generateHarmony(plan);
    const chorus = plan.sections.find((section) => section.name === "Chorus 1")!;
    expect(harmony.slice(chorus.startBar - 1, chorus.startBar + 3).map((event) => event.symbol)).toEqual([
      "Gmaj7", "A7", "F#m7", "Bm7"
    ]);
    expect(new Set(harmony.map((event) => event.symbol)).size).toBeGreaterThanOrEqual(8);

    const bass = generator.generate("bass", plan);
    const piano = generator.generate("chords", plan);
    const silentBassBars = new Set([1, 2, 3, 117, 118, 119, 120]);
    for (const chord of harmony) {
      const bassDownbeat = bass.find((candidate) => candidate.start.format === "musical"
        && candidate.start.bar === chord.bar && candidate.start.beat === 1 && candidate.start.sixteenth === 1);
      if (silentBassBars.has(chord.bar)) {
        expect(bassDownbeat, `intentional bass rest bar ${chord.bar}`).toBeUndefined();
        continue;
      }
      expect(bassDownbeat, `bass bar ${chord.bar}`).toBeDefined();
      expect(bassDownbeat!.pitch % 12, `bass root bar ${chord.bar}`).toBe(chord.bassPitchClass);

      const pianoDownbeat = piano.filter((candidate) => candidate.start.format === "musical"
        && candidate.start.bar === chord.bar && candidate.start.beat === 1 && candidate.start.sixteenth === 1);
      const pitchClasses = new Set(pianoDownbeat.map((candidate) => candidate.pitch % 12));
      for (const pitchClass of chord.pitchClasses) expect(pitchClasses.has(pitchClass), `${chord.symbol} tone ${pitchClass}`).toBe(true);
    }
  });

  it("creates scale-aware phrases with denser choruses than verses", () => {
    const plan = new SongProjectPlanner().plan({ prompt: "120-bar J-pop", genre: "jpop", bars: 120, key: "D major" });
    const generator = new JpopMidiArrangementGenerator();
    const harmony = generator.generateHarmony(plan);
    const lead = generator.generate("lead", plan);
    const verse = plan.sections.find((section) => section.name === "Verse 1")!;
    const chorus = plan.sections.find((section) => section.name === "Chorus 1")!;
    const inSection = (startBar: number, bars: number) => lead.filter((candidate) => candidate.start.format === "musical"
      && candidate.start.bar >= startBar && candidate.start.bar < startBar + bars);
    expect(inSection(chorus.startBar, chorus.bars).length / chorus.bars)
      .toBeGreaterThan(inSection(verse.startBar, verse.bars).length / verse.bars);
    for (const candidate of lead) {
      if (candidate.start.format !== "musical") continue;
      const step = (candidate.start.beat - 1) * 4 + candidate.start.sixteenth - 1;
      if (step % 4 !== 0) continue;
      const chord = harmony[candidate.start.bar - 1]!;
      expect(chord.pitchClasses).toContain(candidate.pitch % 12);
    }
  });

  it("uses section-level rests so accompaniment layers do not play continuously", () => {
    const plan = new SongProjectPlanner().plan({ prompt: "120-bar J-pop", genre: "jpop", bars: 120, key: "D major" });
    const generator = new JpopMidiArrangementGenerator();
    const notes = Object.fromEntries((["bass", "chords", "lead", "pad", "arp"] as const)
      .map((role) => [role, generator.generate(role, plan)])) as Record<"bass" | "chords" | "lead" | "pad" | "arp", ReturnType<JpopMidiArrangementGenerator["generate"]>>;
    expect(notes.bass.length).toBeLessThan(600);
    expect(notes.chords.length).toBeLessThan(1_000);
    expect(notes.lead.length).toBeLessThanOrEqual(350);
    expect(notes.pad.length).toBeLessThan(250);
    expect(notes.arp.length).toBeLessThan(500);
    expect(Object.values(notes).reduce((sum, roleNotes) => sum + roleNotes.length, 0)).toBeLessThan(2_400);

    const activeBars = (role: keyof typeof notes) => new Set(notes[role].flatMap((note) =>
      note.start.format === "musical" ? [note.start.bar] : []));
    const leadBars = activeBars("lead");
    const padBars = activeBars("pad");
    const arpBars = activeBars("arp");
    expect(leadBars.size).toBeLessThan(80);
    expect(padBars.size).toBeLessThan(50);
    expect(arpBars.size).toBeLessThan(50);
    for (const bar of padBars) expect(arpBars.has(bar), `pad/arp collision bar ${bar}`).toBe(false);
  });

  it("exposes only the isolated, opt-in song surface as real", () => {
    const host: HostDescriptor = {
      product: "Cubase", edition: "Pro", version: "14.0.32", sessionId: "test",
      supportStatus: "unverified_host_profile", profile: "automation14"
    };
    const registry = new CapabilityRegistry();
    expect(registry.resolve(host, "cubase.song.create")).toMatchObject({ status: "real", profile: "automation14" });
    expect(registry.resolve(host, "cubase.export_run.perform_current_settings")).toMatchObject({
      status: "real",
      profile: "automation14",
      constraints: { realtimeExportDefault: true, masterGainDbDefault: -3.2 }
    });
    expect(registry.resolve(host, "cubase.track.create_parameterized")).toMatchObject({ status: "blocked_by_no_headless_api" });
  });

  it("requires confirmation and returns artifact evidence through the MCP export action", async () => {
    const adapter = new MockCubaseAdapter();
    await adapter.connect();
    const host: HostDescriptor = {
      product: "Cubase", edition: "Pro", version: "14.0.32", sessionId: "export-test",
      supportStatus: "unverified_host_profile", profile: "automation14"
    };
    const execute = vi.fn().mockResolvedValue({
      changed: true,
      data: { audio: { verified: true } },
      evidence: { outputFiles: [{ path: "E:\\Mixdown\\song.wav", bytes: 42, sha256: "ABC" }] }
    });
    const controller = new V2Controller(adapter, host, new CapabilityRegistry(), undefined, { execute });
    const unconfirmed = await controller.invoke("cubase.export_run", {
      action: "perform_current_settings",
      expectedFiles: ["E:\\Mixdown\\song.wav"],
      timeoutMs: 600_000
    });
    expect(unconfirmed).toMatchObject({ ok: false, error: { code: "CONFIRMATION_REQUIRED" } });

    const confirmed = await controller.invoke("cubase.export_run", {
      action: "perform_current_settings",
      expectedFiles: ["E:\\Mixdown\\song.wav"],
      masterGainDb: -3.2,
      realtime: true,
      confirm: true,
      timeoutMs: 600_000
    });
    expect(confirmed).toMatchObject({
      ok: true,
      changed: true,
      evidence: { outputFiles: [{ path: "E:\\Mixdown\\song.wav", bytes: 42, sha256: "ABC" }] }
    });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ masterGainDb: -3.2, realtime: true }), expect.objectContaining({ timeoutMs: 600_000 }));
    await adapter.disconnect();
  });

  it("runs gain, realtime export, and audio analysis as one automation14 operation", async () => {
    const ui = new FakeUiDriver();
    const analyzer = {
      analyze: vi.fn().mockResolvedValue({
        verified: true,
        path: "E:\\Mixdown\\song.wav",
        sha256: "DEF",
        bytes: 4096,
        durationSeconds: 180,
        codec: "pcm_f32le",
        sampleRate: 48_000,
        channels: 2,
        bitRate: 3_072_000,
        peakDbfs: -1.8,
        truePeakDbfs: -1.7,
        rmsDb: -19,
        integratedLufs: -16.8,
        silenceStarts: [],
        silenceEnds: [],
        warnings: [],
        analyzer: "ffprobe+ffmpeg"
      })
    };
    const result = await new Automation14ExportExecutor(ui, analyzer).execute({
      expectedFiles: ["E:\\Mixdown\\song.wav"], masterGainDb: -3.2, realtime: true
    }, {
      requestId: "export", correlationId: "export", toolName: "cubase.export_run", dryRun: false, timeoutMs: 600_000
    });
    expect(ui.calls).toContain("master:-3.2");
    expect(ui.calls).toContain("export:E:\\Mixdown\\song.wav:true");
    expect(result).toMatchObject({
      changed: true,
      adapter: "automation14",
      evidence: { outputFiles: [{ path: "E:\\Mixdown\\song.wav", bytes: 4096, sha256: "DEF" }] }
    });
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
        { role: "chords", routeToRole: "music_bus", program: "[GM 002] Bright Acoustic Piano" }
      ]
    });
    const ui = new FakeUiDriver();
    const result = await new Automation14SongExecutor(adapter, ui).execute(plan, { rollbackOnFailure: false });
    expect(result.status).toBe("succeeded");
    expect(result.validation.summary.instrumentTracks).toBe(1);
    expect(result.validation.summary.notes).toBeGreaterThan(0);
    expect(ui.calls).toContain("group:Music Bus:Stereo Out");
    expect(ui.calls).toContain("range:2");
    expect(ui.calls).toContain("fx:Reverb FX");
    expect(ui.calls).toContain("program:[GM 002] Bright Acoustic Piano");
    expect(ui.calls).toContain("instrument:Chords:AI MCP Bridge To Cubase:Music Bus");
    expect(execute).toHaveBeenCalledWith("automation14PlayMidi", expect.any(Object), expect.any(Object));
    await adapter.disconnect();
  });
});
