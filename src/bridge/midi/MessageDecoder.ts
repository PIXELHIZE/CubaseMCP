import {
  AI_MCP_CHUNK_MAGIC,
  AI_MCP_MAGIC,
  AI_MCP_SYSEX_MANUFACTURER,
  checksumAscii,
  type CubaseMidiChunkEnvelope,
  type CubaseMidiProtocolMessage
} from "./CubaseMidiProtocol.js";

export type DecodedSysexFrame =
  | { kind: "message"; message: CubaseMidiProtocolMessage }
  | { kind: "chunk"; chunk: CubaseMidiChunkEnvelope }
  | { kind: "malformed"; error: string; payload?: string };

interface ChunkAssembly {
  createdAt: number;
  updatedAt: number;
  envelope: CubaseMidiChunkEnvelope;
  fragments: Map<number, string>;
}

export interface ChunkAssemblerDiagnostics {
  chunksAccepted: number;
  duplicateChunks: number;
  conflictingChunks: number;
  completedTransfers: number;
  expiredTransfers: number;
  checksumFailures: number;
}

function parseProtocolMessage(json: string): CubaseMidiProtocolMessage {
  const parsed = JSON.parse(json) as CubaseMidiProtocolMessage;
  if (parsed.protocol !== "cubase-mcp-midi" || parsed.version !== 1) {
    throw new Error("Unsupported AIMCP protocol marker or version.");
  }
  return parsed;
}

export function decodeSysexFrame(bytes: number[]): DecodedSysexFrame | undefined {
  if (bytes.length < 4) return undefined;
  if (bytes[0] !== 0xf0 || bytes[1] !== AI_MCP_SYSEX_MANUFACTURER || bytes[bytes.length - 1] !== 0xf7) return undefined;
  const payload = String.fromCharCode(...bytes.slice(2, -1));
  try {
    if (payload.startsWith(`${AI_MCP_MAGIC}:`)) {
      return { kind: "message", message: parseProtocolMessage(payload.slice(AI_MCP_MAGIC.length + 1)) };
    }
    if (payload.startsWith(`${AI_MCP_CHUNK_MAGIC}:`)) {
      const chunk = JSON.parse(payload.slice(AI_MCP_CHUNK_MAGIC.length + 1)) as CubaseMidiChunkEnvelope;
      if (
        chunk.protocol !== "cubase-mcp-midi-chunk" ||
        chunk.version !== 1 ||
        !Number.isInteger(chunk.index) ||
        !Number.isInteger(chunk.total) ||
        chunk.index < 0 ||
        chunk.total < 1 ||
        chunk.index >= chunk.total ||
        typeof chunk.fragment !== "string"
      ) {
        throw new Error("Invalid AIMCP chunk envelope.");
      }
      return { kind: "chunk", chunk };
    }
    return undefined;
  } catch (error) {
    return { kind: "malformed", error: error instanceof Error ? error.message : String(error), payload: payload.slice(0, 256) };
  }
}

export function decodeSysexMessage(bytes: number[]): CubaseMidiProtocolMessage | undefined {
  const frame = decodeSysexFrame(bytes);
  return frame?.kind === "message" ? frame.message : undefined;
}

export class SysexChunkAssembler {
  private readonly assemblies = new Map<string, ChunkAssembly>();
  private readonly diagnostics: ChunkAssemblerDiagnostics = {
    chunksAccepted: 0,
    duplicateChunks: 0,
    conflictingChunks: 0,
    completedTransfers: 0,
    expiredTransfers: 0,
    checksumFailures: 0
  };

  constructor(
    private readonly timeoutMs = 5000,
    private readonly maximumPayloadBytes = 4 * 1024 * 1024
  ) {}

  accept(chunk: CubaseMidiChunkEnvelope, now = Date.now()): CubaseMidiProtocolMessage | undefined {
    this.prune(now);
    if (chunk.payloadLength < 1 || chunk.payloadLength > this.maximumPayloadBytes) {
      throw new Error(`AIMCP chunk payload length ${chunk.payloadLength} exceeds configured maximum ${this.maximumPayloadBytes}.`);
    }
    if (chunk.total > Math.ceil(this.maximumPayloadBytes / 32)) {
      throw new Error(`AIMCP chunk count ${chunk.total} exceeds the configured assembly bound.`);
    }
    let assembly = this.assemblies.get(chunk.transferId);
    if (!assembly) {
      assembly = { createdAt: now, updatedAt: now, envelope: chunk, fragments: new Map() };
      this.assemblies.set(chunk.transferId, assembly);
    } else if (
      assembly.envelope.total !== chunk.total ||
      assembly.envelope.checksum !== chunk.checksum ||
      assembly.envelope.payloadLength !== chunk.payloadLength
    ) {
      this.diagnostics.conflictingChunks += 1;
      this.assemblies.delete(chunk.transferId);
      throw new Error(`Conflicting AIMCP chunk metadata for transfer ${chunk.transferId}.`);
    }

    const existing = assembly.fragments.get(chunk.index);
    if (existing !== undefined) {
      if (existing === chunk.fragment) {
        this.diagnostics.duplicateChunks += 1;
        return undefined;
      }
      this.diagnostics.conflictingChunks += 1;
      this.assemblies.delete(chunk.transferId);
      throw new Error(`Conflicting duplicate AIMCP chunk ${chunk.index} for transfer ${chunk.transferId}.`);
    }

    assembly.fragments.set(chunk.index, chunk.fragment);
    assembly.updatedAt = now;
    this.diagnostics.chunksAccepted += 1;
    if (assembly.fragments.size !== chunk.total) return undefined;

    const json = Array.from({ length: chunk.total }, (_, index) => assembly?.fragments.get(index) ?? "").join("");
    this.assemblies.delete(chunk.transferId);
    if (json.length !== chunk.payloadLength || checksumAscii(json) !== chunk.checksum) {
      this.diagnostics.checksumFailures += 1;
      throw new Error(`AIMCP checksum or payload length mismatch for transfer ${chunk.transferId}.`);
    }
    const message = parseProtocolMessage(json);
    if (chunk.requestId && message.id !== chunk.requestId) {
      throw new Error(`AIMCP chunk requestId correlation failed for transfer ${chunk.transferId}.`);
    }
    this.diagnostics.completedTransfers += 1;
    return message;
  }

  snapshot(): ChunkAssemblerDiagnostics {
    this.prune(Date.now());
    return { ...this.diagnostics };
  }

  clear(): void {
    this.assemblies.clear();
  }

  private prune(now: number): void {
    for (const [transferId, assembly] of this.assemblies) {
      if (now - assembly.updatedAt > this.timeoutMs) {
        this.assemblies.delete(transferId);
        this.diagnostics.expiredTransfers += 1;
      }
    }
  }
}
