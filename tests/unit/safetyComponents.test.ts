import { describe, expect, it } from "vitest";
import { DryRunPlanner } from "../../src/safety/DryRunPlanner.js";
import { DestructiveActionGuard } from "../../src/safety/DestructiveActionGuard.js";
import { defaultCapabilityMatrix } from "../../src/state/CapabilityMatrix.js";
import { getToolDefinition } from "../../src/tools/index.js";
import { ErrorCode } from "../../src/safety/ErrorCodes.js";

describe("safety components", () => {
  it("creates an affected-object dry-run plan", () => {
    const definition = getToolDefinition("cubase.delete_track");
    const plan = new DryRunPlanner().plan(definition, { trackIds: ["track-1"] }, defaultCapabilityMatrix.get(definition.name));
    expect(plan.destructive).toBe(true);
    expect(plan.confirmationRequired).toBe(true);
    expect(plan.affectedObjects).toContainEqual({ field: "trackIds", value: ["track-1"] });
  });

  it("rejects unconfirmed destructive execution", () => {
    const definition = getToolDefinition("cubase.delete_track");
    expect(() => new DestructiveActionGuard().assertAllowed(definition, { trackIds: ["track-1"] }, false, false, { affected: 1 }))
      .toThrow(expect.objectContaining({ code: ErrorCode.ConfirmationRequired }));
  });
});
