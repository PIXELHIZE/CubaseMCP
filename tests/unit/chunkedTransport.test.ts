import { describe, expect, it } from "vitest";
import { makeProtocolMessage } from "../../src/bridge/midi/CubaseMidiProtocol.js";
import { ChunkedSysexTransport } from "../../src/bridge/midi/ChunkedSysexTransport.js";

describe("ChunkedSysexTransport", () => {
  it("reassembles a large response through the transport facade", () => {
    const sender = new ChunkedSysexTransport(512, 5000);
    const receiver = new ChunkedSysexTransport(512, 5000);
    const message = makeProtocolMessage("response", { id: "tree", command: "direct_access", payload: { values: "x".repeat(20_000) } });
    const frames = sender.encode(message);
    const results = frames.map((frame) => receiver.decode(frame));
    expect(frames.length).toBeGreaterThan(1);
    expect(results.at(-1)).toEqual({ kind: "message", message });
    expect(receiver.diagnostics().completedTransfers).toBe(1);
  });

  it("rejects payloads above the configured logical limit", () => {
    const transport = new ChunkedSysexTransport(512, 5000, 1024);
    const message = makeProtocolMessage("response", { id: "too-large", command: "direct_access", payload: { values: "x".repeat(2000) } });
    expect(() => transport.encode(message)).toThrow(/configured maximum/);
  });
});
