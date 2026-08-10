import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CubaseAdapter } from "../adapters/CubaseAdapter.js";
import type { V2Controller } from "./V2Controller.js";
import { v2ActionDocumentation } from "./ActionDocumentation.js";

function jsonResource(uri: URL, value: unknown) {
  return {
    contents: [{
      uri: uri.href,
      mimeType: "application/json",
      text: JSON.stringify(value, null, 2)
    }]
  };
}

export function registerV2Resources(server: McpServer, adapter: CubaseAdapter, controller: V2Controller): void {
  server.registerResource(
    "cubase-v2-status",
    "cubase://v2/status",
    { title: "Cubase MCP v2 Status", description: "Host profile, connection, project, and release support status.", mimeType: "application/json" },
    async (uri) => {
      const state = await adapter.getState();
      return jsonResource(uri, {
        protocolVersion: 2,
        host: controller.getHost(),
        cubase: state.cubase,
        transport: state.transport,
        stale: state.stale,
        lastUpdatedAt: state.lastUpdatedAt
      });
    }
  );

  server.registerResource(
    "cubase-v2-state",
    "cubase://v2/state",
    { title: "Cubase State", description: "Structured state exposed by official headless paths.", mimeType: "application/json" },
    async (uri) => jsonResource(uri, await adapter.getState())
  );

  server.registerResource(
    "cubase-v2-project",
    "cubase://v2/project",
    { title: "Cubase Project", description: "Current project metadata.", mimeType: "application/json" },
    async (uri) => jsonResource(uri, await adapter.getProject())
  );

  server.registerResource(
    "cubase-v2-tracks",
    "cubase://v2/tracks",
    { title: "Cubase Tracks", description: "Visible project tracks with stable IDs.", mimeType: "application/json" },
    async (uri) => jsonResource(uri, await adapter.listTracks({ includeHidden: false }))
  );

  server.registerResource(
    "cubase-v2-track",
    new ResourceTemplate("cubase://v2/tracks/{trackId}", { list: undefined }),
    { title: "Cubase Track", description: "One track by stable ID.", mimeType: "application/json" },
    async (uri, variables) => {
      const trackId = Array.isArray(variables.trackId) ? variables.trackId[0] : variables.trackId;
      return jsonResource(uri, await adapter.getTrack(trackId));
    }
  );

  server.registerResource(
    "cubase-v2-capabilities",
    "cubase://v2/capabilities",
    {
      title: "Cubase v2 Action Capabilities",
      description: "Action-level real or blocked claims for the active host release profile.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, {
      host: controller.getHost(),
      actions: controller.getCapabilityRegistry().list(controller.getHost())
    })
  );

  server.registerResource(
    "cubase-v2-actions",
    "cubase://v2/actions",
    {
      title: "Cubase v2 Action Catalog",
      description: "Action-level summaries, validated examples, and active-host capability claims.",
      mimeType: "application/json"
    },
    async (uri) => {
      const capabilities = new Map(
        controller.getCapabilityRegistry().list(controller.getHost()).map((capability) => [capability.key, capability])
      );
      return jsonResource(uri, {
        count: v2ActionDocumentation.length,
        actions: v2ActionDocumentation.map((document) => ({
          ...document,
          capability: capabilities.get(document.key)
        }))
      });
    }
  );

  server.registerResource(
    "cubase-v2-song-policy",
    "cubase://v2/song-policy",
    {
      title: "Song Creation Policy",
      description: "Strict musical-role to Cubase-track-type resolution and success criteria.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, {
      version: 2,
      mappings: {
        software_instrument: "instrument",
        external_midi: "midi",
        audio_recording: "audio",
        audio_loop: "audio",
        bus: "group",
        send_fx: "fx"
      },
      roleDefaults: {
        drums: "instrument",
        bass: "instrument",
        chords: "instrument",
        lead: "instrument",
        pad: "instrument",
        arp: "instrument",
        vocal: "audio",
        guitar: "audio",
        reverb: "fx",
        delay: "fx",
        drum_bus: "group",
        music_bus: "group",
        chord_progression: "chord",
        markers: "marker",
        external_hardware_synth: "midi",
        rack_multitimbral_channel: "midi"
      },
      forbiddenSuccesses: [
        "software instrument role created as a MIDI Track",
        "Instrument Track without a loaded instrument",
        "required musical track without playable content",
        "MIDI file generated but not imported into Cubase",
        "named track without playable content"
      ]
    })
  );
}
