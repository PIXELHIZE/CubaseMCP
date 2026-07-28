import { createServer } from "node:net";
import { loadPluginBridgeConfig } from "../../config/pluginBridgeConfig.js";
import type { PluginBridgeRequest, PluginBridgeResponse } from "../../bridge/plugin/PluginBridgeProtocol.js";

const config = loadPluginBridgeConfig();

export function startPluginBridgeStub(): ReturnType<typeof createServer> {
  const server = createServer((socket) => {
    socket.setEncoding("utf8");
    let buffer = "";
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      const request = JSON.parse(buffer.slice(0, newline)) as PluginBridgeRequest;
      const authenticated = !config.authToken || request.auth?.scheme === "bearer" && request.auth.token === config.authToken;
      const response: PluginBridgeResponse = {
        id: request.id,
        correlationId: request.correlationId,
        protocol: "cubase-mcp-plugin-bridge",
        version: 1,
        ok: authenticated && (request.command === "ping" || request.command === "get_capabilities"),
        payload: authenticated && request.command === "ping" ? { stub: true } : authenticated && request.command === "get_capabilities" ? { stub: true, realCubase: false } : undefined,
        error: authenticated && (request.command === "ping" || request.command === "get_capabilities") ? undefined : {
          code: authenticated ? "BLOCKED_BY_MISSING_CUBASE_SIDE_BRIDGE" : "PERMISSION_DENIED",
          message: authenticated ? "Development stub does not execute Cubase operations." : "Plugin bridge authentication failed.",
          recoverable: true
        }
      };
      socket.end(`${JSON.stringify(response)}\n`);
    });
  });
  server.listen(config.pipeName);
  return server;
}
