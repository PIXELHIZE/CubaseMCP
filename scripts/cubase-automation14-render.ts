import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CompositeCubaseAdapter } from "../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../src/config/cubaseConfig.js";
import { createCubaseMcpRuntime } from "../src/server.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectTitle = argument("--project-title");
const rawExpectedFile = argument("--expected-file");
if (!projectTitle) throw new Error("--project-title is required.");
if (!rawExpectedFile) throw new Error("--expected-file is required.");
const expectedFile = resolve(rawExpectedFile);
const masterGainDb = Number(argument("--master-gain-db") ?? -3.2);
const realtime = argument("--realtime") !== "false";
const timeoutMs = Number(argument("--timeout-ms") ?? 900_000);
const evidenceDirectory = resolve(argument("--evidence-directory") ?? "artifacts/automation14-render");

process.env.CUBASE_ADAPTER = "composite";
process.env.CUBASE_REQUIRE_REAL = "true";
process.env.CUBASE_AUTOMATION14 = "true";
process.env.CUBASE_AUTOMATION14_PROJECT_TITLE = projectTitle;

await mkdir(dirname(expectedFile), { recursive: true });
await mkdir(evidenceDirectory, { recursive: true });
const adapter = new CompositeCubaseAdapter(loadCubaseConfig(process.env));
const runtime = await createCubaseMcpRuntime(adapter);
const client = new Client({ name: "cubase-automation14-render", version: "2.0.0" }, { capabilities: {} });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

try {
  await Promise.all([runtime.server.connect(serverTransport), client.connect(clientTransport)]);
  const response = await client.callTool({
    name: "cubase.export_run",
    arguments: {
      action: "perform_current_settings",
      expectedFiles: [expectedFile],
      masterGainDb,
      realtime,
      confirm: true,
      timeoutMs,
      requestId: `automation14-render-${Date.now()}`
    }
  }, undefined, { timeout: timeoutMs + 60_000, maxTotalTimeout: timeoutMs + 60_000 });
  const structured = response.structuredContent as { ok?: boolean; error?: unknown } | undefined;
  await writeFile(resolve(evidenceDirectory, "mcp-export-response.json"), `${JSON.stringify(structured, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(structured, null, 2));
  if (!structured?.ok) throw new Error(`MCP export failed: ${JSON.stringify(structured?.error)}`);
} finally {
  await client.close().catch(() => undefined);
  await runtime.close().catch(() => undefined);
}
