import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod/v4";
import { describe, expect, it } from "vitest";
import { getToolDefinition } from "../../src/tools/index.js";

interface ToolCall {
  tool: string;
  arguments: Record<string, unknown>;
}

function collect(value: unknown, output: ToolCall[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collect(item, output);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  if (typeof record.tool === "string" && typeof record.arguments === "object" && record.arguments !== null) {
    output.push({ tool: record.tool, arguments: record.arguments as Record<string, unknown> });
  }
  for (const nested of Object.values(record)) collect(nested, output);
}

describe("workflow examples", () => {
  it("contains only registered tool calls whose arguments satisfy their schemas", async () => {
    const files = (await readdir(resolve("examples"))).filter((file) => file.endsWith(".json"));
    const calls: ToolCall[] = [];
    for (const file of files) collect(JSON.parse(await readFile(resolve("examples", file), "utf8")), calls);
    expect(calls.length).toBeGreaterThan(20);
    for (const call of calls) {
      const definition = getToolDefinition(call.tool);
      expect(() => z.object(definition.inputSchema).parse(call.arguments), call.tool).not.toThrow();
    }
  });
});
