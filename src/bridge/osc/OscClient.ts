import dgram from "node:dgram";
import { randomUUID } from "node:crypto";

export interface OscClientConfig {
  enabled: boolean;
  host: string;
  port: number;
  listenPort: number;
  timeoutMs: number;
}

export interface OscResponse {
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: { code: string; message: string; details?: unknown };
}

export function loadOscClientConfig(env: NodeJS.ProcessEnv = process.env): OscClientConfig {
  return {
    enabled: env.CUBASE_OSC_ENABLED === "true",
    host: env.CUBASE_OSC_HOST ?? "127.0.0.1",
    port: Number(env.CUBASE_OSC_PORT ?? 9000),
    listenPort: Number(env.CUBASE_OSC_LISTEN_PORT ?? 9001),
    timeoutMs: Number(env.CUBASE_OSC_TIMEOUT_MS ?? 2000)
  };
}

function pad4(buffer: Buffer): Buffer {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding === 0 ? buffer : Buffer.concat([buffer, Buffer.alloc(padding)]);
}

function oscString(value: string): Buffer {
  return pad4(Buffer.concat([Buffer.from(value, "utf8"), Buffer.from([0])]));
}

function encodeMessage(address: string, json: string): Buffer {
  return Buffer.concat([oscString(address), oscString(",s"), oscString(json)]);
}

function readOscString(buffer: Buffer, offset: number): { value: string; next: number } {
  const end = buffer.indexOf(0, offset);
  if (end < 0) throw new Error("Malformed OSC string.");
  const next = Math.ceil((end + 1) / 4) * 4;
  return { value: buffer.toString("utf8", offset, end), next };
}

function decodeJsonArgument(buffer: Buffer): unknown {
  const address = readOscString(buffer, 0);
  const types = readOscString(buffer, address.next);
  if (types.value !== ",s") throw new Error(`Unsupported OSC type tag: ${types.value}`);
  const payload = readOscString(buffer, types.next);
  return JSON.parse(payload.value);
}

export class OscClient {
  private socket?: dgram.Socket;
  private readonly pending = new Map<string, { resolve: (value: OscResponse) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();

  constructor(private readonly config = loadOscClientConfig()) {}

  async open(): Promise<void> {
    if (!this.config.enabled || this.socket) return;
    const socket = dgram.createSocket("udp4");
    socket.on("message", (message) => this.onMessage(message));
    socket.on("error", (error) => {
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.bind(this.config.listenPort, "127.0.0.1", () => {
        socket.off("error", reject);
        resolve();
      });
    });
    this.socket = socket;
  }

  close(): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("OSC client closed."));
    }
    this.pending.clear();
    this.socket?.close();
    this.socket = undefined;
  }

  async request(operation: string, input: Record<string, unknown>, timeoutMs = this.config.timeoutMs): Promise<OscResponse> {
    if (!this.config.enabled) throw new Error("OSC adapter is disabled. Set CUBASE_OSC_ENABLED=true.");
    await this.open();
    if (!this.socket) throw new Error("OSC socket is not open.");
    const id = randomUUID();
    const message = encodeMessage("/cubase-mcp/request", JSON.stringify({ id, operation, input, replyPort: this.config.listenPort }));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`OSC request timed out: ${operation}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket?.send(message, this.config.port, this.config.host, (error) => {
        if (error) {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(error);
        }
      });
    });
  }

  get enabled(): boolean {
    return this.config.enabled;
  }

  private onMessage(message: Buffer): void {
    try {
      const response = decodeJsonArgument(message) as OscResponse;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(response.id);
      response.ok ? pending.resolve(response) : pending.reject(new Error(response.error?.message ?? "OSC bridge error"));
    } catch {
      // Malformed or unrelated OSC packets are ignored; pending requests retain their timeout.
    }
  }
}
