import { isAbsolute, resolve } from "node:path";
import type { OperationContext, OperationResult } from "../adapters/CubaseAdapter.js";
import { FfmpegAudioRenderAnalyzer, type AudioRenderEvidence } from "./AudioRenderAnalyzer.js";
import { PowerShellCubaseUiDriver } from "./PowerShellCubaseUiDriver.js";
import type { Automation14UiDriver } from "./types.js";

export interface Automation14ExportInput {
  expectedFiles?: string[];
  masterGainDb?: number;
  realtime?: boolean;
}

export interface Automation14AudioAnalyzer {
  analyze(path: string): Promise<AudioRenderEvidence>;
}

export class Automation14ExportExecutor {
  constructor(
    private readonly ui: Automation14UiDriver = new PowerShellCubaseUiDriver(),
    private readonly analyzer: Automation14AudioAnalyzer = new FfmpegAudioRenderAnalyzer()
  ) {}

  async execute(
    input: Automation14ExportInput,
    context: OperationContext
  ): Promise<OperationResult> {
    const expectedFiles = input.expectedFiles ?? [];
    if (expectedFiles.length !== 1) {
      throw new Error("automation14 export requires exactly one expectedFiles entry.");
    }
    const rawPath = expectedFiles[0]!;
    const expectedFile = isAbsolute(rawPath) ? resolve(rawPath) : resolve(process.cwd(), rawPath);
    if (!expectedFile.toLowerCase().endsWith(".wav")) {
      throw new Error("automation14 export currently supports one WAV artifact.");
    }
    const masterGainDb = input.masterGainDb ?? -3.2;
    const realtime = input.realtime ?? true;
    const timeoutMs = context.timeoutMs ?? 600_000;

    if (context.dryRun) {
      return {
        changed: false,
        preview: {
          expectedFile,
          masterGainDb,
          realtime,
          testedHostVersion: "14.0.32",
          controlPath: "interactive-automation14"
        }
      };
    }

    const preflight = await this.ui.preflight();
    if (!preflight.ok) {
      throw new Error(`automation14 export preflight failed: ${preflight.failures.join("; ")}`);
    }
    const gain = await this.ui.setStereoOutGain(masterGainDb);
    if (!gain.applied) throw new Error("automation14 did not verify the requested Stereo Out gain interaction.");
    const exportUi = await this.ui.exportAudioMixdown(expectedFile, realtime, timeoutMs);
    if (!exportUi.completed || exportUi.bytes <= 0) {
      throw new Error(`automation14 export did not complete: ${expectedFile}`);
    }
    const audio = await this.analyzer.analyze(expectedFile);
    if (!audio.verified) {
      throw new Error(`Exported audio failed render verification: ${expectedFile}`);
    }
    return {
      changed: true,
      adapter: "automation14",
      data: {
        expectedFile,
        masterGainDb,
        realtime,
        gain,
        exportUi,
        audio
      },
      warnings: audio.warnings,
      evidence: {
        requestId: context.requestId,
        reportFile: exportUi.screenshotPath,
        outputFiles: [{ path: audio.path, bytes: audio.bytes, sha256: audio.sha256 }]
      }
    };
  }
}
