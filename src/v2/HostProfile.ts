import { randomUUID } from "node:crypto";
import type { CubaseAdapter } from "../adapters/CubaseAdapter.js";
import type { HostDescriptor } from "./contracts.js";

function versionFromLabel(label: string): string {
  return label.match(/\d+\.\d+(?:\.\d+)?/)?.[0] ?? "0.0.0";
}

function major(version: string): number {
  return Number(version.split(".")[0] ?? 0);
}

function atLeast(version: string, target: [number, number, number]): boolean {
  const parts = version.split(".").map((part) => Number(part));
  for (let index = 0; index < target.length; index += 1) {
    const value = parts[index] ?? 0;
    if (value > target[index]) return true;
    if (value < target[index]) return false;
  }
  return true;
}

export interface HostProfileHints {
  /**
   * MIDI Remote exposes the application name (Cubase/Nuendo), but not the
   * licensed edition. A release runner may provide an operator-verified
   * edition; absence must remain fail-closed for a Pro-only manifest.
   */
  edition?: string;
  automation14?: boolean;
}

function productFromAppName(appName: string | undefined): string {
  if (/^cubase\b/i.test(appName ?? "")) return "Cubase";
  if (/^nuendo\b/i.test(appName ?? "")) return "Nuendo";
  return "Unknown Steinberg Host";
}

export async function detectHostProfile(
  adapter: CubaseAdapter,
  sessionId: string = randomUUID(),
  hints: HostProfileHints = {
    edition: process.env.CUBASE_HOST_EDITION,
    automation14: process.env.CUBASE_AUTOMATION14 === "1" || process.env.CUBASE_AUTOMATION14 === "true"
  }
): Promise<HostDescriptor> {
  if (adapter.mode === "mock") {
    return {
      product: "Mock Cubase",
      edition: "Test",
      version: "15.0.0",
      midiRemoteApiVersion: "mock-1.3",
      scriptBuild: "mock",
      sessionId,
      supportStatus: "supported_release_profile",
      profile: "mock"
    };
  }

  const state = await adapter.getState();
  const label = state.cubase.version ?? "Unknown Cubase";
  const version = versionFromLabel(label);
  const hostMajor = major(version);
  const product = productFromAppName(state.cubase.appName);
  const edition = /(?:^|\s)pro(?:\s|$)/i.test(state.cubase.appName ?? "") ? "Pro" : hints.edition;
  if (version === "14.0.32" && product === "Cubase" && hints.automation14) {
    return {
      product,
      edition,
      version,
      midiRemoteApiVersion: state.cubase.midiRemoteApiVersion,
      mcpProtocolVersion: state.cubase.mcpProtocolVersion,
      mcpTransportVersion: state.cubase.mcpTransportVersion,
      scriptBuild: state.cubase.scriptBuild,
      sessionId,
      supportStatus: "unverified_host_profile",
      profile: "automation14"
    };
  }
  if (hostMajor === 14 && product === "Cubase") {
    return {
      product,
      edition,
      version,
      midiRemoteApiVersion: state.cubase.midiRemoteApiVersion,
      mcpProtocolVersion: state.cubase.mcpProtocolVersion,
      mcpTransportVersion: state.cubase.mcpTransportVersion,
      scriptBuild: state.cubase.scriptBuild,
      sessionId,
      supportStatus: atLeast(version, [14, 0, 41]) ? "unverified_host_profile" : "unsupported_host_version",
      profile: "safe14"
    };
  }
  if (hostMajor === 15 && product === "Cubase") {
    return {
      product,
      edition,
      version,
      midiRemoteApiVersion: state.cubase.midiRemoteApiVersion,
      mcpProtocolVersion: state.cubase.mcpProtocolVersion,
      mcpTransportVersion: state.cubase.mcpTransportVersion,
      scriptBuild: state.cubase.scriptBuild,
      sessionId,
      supportStatus: "unverified_host_profile",
      profile: "safe15"
    };
  }
  return {
    product,
    edition,
    version,
    midiRemoteApiVersion: state.cubase.midiRemoteApiVersion,
    mcpProtocolVersion: state.cubase.mcpProtocolVersion,
    mcpTransportVersion: state.cubase.mcpTransportVersion,
    sessionId,
    supportStatus: product === "Unknown Steinberg Host" ? "unsupported_host_version" : "unverified_host_profile",
    profile: `unsupported-${product.toLowerCase().replaceAll(" ", "-")}-${hostMajor || "unknown"}`
  };
}
