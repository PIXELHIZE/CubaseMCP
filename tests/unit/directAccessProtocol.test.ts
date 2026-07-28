import { describe, expect, it } from "vitest";
import { makeDirectAccessEnvelope, isDirectAccessResponse, type DirectAccessRequest, type DirectAccessResponse } from "../../src/bridge/midi/DirectAccessProtocol.js";

describe("DirectAccessProtocol", () => {
  it("creates structured DirectAccess request envelopes", () => {
    const envelope = makeDirectAccessEnvelope("req-1", {
      type: "DA_DISCOVER_OBJECT_TREE",
      root: "mixConsole"
    });

    expect(envelope.requestId).toBe("req-1");
    expect(envelope.request).toEqual({ type: "DA_DISCOVER_OBJECT_TREE", root: "mixConsole" });
  });

  it("recognizes structured DirectAccess responses", () => {
    const response: DirectAccessResponse = {
      ok: true,
      requestId: "req-1",
      data: { apiVersion: "15.0.20" }
    };

    expect(isDirectAccessResponse(response)).toBe(true);
    expect(isDirectAccessResponse({ ok: true })).toBe(false);
  });

  it("supports feature-detected plugin slot reset requests", () => {
    const request: DirectAccessRequest = { type: "DA_RESET_SLOT_PLUGIN", pluginSlotObjectId: 1234 };
    expect(makeDirectAccessEnvelope("reset-1", request).request).toEqual(request);
  });
});
