import { readFile } from "node:fs/promises";
import type { ActionCapability, BlockerReason, CapabilityStatus, HostDescriptor } from "./contracts.js";
import { ActionCapabilitySchema } from "./contracts.js";
import { v2Actions } from "./actionManifest.js";

export interface CapabilityManifest {
  protocolVersion: 2;
  profile: string;
  hostProduct: string;
  hostVersion: string;
  generatedAt: string;
  releaseCertified: boolean;
  actions: ActionCapability[];
}

const serverOnlyActions = new Set([
  "cubase.system.status",
  "cubase.system.capabilities",
  "cubase.system.diagnose",
  "cubase.song.plan"
]);

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
  if (serverOnlyActions.has(key)) {
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
    profile: "safe14",
    hostProduct: "Cubase Pro",
    hostVersion: "14.0.41",
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
    if (manifest.protocolVersion !== 2) throw new Error("Capability manifest protocolVersion must be 2.");
    const expected = new Set(v2Actions.map((action) => action.key));
    const keys = new Set(manifest.actions.map((action) => action.key));
    if (keys.size !== manifest.actions.length) {
      throw new Error("Capability manifest contains duplicate action keys.");
    }
    const missing = [...expected].filter((key) => !keys.has(key));
    const extra = [...keys].filter((key) => !expected.has(key));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(`Capability manifest action mismatch. Missing=${missing.join(",")} Extra=${extra.join(",")}`);
    }
    for (const capability of manifest.actions) ActionCapabilitySchema.parse(capability);
    this.manifests.set(manifest.profile, manifest);
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
    if (!manifest?.releaseCertified || manifest.hostVersion !== host.version) return false;
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
