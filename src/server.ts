#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MockCubaseAdapter } from "./adapters/MockCubaseAdapter.js";
import type { CubaseAdapter } from "./adapters/CubaseAdapter.js";
import { CompositeCubaseAdapter } from "./adapters/CompositeCubaseAdapter.js";
import { SafetyController } from "./safety/SafetyController.js";
import { registerCubaseTools } from "./tools/registerTools.js";
import { registerCubaseResources } from "./resources.js";
import { registerCubasePrompts } from "./prompts.js";
import { loadCubaseConfig } from "./config/cubaseConfig.js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

export function createAdapterFromEnv(env: NodeJS.ProcessEnv = process.env): CubaseAdapter {
  const config = loadCubaseConfig(env);
  switch (config.adapter) {
    case "mock":
      return new MockCubaseAdapter();
    case "composite":
      return new CompositeCubaseAdapter(config);
    case "midiRemote":
      return new CompositeCubaseAdapter({ ...config, adapter: "composite" });
    default:
      throw new Error(
        `Unsupported CUBASE_ADAPTER=${config.adapter}. Use composite, midiRemote, or mock.`
      );
  }
}

export interface CubaseMcpRuntime {
  server: McpServer;
  adapter: CubaseAdapter;
  close(): Promise<void>;
}

export async function createCubaseMcpRuntime(adapter: CubaseAdapter): Promise<CubaseMcpRuntime> {
  await adapter.connect();

  const server = new McpServer(
    {
      name: "cubase-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  const controller = new SafetyController(adapter);
  registerCubaseTools(server, controller);
  registerCubaseResources(server, adapter);
  registerCubasePrompts(server);

  return {
    server,
    adapter,
    async close(): Promise<void> {
      await server.close().catch(() => undefined);
      await adapter.disconnect();
    }
  };
}

export async function main(): Promise<void> {
  const runtime = await createCubaseMcpRuntime(createAdapterFromEnv());

  const transport = new StdioServerTransport();
  await runtime.server.connect(transport);
}

const entryPoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (entryPoint === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
