import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { CompositeCubaseAdapter } from "../src/adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "../src/config/cubaseConfig.js";
import { createCubaseMcpRuntime } from "../src/server.js";

const [tool, rawArgs = "{}", ...extraArgs] = process.argv.slice(2);
if (!tool) throw new Error("Usage: npm run cubase:call -- <tool-name> '<json-args>'");

const args = rawArgs.startsWith("{") && rawArgs.includes('"')
  ? JSON.parse(rawArgs) as Record<string, unknown>
  : [rawArgs, ...extraArgs].reduce<Record<string, unknown>>((values, pair) => {
      if (pair === "{}") return values;
      const separator = pair.indexOf("=");
      if (separator < 1) throw new Error(`Expected JSON or key=value argument, received: ${pair}`);
      const key = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      values[key] = value === "true" ? true : value === "false" ? false : /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : value;
      return values;
    }, {});
process.env.CUBASE_ADAPTER = "composite";
process.env.CUBASE_REQUIRE_REAL = "true";

const config = loadCubaseConfig(process.env);
const adapter = new CompositeCubaseAdapter(config);
const runtime = await createCubaseMcpRuntime(adapter);
const client = new Client({ name: "cubase-real-single-tool", version: "1.0.0" }, { capabilities: {} });
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

try {
  await Promise.all([runtime.server.connect(serverTransport), client.connect(clientTransport)]);
  const response = await client.callTool({ name: tool, arguments: args });
  const result = response.structuredContent as Record<string, unknown> | undefined;
  if (!result) throw new Error("MCP response did not include structuredContent.");
  if (result.status === "mock_only" || result.adapter === "Mock Cubase Adapter") {
    throw new Error("MockCubaseAdapter is forbidden for cubase:call.");
  }
  const reportDirectory = resolve("reports", "real-cubase", "project-create-test");
  await mkdir(reportDirectory, { recursive: true });
  await appendFile(resolve(reportDirectory, "bootstrap-tool-calls.jsonl"), `${JSON.stringify({
    timestamp: new Date().toISOString(),
    tool,
    args,
    adapter: result.adapter,
    usedMock: false,
    result
  })}\n`, "utf8");
  console.log(JSON.stringify(result, null, 2));
  if (result.ok !== true) process.exitCode = 1;
} finally {
  await client.close().catch(() => undefined);
  await runtime.close().catch(() => undefined);
}
