import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { v2ToolDefinitions } from "./catalog.js";
import type { V2Controller } from "./V2Controller.js";

export function registerV2Tools(server: McpServer, controller: V2Controller): void {
  for (const definition of v2ToolDefinitions) {
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema
      },
      async (args, extra) => {
        const result = await controller.invoke(definition.name, args);
        await server.sendLoggingMessage({
          level: result.ok ? "info" : "warning",
          data: {
            tool: definition.name,
            action: result.action,
            requestId: result.requestId,
            ok: result.ok,
            capabilityStatus: result.capability.status,
            errorCode: result.error?.code
          }
        }, extra.sessionId).catch(() => undefined);
        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          structuredContent: result,
          isError: !result.ok
        };
      }
    );
  }
}
