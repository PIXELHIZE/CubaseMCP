import type { CubaseMidiProtocolMessage } from "../bridge/midi/CubaseMidiProtocol.js";
import { MidiPortManager } from "../bridge/midi/MidiPortManager.js";
import { RequestResponseRouter } from "../bridge/midi/RequestResponseRouter.js";
import type { MidiPortConfig } from "../config/midiPorts.js";
import { MidiPortDoctor, type MidiPortAudit } from "./MidiPortDoctor.js";

export interface CubaseHandshakeEvidence {
  connected: boolean;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  ports: MidiPortAudit;
  request?: { command: "ping"; timeoutMs: number; retries: number };
  response?: CubaseMidiProtocolMessage;
  appVersion?: string;
  midiRemoteApiVersion?: string;
  directAccessAvailable?: boolean;
  bridgeActive?: boolean;
  protocol?: unknown;
  routerDiagnostics: ReturnType<RequestResponseRouter["getDiagnostics"]>;
  error?: { code: string; message: string };
}

function objectValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export class CubaseConnectionDoctor {
  private readonly ports: MidiPortManager;
  private readonly router: RequestResponseRouter;
  private opened = false;

  constructor(private readonly config: MidiPortConfig) {
    this.ports = new MidiPortManager(config);
    this.router = new RequestResponseRouter(this.ports, config);
  }

  getRouter(): RequestResponseRouter {
    return this.router;
  }

  async connect(): Promise<CubaseHandshakeEvidence> {
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    const portAudit = await new MidiPortDoctor(this.config).audit();
    if (!portAudit.valid) {
      return this.failure(started, startedAt, portAudit, "MIDI_PORT_CONFIGURATION_INVALID", portAudit.diagnoses.join(" "));
    }
    try {
      await this.router.open();
      this.opened = true;
      const response = await this.router.request("ping", { client: "cubase-capability-discovery", supportsChunking: true }, this.config.timeoutMs);
      if (response.id === undefined || response.command !== "ping" || response.type !== "response") {
        throw new Error("Handshake response did not preserve request correlation or command type.");
      }
      const payload = objectValue(response.payload);
      const directAccess = objectValue(payload.directAccess);
      const completed = Date.now();
      return {
        connected: true,
        startedAt,
        completedAt: new Date(completed).toISOString(),
        durationMs: completed - started,
        ports: portAudit,
        request: { command: "ping", timeoutMs: this.config.timeoutMs, retries: this.config.retries },
        response,
        appVersion: typeof payload.appVersion === "string" ? payload.appVersion : undefined,
        midiRemoteApiVersion: typeof payload.midiRemoteApiVersion === "string" ? payload.midiRemoteApiVersion : undefined,
        directAccessAvailable: directAccess.makeDirectAccess === true,
        bridgeActive: directAccess.active === true,
        protocol: payload.protocol,
        routerDiagnostics: this.router.getDiagnostics()
      };
    } catch (error) {
      return this.failure(started, startedAt, portAudit, "CUBASE_HANDSHAKE_FAILED", error instanceof Error ? error.message : String(error));
    }
  }

  async getState(): Promise<Record<string, unknown>> {
    const response = await this.router.request("get_state", { include: "all" });
    const payload = objectValue(response.payload);
    return objectValue(payload.state ?? payload);
  }

  async waitForScriptReload(timeoutMs = 10_000): Promise<CubaseMidiProtocolMessage> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.router.off("reconnect", onReconnect);
        reject(new Error(`Timed out waiting for Cubase MIDI Remote script reload after ${timeoutMs}ms.`));
      }, timeoutMs);
      const onReconnect = (message: CubaseMidiProtocolMessage): void => {
        clearTimeout(timer);
        resolve(message);
      };
      this.router.once("reconnect", onReconnect);
    });
  }

  async disconnect(): Promise<void> {
    if (!this.opened) return;
    this.router.close();
    this.opened = false;
  }

  private failure(started: number, startedAt: string, ports: MidiPortAudit, code: string, message: string): CubaseHandshakeEvidence {
    const completed = Date.now();
    return {
      connected: false,
      startedAt,
      completedAt: new Date(completed).toISOString(),
      durationMs: completed - started,
      ports,
      routerDiagnostics: this.router.getDiagnostics(),
      error: { code, message }
    };
  }
}
