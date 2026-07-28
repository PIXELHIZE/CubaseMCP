import type { CubaseMidiProtocolMessage } from "./CubaseMidiProtocol.js";
import { decodeSysexFrame, SysexChunkAssembler, type ChunkAssemblerDiagnostics } from "./MessageDecoder.js";
import { encodeSysexFrames } from "./MessageEncoder.js";

export type ChunkedDecodeResult =
  | { kind: "message"; message: CubaseMidiProtocolMessage }
  | { kind: "pending" }
  | { kind: "unrelated" }
  | { kind: "malformed"; error: string };

export class ChunkedSysexTransport {
  private readonly assembler: SysexChunkAssembler;

  constructor(
    private readonly maximumFrameBytes = 1024,
    chunkTimeoutMs = 5000,
    private readonly maximumPayloadBytes = 4 * 1024 * 1024
  ) {
    this.assembler = new SysexChunkAssembler(chunkTimeoutMs, maximumPayloadBytes);
  }

  encode(message: CubaseMidiProtocolMessage): number[][] {
    return encodeSysexFrames(message, this.maximumFrameBytes, this.maximumPayloadBytes);
  }

  decode(bytes: number[]): ChunkedDecodeResult {
    const frame = decodeSysexFrame(bytes);
    if (!frame) return { kind: "unrelated" };
    if (frame.kind === "malformed") return { kind: "malformed", error: frame.error };
    if (frame.kind === "message") return { kind: "message", message: frame.message };
    try {
      const message = this.assembler.accept(frame.chunk);
      return message ? { kind: "message", message } : { kind: "pending" };
    } catch (error) {
      return { kind: "malformed", error: error instanceof Error ? error.message : String(error) };
    }
  }

  diagnostics(): ChunkAssemblerDiagnostics {
    return this.assembler.snapshot();
  }

  clear(): void {
    this.assembler.clear();
  }
}
