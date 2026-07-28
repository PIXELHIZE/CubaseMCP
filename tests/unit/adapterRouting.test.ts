import { describe, expect, it } from "vitest";
import { CompositeCubaseAdapter } from "../../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../../src/config/cubaseConfig.js";
import { toolDefinitions } from "../../src/tools/index.js";

describe("CompositeCubaseAdapter routing", () => {
  it("returns dry-run preview without opening MIDI ports", async () => {
    const adapter = new CompositeCubaseAdapter(loadCubaseConfig({ CUBASE_ADAPTER: "composite" } as NodeJS.ProcessEnv));
    const result = await adapter.execute(
      "transportPlay",
      { dryRun: true },
      { requestId: "test", toolName: "cubase.transport_play", dryRun: true }
    );

    expect(result.changed).toBe(false);
    expect(result.preview).toMatchObject({ adapter: "MIDI Remote Adapter", usesScreenAutomation: false });
  });

  it("provides a screen-free dry-run route for every registered operation", async () => {
    const adapter = new CompositeCubaseAdapter(loadCubaseConfig({ CUBASE_ADAPTER: "composite" } as NodeJS.ProcessEnv));
    for (const definition of toolDefinitions) {
      const result = await adapter.execute(
        definition.operation,
        {},
        { requestId: `route-${definition.operation}`, correlationId: `route-${definition.operation}`, toolName: definition.name, dryRun: true, timeoutMs: 1000 }
      );
      expect(result.changed, definition.name).toBe(false);
      expect(result.preview, definition.name).toMatchObject({ usesScreenAutomation: false });
    }
  });
});
