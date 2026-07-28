import {
  AI_MCP_CHUNK_MAGIC,
  AI_MCP_MAGIC,
  AI_MCP_SYSEX_MANUFACTURER,
  checksumAscii,
  type CubaseMidiChunkEnvelope,
  type CubaseMidiProtocolMessage
} from "./CubaseMidiProtocol.js";

function toAsciiJson(message: CubaseMidiProtocolMessage): string {
  const json = JSON.stringify(message);
  return json.replace(/[^\x00-\x7F]/g, (char) => {
    const code = char.charCodeAt(0).toString(16).padStart(4, "0");
    return `\\u${code}`;
  });
}

function encodeAsciiPayload(magic: string, payload: string): number[] {
  const text = `${magic}:${payload}`;
  const bytes = [...text].map((char) => char.charCodeAt(0));
  if (bytes.some((byte) => byte > 0x7f)) {
    throw new Error("AIMCP SysEx payload must be 7-bit ASCII.");
  }
  return [0xf0, AI_MCP_SYSEX_MANUFACTURER, ...bytes, 0xf7];
}

export function encodeSysexMessage(message: CubaseMidiProtocolMessage): number[] {
  return encodeAsciiPayload(AI_MCP_MAGIC, toAsciiJson(message));
}

export function encodeSysexFrames(message: CubaseMidiProtocolMessage, maximumFrameBytes = 1024, maximumPayloadBytes = 4 * 1024 * 1024): number[][] {
  if (!Number.isInteger(maximumFrameBytes) || maximumFrameBytes < 384) {
    throw new Error("AIMCP maximum SysEx frame size must be at least 384 bytes.");
  }
  const json = toAsciiJson(message);
  if (json.length > maximumPayloadBytes) {
    throw new Error(`AIMCP payload exceeds configured maximum of ${maximumPayloadBytes} bytes.`);
  }
  const single = encodeAsciiPayload(AI_MCP_MAGIC, json);
  if (single.length <= maximumFrameBytes) return [single];
  const transferId = `${message.id ?? "event"}-${checksumAscii(`${message.timestamp}:${json.length}`)}`;
  const checksum = checksumAscii(json);
  let fragmentSize = maximumFrameBytes - 320;

  while (fragmentSize >= 64) {
    const fragments: string[] = [];
    for (let offset = 0; offset < json.length; offset += fragmentSize) {
      fragments.push(json.slice(offset, offset + fragmentSize));
    }
    const frames = fragments.map((fragment, index) => {
      const envelope: CubaseMidiChunkEnvelope = {
        protocol: "cubase-mcp-midi-chunk",
        version: 1,
        transferId,
        requestId: message.id,
        index,
        total: fragments.length,
        checksum,
        payloadLength: json.length,
        fragment
      };
      return encodeAsciiPayload(AI_MCP_CHUNK_MAGIC, JSON.stringify(envelope));
    });
    if (frames.every((frame) => frame.length <= maximumFrameBytes)) return frames;
    fragmentSize -= 32;
  }
  throw new Error(`AIMCP could not fit chunk envelopes within ${maximumFrameBytes} bytes.`);
}
