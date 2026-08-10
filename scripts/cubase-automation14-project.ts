import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CompositeCubaseAdapter } from "../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../src/config/cubaseConfig.js";
import { createCubaseMcpRuntime } from "../src/server.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const currentProjectTitle = argument("--current-project-title");
const name = argument("--name");
const directory = resolve(argument("--directory") ?? resolve(process.env.USERPROFILE ?? process.cwd(), "Documents", "Cubase Projects"));
const evidenceDirectory = resolve(argument("--evidence-directory") ?? "artifacts/automation14-project");
if (!currentProjectTitle) throw new Error("--current-project-title is required.");
if (!name) throw new Error("--name is required.");

process.env.CUBASE_ADAPTER = "composite";
process.env.CUBASE_REQUIRE_REAL = "true";
process.env.CUBASE_AUTOMATION14 = "true";
process.env.CUBASE_AUTOMATION14_PROJECT_TITLE = currentProjectTitle;

await mkdir(evidenceDirectory, { recursive: true });
const adapter = new CompositeCubaseAdapter(loadCubaseConfig(process.env));
const runtime = await createCubaseMcpRuntime(adapter);
const client = new Client({ name: "cubase-automation14-project", version: "2.0.0" }, { capabilities: {} });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

try {
  await Promise.all([runtime.server.connect(serverTransport), client.connect(clientTransport)]);
  const response = await client.callTool({
    name: "cubase.project",
    arguments: {
      action: "create",
      name,
      directory,
      timeoutMs: 120_000,
      requestId: `automation14-project-${Date.now()}`
    }
  }, undefined, { timeout: 180_000, maxTotalTimeout: 180_000 });
  const structured = response.structuredContent as { ok?: boolean; error?: unknown } | undefined;
  await writeFile(resolve(evidenceDirectory, "mcp-project-create-response.json"), `${JSON.stringify(structured, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(structured, null, 2));
  if (!structured?.ok) throw new Error(`MCP project.create failed: ${JSON.stringify(structured?.error)}`);
} finally {
  await client.close().catch(() => undefined);
  await runtime.close().catch(() => undefined);
}
