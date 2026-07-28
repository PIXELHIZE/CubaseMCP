import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MockCubaseAdapter } from "../../src/adapters/MockCubaseAdapter.js";
import { createCubaseMcpRuntime, type CubaseMcpRuntime } from "../../src/server.js";
import requiredTools from "../fixtures/required-tools.json" with { type: "json" };

describe("MCP catalog", () => {
  let runtime: CubaseMcpRuntime;
  let client: Client;

  beforeEach(async () => {
    runtime = await createCubaseMcpRuntime(new MockCubaseAdapter());
    client = new Client({ name: "catalog-test", version: "1.0.0" }, { capabilities: {} });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([runtime.server.connect(serverTransport), client.connect(clientTransport)]);
  });

  afterEach(async () => {
    await client.close().catch(() => undefined);
    await runtime.close();
  });

  it("publishes every required tool through the SDK", async () => {
    const result = await client.listTools();
    const names = new Set(result.tools.map((tool) => tool.name));
    expect(result.tools.length).toBeGreaterThanOrEqual(238);
    expect(requiredTools.filter((name) => !names.has(name))).toEqual([]);
    expect(result.tools.every((tool) => tool.description && tool.inputSchema)).toBe(true);
  });

  it("publishes required resources and prompts", async () => {
    const resources = await client.listResources();
    const resourceUris = new Set(resources.resources.map((resource) => resource.uri));
    for (const uri of ["cubase://status", "cubase://project", "cubase://tracks", "cubase://selected-tracks", "cubase://mixer", "cubase://plugins", "cubase://markers", "cubase://tempo-map", "cubase://automation", "cubase://capabilities", "cubase://diagnostics", "cubase://jobs"]) {
      expect(resourceUris.has(uri), uri).toBe(true);
    }

    const prompts = await client.listPrompts();
    const promptNames = new Set(prompts.prompts.map((prompt) => prompt.name));
    for (const name of ["cubase_create_song", "cubase_create_house_beat", "cubase_mix_vocal_forward", "cubase_clean_project", "cubase_export_stems", "cubase_prepare_recording_session", "cubase_fix_timing", "cubase_make_chord_progression", "cubase_master_rough_mix", "cubase_diagnose_project"]) {
      expect(promptNames.has(name), name).toBe(true);
    }
  });

  it("returns structured tool content and readable resources", async () => {
    const tool = await client.callTool({ name: "cubase.get_status", arguments: {} });
    expect(tool.isError).toBe(false);
    expect(tool.structuredContent).toMatchObject({ ok: true, tool: "cubase.get_status", status: "mock_only" });

    const resource = await client.readResource({ uri: "cubase://status" });
    expect(resource.contents[0]).toMatchObject({ mimeType: "application/json" });
  });
});
