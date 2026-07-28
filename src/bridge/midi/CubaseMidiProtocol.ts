export const AI_MCP_SYSEX_MANUFACTURER = 0x7d;
export const AI_MCP_MAGIC = "AIMCP1";
export const AI_MCP_CHUNK_MAGIC = "AIMCP1C";

export type CubaseMidiProtocolType = "hello" | "request" | "response" | "event" | "state" | "error";

export interface CubaseMidiProtocolMessage<TPayload = unknown> {
  protocol: "cubase-mcp-midi";
  version: 1;
  type: CubaseMidiProtocolType;
  id?: string;
  command?: string;
  ok?: boolean;
  payload?: TPayload;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export interface CubaseMidiChunkEnvelope {
  protocol: "cubase-mcp-midi-chunk";
  version: 1;
  transferId: string;
  requestId?: string;
  index: number;
  total: number;
  checksum: string;
  payloadLength: number;
  fragment: string;
}

export interface MidiControlMessage {
  kind: "cc" | "note" | "program";
  channel: number;
  number: number;
  value?: number;
}

export function makeProtocolMessage<TPayload>(
  type: CubaseMidiProtocolType,
  input: Omit<CubaseMidiProtocolMessage<TPayload>, "protocol" | "version" | "type" | "timestamp">
): CubaseMidiProtocolMessage<TPayload> {
  return {
    protocol: "cubase-mcp-midi",
    version: 1,
    type,
    timestamp: new Date().toISOString(),
    ...input
  };
}

export function encodeControlMessage(message: MidiControlMessage): number[] {
  const channel = Math.max(0, Math.min(15, message.channel));
  const number = Math.max(0, Math.min(127, message.number));
  const value = Math.max(0, Math.min(127, message.value ?? 127));
  switch (message.kind) {
    case "cc":
      return [0xb0 | channel, number, value];
    case "note":
      return [0x90 | channel, number, value];
    case "program":
      return [0xc0 | channel, number];
  }
}

export function checksumAscii(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
