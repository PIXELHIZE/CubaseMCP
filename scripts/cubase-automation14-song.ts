import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CompositeCubaseAdapter } from "../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../src/config/cubaseConfig.js";
import { createCubaseMcpRuntime } from "../src/server.js";
import type { SongCreateResult, SongPlan } from "../src/song/models.js";

const args = process.argv.slice(2);
const barsIndex = args.indexOf("--bars");
const bars = Number(barsIndex >= 0 ? args[barsIndex + 1] : 120);
const outputIndex = args.indexOf("--output");
const outputDirectory = resolve(outputIndex >= 0 && args[outputIndex + 1]
  ? args[outputIndex + 1]
  : "artifacts/automation14-jpop");
if (!Number.isInteger(bars) || bars < 1 || bars > 512) throw new Error(`Invalid --bars value: ${bars}`);

process.env.CUBASE_ADAPTER = "composite";
process.env.CUBASE_REQUIRE_REAL = "true";
process.env.CUBASE_AUTOMATION14 = "true";

const adapter = new CompositeCubaseAdapter(loadCubaseConfig(process.env));
const runtime = await createCubaseMcpRuntime(adapter);
const client = new Client({ name: "cubase-automation14-song", version: "2.0.0" }, { capabilities: {} });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

try {
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([runtime.server.connect(serverTransport), client.connect(clientTransport)]);
  const planResponse = await client.callTool({
    name: "cubase.song",
    arguments: {
      action: "plan",
      prompt: `${bars} bars of a complete bright, emotional J-pop song with intro, verses, pre-choruses, choruses, bridge and outro`,
      genre: "jpop",
      tempo: 138,
      key: "D major",
      bars,
      tracks: [
        { role: "drums", name: "JPOP Drums", program: "SR Studio A Kit" },
        { role: "bass", name: "JPOP Bass", program: "SR Smooth Bass" },
        { role: "chords", name: "JPOP Piano", program: "[GM 001] Acoustic Grand Piano" },
        { role: "lead", name: "JPOP Lead", program: "Butterfly Lead" },
        { role: "pad", name: "JPOP Pad", program: "Alaska Sweep" },
        { role: "arp", name: "JPOP Arp", program: "Easy Saw Comp" },
        { role: "drum_bus", name: "Drum Bus" },
        { role: "music_bus", name: "Music Bus" },
        { role: "reverb", name: "Reverb FX" },
        { role: "delay", name: "Delay FX" },
        { role: "markers", name: "Song Markers" }
      ]
    }
  });
  const planned = planResponse.structuredContent as { ok?: boolean; data?: SongPlan; error?: unknown } | undefined;
  if (!planned?.ok || !planned.data) throw new Error(`MCP cubase.song.plan failed: ${JSON.stringify(planned?.error)}`);
  await writeFile(resolve(outputDirectory, "mcp-song-plan.json"), `${JSON.stringify(planned.data, null, 2)}\n`, "utf8");

  const startedAt = new Date().toISOString();
  const createResponse = await client.callTool({
    name: "cubase.song",
    arguments: {
      action: "create",
      plan: planned.data,
      rollbackOnFailure: false,
      timeoutMs: 3_600_000,
      requestId: `automation14-jpop-${Date.now()}`
    }
  }, undefined, { timeout: 3_600_000, maxTotalTimeout: 3_600_000 });
  const created = createResponse.structuredContent as { ok?: boolean; data?: SongCreateResult; error?: unknown } | undefined;
  await writeFile(resolve(outputDirectory, "mcp-song-create-response.json"), `${JSON.stringify(created, null, 2)}\n`, "utf8");
  if (!created?.ok || created.data?.status !== "succeeded") {
    throw new Error(`MCP cubase.song.create failed: ${JSON.stringify(created?.error ?? created?.data?.validation)}`);
  }
  const summary = {
    startedAt,
    completedAt: new Date().toISOString(),
    mcpTool: "cubase.song",
    mcpActions: ["plan", "create"],
    profile: "automation14",
    bars,
    songId: planned.data.songId,
    projectTitle: "Neon_Summer_JPOP_Full_120bars",
    trackBindings: created.data.manifest.trackBindings.map((binding) => ({
      role: binding.role,
      name: binding.name,
      type: binding.actualType,
      program: binding.programExpected,
      notes: binding.noteCount,
      routeToRole: binding.routeToRole,
      routeValid: binding.routeValid
    })),
    audibleEvidence: created.data.manifest.audibleEvidence,
    validation: created.data.validation
  };
  await writeFile(resolve(outputDirectory, "mcp-call-summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await client.close().catch(() => undefined);
  await runtime.close().catch(() => undefined);
}
