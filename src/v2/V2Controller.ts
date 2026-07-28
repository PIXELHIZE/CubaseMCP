import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import type { CubaseAdapter, OperationResult } from "../adapters/CubaseAdapter.js";
import type { SongPlan, SongPlanRequest } from "../song/models.js";
import { SongProjectService } from "../song/SongProjectService.js";
import { ActionRouter } from "./ActionRouter.js";
import type { V2ToolName } from "./actionSchemas.js";
import { v2ActionSchemas } from "./actionSchemas.js";
import { actionKey } from "./actionManifest.js";
import { CapabilityRegistry } from "./CapabilityRegistry.js";
import type { HostDescriptor, V2Result } from "./contracts.js";

const readActions = new Set([
  "cubase.system.status", "cubase.system.capabilities", "cubase.system.diagnose",
  "cubase.project.get", "cubase.song.plan", "cubase.song.validate", "cubase.song.describe",
  "cubase.track.list", "cubase.track.get", "cubase.transport.get", "cubase.mixer_channel.get",
  "cubase.mixer_channel.get_meters", "cubase.plugin.list", "cubase.plugin.list_parameters",
  "cubase.plugin.get_parameter", "cubase.midi_part.get", "cubase.midi_edit.list_notes",
  "cubase.audio_event.get", "cubase.tempo.get", "cubase.chord.get", "cubase.arrangement.analyze_structure",
  "cubase.media.get_pool", "cubase.media.search", "cubase.export_config.get", "cubase.job.list",
  "cubase.job.get", "cubase.batch.preview", "cubase.batch.validate",
  "cubase.debug.command.get_registry", "cubase.debug.command.can_perform",
  "cubase.debug.direct_access.get_capabilities", "cubase.debug.direct_access.discover_tree",
  "cubase.debug.direct_access.get_object", "cubase.debug.direct_access.get_parameters",
  "cubase.debug.direct_access.get_parameter"
]);

const destructiveActions = new Set([
  "cubase.project.close", "cubase.track.delete", "cubase.plugin.assign", "cubase.plugin.remove",
  "cubase.midi_part.delete", "cubase.midi_edit.delete_notes", "cubase.audio_event.delete",
  "cubase.tempo.delete_event", "cubase.chord.delete", "cubase.arrangement.delete_marker",
  "cubase.automation.delete_points", "cubase.media.clean_unused", "cubase.export_run.perform_current_settings",
  "cubase.job.cancel"
]);

export class V2Controller {
  private writeQueue: Promise<unknown> = Promise.resolve();
  private readonly router: ActionRouter;
  private readonly songs: SongProjectService;

  constructor(
    private readonly adapter: CubaseAdapter,
    private host: HostDescriptor,
    private readonly capabilities = new CapabilityRegistry()
  ) {
    this.router = new ActionRouter(adapter);
    this.songs = new SongProjectService(adapter);
    if (capabilities.isCertifiedHost(host) && host.supportStatus === "unverified_host_profile") {
      this.host = { ...host, supportStatus: "supported_release_profile" };
    }
  }

  setHost(host: HostDescriptor): void {
    this.host = host;
  }

  getHost(): HostDescriptor {
    return structuredClone(this.host);
  }

  getCapabilityRegistry(): CapabilityRegistry {
    return this.capabilities;
  }

  routeCount(): number {
    return this.router.routeCount();
  }

  async invoke(tool: V2ToolName, rawInput: unknown): Promise<V2Result> {
    const requestId = this.requestIdFrom(rawInput);
    let input: Record<string, unknown>;
    try {
      input = v2ActionSchemas[tool].parse(rawInput ?? {}) as Record<string, unknown>;
    } catch (error) {
      return this.failure(tool, "invalid", requestId, requestId, undefined, "VALIDATION_FAILED", "Tool input validation failed.", error);
    }
    const action = String(input.action);
    const key = actionKey(tool, action);
    const capability = this.capabilities.resolve(this.host, key);
    const correlationId = String(input.correlationId ?? requestId);
    const dryRun = Boolean(input.dryRun);
    const confirmed = Boolean(input.confirm);

    if (capability.status !== "real") {
      return this.failure(
        tool,
        action,
        requestId,
        correlationId,
        capability,
        capability.status === "blocked_by_no_headless_api"
          ? "BLOCKED_BY_NO_HEADLESS_API"
          : capability.status === "unsupported_release_profile"
            ? "UNSUPPORTED_RELEASE_PROFILE"
            : "BLOCKED_BY_CUBASE_API",
        `${key} is not executable in release profile ${this.host.profile}.`,
        { blockerReason: capability.blockerReason, constraints: capability.constraints }
      );
    }
    if (destructiveActions.has(key) && !dryRun && !confirmed) {
      return this.failure(
        tool, action, requestId, correlationId, capability,
        "CONFIRMATION_REQUIRED", `${key} requires confirm:true.`, { destructive: true }
      );
    }

    const execute = async (): Promise<V2Result> => {
      try {
        const before = await this.adapter.getState().catch(() => undefined);
        const operationResult = await this.withTimeout(
          this.execute(tool, action, input, { requestId, correlationId, dryRun }),
          Number(input.timeoutMs ?? 30_000),
          key
        );
        const after = dryRun ? before : await this.adapter.getState().catch(() => undefined);
        return {
          ok: true,
          tool,
          action,
          actionKey: key,
          requestId,
          correlationId,
          host: this.getHost(),
          capability,
          changed: dryRun ? false : operationResult.changed,
          dryRun,
          confirmed,
          data: operationResult.data,
          preview: dryRun ? operationResult.preview ?? operationResult.data : operationResult.preview,
          evidence: {
            requestId,
            actionKey: key,
            hostSessionId: this.host.sessionId,
            stateBefore: before,
            stateAfter: after,
            stateDiff: operationResult.evidence?.stateDiff,
            evidenceId: capability.evidenceId
          },
          warnings: operationResult.warnings ?? []
        };
      } catch (error) {
        return this.failure(
          tool, action, requestId, correlationId, capability,
          error instanceof Error && error.message.includes("selection") ? "REQUIRES_EXISTING_SELECTION" : "ADAPTER_FAILED",
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? { name: error.name } : error
        );
      }
    };

    if (readActions.has(key) || dryRun) return execute();
    const queued = this.writeQueue.then(execute, execute);
    this.writeQueue = queued.catch(() => undefined);
    return queued;
  }

  private async execute(
    tool: V2ToolName,
    action: string,
    input: Record<string, unknown>,
    meta: { requestId: string; correlationId: string; dryRun: boolean }
  ): Promise<OperationResult> {
    if (tool === "cubase.system") return this.executeSystem(action, input);
    if (tool === "cubase.song") return this.executeSong(action, input, meta);
    if (tool === "cubase.batch") return this.executeBatch(action, input);
    return this.router.execute(tool, action, input, {
      ...meta,
      toolName: tool,
      timeoutMs: Number(input.timeoutMs ?? 30_000)
    });
  }

  private async executeSystem(action: string, input: Record<string, unknown>): Promise<OperationResult> {
    if (action === "status") {
      return {
        changed: false,
        data: {
          protocolVersion: 2,
          publicTools: Object.keys(v2ActionSchemas).filter((name) => !name.startsWith("cubase.debug.")).length,
          diagnosticTools: 2,
          routedActions: this.router.routeCount(),
          host: this.getHost(),
          state: await this.adapter.getState()
        }
      };
    }
    if (action === "capabilities") {
      const filter = typeof input.tool === "string" ? input.tool : undefined;
      const actionFilter = typeof input.actionFilter === "string" ? input.actionFilter : undefined;
      const capabilities = this.capabilities.list(this.host).filter((candidate) =>
        (!filter || candidate.key.startsWith(`${filter}.`)) &&
        (!actionFilter || candidate.key.includes(actionFilter))
      );
      return { changed: false, data: { host: this.getHost(), capabilities } };
    }
    return {
      changed: false,
      data: {
        host: this.getHost(),
        adapterCapabilities: await this.adapter.getCapabilities(),
        state: await this.adapter.getState(),
        transportProbeRequested: Boolean(input.includeTransportProbe),
        transportProbeExecuted: false
      }
    };
  }

  private async executeSong(
    action: string,
    input: Record<string, unknown>,
    meta: { requestId: string; correlationId: string; dryRun: boolean }
  ): Promise<OperationResult> {
    if (action === "plan") return { changed: false, data: this.songs.plan(input as unknown as SongPlanRequest) };
    if (action === "create") {
      if (meta.dryRun) {
        return {
          changed: false,
          preview: this.songs.previewCreate({
            planId: input.planId as string | undefined,
            plan: input.plan as unknown as SongPlan | undefined
          })
        };
      }
      const result = await this.songs.create({
        planId: input.planId as string | undefined,
        plan: input.plan as unknown as SongPlan | undefined,
        requestId: meta.requestId,
        correlationId: meta.correlationId,
        dryRun: meta.dryRun,
        rollbackOnFailure: input.rollbackOnFailure as boolean | undefined
      });
      return { changed: result.status === "succeeded" && !meta.dryRun, data: result };
    }
    if (action === "validate") return { changed: false, data: await this.songs.validate(String(input.songId)) };
    if (action === "repair") {
      const data = await this.songs.repair(String(input.songId), input.issueIds as string[] | undefined);
      return { changed: data.repairedIssueIds.length > 0, data };
    }
    return { changed: false, data: this.songs.describe(input.songId as string | undefined) ?? null };
  }

  private async executeBatch(action: string, input: Record<string, unknown>): Promise<OperationResult> {
    const steps = input.steps as Array<Record<string, unknown>>;
    const validation = steps.map((step, index) => {
      const tool = step.tool;
      const nestedAction = step.action;
      const validTool = typeof tool === "string" && tool in v2ActionSchemas;
      const validAction = validTool && typeof nestedAction === "string";
      return {
        index,
        valid: Boolean(validAction),
        tool,
        action: nestedAction,
        error: validAction ? undefined : "Each step requires a valid tool and action."
      };
    });
    if (action === "preview") return { changed: false, preview: { steps, validation } };
    if (action === "validate") return { changed: false, data: { valid: validation.every((item) => item.valid), steps: validation } };
    throw new Error("Batch execution is blocked until every nested action can be preflighted and evidenced independently.");
  }

  private requestIdFrom(rawInput: unknown): string {
    if (typeof rawInput === "object" && rawInput !== null) {
      const value = (rawInput as { requestId?: unknown; correlationId?: unknown }).requestId ??
        (rawInput as { correlationId?: unknown }).correlationId;
      if (typeof value === "string" && value.length > 0) return value;
    }
    return randomUUID();
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, key: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(`${key} timed out after ${timeoutMs}ms.`)), timeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private failure(
    tool: V2ToolName,
    action: string,
    requestId: string,
    correlationId: string,
    capability: V2Result["capability"] | undefined,
    code: string,
    message: string,
    details?: unknown
  ): V2Result {
    const key = action === "invalid" ? `${tool}.invalid` : actionKey(tool, action);
    return {
      ok: false,
      tool,
      action,
      actionKey: key,
      requestId,
      correlationId,
      host: this.getHost(),
      capability: capability ?? {
        key,
        profile: this.host.profile,
        status: "unsupported_release_profile",
        constraints: {}
      },
      changed: false,
      dryRun: false,
      confirmed: false,
      warnings: [],
      error: { code, message, details: details instanceof z.ZodError ? details.issues : details, recoverable: code !== "VALIDATION_FAILED" }
    };
  }
}
