import type { RequestResponseRouter } from "../bridge/midi/RequestResponseRouter.js";
import type { DirectAccessDoctor } from "./DirectAccessDoctor.js";

export type CommandAuditResultValue = "real" | "partial" | "not_performable" | "dialog_required" | "unknown" | "error";

export type CommandAuditResult = {
  category: string;
  name: string;
  bindingCreated: boolean;
  canPerformSupported: boolean;
  canPerform?: boolean;
  executedInAudit: boolean;
  stateBefore?: unknown;
  stateAfter?: unknown;
  stateDiff?: unknown;
  stateAfterRestore?: unknown;
  requiresSelection?: boolean;
  opensDialog?: boolean;
  result: CommandAuditResultValue;
  error?: string;
  key: string;
  destructive: boolean;
  restored?: boolean;
  executionSkippedReason?: string;
  expectedEffect?: { verified: boolean; description: string; observed?: unknown };
};

interface CommandCandidate {
  key: string;
  category: string;
  name: string;
  requiresSelection?: boolean;
  destructive?: boolean;
  opensDialog?: boolean;
}

interface RegistryEntry extends CommandCandidate {
  cc?: number;
  dialogRisk?: boolean;
  selectionDependent?: boolean;
  bindingCreated?: boolean;
  canPerformSupported?: boolean;
  canPerform?: boolean;
  error?: string;
}

export const commandAuditCandidates: CommandCandidate[] = [
  { key: "track.add.audio", category: "AddTrack", name: "Audio" },
  { key: "track.add.midi", category: "AddTrack", name: "MIDI" },
  { key: "track.add.instrument", category: "AddTrack", name: "Instrument", opensDialog: true },
  { key: "track.add.group", category: "AddTrack", name: "Group Channel" },
  { key: "track.add.fx", category: "AddTrack", name: "FX Channel", opensDialog: true },
  { key: "track.add.folder", category: "AddTrack", name: "Folder" },
  { key: "track.add.marker", category: "AddTrack", name: "Marker" },
  { key: "track.add.tempo", category: "AddTrack", name: "Tempo" },
  { key: "track.add.chord", category: "AddTrack", name: "Chord" },
  { key: "track.duplicate", category: "Project", name: "Duplicate Track", requiresSelection: true, destructive: true },
  { key: "track.remove_selected", category: "Project", name: "Remove Selected Tracks", requiresSelection: true, destructive: true },
  { key: "midi.quantize", category: "Quantize Category", name: "Quantize", requiresSelection: true, destructive: true },
  { key: "audio.bounce_selection", category: "Audio", name: "Bounce Selection", requiresSelection: true, destructive: true },
  { key: "audio.crossfade", category: "Audio", name: "Crossfade", requiresSelection: true, destructive: true },
  { key: "audio.fade_in", category: "Audio", name: "Apply Standard Fade In", requiresSelection: true, destructive: true },
  { key: "audio.fade_out", category: "Audio", name: "Apply Standard Fade Out", requiresSelection: true, destructive: true },
  { key: "audio.delete_overlaps", category: "Audio", name: "Delete Overlaps", requiresSelection: true, destructive: true },
  { key: "audio.dissolve_part", category: "Audio", name: "Dissolve Part", requiresSelection: true, destructive: true },
  { key: "marker.add_position_selected", category: "Marker", name: "Add Position Marker on Selected Track", requiresSelection: true, destructive: true },
  { key: "marker.add_cycle_selected", category: "Marker", name: "Add Cycle Marker on Selected Track", requiresSelection: true, destructive: true },
  { key: "marker.add_position_active", category: "Marker", name: "Add Position Marker on Active Track", requiresSelection: true, destructive: true },
  { key: "marker.add_cycle_active", category: "Marker", name: "Add Cycle Marker on Active Track", requiresSelection: true, destructive: true },
  { key: "track.rename_selected", category: "Edit", name: "Rename First Selected Track", requiresSelection: true, opensDialog: true },
  { key: "render.current_settings", category: "Render in Place", name: "Render (with Current Settings)", requiresSelection: true, destructive: true },
  { key: "export.perform_current_audio_export", category: "Audio Export", name: "Perform Audio Export", destructive: true },
  { key: "edit.undo", category: "Edit", name: "Undo", destructive: true },
  { key: "edit.redo", category: "Edit", name: "Redo", destructive: true }
];

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function changedPaths(before: unknown, after: unknown, prefix = ""): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (typeof before !== "object" || before === null || typeof after !== "object" || after === null) return [prefix || "$"];
  const left = before as Record<string, unknown>;
  const right = after as Record<string, unknown>;
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return [...keys].flatMap((key) => changedPaths(left[key], right[key], prefix ? `${prefix}.${key}` : key));
}

export class CommandBindingDoctor {
  constructor(
    private readonly router: RequestResponseRouter,
    private readonly directAccess: DirectAccessDoctor
  ) {}

  async audit(options: { executeDestructive?: boolean; executeSafe?: boolean } = {}): Promise<CommandAuditResult[]> {
    const registry = await this.registry();
    const byKey = new Map(registry.map((entry) => [entry.key, entry]));
    const results: CommandAuditResult[] = [];
    let executionHalted = false;
    for (const candidate of commandAuditCandidates) {
      const entry = byKey.get(candidate.key);
      const result: CommandAuditResult = {
        key: candidate.key,
        category: entry?.category ?? candidate.category,
        name: entry?.name ?? candidate.name,
        bindingCreated: entry?.bindingCreated === true,
        canPerformSupported: entry?.canPerformSupported === true,
        canPerform: entry?.canPerform,
        executedInAudit: false,
        requiresSelection: entry?.selectionDependent ?? candidate.requiresSelection ?? false,
        opensDialog: entry?.dialogRisk ?? candidate.opensDialog ?? false,
        destructive: entry?.destructive ?? candidate.destructive ?? false,
        result: "unknown",
        error: entry?.error
      };
      if (!entry || !result.bindingCreated) {
        result.result = entry?.error ? "error" : "unknown";
        result.error ??= "Command binding was not created by the Cubase script.";
        results.push(result);
        continue;
      }
      if (result.canPerformSupported && result.canPerform === false) {
        result.result = "not_performable";
        results.push(result);
        continue;
      }
      if (result.opensDialog) {
        result.result = "dialog_required";
        result.executionSkippedReason = "Command is marked as dialog-risk; screen/dialog automation is disallowed.";
        results.push(result);
        continue;
      }
      const performabilityAllowsAttempt = result.canPerform === true || !result.canPerformSupported;
      const mayExecute =
        !executionHalted &&
        performabilityAllowsAttempt &&
        (result.destructive ? options.executeDestructive === true : options.executeSafe !== false);
      if (!mayExecute) {
        result.result = performabilityAllowsAttempt ? "partial" : "unknown";
        result.executionSkippedReason = executionHalted
          ? "Command execution was halted after an earlier command had no observable effect or could not be restored."
          : result.destructive
            ? "Use --execute-destructive to execute and diff this command."
            : "canPerform was unavailable or safe command execution was disabled.";
        results.push(result);
        continue;
      }
      try {
        result.stateBefore = await this.snapshot();
        if (typeof entry.cc !== "number") throw new Error("Command registry did not expose its MIDI CC number.");
        this.router.sendControl({ kind: "cc", channel: 0, number: entry.cc, value: 127 });
        result.executedInAudit = true;
        await wait(Number(process.env.CUBASE_COMMAND_SETTLE_MS ?? 700));
        result.stateAfter = await this.snapshot();
        const paths = changedPaths(result.stateBefore, result.stateAfter);
        result.expectedEffect = this.verifyExpectedEffect(candidate, result.stateBefore, result.stateAfter, paths);
        result.stateDiff = { changed: paths.length > 0, changedPaths: paths, expectedEffect: result.expectedEffect };
        if (!result.expectedEffect.verified) {
          result.result = "unknown";
          result.error = `Expected effect was not observed: ${result.expectedEffect.description}. Dialog presence cannot be inferred without disallowed screen automation.`;
          executionHalted = true;
          results.push(result);
          continue;
        }
        this.router.sendControl({ kind: "cc", channel: 0, number: 101, value: 127 });
        await wait(Number(process.env.CUBASE_COMMAND_SETTLE_MS ?? 700));
        const restoredState = await this.snapshot();
        result.stateAfterRestore = restoredState;
        result.restored = changedPaths(result.stateBefore, restoredState).length === 0;
        result.result = result.restored ? "real" : "partial";
        if (!result.restored) {
          result.error = "Command changed state but Undo did not restore the observed snapshot.";
          executionHalted = true;
        }
      } catch (error) {
        result.result = "error";
        result.error = error instanceof Error ? error.message : String(error);
      }
      results.push(result);
    }
    return results;
  }

  async registry(): Promise<RegistryEntry[]> {
    const response = await this.router.request("command_binding", { type: "COMMAND_GET_REGISTRY" });
    const payload = record(response.payload);
    if (payload.ok !== true || !Array.isArray(payload.data)) {
      throw new Error(`${record(payload.error).code ?? "COMMAND_REGISTRY_ERROR"}: ${record(payload.error).message ?? "Invalid command registry response"}`);
    }
    return payload.data as RegistryEntry[];
  }

  private async snapshot(): Promise<unknown> {
    const stateResponse = await this.router.request("get_state", { include: "state" });
    const payload = record(stateResponse.payload);
    const treeResponse = await this.directAccess.request({ type: "DA_DISCOVER_OBJECT_TREE", root: "mixConsole" });
    const tree = record(treeResponse.data);
    return {
      state: payload.state ?? payload,
      mixConsole: {
        baseObjectId: tree.baseObjectId,
        objectCount: tree.objectCount,
        truncated: tree.truncated,
        signature: this.treeSignature(tree.tree)
      }
    };
  }

  private treeSignature(value: unknown): Array<{ objectId?: number; uniqueId?: string; title?: string; typeName?: string }> {
    const output: Array<{ objectId?: number; uniqueId?: string; title?: string; typeName?: string }> = [];
    const walk = (nodeValue: unknown): void => {
      const node = record(nodeValue);
      output.push({
        objectId: typeof node.objectId === "number" ? node.objectId : undefined,
        uniqueId: typeof node.uniqueId === "string" ? node.uniqueId : undefined,
        title: typeof node.title === "string" ? node.title : undefined,
        typeName: typeof node.typeName === "string" ? node.typeName : undefined
      });
      if (Array.isArray(node.children)) for (const child of node.children) walk(child);
    };
    if (value) walk(value);
    return output;
  }

  private verifyExpectedEffect(candidate: CommandCandidate, before: unknown, after: unknown, paths: string[]): { verified: boolean; description: string; observed?: unknown } {
    const beforeMix = record(record(before).mixConsole);
    const afterMix = record(record(after).mixConsole);
    const beforeCount = typeof beforeMix.objectCount === "number" ? beforeMix.objectCount : undefined;
    const afterCount = typeof afterMix.objectCount === "number" ? afterMix.objectCount : undefined;
    if (candidate.key.startsWith("track.add.") || candidate.key === "track.duplicate") {
      return {
        verified: beforeCount !== undefined && afterCount !== undefined && afterCount > beforeCount,
        description: "MixConsole DirectAccess object count must increase.",
        observed: { beforeCount, afterCount }
      };
    }
    if (candidate.key === "track.remove_selected") {
      return {
        verified: beforeCount !== undefined && afterCount !== undefined && afterCount < beforeCount,
        description: "MixConsole DirectAccess object count must decrease.",
        observed: { beforeCount, afterCount }
      };
    }
    return {
      verified: paths.length > 0,
      description: "At least one structured Cubase state or DirectAccess path must change.",
      observed: { changedPaths: paths }
    };
  }
}
