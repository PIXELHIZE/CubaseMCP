import { describe, expect, it } from "vitest";
import { CompositeCubaseAdapter } from "../../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../../src/config/cubaseConfig.js";
import { CubaseMcpError } from "../../src/safety/ErrorCodes.js";

const requireReal = process.env.CUBASE_REQUIRE_REAL === "true" || process.env.npm_lifecycle_event === "test:real";
const skipReal = process.env.SKIP_REAL_CUBASE_TESTS !== "false" && !requireReal;
const describeReal = skipReal ? describe.skip : describe;

async function withAdapter<T>(fn: (adapter: CompositeCubaseAdapter) => Promise<T>): Promise<T> {
  const adapter = new CompositeCubaseAdapter(loadCubaseConfig(process.env));
  try {
    await adapter.connect();
    return await fn(adapter);
  } finally {
    await adapter.disconnect().catch(() => undefined);
  }
}

describeReal("DirectAccess real Cubase bridge", () => {
  it("feature-detects DirectAccess capabilities", async () => {
    await withAdapter(async (adapter) => {
      try {
        const result = await adapter.execute("directAccessGetCapabilities", {}, {
          requestId: "real-da-capabilities",
          toolName: "cubase.direct_access_get_capabilities",
          dryRun: false
        });
        expect(result.changed).toBe(false);
        expect(result.data).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(CubaseMcpError);
        expect((error as CubaseMcpError).code).toBe("CAPABILITY_UNSUPPORTED");
        expect((error as Error).message).toMatch(/command-surface-only|DirectAccess/i);
      }
    });
  }, 15000);

  it("discovers trackSelection or returns an explicit feature blocker", async () => {
    await withAdapter(async (adapter) => {
      try {
        const result = await adapter.execute("directAccessDiscoverObjectTree", { root: "trackSelection" }, {
          requestId: "real-da-track-tree",
          toolName: "cubase.direct_access_discover_object_tree",
          dryRun: false
        });
        expect(result.data).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(CubaseMcpError);
        expect((error as CubaseMcpError).code).toBe("CAPABILITY_UNSUPPORTED");
      }
    });
  }, 15000);

  it("returns command binding registry with canPerform data", async () => {
    await withAdapter(async (adapter) => {
      const result = await adapter.execute("commandBindingGetRegistry", {}, {
        requestId: "real-command-registry",
        toolName: "cubase.command_binding_get_registry",
        dryRun: false
      });
      expect(result.data).toBeDefined();
    });
  }, 15000);
});
