import { randomUUID } from "node:crypto";
import type { CubaseAdapter } from "../adapters/CubaseAdapter.js";
import { positionToCubaseString } from "../v2/contracts.js";
import { MidiPatternGenerator } from "./MidiPatternGenerator.js";
import type {
  SongCreateResult,
  SongManifest,
  SongPlan,
  SongPlanRequest,
  SongRole,
  SongValidationResult
} from "./models.js";
import { SongManifestStore } from "./SongManifestStore.js";
import { SongProjectExecutor } from "./SongProjectExecutor.js";
import { SongProjectPlanner } from "./SongProjectPlanner.js";
import { SongProjectValidator } from "./SongProjectValidator.js";
import { TrackTypeResolver } from "./TrackTypeResolver.js";
import { InstrumentResolver } from "./InstrumentResolver.js";
import { CubaseStateSchema } from "../schemas/state.js";

export class SongProjectService {
  private readonly executor: Pick<SongProjectExecutor, "execute">;

  constructor(
    private readonly adapter: CubaseAdapter,
    private readonly store = new SongManifestStore(),
    private readonly planner = new SongProjectPlanner(),
    private readonly validator = new SongProjectValidator(),
    private readonly patterns = new MidiPatternGenerator(),
    private readonly trackTypes = new TrackTypeResolver(),
    private readonly instruments = new InstrumentResolver(),
    executor?: Pick<SongProjectExecutor, "execute">
  ) {
    this.executor = executor ?? new SongProjectExecutor(adapter, patterns, validator);
  }

  plan(request: SongPlanRequest): SongPlan {
    return this.store.savePlan(this.planner.plan(request));
  }

  programCatalog(query?: string, role?: SongRole) {
    return this.instruments.programCatalog(query, role);
  }

  async create(input: {
    planId?: string;
    plan?: SongPlan;
    requestId?: string;
    correlationId?: string;
    dryRun?: boolean;
    rollbackOnFailure?: boolean;
  }): Promise<SongCreateResult> {
    if (!input.planId && !input.plan) throw new Error("cubase.song.create requires planId or plan.");
    const plan = input.plan ? this.store.savePlan(this.assertPlan(input.plan)) : this.store.getPlan(String(input.planId));
    const result = await this.executor.execute(plan, input);
    if (result.status === "succeeded") this.store.saveManifest(result.manifest);
    return result;
  }

  previewCreate(input: { planId?: string; plan?: SongPlan }): {
    executable: true;
    plan: SongPlan;
    invariants: string[];
  } {
    if (!input.planId && !input.plan) throw new Error("cubase.song.create requires planId or plan.");
    const plan = input.plan ? this.assertPlan(input.plan) : this.store.getPlan(String(input.planId));
    return {
      executable: true,
      plan,
      invariants: [
        "software_instrument -> Instrument Track",
        "required generated MIDI track -> at least one imported part and note",
        "Instrument Track -> loaded instrument",
        "validation failure -> planner-owned track rollback"
      ]
    };
  }

  async validate(songId: string): Promise<SongValidationResult> {
    const manifest = this.store.getManifest(songId);
    const evidenced = CubaseStateSchema.safeParse(manifest.evidence.at(-1)?.stateAfter);
    return this.validator.validate(manifest, evidenced.success ? evidenced.data : await this.adapter.getState());
  }

  describe(songId?: string): { plan: SongPlan; manifest: SongManifest; validation?: SongValidationResult } | undefined {
    const manifest = songId ? this.store.getManifest(songId) : this.store.latestManifest();
    if (!manifest) return undefined;
    return {
      plan: this.store.getPlan(manifest.planId),
      manifest
    };
  }

  async repair(songId: string, issueIds?: string[]): Promise<{
    repairedIssueIds: string[];
    skippedIssueIds: string[];
    validation: SongValidationResult;
  }> {
    const manifest = this.store.getManifest(songId);
    const plan = this.store.getPlan(manifest.planId);
    const initial = this.validator.validate(manifest, await this.adapter.getState());
    const selected = initial.issues.filter((issue) => !issueIds || issueIds.includes(issue.id));
    const repairedIssueIds: string[] = [];
    const skippedIssueIds: string[] = [];
    const context = {
      requestId: randomUUID(),
      toolName: "cubase.song",
      dryRun: false
    };

    for (const issue of selected) {
      const binding = manifest.trackBindings.find((candidate) => candidate.intentId === issue.intentId);
      const intent = plan.tracks.find((candidate) => candidate.id === issue.intentId);
      if (!binding || !intent || binding.target.kind !== "uniqueId" || !issue.repairable) {
        skippedIssueIds.push(issue.id);
        continue;
      }
      if (issue.code === "INSTRUMENT_NOT_LOADED" && intent.instrument) {
        await this.adapter.execute("updateTrack", {
          trackId: binding.target.uniqueId,
          metadata: { instrumentName: intent.instrument }
        }, context);
        binding.instrumentLoaded = true;
        repairedIssueIds.push(issue.id);
        continue;
      }
      if (issue.code === "MIDI_PART_MISSING" || issue.code === "MIDI_NOTES_MISSING") {
        const notes = this.patterns.generate(intent.role, plan.bars, plan.key, intent.noteDensity);
        if (notes.length === 0) {
          skippedIssueIds.push(issue.id);
          continue;
        }
        let partId = binding.partIds[0];
        if (!partId || issue.code === "MIDI_PART_MISSING") {
          const created = await this.adapter.execute<{ part: { id: string } }>("createMidiPart", {
            trackId: binding.target.uniqueId,
            start: "1.1.1.0",
            length: `${plan.bars}.0.0.0`,
            name: `${intent.name} Pattern`
          }, context);
          const createdPartId = created.data?.part.id;
          if (!createdPartId) throw new Error(`Repair did not return a MIDI part for ${intent.role}.`);
          partId = createdPartId;
          binding.partIds.push(createdPartId);
        }
        if (!partId) throw new Error(`Repair has no MIDI part for ${intent.role}.`);
        await this.adapter.execute("addMidiNote", {
          partId,
          notes: notes.map((note) => ({
            ...note,
            start: positionToCubaseString(note.start)
          }))
        }, context);
        binding.noteCount += notes.length;
        repairedIssueIds.push(issue.id);
        continue;
      }
      if (issue.code === "ROUTING_INVALID" && binding.routeToRole) {
        const destination = manifest.trackBindings.find((candidate) => candidate.role === binding.routeToRole);
        if (destination?.target.kind === "uniqueId") {
          await this.adapter.execute("setRouting", {
            trackId: binding.target.uniqueId,
            outputBus: destination.target.uniqueId,
            groupTrackId: destination.target.uniqueId
          }, context);
          binding.routeValid = true;
          repairedIssueIds.push(issue.id);
          continue;
        }
      }
      skippedIssueIds.push(issue.id);
    }

    manifest.updatedAt = new Date().toISOString();
    this.store.saveManifest(manifest);
    const validation = this.validator.validate(manifest, await this.adapter.getState());
    return { repairedIssueIds, skippedIssueIds, validation };
  }

  private assertPlan(plan: SongPlan): SongPlan {
    if (!plan || typeof plan !== "object" || !Array.isArray(plan.tracks) || plan.tracks.length === 0) {
      throw new Error("Invalid SongPlan: at least one track intent is required.");
    }
    for (const intent of plan.tracks) {
      const resolved = this.trackTypes.resolve(intent.role, intent.sourceKind, intent.trackType);
      if (resolved.sourceKind !== intent.sourceKind || resolved.trackType !== intent.trackType) {
        throw new Error(`Invalid SongPlan track policy for ${intent.role}.`);
      }
    }
    return structuredClone(plan);
  }
}
