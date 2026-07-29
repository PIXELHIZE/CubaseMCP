import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CompositeCubaseAdapter } from "../../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../../src/config/cubaseConfig.js";
import { detectHostProfile } from "../../src/v2/HostProfile.js";
import type { HostDescriptor } from "../../src/v2/contracts.js";

const requireReal =
  process.env.CUBASE_REQUIRE_REAL === "true" ||
  process.env.npm_lifecycle_event === "test:real";
const describeReal = requireReal ? describe : describe.skip;

describeReal.sequential("v2 safe14 host contract", () => {
  const adapter = new CompositeCubaseAdapter(loadCubaseConfig(process.env));
  let host: HostDescriptor;

  beforeAll(async () => {
    await adapter.connect();
    host = await detectHostProfile(adapter, "v2-safe14-release-gate", {
      edition: process.env.CUBASE_HOST_EDITION
    });
  }, 30_000);

  afterAll(async () => {
    await adapter.disconnect();
  });

  it("accepts only the exact certified Cubase Pro 14.0.41 target", async () => {
    expect(host).toMatchObject({
      product: "Cubase",
      edition: "Pro",
      version: "14.0.41",
      profile: "safe14",
      mcpProtocolVersion: 2,
      mcpTransportVersion: 1,
      scriptBuild: "2.0.0-safe14"
    });
    expect(host.supportStatus).toBe("unverified_host_profile");
  });

  it("receives the v2 application handshake over transport v1", async () => {
    const state = await adapter.getState();
    expect(state.cubase).toMatchObject({
      connected: true,
      mcpProtocolVersion: 2,
      mcpTransportVersion: 1,
      hostProfile: "safe14",
      scriptBuild: "2.0.0-safe14"
    });
  });
});
