import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MockCubaseAdapter } from "../../src/adapters/MockCubaseAdapter.js";
import { createCubaseMcpRuntime, type CubaseMcpRuntime } from "../../src/server.js";
import { v2ToolNames } from "../../src/v2/actionSchemas.js";

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

  it("publishes exactly the 25 v2 domain tools through the SDK", async () => {
    const result = await client.listTools();
    const names = new Set(result.tools.map((tool) => tool.name));
    expect(result.tools).toHaveLength(25);
    expect(v2ToolNames.filter((name) => !names.has(name))).toEqual([]);
    expect(names.has("cubase.get_status")).toBe(false);
    expect(result.tools.every((tool) => tool.description && tool.inputSchema)).toBe(true);
  });

  it("publishes required resources and prompts", async () => {
    const resources = await client.listResources();
    const resourceUris = new Set(resources.resources.map((resource) => resource.uri));
    for (const uri of ["cubase://v2/status", "cubase://v2/state", "cubase://v2/project", "cubase://v2/tracks", "cubase://v2/capabilities", "cubase://v2/actions", "cubase://v2/song-policy"]) {
      expect(resourceUris.has(uri), uri).toBe(true);
    }

    const prompts = await client.listPrompts();
    const promptNames = new Set(prompts.prompts.map((prompt) => prompt.name));
    for (const name of ["cubase_v2_create_song", "cubase_v2_diagnose"]) {
      expect(promptNames.has(name), name).toBe(true);
    }
  });

  it("returns structured tool content and readable resources", async () => {
    const tool = await client.callTool({ name: "cubase.system", arguments: { action: "status" } });
    expect(tool.isError).toBe(false);
    expect(tool.structuredContent).toMatchObject({
      ok: true,
      tool: "cubase.system",
      action: "status",
      capability: { status: "real", constraints: { testOnly: true } }
    });

    const resource = await client.readResource({ uri: "cubase://v2/status" });
    expect(resource.contents[0]).toMatchObject({ mimeType: "application/json" });
    const actions = await client.readResource({ uri: "cubase://v2/actions" });
    const actionContent = actions.contents[0];
    expect(actionContent && "text" in actionContent).toBe(true);
    const catalog = JSON.parse(actionContent && "text" in actionContent ? actionContent.text : "{}");
    expect(catalog.count).toBe(199);
    expect(catalog.actions[0]).toMatchObject({
      key: expect.any(String),
      inputSchema: expect.any(Object),
      example: expect.any(Object),
      capability: { constraints: { testOnly: true } }
    });
  });
});
