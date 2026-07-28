import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import requiredTools from "../fixtures/required-tools.json" with { type: "json" };
import { toolDefinitions } from "../../src/tools/index.js";
import { defaultCapabilityMatrix } from "../../src/state/CapabilityMatrix.js";

describe("objective tool coverage", () => {
  it("registers every required tool exactly once", () => {
    const names = toolDefinitions.map((definition) => definition.name);
    expect(new Set(names).size).toBe(names.length);
    expect(requiredTools.filter((name) => !names.includes(name))).toEqual([]);
  });

  it("provides common schema fields and capability metadata for every tool", () => {
    for (const definition of toolDefinitions) {
      expect(definition.inputSchema).toHaveProperty("dryRun");
      expect(definition.inputSchema).toHaveProperty("confirm");
      expect(definition.inputSchema).toHaveProperty("timeoutMs");
      expect(definition.inputSchema).toHaveProperty("correlationId");
      expect(() => z.object(definition.inputSchema)).not.toThrow();
      const capability = defaultCapabilityMatrix.get(definition.name);
      expect(capability.toolName).toBe(definition.name);
      expect(capability.usesScreenAutomation).toBe(false);
      if (!capability.testedWithRealCubase) expect(capability.status).not.toBe("real");
    }
  });
});
