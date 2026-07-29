import { describe, expect, it } from "vitest";
import type { CubaseAdapter } from "../../src/adapters/CubaseAdapter.js";
import type { CubaseState } from "../../src/schemas/state.js";
import { detectHostProfile } from "../../src/v2/HostProfile.js";

function hostAdapter(appName: string | undefined, version: string): CubaseAdapter {
  return {
    mode: "composite",
    getState: async () => ({
      cubase: {
        connected: true,
        appName,
        version,
        midiRemoteApiVersion: "1.2_feature_detected",
        mcpProtocolVersion: 2,
        mcpTransportVersion: 1,
        hostProfile: "safe14",
        scriptBuild: "2.0.0-safe14",
        directAccessAvailable: true,
        projectOpen: true
      }
    } as CubaseState)
  } as CubaseAdapter;
}

describe("host profile detection", () => {
  it("uses the official app name and an explicit edition attestation", async () => {
    await expect(detectHostProfile(
      hostAdapter("Cubase", "14.0.41"),
      "safe14-session",
      { edition: "Pro" }
    )).resolves.toMatchObject({
      product: "Cubase",
      edition: "Pro",
      version: "14.0.41",
      profile: "safe14",
      supportStatus: "unverified_host_profile"
    });
  });

  it("does not classify Nuendo 14 as the Cubase safe14 profile", async () => {
    await expect(detectHostProfile(
      hostAdapter("Nuendo", "14.0.41"),
      "nuendo-session",
      { edition: "Pro" }
    )).resolves.toMatchObject({
      product: "Nuendo",
      profile: "unsupported-nuendo-14",
      supportStatus: "unverified_host_profile"
    });
  });

  it("fails closed when a legacy bridge reports only a version string", async () => {
    const host = await detectHostProfile(
      hostAdapter(undefined, "14.0.41"),
      "legacy-session",
      {}
    );

    expect(host).toMatchObject({
      product: "Unknown Steinberg Host",
      profile: "unsupported-unknown-steinberg-host-14",
      supportStatus: "unsupported_host_version"
    });
    expect(host.edition).toBeUndefined();
  });
});
