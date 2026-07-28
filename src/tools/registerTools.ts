import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SafetyController } from "../safety/SafetyController.js";
import { toolDefinitions } from "./definitions.js";

export function registerCubaseTools(server: McpServer, controller: SafetyController): void {
  for (const definition of toolDefinitions) {
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: definition.inputSchema
      },
      async (args, extra) => {
        const result = await controller.invoke(definition, args);
        await server
          .sendLoggingMessage(
            {
              level: result.ok ? "info" : "warning",
              data: {
                tool: definition.name,
                requestId: result.requestId,
                ok: result.ok,
                errorCode: result.error?.code
              }
            },
            extra.sessionId
          )
          .catch(() => undefined);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2)
            }
          ],
          structuredContent: result,
          isError: !result.ok
        };
      }
    );
  }
}
