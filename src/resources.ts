import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CubaseAdapter } from "./adapters/CubaseAdapter.js";
import { defaultSafetyPolicy } from "./safety/Permissions.js";
import { defaultCapabilityMatrix } from "./state/CapabilityMatrix.js";

function jsonResource(uri: URL, value: unknown) {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

export function registerCubaseResources(server: McpServer, adapter: CubaseAdapter): void {
  server.registerResource(
    "cubase-status",
    "cubase://status",
    { title: "Cubase Status", description: "Connection, transport, project-open and stale-state status.", mimeType: "application/json" },
    async (uri) => {
      const state = await adapter.getState();
      return jsonResource(uri, { cubase: state.cubase, transport: state.transport, lastUpdatedAt: state.lastUpdatedAt, stale: state.stale });
    }
  );
  server.registerResource(
    "cubase-state",
    "cubase://state",
    {
      title: "Cubase State",
      description: "Full Cubase state snapshot.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, await adapter.getState())
  );

  server.registerResource(
    "cubase-selected-tracks",
    "cubase://selected-tracks",
    { title: "Selected Cubase Tracks", description: "Tracks referenced by the current structured selection.", mimeType: "application/json" },
    async (uri) => {
      const state = await adapter.getState();
      const ids = new Set(state.selectedObjects.filter((item) => item.type === "track").map((item) => item.id));
      return jsonResource(uri, state.tracks.filter((track) => ids.has(track.id)));
    }
  );

  server.registerResource(
    "cubase-mixer",
    "cubase://mixer",
    { title: "Cubase Mixer", description: "Visible mixer bank, channel levels, inserts and sends from structured state.", mimeType: "application/json" },
    async (uri) => {
      const state = await adapter.getState();
      return jsonResource(uri, { visibleMixerBank: state.visibleMixerBank, channels: state.tracks.map(({ id, name, volumeDb, pan, mute, solo, inserts, sends }) => ({ id, name, volumeDb, pan, mute, solo, inserts, sends })) });
    }
  );

  server.registerResource(
    "cubase-project",
    "cubase://project",
    {
      title: "Cubase Project",
      description: "Current project setup and metadata.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, await adapter.getProject())
  );

  server.registerResource(
    "cubase-markers",
    "cubase://markers",
    { title: "Cubase Markers", description: "Position and cycle markers.", mimeType: "application/json" },
    async (uri) => jsonResource(uri, (await adapter.getState()).markers)
  );

  server.registerResource(
    "cubase-tempo-map",
    "cubase://tempo-map",
    { title: "Cubase Tempo Map", description: "Current tempo and discovered tempo-map events.", mimeType: "application/json" },
    async (uri) => {
      const state = await adapter.getState();
      return jsonResource(uri, { tempo: state.project.tempo, timeSignature: state.project.timeSignature, key: state.project.key, events: state.tempoMap });
    }
  );

  server.registerResource(
    "cubase-automation",
    "cubase://automation",
    { title: "Cubase Automation", description: "Discovered automation lanes and points.", mimeType: "application/json" },
    async (uri) => jsonResource(uri, (await adapter.getState()).automation)
  );

  server.registerResource(
    "cubase-tracks",
    "cubase://tracks",
    {
      title: "Cubase Tracks",
      description: "All visible tracks.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, await adapter.listTracks({ includeHidden: false }))
  );

  server.registerResource(
    "cubase-diagnostics",
    "cubase://diagnostics",
    { title: "Cubase Diagnostics", description: "State freshness and adapter setup/capability diagnostics.", mimeType: "application/json" },
    async (uri) => {
      const state = await adapter.getState();
      return jsonResource(uri, { connected: state.cubase.connected, stale: state.stale, lastUpdatedAt: state.lastUpdatedAt, adapters: await adapter.getCapabilities() });
    }
  );

  server.registerResource(
    "cubase-track",
    new ResourceTemplate("cubase://tracks/{trackId}", { list: undefined }),
    {
      title: "Cubase Track",
      description: "A single Cubase track by stable ID.",
      mimeType: "application/json"
    },
    async (uri, variables) => {
      const trackId = Array.isArray(variables.trackId) ? variables.trackId[0] : variables.trackId;
      return jsonResource(uri, await adapter.getTrack(trackId));
    }
  );

  server.registerResource(
    "cubase-plugins",
    "cubase://plugins",
    {
      title: "Cubase Plugins",
      description: "Available and loaded plugins.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, await adapter.listPlugins({ includeLoaded: true }))
  );

  server.registerResource(
    "cubase-jobs",
    "cubase://jobs",
    {
      title: "Cubase Jobs",
      description: "Export, render, scan, backup, and import jobs.",
      mimeType: "application/json"
    },
    async (uri) => jsonResource(uri, await adapter.listJobs())
  );

  server.registerResource(
    "cubase-capabilities",
    "cubase://capabilities",
    {
      title: "Cubase Capabilities",
      description: "Adapter capability matrix.",
      mimeType: "application/json"
    },
    async (uri) =>
      jsonResource(uri, {
        adapters: await adapter.getCapabilities(),
        tools: defaultCapabilityMatrix.list()
      })
  );

  server.registerResource(
    "cubase-safety-policy",
    "cubase://safety/policy",
    {
      title: "Cubase Safety Policy",
      description: "Active confirmation and permission policy.",
      mimeType: "application/json"
    },
    async (uri) =>
      jsonResource(uri, {
        ...defaultSafetyPolicy,
        allowedPermissions: [...defaultSafetyPolicy.allowedPermissions]
      })
  );
}
