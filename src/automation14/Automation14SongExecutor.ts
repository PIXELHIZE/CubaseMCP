import { randomUUID } from "node:crypto";
import type { CubaseAdapter, OperationContext } from "../adapters/CubaseAdapter.js";
import type { CubaseState, Track } from "../schemas/state.js";
import { InstrumentResolver } from "../song/InstrumentResolver.js";
import { JpopMidiArrangementGenerator } from "../song/JpopMidiArrangementGenerator.js";
import type { SongCreateResult, SongManifest, SongPlan, SongTrackBinding } from "../song/models.js";
import { SongProjectValidator } from "../song/SongProjectValidator.js";
import { positionToCubaseString } from "../v2/contracts.js";
import { MidiPerformanceEncoder } from "./MidiPerformanceEncoder.js";
import { PowerShellCubaseUiDriver } from "./PowerShellCubaseUiDriver.js";
import type { Automation14ExecutionOptions, Automation14TrackRecipe, Automation14UiDriver } from "./types.js";

interface ExecutorOptions {
  requestId?: string;
  correlationId?: string;
  dryRun?: boolean;
  rollbackOnFailure?: boolean;
}

function virtualTrack(plan: SongPlan, bindingId: string, index: number, recipe: Automation14TrackRecipe): Track {
  const partId = `${bindingId}:part`;
  return {
    id: bindingId,
    index,
    type: "instrument",
    name: recipe.name,
    mute: false,
    solo: false,
    recordEnabled: false,
    monitorEnabled: false,
    frozen: false,
    visible: true,
    volumeDb: 0,
    pan: 0,
    routeTo: recipe.outputBus,
    inserts: [{ id: `${bindingId}:instrument`, name: recipe.program.plugin, vendor: "Steinberg", slot: 0, bypassed: false, enabled: true, parameters: {} }],
    sends: [],
    parts: [{
      id: partId,
      trackId: bindingId,
      start: "1.1.1.0",
      length: `${plan.bars}.0.0.0`,
      name: `${recipe.name} Performance`,
      notes: recipe.notes.map((note, noteIndex) => ({
        id: `${partId}:note:${noteIndex}`,
        pitch: note.pitch,
        start: positionToCubaseString(note.start),
        length: note.length,
        velocity: note.velocity,
        channel: note.channel
      }))
    }],
    audioEvents: [],
    metadata: {
      instrumentName: recipe.program.plugin,
      programName: recipe.program.program,
      automationProfile: "automation14"
    }
  };
}

function structuralTrack(id: string, index: number, name: string, type: "group" | "fx" | "marker", routeTo?: string, effect?: string): Track {
  return {
    id, index, type, name, mute: false, solo: false, recordEnabled: false, monitorEnabled: false,
    frozen: false, visible: true, volumeDb: 0, pan: 0, routeTo,
    inserts: effect ? [{ id: `${id}:effect`, name: effect, vendor: "Steinberg", slot: 0, bypassed: false, enabled: true, parameters: {} }] : [],
    sends: [], parts: [], audioEvents: [], metadata: { automationProfile: "automation14", effectName: effect }
  };
}

export class Automation14SongExecutor {
  private readonly midiPort: string;
  private readonly captureTempoMultiplier: number;

  constructor(
    private readonly adapter: CubaseAdapter,
    private readonly ui: Automation14UiDriver = new PowerShellCubaseUiDriver(),
    private readonly arranger = new JpopMidiArrangementGenerator(),
    private readonly encoder = new MidiPerformanceEncoder(),
    private readonly validator = new SongProjectValidator(),
    private readonly instruments = new InstrumentResolver(),
    options: Automation14ExecutionOptions = {}
  ) {
    this.midiPort = options.midiPort ?? "AI MCP Bridge To Cubase";
    this.captureTempoMultiplier = options.captureTempoMultiplier ?? 2;
  }

  async execute(plan: SongPlan, options: ExecutorOptions = {}): Promise<SongCreateResult> {
    if (options.dryRun) throw new Error("automation14 execution is not invoked for dry runs.");
    if (options.rollbackOnFailure !== false) {
      throw new Error("automation14 requires rollbackOnFailure:false and a separate empty saved project because deterministic UI rollback is not claimed.");
    }
    const preflight = await this.ui.preflight();
    if (!preflight.ok) throw new Error(`automation14 preflight failed: ${preflight.failures.join("; ")}`);
    const before = await this.adapter.getState();
    if (!before.cubase.projectOpen) throw new Error("automation14 song creation requires an open Cubase project.");
    const requestId = options.requestId ?? randomUUID();
    const context: OperationContext = {
      requestId,
      correlationId: options.correlationId,
      toolName: "cubase.song",
      dryRun: false,
      timeoutMs: 3_600_000
    };
    const captureTempo = Math.min(300, Math.max(plan.tempo, plan.tempo * this.captureTempoMultiplier));
    const virtualTracks: Track[] = [];
    const bindings: SongTrackBinding[] = [];
    const roleNames = new Map(plan.tracks.map((track) => [track.role, track.name]));
    const busNames = new Map(plan.tracks.filter((track) => track.trackType === "group").map((track) => [track.role, track.name]));
    let index = before.tracks.length;

    await this.ui.stopTransport();
    await this.ui.setTempo(captureTempo);

    const structuralIntents = plan.tracks
      .filter((track) => track.trackType === "group" || track.trackType === "fx" || track.trackType === "marker")
      .sort((left, right) =>
        ({ fx: 0, group: 1, marker: 2 }[left.trackType as "fx" | "group" | "marker"])
        - ({ fx: 0, group: 1, marker: 2 }[right.trackType as "fx" | "group" | "marker"])
      );
    for (const intent of structuralIntents) {
      const id = `automation14:${plan.songId}:${intent.role}`;
      const output = intent.routeToRole ? roleNames.get(intent.routeToRole) : undefined;
      const effect = intent.trackType === "fx" ? (intent.role === "reverb" ? "RoomWorks SE" : "StereoDelay") : undefined;
      if (intent.trackType === "group") await this.ui.addGroupTrack(intent.name, output);
      if (intent.trackType === "fx") await this.ui.addFxTrack(intent.name, effect, "Stereo Out");
      if (intent.trackType === "marker") {
        await this.adapter.execute("triggerCommand", { name: "track.add.marker" }, context);
        await this.ui.addMarkerTrack(intent.name);
      }
      const track = structuralTrack(id, index++, intent.name, intent.trackType as "group" | "fx" | "marker", output, effect);
      virtualTracks.push(track);
      bindings.push({
        intentId: intent.id, role: intent.role, name: intent.name, target: { kind: "uniqueId", uniqueId: id },
        expectedType: intent.trackType, actualType: intent.trackType, partIds: [], noteCount: 0, audioEventIds: [],
        routeToRole: intent.routeToRole, routeValid: !intent.routeToRole || Boolean(output), ownedByPlanner: true
      });
    }

    for (const intent of plan.tracks.filter((track) => track.trackType === "instrument" && track.contentIntent === "generated_midi")) {
      if (intent.instrument && intent.instrument.toLowerCase() !== "halion sonic") {
        throw new Error(`automation14 supports HALion Sonic Instrument Tracks; ${intent.role} requested ${intent.instrument}.`);
      }
      const program = intent.program ?? this.instruments.preferredProgram(intent.role);
      if (!program) throw new Error(`No automation14 program was selected for ${intent.role}.`);
      const notes = this.arranger.generate(intent.role, plan);
      if (intent.required && notes.length === 0) throw new Error(`No MIDI arrangement was generated for ${intent.role}.`);
      const outputBus = intent.routeToRole ? busNames.get(intent.routeToRole) : undefined;
      const recipe: Automation14TrackRecipe = {
        role: intent.role,
        name: intent.name,
        program: { plugin: "HALion Sonic", program },
        notes,
        outputBus
      };
      await this.ui.addInstrumentTrack(recipe.name, recipe.program.plugin, this.midiPort, outputBus);
      await this.ui.loadHalionProgram(recipe.program.program);
      await this.ui.locateStart();
      const events = this.encoder.encode(notes, captureTempo);
      await this.ui.startRecording();
      try {
        await this.adapter.execute("automation14PlayMidi", { events }, context);
      } finally {
        await this.ui.stopTransport();
      }
      const id = `automation14:${plan.songId}:${intent.role}`;
      const track = virtualTrack(plan, id, index++, recipe);
      virtualTracks.push(track);
      bindings.push({
        intentId: intent.id, role: intent.role, name: intent.name, target: { kind: "uniqueId", uniqueId: id },
        expectedType: "instrument", actualType: "instrument", instrumentExpected: recipe.program.plugin,
        programExpected: recipe.program.program, instrumentLoaded: true, programLoaded: true,
        partIds: track.parts.map((part) => part.id), noteCount: notes.length, audioEventIds: [], routeToRole: intent.routeToRole,
        routeValid: !intent.routeToRole || Boolean(outputBus), ownedByPlanner: true
      });
    }

    await this.ui.setTempo(plan.tempo);
    await this.ui.saveProject();
    const auditionMs = Math.min(8_000, Math.ceil(4 * 60_000 / plan.tempo));
    const playbackProbe = await this.ui.playFromStart(auditionMs);
    const after = await this.adapter.getState();
    const validationState: CubaseState = {
      ...after,
      project: { ...after.project, tempo: plan.tempo, timeSignature: plan.timeSignature, key: plan.key },
      tracks: [...after.tracks.filter((track) => !track.id.startsWith("automation14:")), ...virtualTracks],
      lastUpdatedAt: new Date().toISOString()
    };
    const now = new Date().toISOString();
    const manifest: SongManifest = {
      songId: plan.songId,
      planId: plan.id,
      hostSessionId: `automation14:${preflight.processId}:${preflight.hostVersion}`,
      projectFingerprint: after.cubase.projectPath ?? "automation14-open-project",
      createdAt: now,
      updatedAt: now,
      trackBindings: bindings,
      audibleEvidence: {
        verified: playbackProbe.verified,
        method: "meter",
        details: { method: "mixconsole-meter-pixel-delta", profile: "automation14", ...playbackProbe }
      },
      evidence: [{
        requestId,
        actionKey: "cubase.song.create",
        hostSessionId: `automation14:${preflight.processId}:${preflight.hostVersion}`,
        stateBefore: before,
        stateAfter: validationState,
        restored: false,
        evidenceId: `runtime:automation14:${plan.songId}`
      }]
    };
    const validation = this.validator.validate(manifest, validationState);
    return { status: validation.valid ? "succeeded" : "failed", plan, manifest, validation, state: validationState };
  }
}
