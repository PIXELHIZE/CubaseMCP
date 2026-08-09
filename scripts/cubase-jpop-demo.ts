import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CompositeCubaseAdapter } from "../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../src/config/cubaseConfig.js";
import { createCubaseMcpRuntime } from "../src/server.js";
import { JpopAudioRenderer } from "../src/song/JpopAudioRenderer.js";
import type { SongPlan } from "../src/song/models.js";

const argumentsList = process.argv.slice(2);
const full = argumentsList.includes("--full");
const outputIndex = argumentsList.indexOf("--output");
const outputDirectory = resolve(outputIndex >= 0 && argumentsList[outputIndex + 1]
  ? argumentsList[outputIndex + 1]
  : join("artifacts", full ? "jpop-full" : "jpop-loop"));
const bars = full ? 120 : 8;
process.env.CUBASE_ADAPTER = "composite";
process.env.CUBASE_REQUIRE_REAL = "true";

const adapter = new CompositeCubaseAdapter(loadCubaseConfig(process.env));
const runtime = await createCubaseMcpRuntime(adapter);
const client = new Client({ name: "cubase-jpop-real-demo", version: "2.0.0" }, { capabilities: {} });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

try {
  await Promise.all([runtime.server.connect(serverTransport), client.connect(clientTransport)]);
  const response = await client.callTool({
    name: "cubase.song",
    arguments: {
      action: "plan",
      prompt: full
        ? "120마디, 3분대의 완성된 J-pop 느낌 노래를 계획해줘"
        : "8마디 J-pop 루프를 계획해줘",
      genre: "jpop",
      tempo: 138,
      key: "D major",
      bars
    }
  });
  const result = response.structuredContent as { ok?: boolean; data?: SongPlan; error?: unknown } | undefined;
  if (!result?.ok || !result.data) throw new Error(`MCP song plan failed: ${JSON.stringify(result?.error)}`);
  const plan = result.data;
  const rendered = await new JpopAudioRenderer().render(plan, {
    outputDirectory,
    sampleRate: 48_000,
    title: full ? "Neon Summer Promise" : "Neon Summer Promise - Loop"
  });
  await writeFile(join(outputDirectory, "song-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  await writeFile(join(outputDirectory, "render-manifest.json"), `${JSON.stringify(rendered, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputDirectory, plan, rendered }, null, 2));
} finally {
  await client.close().catch(() => undefined);
  await runtime.close().catch(() => undefined);
}
