import { describe, expect, it } from "vitest";
import { defaultCapabilityMatrix } from "../../src/state/CapabilityMatrix.js";

describe("CapabilityMatrix", () => {
  it("does not allow screen automation capabilities", () => {
    expect(() => defaultCapabilityMatrix.assertNoScreenAutomation()).not.toThrow();
    expect(defaultCapabilityMatrix.list().every((capability) => capability.usesScreenAutomation === false)).toBe(true);
  });

  it("does not mark untested full export mixdown as API-blocked", () => {
    const capability = defaultCapabilityMatrix.get("cubase.export_mixdown");
    expect(capability.status).toBe("partial_bridge_required");
    expect(capability.blockerReason).toBe("requires_cubase_side_binary_bridge");
  });

  it("marks current audio export as current-settings command binding", () => {
    const capability = defaultCapabilityMatrix.get("cubase.perform_current_audio_export");
    expect(capability.status).toBe("partial_current_setting_only");
    expect(capability.blockerReason).toBe("requires_existing_export_settings");
  });

  it("does not mark transport play as real before a real evidence run", () => {
    const capability = defaultCapabilityMatrix.get("cubase.transport_play");
    expect(capability.status).toBe("unknown_not_tested");
    expect(capability.testedWithRealCubase).toBe(false);
    expect(capability.blockerReason).toBe("not_tested_yet");
    expect(capability.primaryAdapter).toBe("MidiRemoteAdapter");
  });
});
