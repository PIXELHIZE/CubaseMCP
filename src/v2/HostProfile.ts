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

export async function detectHostProfile(adapter: CubaseAdapter, sessionId: string = randomUUID()): Promise<HostDescriptor> {
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
  if (hostMajor === 14) {
    return {
      product: "Cubase",
      edition: /pro/i.test(label) ? "Pro" : undefined,
      version,
      midiRemoteApiVersion: state.cubase.midiRemoteApiVersion,
      scriptBuild: state.cubase.scriptBuild,
      sessionId,
      supportStatus: atLeast(version, [14, 0, 41]) ? "unverified_host_profile" : "unsupported_host_version",
      profile: "safe14"
    };
  }
  if (hostMajor === 15) {
    return {
      product: "Cubase",
      edition: /pro/i.test(label) ? "Pro" : undefined,
      version,
      midiRemoteApiVersion: state.cubase.midiRemoteApiVersion,
      scriptBuild: state.cubase.scriptBuild,
      sessionId,
      supportStatus: "unverified_host_profile",
      profile: "safe15"
    };
  }
  return {
    product: "Cubase",
    version,
    midiRemoteApiVersion: state.cubase.midiRemoteApiVersion,
    sessionId,
    supportStatus: "unsupported_host_version",
    profile: `unsupported-${hostMajor || "unknown"}`
  };
}
