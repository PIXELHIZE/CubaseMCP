import { describe, expect, it } from "vitest";
import { PluginBridgeClient } from "../../src/bridge/plugin/PluginBridgeClient.js";
import { ErrorCode } from "../../src/safety/ErrorCodes.js";

describe("error mapping", () => {
  it("returns a machine-readable bridge requirement when all transports are disabled", async () => {
    const client = new PluginBridgeClient(undefined, {
      enabled: false,
      pipeName: "unused",
      timeoutMs: 100,
      fallbackToMidiRemote: false
    });
    await expect(client.request("list_parameters", {})).rejects.toMatchObject({
      code: ErrorCode.NeedsCubaseSideBridge,
      retryable: true
    });
  });
});
