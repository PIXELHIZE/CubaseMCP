import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { PowerShellCubaseUiDriver } from "../src/automation14/PowerShellCubaseUiDriver.js";
import type { Automation14PlaybackProbe } from "../src/automation14/types.js";
import { SongProjectValidator } from "../src/song/SongProjectValidator.js";
import type { SongCreateResult } from "../src/song/models.js";

interface StoredMcpResponse {
  ok: boolean;
  changed?: boolean;
  data?: SongCreateResult;
  [key: string]: unknown;
}

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const outputDirectory = resolve(outputIndex >= 0 && args[outputIndex + 1]
  ? args[outputIndex + 1]
  : "artifacts/automation14-jpop-full");
const responsePath = resolve(outputDirectory, "mcp-song-create-response.json");
const response = JSON.parse(await readFile(responsePath, "utf8")) as StoredMcpResponse;
if (!response.ok || !response.data?.state) throw new Error(`No completed MCP song result was found in ${responsePath}.`);

const driver = new PowerShellCubaseUiDriver();
const preflight = await driver.preflight();
if (!preflight.ok) throw new Error(`automation14 preflight failed: ${preflight.failures.join("; ")}`);

const sectionPositions = ["1.1.1.0", "33.1.1.0", "97.1.1.0"];
const probes: Array<Automation14PlaybackProbe & { position: string }> = [];
for (const position of sectionPositions) {
  const probe = await driver.playFromPosition(position, 4_000);
  probes.push({ ...probe, position });
}

const verified = probes.every((probe) => probe.verified);
const projectPath = join(homedir(), "Documents", "Cubase Projects", "Neon_Summer_JPOP_Full_120bars", "Neon_Summer_JPOP_Full_120bars.cpr");
response.data.manifest.projectFingerprint = projectPath;
response.data.manifest.audibleEvidence = {
  verified,
  method: "meter",
  details: {
    method: "mixconsole-multichannel-meter-pixel-delta",
    profile: "automation14",
    testedHostVersion: preflight.hostVersion,
    projectPath,
    sectionProbes: probes,
    routing: [
      "JPOP Drums -> Drum Bus -> Delay FX -> Stereo Out",
      "JPOP Bass/Piano/Lead/Pad/Arp -> Music Bus -> Reverb FX -> Stereo Out"
    ]
  }
};
response.data.manifest.updatedAt = new Date().toISOString();
response.data.validation = new SongProjectValidator().validate(response.data.manifest, response.data.state);
response.data.status = response.data.validation.valid ? "succeeded" : "failed";
response.changed = response.data.status === "succeeded";

const summary = {
  completedAt: new Date().toISOString(),
  mcpTool: "cubase.song",
  mcpActions: ["plan", "create", "validate"],
  profile: "automation14",
  hostVersion: preflight.hostVersion,
  projectTitle: "Neon_Summer_JPOP_Full_120bars",
  songId: response.data.plan.songId,
  bars: response.data.plan.bars,
  sections: response.data.plan.sections,
  trackBindings: response.data.manifest.trackBindings.map((binding) => ({
    role: binding.role,
    name: binding.name,
    type: binding.actualType,
    program: binding.programExpected,
    notes: binding.noteCount,
    routeToRole: binding.routeToRole,
    routeValid: binding.routeValid
  })),
  audibleEvidence: response.data.manifest.audibleEvidence,
  validation: response.data.validation
};

await Promise.all([
  writeFile(resolve(outputDirectory, "mcp-song-create-final.json"), `${JSON.stringify(response, null, 2)}\n`, "utf8"),
  writeFile(resolve(outputDirectory, "mcp-call-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8")
]);
console.log(JSON.stringify(summary, null, 2));
