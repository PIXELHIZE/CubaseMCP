import { describe, expect, it } from "vitest";
import { isPluginBridgeResponse, makePluginBridgeRequest } from "../../src/bridge/plugin/PluginBridgeProtocol.js";

describe("plugin bridge protocol", () => {
  it("correlates requests and includes an optional redaction-sensitive auth token", () => {
    const request = makePluginBridgeRequest("request-1", "correlation-1", "set_parameter", { value: 0.5 }, "secret");
    expect(request).toMatchObject({
      id: "request-1",
      correlationId: "correlation-1",
      protocol: "cubase-mcp-plugin-bridge",
      version: 1,
      auth: { scheme: "bearer", token: "secret" }
    });
  });

  it("rejects non-protocol response envelopes", () => {
    expect(isPluginBridgeResponse({ protocol: "cubase-mcp-plugin-bridge", version: 1, ok: true, id: "1" })).toBe(true);
    expect(isPluginBridgeResponse({ protocol: "other", version: 1 })).toBe(false);
  });
});
