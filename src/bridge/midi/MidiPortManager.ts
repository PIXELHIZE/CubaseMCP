import { EventEmitter } from "node:events";
import type { MidiPortConfig } from "../../config/midiPorts.js";

interface MidiInputLike {
  getPortCount(): number;
  getPortName(port: number): string;
  openPort(port: number): void;
  closePort(): void;
  ignoreTypes?(sysex: boolean, timing: boolean, activeSensing: boolean): void;
  on(event: "message", listener: (deltaTime: number, message: number[]) => void): void;
}

interface MidiOutputLike {
  getPortCount(): number;
  getPortName(port: number): string;
  openPort(port: number): void;
  closePort(): void;
  sendMessage(message: number[]): void;
}

interface MidiModuleLike {
  Input: new () => MidiInputLike;
  Output: new () => MidiOutputLike;
}

export interface MidiPortSnapshot {
  inputs: string[];
  outputs: string[];
}

export class MidiPortManager extends EventEmitter {
  private input?: MidiInputLike;
  private output?: MidiOutputLike;
  private opened = false;

  constructor(private readonly config: MidiPortConfig) {
    super();
  }

  async open(): Promise<void> {
    if (this.opened) return;
    const midi = (await import("@julusian/midi")) as unknown as MidiModuleLike;
    const input = new midi.Input();
    const output = new midi.Output();
    try {
      const inputIndex = this.findPort(input, this.config.inputName, "input");
      const outputIndex = this.findPort(output, this.config.outputName, "output");
      input.ignoreTypes?.(false, false, false);
      input.on("message", (_deltaTime, message) => this.emit("message", message));
      input.openPort(inputIndex);
      output.openPort(outputIndex);
      this.input = input;
      this.output = output;
      this.opened = true;
    } catch (error) {
      try {
        input.closePort();
      } catch {}
      try {
        output.closePort();
      } catch {}
      throw error;
    }
  }

  close(): void {
    if (!this.opened) return;
    this.input?.closePort();
    this.output?.closePort();
    this.input = undefined;
    this.output = undefined;
    this.opened = false;
  }

  send(message: number[]): void {
    if (!this.output || !this.opened) throw new Error("MIDI output port is not open.");
    this.output.sendMessage(message);
  }

  async listPorts(): Promise<MidiPortSnapshot> {
    const midi = (await import("@julusian/midi")) as unknown as MidiModuleLike;
    const input = new midi.Input();
    const output = new midi.Output();
    return {
      inputs: this.portNames(input),
      outputs: this.portNames(output)
    };
  }

  private findPort(port: MidiInputLike | MidiOutputLike, expectedName: string, kind: "input" | "output"): number {
    const names = this.portNames(port);
    const exact = names.findIndex((name) => name === expectedName);
    if (exact >= 0) return exact;
    const partial = names.findIndex((name) => name.toLowerCase().includes(expectedName.toLowerCase()));
    if (partial >= 0) return partial;
    throw new Error(`MIDI ${kind} port not found: "${expectedName}". Available ${kind}s: ${names.join(", ") || "(none)"}`);
  }

  private portNames(port: MidiInputLike | MidiOutputLike): string[] {
    const names: string[] = [];
    for (let index = 0; index < port.getPortCount(); index += 1) {
      names.push(port.getPortName(index));
    }
    return names;
  }
}
