import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

export function registerV2Prompts(server: McpServer): void {
  server.registerPrompt(
    "cubase_v2_create_song",
    {
      title: "Create and Validate Song",
      description: "Plan, create, and verify a playable Cubase song under Song Creation Policy.",
      argsSchema: {
        brief: z.string(),
        bars: z.string().default("4").optional()
      }
    },
    ({ brief, bars }) => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: [
            `Plan a ${bars ?? "4"}-bar song from: ${brief}.`,
            "Call cubase.song action=plan first.",
            "Check cubase.system action=capabilities for cubase.song.create.",
            "Only call cubase.song action=create when the active profile reports status=real.",
            "Validate the returned songId and never substitute a MIDI Track for a software instrument role."
          ].join("\n")
        }
      }]
    })
  );

  server.registerPrompt(
    "cubase_v2_diagnose",
    { title: "Diagnose Cubase v2", description: "Inspect host profile and action-level blockers.", argsSchema: {} },
    () => ({
      messages: [{
        role: "user",
        content: {
          type: "text",
          text: "Call cubase.system action=status, capabilities, and diagnose. Report real actions and blocked actions with blockerReason; never describe a pending or mock-only result as real Cubase evidence."
        }
      }]
    })
  );
}
