import type { MidiPortConfig } from "../config/midiPorts.js";
import { MidiPortManager, type MidiPortSnapshot } from "../bridge/midi/MidiPortManager.js";

export interface MidiPortAudit {
  expected: { input: string; output: string };
  available: MidiPortSnapshot;
  inputFound: boolean;
  outputFound: boolean;
  likelyDirectionMismatch: boolean;
  valid: boolean;
  diagnoses: string[];
}

function containsPort(names: string[], expected: string): boolean {
  const normalized = expected.toLowerCase();
  return names.some((name) => name === expected || name.toLowerCase().includes(normalized));
}

export class MidiPortDoctor {
  constructor(private readonly config: MidiPortConfig) {}

  async audit(): Promise<MidiPortAudit> {
    const manager = new MidiPortManager(this.config);
    const available = await manager.listPorts();
    const inputFound = containsPort(available.inputs, this.config.inputName);
    const outputFound = containsPort(available.outputs, this.config.outputName);
    const reversedInput = containsPort(available.inputs, this.config.outputName);
    const reversedOutput = containsPort(available.outputs, this.config.inputName);
    const likelyDirectionMismatch =
      this.config.inputName === this.config.outputName ||
      (!inputFound && !outputFound && reversedInput && reversedOutput) ||
      (/to cubase/i.test(this.config.inputName) && /from cubase/i.test(this.config.outputName));
    const diagnoses: string[] = [];
    if (!inputFound) diagnoses.push(`Node MIDI input was not found: ${this.config.inputName}`);
    if (!outputFound) diagnoses.push(`Node MIDI output was not found: ${this.config.outputName}`);
    if (likelyDirectionMismatch) {
      diagnoses.push("MIDI direction appears reversed. Node input must receive 'From Cubase'; Node output must send 'To Cubase'.");
    }
    return {
      expected: { input: this.config.inputName, output: this.config.outputName },
      available,
      inputFound,
      outputFound,
      likelyDirectionMismatch,
      valid: inputFound && outputFound && !likelyDirectionMismatch,
      diagnoses
    };
  }
}
