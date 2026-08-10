import type { CubaseHandshakeEvidence } from "../diagnostics/CubaseConnectionDoctor.js";
import type { BlockerReason, CapabilityStatus } from "./contracts.js";
import type { CrashDumpAudit } from "./CrashDumpMonitor.js";
import { evaluateSafe14Preflight } from "./Safe14Preflight.js";
import {
  SAFE14_HOST,
  Safe14ObservationSchema,
  type Safe14Observation
} from "./Safe14Certification.js";

interface SmokeResult {
  name: string;
  passed: boolean;
  before?: unknown;
  executionValue?: unknown;
  after?: unknown;
  restoreAttempted: boolean;
  restored?: boolean;
  restoredValue?: unknown;
  error?: string;
}

interface CommandResult {
  key: string;
  bindingCreated: boolean;
  canPerformSupported: boolean;
  canPerform?: boolean;
  executedInAudit: boolean;
  stateBefore?: unknown;
  stateAfter?: unknown;
  stateDiff?: unknown;
  stateAfterRestore?: unknown;
  result: string;
  restored?: boolean;
  error?: string;
}

export interface Safe14RealReportInput {
  handshake: CubaseHandshakeEvidence;
  crashDumps: CrashDumpAudit;
  smokeTests: SmokeResult[];
  commandBindings: CommandResult[];
  directAccessTree: {
    capabilities?: unknown;
    objects?: unknown[];
  };
  directAccessParameters: {
    parameters?: unknown[];
    writeTests?: Array<{
      before?: unknown;
      after?: unknown;
      restoredValue?: unknown;
      writeAccepted?: boolean;
      valueChanged?: boolean;
      restored?: boolean;
    }>;
  };
}

function changed(before: unknown, after: unknown): unknown {
  return {
    changed: JSON.stringify(before) !== JSON.stringify(after),
    before,
    after
  };
}

function recordBase(
  actionKey: string,
  capturedAt: string,
  crashDumpChecked: true
): Omit<
  Safe14Observation,
  "outcome" | "blockerReason" | "constraints" | "method" | "notes" | "artifacts"
> {
  return {
    id: `real:safe14:${actionKey}`,
    actionKey,
    hostProfile: SAFE14_HOST.profile,
    hostProduct: SAFE14_HOST.product,
    hostVersion: SAFE14_HOST.version,
    scriptBuild: SAFE14_HOST.scriptBuild,
    mcpProtocolVersion: SAFE14_HOST.mcpProtocolVersion,
    transportVersion: SAFE14_HOST.transportVersion,
    capturedAt,
    crashDumpChecked
  };
}

export function collectSafe14ReportObservations(
  report: Safe14RealReportInput,
  edition: string | undefined
): Safe14Observation[] {
  const preflight = evaluateSafe14Preflight(report.handshake, { edition });
  if (!preflight.passed) {
    throw new Error(`Cannot collect safe14 evidence from a failed preflight: ${preflight.blockers.map((item) => item.code).join(", ")}`);
  }
  if (!report.crashDumps.checked || !report.crashDumps.passed) {
    throw new Error("Cannot collect safe14 evidence without a successful crash-dump audit.");
  }

  const capturedAt = report.handshake.completedAt;
  const observations = new Map<string, Safe14Observation>();
  const add = (
    actionKey: string,
    outcome: Extract<CapabilityStatus, "real" | "blocked_by_cubase_api" | "blocked_by_no_headless_api">,
    detail: Partial<Safe14Observation> = {},
    blockerReason?: BlockerReason,
    constraints: Record<string, unknown> = {}
  ): void => {
    const parsed = Safe14ObservationSchema.parse({
      ...recordBase(actionKey, capturedAt, true),
      outcome,
      method: "real_hardware",
      blockerReason,
      constraints,
      artifacts: [],
      notes: [`Derived from correlated real Cubase report at ${capturedAt}.`],
      ...detail
    });
    observations.set(actionKey, parsed);
  };

  const payload = report.handshake.response?.payload;
  add("cubase.system.status", "real", {
    stateBefore: payload,
    stateAfter: payload
  });
  add("cubase.system.diagnose", "real", {
    stateBefore: {
      ports: report.handshake.ports,
      routerDiagnostics: report.handshake.routerDiagnostics
    },
    stateAfter: {
      ports: report.handshake.ports,
      routerDiagnostics: report.handshake.routerDiagnostics,
      crashDumps: report.crashDumps
    }
  });
  add(
    "cubase.project.get",
    "blocked_by_cubase_api",
    {},
    "object_not_enumerable",
    { observedProjectFields: ["projectOpen"], completeProjectObject: false }
  );
  add("cubase.transport.get", "real", {
    stateBefore: payload,
    stateAfter: payload
  });

  const smoke = new Map(report.smokeTests.map((item) => [item.name, item]));
  const addRestoredSmoke = (actionKey: string, smokeName: string): void => {
    const item = smoke.get(smokeName);
    if (!item?.passed || item.restored !== true) return;
    add(actionKey, "real", {
      stateBefore: item.before,
      stateAfter: item.after,
      stateDiff: changed(item.before, item.after),
      stateAfterRestore: item.restoredValue,
      restored: true
    }, undefined, { scenario: smokeName });
  };
  addRestoredSmoke("cubase.transport.set_cycle", "transport.cycle");
  addRestoredSmoke("cubase.transport.set_metronome", "transport.metronome");
  addRestoredSmoke("cubase.mixer_channel.set_level", "selected.volume");
  addRestoredSmoke("cubase.mixer_channel.set_pan", "selected.pan");
  addRestoredSmoke("cubase.mixer_channel.set_mute", "selected.mute");
  addRestoredSmoke("cubase.mixer_channel.set_solo", "selected.solo");

  const stopInitial = smoke.get("transport.stop.initial");
  if (stopInitial?.passed) {
    add("cubase.transport.stop", "real", {
      stateBefore: stopInitial.before,
      stateAfter: stopInitial.after,
      stateDiff: changed(stopInitial.before, stopInitial.after),
      stateAfterRestore: stopInitial.after,
      restored: true
    }, undefined, { idempotentCommandAccepted: stopInitial.before === stopInitial.after });
  }
  const play = smoke.get("transport.play");
  const stopFinal = smoke.get("transport.stop.final");
  if (
    play?.passed &&
    stopFinal?.passed &&
    JSON.stringify(play.before) === JSON.stringify(stopFinal.after)
  ) {
    add("cubase.transport.play", "real", {
      stateBefore: play.before,
      stateAfter: play.after,
      stateDiff: changed(play.before, play.after),
      stateAfterRestore: stopFinal.after,
      restored: true
    }, undefined, { restoreScenario: "transport.stop.final" });
  }

  const commandMap: Record<string, string> = {
    "track.add.audio": "cubase.track.create_default_audio",
    "track.add.midi": "cubase.track.create_default_midi",
    "track.add.group": "cubase.track.create_default_group",
    "track.add.folder": "cubase.track.create_default_folder",
    "track.add.marker": "cubase.track.create_default_marker",
    "track.duplicate": "cubase.track.duplicate",
    "track.remove_selected": "cubase.track.delete",
    "midi.quantize": "cubase.midi_transform.quantize",
    "midi.legato": "cubase.midi_transform.legato",
    "midi.fixed_length": "cubase.midi_transform.fixed_length",
    "audio.bounce_selection": "cubase.audio_process.bounce",
    "audio.crossfade": "cubase.audio_event.crossfade",
    "render.current_settings": "cubase.audio_process.render",
    "marker.add_position_selected": "cubase.arrangement.add_marker",
    "marker.add_cycle_selected": "cubase.arrangement.add_cycle_marker"
  };
  for (const command of report.commandBindings) {
    const actionKey = commandMap[command.key];
    if (
      !actionKey ||
      command.result !== "real" ||
      command.executedInAudit !== true ||
      command.restored !== true ||
      command.stateAfterRestore === undefined
    ) continue;
    add(actionKey, "real", {
      stateBefore: command.stateBefore,
      stateAfter: command.stateAfter,
      stateDiff: command.stateDiff ?? changed(command.stateBefore, command.stateAfter),
      stateAfterRestore: command.stateAfterRestore,
      restored: true
    }, undefined, { commandKey: command.key });
  }

  if (report.commandBindings.some((item) => item.bindingCreated)) {
    add("cubase.debug.command.get_registry", "real", {
      stateBefore: report.commandBindings,
      stateAfter: report.commandBindings
    });
  }
  if (report.commandBindings.some((item) => item.canPerformSupported)) {
    add("cubase.debug.command.can_perform", "real", {
      stateBefore: report.commandBindings.map((item) => ({
        key: item.key,
        canPerform: item.canPerform
      })),
      stateAfter: report.commandBindings.map((item) => ({
        key: item.key,
        canPerform: item.canPerform
      }))
    });
  } else {
    add(
      "cubase.debug.command.can_perform",
      "blocked_by_cubase_api",
      {},
      "api_method_missing",
      { featureDetected: false }
    );
  }
  const triggered = report.commandBindings.find((item) =>
    item.result === "real" &&
    item.executedInAudit &&
    item.restored &&
    item.stateAfterRestore !== undefined
  );
  if (triggered) {
    add("cubase.debug.command.trigger", "real", {
      stateBefore: triggered.stateBefore,
      stateAfter: triggered.stateAfter,
      stateDiff: triggered.stateDiff ?? changed(triggered.stateBefore, triggered.stateAfter),
      stateAfterRestore: triggered.stateAfterRestore,
      restored: true
    }, undefined, { commandKey: triggered.key });
  }

  const directObjects = report.directAccessTree.objects ?? [];
  const directParameters = report.directAccessParameters.parameters ?? [];
  if (report.handshake.directAccessAvailable) {
    add("cubase.debug.direct_access.get_capabilities", "real", {
      stateBefore: report.directAccessTree.capabilities,
      stateAfter: report.directAccessTree.capabilities
    });
  } else {
    add(
      "cubase.debug.direct_access.get_capabilities",
      "blocked_by_cubase_api",
      {},
      "api_method_missing",
      { makeDirectAccess: false }
    );
  }
  if (directObjects.length > 0) {
    for (const key of [
      "cubase.debug.direct_access.discover_tree",
      "cubase.debug.direct_access.get_object"
    ]) {
      add(key, "real", {
        stateBefore: directObjects[0],
        stateAfter: directObjects[0]
      });
    }
  } else if (report.handshake.directAccessAvailable) {
    for (const key of [
      "cubase.debug.direct_access.discover_tree",
      "cubase.debug.direct_access.get_object"
    ]) {
      add(key, "blocked_by_cubase_api", {}, "object_not_enumerable");
    }
  }
  if (directParameters.length > 0) {
    for (const key of [
      "cubase.debug.direct_access.get_parameters",
      "cubase.debug.direct_access.get_parameter"
    ]) {
      add(key, "real", {
        stateBefore: directParameters[0],
        stateAfter: directParameters[0]
      });
    }
  } else if (report.handshake.directAccessAvailable) {
    for (const key of [
      "cubase.debug.direct_access.get_parameters",
      "cubase.debug.direct_access.get_parameter"
    ]) {
      add(key, "blocked_by_cubase_api", {}, "object_not_enumerable");
    }
  }
  const directWrite = report.directAccessParameters.writeTests?.find((item) =>
    item.writeAccepted && item.valueChanged && item.restored
  );
  if (directWrite) {
    add("cubase.debug.direct_access.set_parameter", "real", {
      stateBefore: directWrite.before,
      stateAfter: directWrite.after,
      stateDiff: changed(directWrite.before, directWrite.after),
      stateAfterRestore: directWrite.restoredValue,
      restored: true
    });
  }

  return [...observations.values()].sort((left, right) =>
    left.actionKey.localeCompare(right.actionKey)
  );
}
