import { randomUUID } from "node:crypto";
import type { CubaseAdapter, OperationContext, OperationResult } from "../adapters/CubaseAdapter.js";
import type { CubaseState, Track } from "../schemas/state.js";
import { positionToCubaseString } from "../v2/contracts.js";
import { MidiPatternGenerator } from "./MidiPatternGenerator.js";
import type {
  SongCreateResult,
  SongManifest,
  SongPlan,
  SongTrackBinding
} from "./models.js";
import { SongProjectValidator } from "./SongProjectValidator.js";

interface ExecutorOptions {
  requestId?: string;
  correlationId?: string;
  dryRun?: boolean;
  rollbackOnFailure?: boolean;
}

interface CreatedTrackResult {
  tracks: Track[];
}

interface CreatedPartResult {
  part: { id: string };
}

function projectFingerprint(state: CubaseState): string {
  return [
    state.cubase.projectPath ?? "untitled",
    state.project.sampleRate,
    state.project.bitDepth
  ].join(":");
}

export class SongProjectExecutor {
  constructor(
    private readonly adapter: CubaseAdapter,
    private readonly patterns = new MidiPatternGenerator(),
    private readonly validator = new SongProjectValidator()
  ) {}

  async execute(plan: SongPlan, options: ExecutorOptions = {}): Promise<SongCreateResult> {
    const requestId = options.requestId ?? randomUUID();
    const context: OperationContext = {
      requestId,
      correlationId: options.correlationId,
      toolName: "cubase.song",
      dryRun: options.dryRun ?? false
    };
    const before = await this.adapter.getState();
    if (!before.cubase.projectOpen) {
      throw new Error("Song creation requires an open Cubase project.");
    }

    const undoSnapshotId = options.dryRun ? undefined : await this.adapter.createUndoSnapshot(`cubase.song.create:${plan.songId}`);
    const bindings: SongTrackBinding[] = [];
    const createdTrackIds: string[] = [];
    try {
      await this.adapter.execute("setTempo", { tempo: plan.tempo }, context);
      await this.adapter.execute("setTimeSignature", { signature: plan.timeSignature }, context);

      for (const intent of plan.tracks) {
        const result = await this.adapter.execute<CreatedTrackResult>("createTrack", {
          type: intent.trackType,
          name: intent.name,
          count: 1,
          instrumentName: intent.instrument
        }, context);
        const track = result.data?.tracks[0];
        if (!track) throw new Error(`Cubase did not return the created ${intent.role} track.`);
        createdTrackIds.push(track.id);
        bindings.push({
          intentId: intent.id,
          role: intent.role,
          name: intent.name,
          target: { kind: "uniqueId", uniqueId: track.id },
          expectedType: intent.trackType,
          actualType: track.type,
          instrumentExpected: intent.instrument,
          instrumentLoaded: intent.trackType !== "instrument" || Boolean(intent.instrument),
          partIds: [],
          noteCount: 0,
          audioEventIds: [],
          routeToRole: intent.routeToRole,
          routeValid: intent.routeToRole ? false : true,
          ownedByPlanner: true
        });
      }

      for (const intent of plan.tracks) {
        const binding = bindings.find((candidate) => candidate.intentId === intent.id);
        if (!binding || binding.target.kind !== "uniqueId") continue;
        if (intent.contentIntent === "generated_midi") {
          const notes = this.patterns.generate(intent.role, plan.bars, plan.key, intent.noteDensity);
          if (notes.length === 0 && intent.required) {
            throw new Error(`No MIDI pattern can be generated for required ${intent.role} track.`);
          }
          if (notes.length > 0) {
            const partResult = await this.adapter.execute<CreatedPartResult>("createMidiPart", {
              trackId: binding.target.uniqueId,
              start: "1.1.1.0",
              length: `${plan.bars}.0.0.0`,
              name: `${intent.name} Pattern`
            }, context);
            const partId = partResult.data?.part.id;
            if (!partId) throw new Error(`Cubase did not return the MIDI part for ${intent.role}.`);
            await this.adapter.execute("addMidiNote", {
              partId,
              notes: notes.map((note) => ({
                pitch: note.pitch,
                start: positionToCubaseString(note.start),
                length: note.length,
                velocity: note.velocity,
                channel: note.channel
              }))
            }, context);
            binding.partIds.push(partId);
            binding.noteCount += notes.length;
          }
        }
      }

      for (const binding of bindings) {
        if (!binding.routeToRole || binding.target.kind !== "uniqueId") continue;
        const destination = bindings.find((candidate) => candidate.role === binding.routeToRole);
        if (!destination || destination.target.kind !== "uniqueId") {
          if (plan.tracks.find((intent) => intent.id === binding.intentId)?.required) {
            throw new Error(`Routing destination ${binding.routeToRole} is missing for ${binding.role}.`);
          }
          continue;
        }
        await this.adapter.execute("setRouting", {
          trackId: binding.target.uniqueId,
          outputBus: destination.target.uniqueId,
          groupTrackId: destination.target.uniqueId
        }, context);
        binding.routeValid = true;
      }

      const after = options.dryRun ? before : await this.adapter.getState();
      const hostSessionId = `${after.cubase.version}:${projectFingerprint(after)}`;
      const now = new Date().toISOString();
      const manifest: SongManifest = {
        songId: plan.songId,
        planId: plan.id,
        hostSessionId,
        projectFingerprint: projectFingerprint(after),
        createdAt: now,
        updatedAt: now,
        trackBindings: bindings,
        audibleEvidence: this.adapter.mode === "mock"
          ? { verified: true, method: "mock", details: { deterministicMock: true } }
          : undefined,
        evidence: [{
          requestId,
          actionKey: "cubase.song.create",
          hostSessionId,
          stateBefore: before,
          stateAfter: after,
          restored: false,
          evidenceId: undoSnapshotId
        }]
      };
      const validation = this.validator.validate(manifest, after);
      if (!validation.valid) {
        throw Object.assign(new Error("Created song failed Song Creation Policy validation."), { manifest, validation });
      }
      return { status: "succeeded", plan, manifest, validation, state: after };
    } catch (error) {
      const rollbackFailures: string[] = [];
      if ((options.rollbackOnFailure ?? true) && !options.dryRun && createdTrackIds.length > 0) {
        try {
          await this.adapter.execute("deleteTrack", { trackIds: createdTrackIds }, context);
        } catch (rollbackError) {
          rollbackFailures.push(rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
        }
      }
      const attached = error as Error & { manifest?: SongManifest; validation?: SongCreateResult["validation"] };
      if (attached.manifest && attached.validation) {
        return {
          status: "failed",
          plan,
          manifest: attached.manifest,
          validation: attached.validation,
          rollback: {
            attempted: options.rollbackOnFailure ?? true,
            removedTargets: rollbackFailures.length === 0
              ? createdTrackIds.map((uniqueId) => ({ kind: "uniqueId" as const, uniqueId }))
              : [],
            failures: rollbackFailures
          }
        };
      }
      throw error;
    }
  }

  async deleteOwnedTracks(manifest: SongManifest, requestId = randomUUID()): Promise<OperationResult> {
    const trackIds = manifest.trackBindings
      .filter((binding) => binding.ownedByPlanner && binding.target.kind === "uniqueId")
      .map((binding) => binding.target.kind === "uniqueId" ? binding.target.uniqueId : "");
    return this.adapter.execute("deleteTrack", { trackIds }, {
      requestId,
      toolName: "cubase.song",
      dryRun: false
    });
  }
}
