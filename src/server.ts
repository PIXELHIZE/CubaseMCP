#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { MockCubaseAdapter } from "./adapters/MockCubaseAdapter.js";
import type { CubaseAdapter } from "./adapters/CubaseAdapter.js";
import { CompositeCubaseAdapter } from "./adapters/CompositeCubaseAdapter.js";
import { loadCubaseConfig } from "./config/cubaseConfig.js";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { CapabilityRegistry } from "./v2/CapabilityRegistry.js";
import { detectHostProfile } from "./v2/HostProfile.js";
import { V2Controller } from "./v2/V2Controller.js";
import { registerV2Tools } from "./v2/registerV2Tools.js";
import { registerV2Resources } from "./v2/resources.js";
import { registerV2Prompts } from "./v2/prompts.js";
import { Automation14SongExecutor } from "./automation14/Automation14SongExecutor.js";
import { Automation14ExportExecutor } from "./automation14/Automation14ExportExecutor.js";
import { Automation14ProjectExecutor } from "./automation14/Automation14ProjectExecutor.js";

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
  controller: V2Controller;
  close(): Promise<void>;
}

export interface CubaseMcpRuntimeOptions {
  capabilityManifestPath?: string;
}

export async function createCubaseMcpRuntime(
  adapter: CubaseAdapter,
  options: CubaseMcpRuntimeOptions = {}
): Promise<CubaseMcpRuntime> {
  await adapter.connect();
  const host = await detectHostProfile(adapter);
  const capabilities = new CapabilityRegistry();
  const manifestPath = options.capabilityManifestPath ?? process.env.CUBASE_V2_CAPABILITY_MANIFEST;
  if (manifestPath) await capabilities.loadManifest(manifestPath);
  const automation14Executor = host.profile === "automation14" ? new Automation14SongExecutor(adapter) : undefined;
  const automation14ExportExecutor = host.profile === "automation14" ? new Automation14ExportExecutor() : undefined;
  const automation14ProjectExecutor = host.profile === "automation14" ? new Automation14ProjectExecutor() : undefined;
  const controller = new V2Controller(adapter, host, capabilities, automation14Executor, automation14ExportExecutor, automation14ProjectExecutor);

  const server = new McpServer(
    {
      name: "cubase-mcp",
      version: "2.0.0"
    },
    {
      capabilities: {
        logging: {}
      }
    }
  );

  registerV2Tools(server, controller);
  registerV2Resources(server, adapter, controller);
  registerV2Prompts(server);

  return {
    server,
    adapter,
    controller,
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
