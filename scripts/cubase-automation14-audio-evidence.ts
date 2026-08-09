import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { FfmpegAudioRenderAnalyzer } from "../src/automation14/AudioRenderAnalyzer.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const input = resolve(argument("--input") ?? join(
  homedir(), "Documents", "Cubase Projects", "Neon_Summer_JPOP_Full_120bars", "Mixdown",
  "Neon_Summer_JPOP_Full_120bars_MCP_Final.wav"
));
const outputDirectory = resolve(argument("--output") ?? "artifacts/automation14-jpop-full");
const evidence = await new FfmpegAudioRenderAnalyzer().analyze(input);
await writeFile(resolve(outputDirectory, "audio-render-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

const summaryPath = resolve(outputDirectory, "mcp-call-summary.json");
try {
  const summary = JSON.parse(await readFile(summaryPath, "utf8")) as Record<string, unknown>;
  summary.renderEvidence = evidence;
  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

console.log(JSON.stringify(evidence, null, 2));
if (!evidence.verified) process.exitCode = 1;
