import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import type { CubaseAdapter, OperationResult } from "../adapters/CubaseAdapter.js";
import { CubaseMcpError, ErrorCode } from "./ErrorCodes.js";
import { Permission, type SafetyPolicy, defaultSafetyPolicy } from "./Permissions.js";
import type { ToolDefinition } from "../tools/definitions.js";
import { defaultCapabilityMatrix, type CapabilityMatrix, type CapabilityStatus } from "../state/CapabilityMatrix.js";
import { DryRunPlanner } from "./DryRunPlanner.js";
import { DestructiveActionGuard } from "./DestructiveActionGuard.js";
import { UndoManager } from "./UndoManager.js";

export interface StructuredToolResult<T = unknown> {
  [key: string]: unknown;
  ok: boolean;
  tool: string;
  operation: string;
  requestId: string;
  correlationId: string;
  status: CapabilityStatus;
  adapter: string;
  dryRun: boolean;
  confirmed: boolean;
  changed: boolean;
  data?: T;
  preview?: unknown;
  undoSnapshotId?: string;
  job?: OperationResult["job"];
  jobId?: string;
  evidence?: OperationResult["evidence"];
  warnings: string[];
  error?: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    retryable: boolean;
    recoverable: boolean;
  };
}

export class SafetyController {
  private writeQueue: Promise<unknown> = Promise.resolve();
  private readonly dryRunPlanner = new DryRunPlanner();
  private readonly destructiveGuard = new DestructiveActionGuard();
  private readonly undoManager: UndoManager;

  constructor(
    private readonly adapter: CubaseAdapter,
    private readonly policy: SafetyPolicy = defaultSafetyPolicy,
    private readonly capabilityMatrix: CapabilityMatrix = defaultCapabilityMatrix
  ) {
    this.undoManager = new UndoManager(adapter);
  }

  async invoke(definition: ToolDefinition, rawInput: unknown): Promise<StructuredToolResult> {
    const requestId = this.requestIdFrom(rawInput);
    let parsed: Record<string, unknown>;
    try {
      parsed = this.parseInput(definition, rawInput);
    } catch (error) {
      return this.failure(definition, requestId, requestId, false, false, this.normalizeError(error));
    }
    const dryRun = Boolean(parsed.dryRun);
    const confirmed = Boolean(parsed.confirm);
    const correlationId = String(parsed.correlationId ?? requestId);
    const timeoutMs = Number(parsed.timeoutMs ?? 30_000);

    const run = async (): Promise<StructuredToolResult> => {
      try {
        this.checkPermission(definition);
        const capability = this.capabilityMatrix.get(definition.name);
        if (capability.usesScreenAutomation) {
          return this.failure(definition, requestId, correlationId, dryRun, confirmed, new CubaseMcpError(
            ErrorCode.BlockedByNoHeadlessApi,
            `${definition.name} would require screen automation, which is disallowed.`,
            { capability }
          ));
        }

        if (this.adapter.mode !== "mock" && capability.status.startsWith("blocked_") && !dryRun) {
          return this.failure(definition, requestId, correlationId, dryRun, confirmed, new CubaseMcpError(
            this.capabilityMatrix.errorCodeFor(capability),
            `${definition.name} is blocked for headless execution.`,
            { capability }
          ));
        }

        let confirmationPreview: unknown;
        if (!dryRun && !confirmed && (definition.safety.destructive || (definition.safety.mayOverwriteFiles && parsed.overwrite === true))) {
          const safetyPlan = this.dryRunPlanner.plan(definition, parsed, capability);
          const adapterPreview = definition.safety.supportsDryRun
            ? await this.withTimeout(this.adapter.execute(definition.operation, { ...parsed, dryRun: true }, {
                requestId,
                correlationId,
                toolName: definition.name,
                dryRun: true,
                timeoutMs
              }), timeoutMs, definition.name)
            : undefined;
          confirmationPreview = {
            ...safetyPlan,
            adapterPreview: adapterPreview?.preview ?? adapterPreview?.data
          };
        }
        try {
          if (this.policy.requireConfirmationForDestructive) {
            this.destructiveGuard.assertAllowed(definition, parsed, dryRun, confirmed, confirmationPreview);
          }
        } catch (error) {
          return this.failure(definition, requestId, correlationId, dryRun, confirmed, this.normalizeError(error));
        }

        const undoSnapshotId = await this.undoManager.snapshot(definition, requestId, dryRun);

        const operationResult = await this.withTimeout(this.adapter.execute(definition.operation, parsed, {
          requestId,
          correlationId,
          toolName: definition.name,
          dryRun,
          timeoutMs,
          undoSnapshotId
        }), timeoutMs, definition.name);

        const status = this.adapter.mode === "mock" ? "mock_only" : capability.status;
        const adapterName = operationResult.adapter ?? (this.adapter.mode === "mock" ? this.adapter.name : capability.primaryAdapter);

        const preview = dryRun
          ? {
              ...this.dryRunPlanner.plan(definition, parsed, capability),
              adapterPreview: operationResult.preview ?? operationResult.data
            }
          : operationResult.preview;

        return {
          ok: true,
          tool: definition.name,
          operation: definition.operation,
          requestId,
          correlationId,
          status,
          adapter: adapterName,
          dryRun,
          confirmed,
          changed: operationResult.changed,
          data: operationResult.data,
          preview,
          undoSnapshotId,
          job: operationResult.job,
          jobId: operationResult.job?.id,
          evidence: {
            requestId,
            ...operationResult.evidence
          },
          warnings: operationResult.warnings ?? []
        };
      } catch (error) {
        return this.failure(definition, requestId, correlationId, dryRun, confirmed, this.normalizeError(error));
      }
    };

    if (!definition.safety.changesState || dryRun) {
      return run();
    }

    const queued = this.writeQueue.then(run, run);
    this.writeQueue = queued.catch(() => undefined);
    return queued;
  }

  private parseInput(definition: ToolDefinition, rawInput: unknown): Record<string, unknown> {
    try {
      return z.object(definition.inputSchema).parse(rawInput ?? {}) as Record<string, unknown>;
    } catch (error) {
      throw new CubaseMcpError(ErrorCode.ValidationFailed, "Tool input validation failed.", error);
    }
  }

  private checkPermission(definition: ToolDefinition): void {
    if (!this.policy.allowedPermissions.has(definition.safety.permission)) {
      throw new CubaseMcpError(ErrorCode.PermissionDenied, `Permission denied: ${definition.safety.permission}`);
    }
    if (definition.safety.destructive && !this.policy.allowedPermissions.has(Permission.Destructive)) {
      throw new CubaseMcpError(ErrorCode.PermissionDenied, "Destructive operations are disabled by policy.");
    }
  }

  private requestIdFrom(rawInput: unknown): string {
    if (typeof rawInput === "object" && rawInput !== null && "requestId" in rawInput) {
      const requestId = (rawInput as { requestId?: unknown }).requestId;
      if (typeof requestId === "string" && requestId.length > 0) return requestId;
    }
    if (typeof rawInput === "object" && rawInput !== null && "correlationId" in rawInput) {
      const correlationId = (rawInput as { correlationId?: unknown }).correlationId;
      if (typeof correlationId === "string" && correlationId.length > 0) return correlationId;
    }
    return randomUUID();
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, tool: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new CubaseMcpError(ErrorCode.AdapterTimeout, `${tool} timed out after ${timeoutMs}ms.`, { timeoutMs }, true)),
            timeoutMs
          );
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private normalizeError(error: unknown): CubaseMcpError {
    if (error instanceof CubaseMcpError) return error;
    if (error instanceof Error) return new CubaseMcpError(ErrorCode.AdapterFailed, error.message, { name: error.name, stack: error.stack });
    return new CubaseMcpError(ErrorCode.Unknown, "Unknown error", error);
  }

  private failure(
    definition: ToolDefinition,
    requestId: string,
    correlationId: string,
    dryRun: boolean,
    confirmed: boolean,
    error: CubaseMcpError
  ): StructuredToolResult {
    const capability = this.capabilityMatrix.get(definition.name);
    return {
      ok: false,
      tool: definition.name,
      operation: definition.operation,
      requestId,
      correlationId,
      status: this.adapter.mode === "mock" ? "mock_only" : capability.status,
      adapter: this.adapter.mode === "mock" ? this.adapter.name : capability.primaryAdapter,
      dryRun,
      confirmed,
      changed: false,
      warnings: [],
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        retryable: error.retryable,
        recoverable: error.retryable
      }
    };
  }
}
