import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { encodeControlMessage, makeProtocolMessage, type CubaseMidiProtocolMessage, type MidiControlMessage } from "./CubaseMidiProtocol.js";
import { ChunkedSysexTransport } from "./ChunkedSysexTransport.js";
import type { MidiPortConfig } from "../../config/midiPorts.js";
import { MidiPortManager } from "./MidiPortManager.js";

interface PendingRequest {
  resolve: (message: CubaseMidiProtocolMessage) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export interface MidiRouterDiagnostics {
  requests: number;
  retries: number;
  framesSent: number;
  framesReceived: number;
  malformedFrames: number;
  duplicateResponses: number;
  orphanResponses: number;
  reconnectEvents: number;
  lastError?: string;
  chunking: ReturnType<ChunkedSysexTransport["diagnostics"]>;
}

export class RequestResponseRouter extends EventEmitter {
  private readonly pending = new Map<string, PendingRequest>();
  private readonly completed = new Map<string, number>();
  private readonly transport: ChunkedSysexTransport;
  private lastState?: CubaseMidiProtocolMessage;
  private readonly diagnostics = {
    requests: 0,
    retries: 0,
    framesSent: 0,
    framesReceived: 0,
    malformedFrames: 0,
    duplicateResponses: 0,
    orphanResponses: 0,
    reconnectEvents: 0,
    lastError: undefined as string | undefined
  };

  constructor(
    private readonly ports: MidiPortManager,
    private readonly config: MidiPortConfig
  ) {
    super();
    this.transport = new ChunkedSysexTransport(config.maximumSysexFrameBytes, config.chunkAssemblyTimeoutMs, config.maximumPayloadBytes);
    this.ports.on("message", (message: number[]) => this.handleMidi(message));
  }

  async open(): Promise<void> {
    await this.ports.open();
  }

  close(): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`MIDI request cancelled: ${id}`));
    }
    this.pending.clear();
    this.completed.clear();
    this.transport.clear();
    this.ports.close();
  }

  sendControl(message: MidiControlMessage): void {
    this.ports.send(encodeControlMessage(message));
  }

  async request(command: string, payload: unknown = {}, timeoutMs = this.config.timeoutMs): Promise<CubaseMidiProtocolMessage> {
    this.diagnostics.requests += 1;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.config.retries; attempt += 1) {
      try {
        return await this.sendOnce(command, payload, timeoutMs);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.diagnostics.lastError = lastError.message;
        if (attempt < this.config.retries) this.diagnostics.retries += 1;
      }
    }
    throw lastError ?? new Error(`MIDI request failed: ${command}`);
  }

  getCachedState(): CubaseMidiProtocolMessage | undefined {
    return this.lastState;
  }

  getDiagnostics(): MidiRouterDiagnostics {
    return { ...this.diagnostics, chunking: this.transport.diagnostics() };
  }

  private sendOnce(command: string, payload: unknown, timeoutMs: number): Promise<CubaseMidiProtocolMessage> {
    const id = randomUUID();
    const message = makeProtocolMessage("request", { id, command, payload });
    const frames = this.transport.encode(message);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MIDI request timed out: ${command}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      for (const frame of frames) {
        this.ports.send(frame);
        this.diagnostics.framesSent += 1;
      }
    });
  }

  private handleMidi(message: number[]): void {
    this.diagnostics.framesReceived += 1;
    const decodedFrame = this.transport.decode(message);
    if (decodedFrame.kind === "unrelated") {
      this.emit("raw", message);
      return;
    }
    if (decodedFrame.kind === "malformed") {
      this.diagnostics.malformedFrames += 1;
      this.diagnostics.lastError = decodedFrame.error;
      this.emit("malformed", decodedFrame);
      return;
    }
    if (decodedFrame.kind === "pending") return;
    const decoded: CubaseMidiProtocolMessage = decodedFrame.message;
    if (decoded.type === "hello") {
      this.diagnostics.reconnectEvents += 1;
      this.emit("reconnect", decoded);
    }
    if (decoded.type === "state") {
      this.lastState = decoded;
      this.emit("state", decoded);
    }
    if (decoded.id && this.pending.has(decoded.id)) {
      const pending = this.pending.get(decoded.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(decoded.id);
      this.completed.set(decoded.id, Date.now());
      if (decoded.type === "error" || decoded.ok === false) {
        pending.reject(new Error(decoded.error?.message ?? `MIDI request failed: ${decoded.command ?? decoded.id}`));
      } else {
        pending.resolve(decoded);
      }
    } else if (decoded.id && this.completed.has(decoded.id)) {
      this.diagnostics.duplicateResponses += 1;
      return;
    } else if (decoded.id && (decoded.type === "response" || decoded.type === "error")) {
      this.diagnostics.orphanResponses += 1;
    }
    const cutoff = Date.now() - 60_000;
    for (const [id, completedAt] of this.completed) if (completedAt < cutoff) this.completed.delete(id);
    this.emit("message", decoded);
  }
}
