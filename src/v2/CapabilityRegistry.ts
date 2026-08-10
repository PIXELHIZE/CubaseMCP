import { readFile } from "node:fs/promises";
import { z } from "zod/v4";
import type { ActionCapability, BlockerReason, CapabilityStatus, HostDescriptor } from "./contracts.js";
import { ActionCapabilitySchema } from "./contracts.js";
import { v2Actions } from "./actionManifest.js";
import { unitEligibleRealActionKeys } from "./ActionSemantics.js";

export const CapabilityManifestSchema = z.object({
  protocolVersion: z.literal(2),
  transportVersion: z.literal(1),
  profile: z.string().min(1),
  hostProduct: z.string().min(1),
  hostVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  scriptBuild: z.string().min(1),
  generatedAt: z.string().datetime(),
  releaseCertified: z.boolean(),
  actions: z.array(ActionCapabilitySchema)
});

export type CapabilityManifest = z.infer<typeof CapabilityManifestSchema>;

const runtimeDiagnosticActionKeys = new Set([
  "cubase.system.status",
  "cubase.system.diagnose"
]);

const automation14RealActionKeys = new Set([
  "cubase.system.status",
  "cubase.system.capabilities",
  "cubase.system.diagnose",
  "cubase.project.create",
  "cubase.song.program_catalog",
  "cubase.song.plan",
  "cubase.song.create",
  "cubase.song.validate",
  "cubase.song.describe",
  "cubase.export_run.perform_current_settings"
]);

function automation14Capability(host: HostDescriptor, key: string): ActionCapability {
  if (automation14RealActionKeys.has(key)) {
    return {
      key,
      profile: "automation14",
      status: "real",
      constraints: {
        nonOfficialControlPath: true,
        requiresInteractiveDesktop: true,
        releaseCertified: false,
        testedHostVersion: "14.0.32",
        requiredPrimaryDisplay: "2560x1080",
        ...(key === "cubase.song.create" ? {
          requiresEmptySavedProject: true,
          requiresRollbackOnFailureFalse: true,
          instrumentPlugin: "HALion Sonic"
        } : key === "cubase.project.create" ? {
          emptyTemplateOnly: true,
          refusesOverwrite: true,
          defaultDirectory: "Documents/Cubase Projects"
        } : key === "cubase.export_run.perform_current_settings" ? {
          requiresExactlyOneExpectedWav: true,
          configuresExportDialog: true,
          realtimeExportDefault: true,
          masterGainDbDefault: -3.2,
          requiresGenerated11TrackRecipe: true
        } : {}),
        observedHostVersion: host.version
      },
      evidenceId: key === "cubase.song.create"
        ? "real:automation14:instrument-midi-recording:2026-08-10"
        : key === "cubase.project.create"
          ? "real:automation14:empty-project-create:2026-08-10"
          : key === "cubase.export_run.perform_current_settings"
            ? "real:automation14:realtime-wav-export:2026-08-10"
            : "runtime:automation14-profile",
      verifiedAt: new Date().toISOString()
    };
  }
  return {
    key,
    profile: "automation14",
    status: "blocked_by_no_headless_api",
    blockerReason: "dialog_required",
    constraints: {
      nonOfficialControlPath: true,
      actionNotImplementedByAutomation14: true,
      releaseCertified: false
    },
    evidenceId: `blocked:automation14:${key}`
  };
}

function runtimeDiagnosticCapability(host: HostDescriptor, key: string): ActionCapability | undefined {
  if (
    !runtimeDiagnosticActionKeys.has(key) ||
    host.product !== "Cubase" ||
    host.mcpProtocolVersion !== 2 ||
    host.mcpTransportVersion !== 1 ||
    host.scriptBuild !== "2.0.0-safe14"
  ) return undefined;
  return {
    key,
    profile: host.profile,
    status: "real",
    constraints: {
      bootstrapDiagnostic: true,
      releaseCertified: false,
      observedHostVersion: host.version
    },
    evidenceId: `runtime:host-handshake:${host.sessionId}`,
    verifiedAt: new Date().toISOString()
  };
}

function blockerFor(key: string): BlockerReason {
  if (key === "cubase.song.create" || key === "cubase.song.repair" || key.includes("create_from_template")) {
    return "requires_track_template";
  }
  if (key.startsWith("cubase.export_config.set_path") || key.includes("mixdown_explicit")) {
    return "path_not_headless_configurable";
  }
  if (key.startsWith("cubase.export_")) return "requires_existing_export_settings";
  if (key.startsWith("cubase.debug.direct_access") || key.startsWith("cubase.mixer_") || key.startsWith("cubase.plugin")) {
    return "host_crash_reproduced";
  }
  if (key.includes("create_parameterized") || key.includes("rename")) return "command_has_no_parameters";
  if (key.includes("default_instrument") || key.includes("default_fx")) return "dialog_required";
  if (key.startsWith("cubase.track") || key.startsWith("cubase.midi_") || key.startsWith("cubase.audio_")) {
    return "api_method_missing";
  }
  return "api_method_missing";
}

function pendingSafe14Capability(key: string): ActionCapability {
  if (unitEligibleRealActionKeys.has(key)) {
    return {
      key,
      profile: "safe14",
      status: "real",
      constraints: { serverSide: true },
      evidenceId: "unit:v2-server-contract",
      verifiedAt: new Date(0).toISOString()
    };
  }
  return {
    key,
    profile: "safe14",
    status: "unsupported_release_profile",
    blockerReason: blockerFor(key),
    constraints: {
      pendingRealEvidence: true,
      targetHost: "Cubase Pro 14.0.41"
    },
    evidenceId: `pending:safe14:${key}`
  };
}

export function makePendingSafe14Manifest(): CapabilityManifest {
  return {
    protocolVersion: 2,
    transportVersion: 1,
    profile: "safe14",
    hostProduct: "Cubase Pro",
    hostVersion: "14.0.41",
    scriptBuild: "2.0.0-safe14",
    generatedAt: new Date(0).toISOString(),
    releaseCertified: false,
    actions: v2Actions.map((action) => pendingSafe14Capability(action.key))
  };
}

export class CapabilityRegistry {
  private readonly manifests = new Map<string, CapabilityManifest>();

  constructor(manifests: CapabilityManifest[] = []) {
    for (const manifest of manifests) this.addManifest(manifest);
  }

  addManifest(manifest: CapabilityManifest): void {
    const parsed = CapabilityManifestSchema.parse(manifest);
    const expected = new Set(v2Actions.map((action) => action.key));
    const keys = new Set(parsed.actions.map((action) => action.key));
    if (keys.size !== parsed.actions.length) {
      throw new Error("Capability manifest contains duplicate action keys.");
    }
    const missing = [...expected].filter((key) => !keys.has(key));
    const extra = [...keys].filter((key) => !expected.has(key));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(`Capability manifest action mismatch. Missing=${missing.join(",")} Extra=${extra.join(",")}`);
    }
    const wrongProfiles = parsed.actions.filter((capability) => capability.profile !== parsed.profile);
    if (wrongProfiles.length > 0) {
      throw new Error(`Capability profile mismatch: ${wrongProfiles.map((item) => item.key).join(",")}`);
    }
    this.manifests.set(parsed.profile, parsed);
  }

  async loadManifest(path: string): Promise<void> {
    const parsed = JSON.parse(await readFile(path, "utf8")) as CapabilityManifest;
    this.addManifest(parsed);
  }

  resolve(host: HostDescriptor, key: string): ActionCapability {
    if (host.profile === "mock") {
      if (key === "cubase.batch.execute") {
        return {
          key,
          profile: "mock",
          status: "blocked_by_cubase_api",
          blockerReason: "api_method_missing",
          constraints: { testOnly: true, nestedPreflightRequired: true },
          evidenceId: "test:mock-batch-preflight"
        };
      }
      return {
        key,
        profile: "mock",
        status: "real",
        constraints: { testOnly: true },
        evidenceId: "test:mock-adapter",
        verifiedAt: new Date(0).toISOString()
      };
    }
    if (host.profile === "automation14") return automation14Capability(host, key);
    const diagnostic = runtimeDiagnosticCapability(host, key);
    if (diagnostic) return diagnostic;
    const manifest = this.manifests.get(host.profile);
    if (manifest?.releaseCertified && this.isCertifiedHost(host)) {
      const capability = manifest.actions.find((candidate) => candidate.key === key);
      if (capability) return capability;
    }
    if (host.profile === "safe14") return pendingSafe14Capability(key);
    return {
      key,
      profile: host.profile,
      status: "unsupported_release_profile",
      blockerReason: "api_method_missing",
      constraints: { hostSupportStatus: host.supportStatus },
      evidenceId: `pending:${host.profile}:${key}`
    };
  }

  list(host: HostDescriptor): ActionCapability[] {
    return v2Actions.map((action) => this.resolve(host, action.key));
  }

  hasCertifiedProfile(profile: string): boolean {
    return this.manifests.get(profile)?.releaseCertified === true;
  }

  isCertifiedHost(host: HostDescriptor): boolean {
    const manifest = this.manifests.get(host.profile);
    if (
      !manifest?.releaseCertified ||
      manifest.hostVersion !== host.version ||
      manifest.scriptBuild !== host.scriptBuild ||
      host.mcpProtocolVersion !== 2 ||
      host.mcpTransportVersion !== 1 ||
      host.supportStatus === "unsupported_host_version"
    ) return false;
    const actualProduct = `${host.product} ${host.edition ?? ""}`.trim().toLowerCase();
    return actualProduct === manifest.hostProduct.trim().toLowerCase();
  }

  releaseAudit(profile: string): {
    releasable: boolean;
    total: number;
    real: number;
    blocked: number;
    pending: string[];
  } {
    const manifest = this.manifests.get(profile);
    if (!manifest || !manifest.releaseCertified) {
      return { releasable: false, total: v2Actions.length, real: 0, blocked: 0, pending: v2Actions.map((action) => action.key) };
    }
    const pending = manifest.actions
      .filter((capability) =>
        capability.status === "unsupported_release_profile" ||
        !capability.evidenceId ||
        capability.evidenceId.startsWith("pending:")
      )
      .map((capability) => capability.key);
    return {
      releasable: pending.length === 0,
      total: manifest.actions.length,
      real: manifest.actions.filter((capability) => capability.status === "real").length,
      blocked: manifest.actions.filter((capability) => capability.status.startsWith("blocked_")).length,
      pending
    };
  }
}

export function makeCapability(
  key: string,
  profile: string,
  status: CapabilityStatus,
  evidenceId: string,
  blockerReason?: BlockerReason,
  constraints: Record<string, unknown> = {}
): ActionCapability {
  return ActionCapabilitySchema.parse({
    key,
    profile,
    status,
    evidenceId,
    blockerReason,
    constraints
  });
}
