import { describe, expect, it } from "vitest";
import { makeProtocolMessage } from "../../src/bridge/midi/CubaseMidiProtocol.js";
import { encodeSysexFrames, encodeSysexMessage } from "../../src/bridge/midi/MessageEncoder.js";
import { decodeSysexFrame, decodeSysexMessage, SysexChunkAssembler } from "../../src/bridge/midi/MessageDecoder.js";

describe("MIDI protocol", () => {
  it("encodes and decodes AIMCP SysEx messages", () => {
    const message = makeProtocolMessage("request", {
      id: "request-1",
      command: "ping",
      payload: { hello: "world" }
    });

    const encoded = encodeSysexMessage(message);
    const decoded = decodeSysexMessage(encoded);

    expect(encoded[0]).toBe(0xf0);
    expect(encoded[1]).toBe(0x7d);
    expect(encoded.at(-1)).toBe(0xf7);
    expect(decoded?.id).toBe("request-1");
    expect(decoded?.command).toBe("ping");
  });

  it("chunks and reassembles large responses out of order", () => {
    const message = makeProtocolMessage("response", {
      id: "large-response",
      command: "direct_access",
      ok: true,
      payload: { tree: "x".repeat(12_000) }
    });
    const frames = encodeSysexFrames(message, 512);
    const assembler = new SysexChunkAssembler(5000);
    let assembled;
    for (const bytes of [...frames].reverse()) {
      const frame = decodeSysexFrame(bytes);
      expect(frame?.kind).toBe("chunk");
      if (frame?.kind === "chunk") assembled = assembler.accept(frame.chunk) ?? assembled;
    }
    expect(frames.length).toBeGreaterThan(1);
    expect(assembled).toEqual(message);
    expect(assembler.snapshot().completedTransfers).toBe(1);
  });

  it("ignores identical duplicate chunks and recovers malformed JSON", () => {
    const message = makeProtocolMessage("response", {
      id: "duplicate-response",
      command: "direct_access",
      payload: { tree: "x".repeat(4000) }
    });
    const frames = encodeSysexFrames(message, 512);
    const first = decodeSysexFrame(frames[0]);
    const assembler = new SysexChunkAssembler(5000);
    if (first?.kind !== "chunk") throw new Error("Expected chunk frame");
    assembler.accept(first.chunk);
    assembler.accept(first.chunk);
    expect(assembler.snapshot().duplicateChunks).toBe(1);

    const malformedText = "AIMCP1:{not-json";
    const malformed = [0xf0, 0x7d, ...[...malformedText].map((character) => character.charCodeAt(0)), 0xf7];
    expect(decodeSysexFrame(malformed)?.kind).toBe("malformed");
    expect(decodeSysexMessage(malformed)).toBeUndefined();
  });
});
