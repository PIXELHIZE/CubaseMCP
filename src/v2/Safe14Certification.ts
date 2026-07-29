import { z } from "zod/v4";
import {
  CapabilityManifestSchema,
  type CapabilityManifest
} from "./CapabilityRegistry.js";
import {
  EvidenceRecordSchema,
  type EvidenceRecord
} from "./EvidenceMatrix.js";
import {
  BlockerReasonSchema,
  type ActionCapability,
  type BlockerReason,
  type CapabilityStatus
} from "./contracts.js";
import { unitEligibleRealActionKeys } from "./ActionSemantics.js";
import { v2Actions } from "./actionManifest.js";

export const SAFE14_CERTIFICATION_POLICY_VERSION = "safe14-v1";
export const SAFE14_HOST = {
  profile: "safe14",
  product: "Cubase Pro",
  version: "14.0.41",
  scriptBuild: "2.0.0-safe14",
  mcpProtocolVersion: 2,
  transportVersion: 1
} as const;

/**
 * These actions have an official MIDI Remote, DirectAccess, or Command Binding
 * path that must be verified (or explicitly blocked) on real hardware. All
 * other non-unit actions have a reviewed static safe14 blocker.
 */
export const safe14RealObservationActionKeys = new Set([
  "cubase.system.status",
  "cubase.system.diagnose",
  "cubase.project.get",
  "cubase.track.create_default_audio",
  "cubase.track.create_default_midi",
  "cubase.track.create_default_group",
  "cubase.track.create_default_folder",
  "cubase.track.create_default_marker",
  "cubase.track.delete",
  "cubase.track.duplicate",
  "cubase.transport.get",
  "cubase.transport.play",
  "cubase.transport.stop",
  "cubase.transport.pause",
  "cubase.transport.record",
  "cubase.transport.rewind",
  "cubase.transport.forward",
  "cubase.transport.set_cycle",
  "cubase.transport.set_metronome",
  "cubase.mixer_channel.get",
  "cubase.mixer_channel.set_level",
  "cubase.mixer_channel.set_pan",
  "cubase.mixer_channel.set_input_gain",
  "cubase.mixer_channel.set_phase",
  "cubase.mixer_channel.set_mute",
  "cubase.mixer_channel.set_solo",
  "cubase.mixer_channel.set_record_enable",
  "cubase.mixer_channel.set_monitor",
  "cubase.mixer_channel.get_meters",
  "cubase.plugin.list_parameters",
  "cubase.plugin.get_parameter",
  "cubase.plugin.set_parameter",
  "cubase.midi_transform.quantize",
  "cubase.midi_transform.legato",
  "cubase.midi_transform.fixed_length",
  "cubase.audio_event.set_fade",
  "cubase.audio_event.crossfade",
  "cubase.audio_process.render",
  "cubase.audio_process.bounce",
  "cubase.arrangement.add_marker",
  "cubase.arrangement.add_cycle_marker",
  "cubase.export_run.perform_current_settings",
  "cubase.history.undo",
  "cubase.history.redo",
  "cubase.debug.command.get_registry",
  "cubase.debug.command.can_perform",
  "cubase.debug.command.trigger",
  "cubase.debug.direct_access.get_capabilities",
  "cubase.debug.direct_access.discover_tree",
  "cubase.debug.direct_access.get_object",
  "cubase.debug.direct_access.get_parameters",
  "cubase.debug.direct_access.get_parameter",
  "cubase.debug.direct_access.set_parameter"
]);

export const Safe14ObservationSchema = EvidenceRecordSchema.extend({
  blockerReason: BlockerReasonSchema.optional(),
  constraints: z.record(z.string(), z.unknown()).default({})
}).superRefine((observation, context) => {
  if (observation.method !== "real_hardware") {
    context.addIssue({
      code: "custom",
      path: ["method"],
      message: "A safe14 candidate observation must come from real_hardware."
    });
  }
  if (observation.crashDumpChecked !== true) {
    context.addIssue({
      code: "custom",
      path: ["crashDumpChecked"],
      message: "A safe14 candidate observation must include a successful crash-dump check."
    });
  }
  if (observation.outcome === "real" && observation.blockerReason !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["blockerReason"],
      message: "A real observation cannot declare a blockerReason."
    });
  }
  if (observation.outcome !== "real" && observation.blockerReason === undefined) {
    context.addIssue({
      code: "custom",
      path: ["blockerReason"],
      message: "A blocked observation must declare a blockerReason."
    });
  }
});

export type Safe14Observation = z.infer<typeof Safe14ObservationSchema>;

export interface Safe14CertificationBundle {
  manifest: CapabilityManifest;
  evidence: EvidenceRecord[];
  unresolved: string[];
  policyVersion: typeof SAFE14_CERTIFICATION_POLICY_VERSION;
}

interface StaticBlocker {
  status: Extract<CapabilityStatus, "blocked_by_cubase_api" | "blocked_by_no_headless_api">;
  reason: BlockerReason;
  rationale: string;
}

function staticBlockerFor(key: string): StaticBlocker {
  if (
    key === "cubase.song.create" ||
    key === "cubase.song.repair" ||
    key === "cubase.track.create_from_template"
  ) {
    return {
      status: "blocked_by_no_headless_api",
      reason: "requires_track_template",
      rationale: "safe14 cannot pass the complete track-template/instrument configuration through a headless command."
    };
  }
  if (key === "cubase.track.create_default_instrument" || key === "cubase.track.create_default_fx") {
    return {
      status: "blocked_by_no_headless_api",
      reason: "dialog_required",
      rationale: "The default command opens a Cubase dialog and the v2 runtime forbids UI automation."
    };
  }
  if (
    key.startsWith("cubase.project.") ||
    key === "cubase.track.rename" ||
    key === "cubase.plugin.load_preset" ||
    key === "cubase.plugin.set_window"
  ) {
    return {
      status: "blocked_by_no_headless_api",
      reason: /open|save_as|backup|configure|preset/i.test(key)
        ? "path_not_headless_configurable"
        : "dialog_required",
      rationale: "The official safe14 path requires a host dialog or cannot carry the requested path/parameters."
    };
  }
  if (key.startsWith("cubase.export_config.")) {
    return {
      status: "blocked_by_no_headless_api",
      reason: key.endsWith(".get") ? "object_not_enumerable" : "path_not_headless_configurable",
      rationale: "MIDI Remote and Command Binding do not expose parameterized Audio Export configuration."
    };
  }
  if (key.startsWith("cubase.export_run.")) {
    return {
      status: "blocked_by_no_headless_api",
      reason: "requires_existing_export_settings",
      rationale: "This mode cannot be executed with explicit headless settings on safe14."
    };
  }
  if (
    key.startsWith("cubase.midi_transform.") ||
    key.startsWith("cubase.audio_process.") ||
    key.startsWith("cubase.audio_event.") ||
    key.startsWith("cubase.arrangement.")
  ) {
    return {
      status: "blocked_by_no_headless_api",
      reason: "requires_existing_selection",
      rationale: "The available command is selection-dependent and cannot address the action contract's explicit target."
    };
  }
  if (key.startsWith("cubase.plugin.")) {
    return {
      status: "blocked_by_cubase_api",
      reason: "api_method_missing",
      rationale: "safe14 MIDI Remote API 1.2 does not expose this complete plugin-management operation."
    };
  }
  if (
    key.startsWith("cubase.track.") ||
    key.startsWith("cubase.midi_part.") ||
    key.startsWith("cubase.midi_edit.") ||
    key.startsWith("cubase.tempo.") ||
    key.startsWith("cubase.chord.") ||
    key.startsWith("cubase.automation.") ||
    key.startsWith("cubase.media.") ||
    key.startsWith("cubase.mixer_")
  ) {
    return {
      status: "blocked_by_cubase_api",
      reason: "api_method_missing",
      rationale: "No official safe14 API method implements this parameterized project operation."
    };
  }
  if (key.startsWith("cubase.song.")) {
    return {
      status: "blocked_by_cubase_api",
      reason: "api_method_missing",
      rationale: "This song lifecycle operation cannot be completed without the blocked project operation it depends on."
    };
  }
  return {
    status: "blocked_by_cubase_api",
    reason: "api_method_missing",
    rationale: "No verified official safe14 route implements this action contract."
  };
}

function evidenceBase(
  id: string,
  actionKey: string,
  capturedAt: string
): Pick<
  EvidenceRecord,
  | "id"
  | "actionKey"
  | "hostProfile"
  | "hostProduct"
  | "hostVersion"
  | "scriptBuild"
  | "mcpProtocolVersion"
  | "transportVersion"
  | "capturedAt"
  | "artifacts"
  | "notes"
> {
  return {
    id,
    actionKey,
    hostProfile: SAFE14_HOST.profile,
    hostProduct: SAFE14_HOST.product,
    hostVersion: SAFE14_HOST.version,
    scriptBuild: SAFE14_HOST.scriptBuild,
    mcpProtocolVersion: SAFE14_HOST.mcpProtocolVersion,
    transportVersion: SAFE14_HOST.transportVersion,
    capturedAt,
    artifacts: [],
    notes: []
  };
}

function capabilityFromObservation(observation: Safe14Observation): ActionCapability {
  return {
    key: observation.actionKey,
    profile: SAFE14_HOST.profile,
    status: observation.outcome,
    blockerReason: observation.blockerReason,
    constraints: {
      ...observation.constraints,
      certificationPolicy: SAFE14_CERTIFICATION_POLICY_VERSION
    },
    evidenceId: observation.id,
    verifiedAt: observation.capturedAt
  };
}

export function assembleSafe14Certification(
  rawObservations: Safe14Observation[],
  generatedAt = new Date().toISOString()
): Safe14CertificationBundle {
  const observations = new Map<string, Safe14Observation>();
  for (const raw of rawObservations) {
    const observation = Safe14ObservationSchema.parse(raw);
    if (!safe14RealObservationActionKeys.has(observation.actionKey)) {
      throw new Error(`Observation is not a safe14 real-hardware candidate: ${observation.actionKey}`);
    }
    if (
      observation.hostProfile !== SAFE14_HOST.profile ||
      observation.hostProduct !== SAFE14_HOST.product ||
      observation.hostVersion !== SAFE14_HOST.version ||
      observation.scriptBuild !== SAFE14_HOST.scriptBuild ||
      observation.mcpProtocolVersion !== SAFE14_HOST.mcpProtocolVersion ||
      observation.transportVersion !== SAFE14_HOST.transportVersion
    ) {
      throw new Error(`Observation host contract mismatch: ${observation.actionKey}`);
    }
    if (observations.has(observation.actionKey)) {
      throw new Error(`Duplicate safe14 observation: ${observation.actionKey}`);
    }
    observations.set(observation.actionKey, observation);
  }

  const evidence: EvidenceRecord[] = [];
  const actions: ActionCapability[] = [];
  const unresolved: string[] = [];
  for (const action of v2Actions) {
    const key = action.key;
    if (unitEligibleRealActionKeys.has(key)) {
      const id = `unit:safe14:${key}`;
      evidence.push(EvidenceRecordSchema.parse({
        ...evidenceBase(id, key, generatedAt),
        outcome: "real",
        method: "unit",
        notes: ["Server-side action contract is covered by the v2 unit/contract suite."]
      }));
      actions.push({
        key,
        profile: SAFE14_HOST.profile,
        status: "real",
        constraints: {
          serverSide: true,
          certificationPolicy: SAFE14_CERTIFICATION_POLICY_VERSION
        },
        evidenceId: id,
        verifiedAt: generatedAt
      });
      continue;
    }

    if (safe14RealObservationActionKeys.has(key)) {
      const observation = observations.get(key);
      if (observation) {
        evidence.push(EvidenceRecordSchema.parse(observation));
        actions.push(capabilityFromObservation(observation));
      } else {
        unresolved.push(key);
        actions.push({
          key,
          profile: SAFE14_HOST.profile,
          status: "unsupported_release_profile",
          blockerReason: "api_method_missing",
          constraints: {
            pendingRealHardwareObservation: true,
            certificationPolicy: SAFE14_CERTIFICATION_POLICY_VERSION
          },
          evidenceId: `pending:safe14:${key}`
        });
      }
      continue;
    }

    const blocker = staticBlockerFor(key);
    const id = `static:safe14:${key}`;
    evidence.push(EvidenceRecordSchema.parse({
      ...evidenceBase(id, key, generatedAt),
      outcome: blocker.status,
      method: "static_api_analysis",
      notes: [
        blocker.rationale,
        `Blocker reason: ${blocker.reason}.`,
        `Policy: ${SAFE14_CERTIFICATION_POLICY_VERSION}.`
      ]
    }));
    actions.push({
      key,
      profile: SAFE14_HOST.profile,
      status: blocker.status,
      blockerReason: blocker.reason,
      constraints: {
        rationale: blocker.rationale,
        certificationPolicy: SAFE14_CERTIFICATION_POLICY_VERSION
      },
      evidenceId: id,
      verifiedAt: generatedAt
    });
  }

  const manifest = CapabilityManifestSchema.parse({
    protocolVersion: SAFE14_HOST.mcpProtocolVersion,
    transportVersion: SAFE14_HOST.transportVersion,
    profile: SAFE14_HOST.profile,
    hostProduct: SAFE14_HOST.product,
    hostVersion: SAFE14_HOST.version,
    scriptBuild: SAFE14_HOST.scriptBuild,
    generatedAt,
    releaseCertified: unresolved.length === 0,
    actions
  });
  return {
    manifest,
    evidence,
    unresolved,
    policyVersion: SAFE14_CERTIFICATION_POLICY_VERSION
  };
}
