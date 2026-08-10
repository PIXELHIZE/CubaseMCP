import type { z } from "zod/v4";
import { v2ActionSchemas, type V2ToolName } from "./actionSchemas.js";

export interface V2ToolDefinition {
  name: V2ToolName;
  title: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  diagnostic?: boolean;
}

const metadata: Record<V2ToolName, Omit<V2ToolDefinition, "name" | "inputSchema">> = {
  "cubase.system": { title: "Cubase System", description: "Inspect connection, release profile, action capabilities, and diagnostics." },
  "cubase.project": { title: "Cubase Project", description: "Read or manage the current Cubase project using an explicit action." },
  "cubase.song": { title: "Cubase Song", description: "List HALion programs, plan, create, validate, repair, or describe a playable song. Software roles always resolve to Instrument Tracks, never MIDI Tracks." },
  "cubase.track": { title: "Cubase Track", description: "List, create, select, update, organize, freeze, or delete tracks with action-specific contracts." },
  "cubase.transport": { title: "Cubase Transport", description: "Read and control transport, positions, locators, cycle, metronome, punch, and roll settings." },
  "cubase.mixer_channel": { title: "Cubase Mixer Channel", description: "Read or change channel values, meters, EQ, strip modules, and VCA membership." },
  "cubase.mixer_routing": { title: "Cubase Mixer Routing", description: "Manage output, group, sidechain, and send routing." },
  "cubase.plugin": { title: "Cubase Plugin", description: "Inspect and manage plugin slots, parameters, presets, sidechains, outputs, and windows." },
  "cubase.midi_part": { title: "Cubase MIDI Part", description: "Create, move, copy, delete, import, or generate MIDI parts and files." },
  "cubase.midi_edit": { title: "Cubase MIDI Edit", description: "Edit notes, controllers, and pitch bend inside an existing MIDI part." },
  "cubase.midi_transform": { title: "Cubase MIDI Transform", description: "Quantize, humanize, transpose, legato, length, drum-map, or scale-transform MIDI." },
  "cubase.audio_event": { title: "Cubase Audio Event", description: "Import and edit audio events, positions, fades, splits, moves, and crossfades." },
  "cubase.audio_process": { title: "Cubase Audio Process", description: "Apply audio processing, rendering, warping, hitpoint analysis, or comping." },
  "cubase.tempo": { title: "Cubase Tempo", description: "Read and edit tempo, signatures, keys, scales, and tempo maps." },
  "cubase.chord": { title: "Cubase Chord", description: "Read and edit chord events and progressions." },
  "cubase.arrangement": { title: "Cubase Arrangement", description: "Manage markers, arranger events/chains, sections, and structure analysis." },
  "cubase.automation": { title: "Cubase Automation", description: "Manage automation lanes, points, curves, modes, series, smoothing, and trimming." },
  "cubase.media": { title: "Cubase Media", description: "Inspect the pool, import media, clean, relink, or search MediaBay." },
  "cubase.export_config": { title: "Cubase Export Configuration", description: "Read or change one explicit export setting per action." },
  "cubase.export_run": { title: "Cubase Export", description: "Run current-settings, explicit, stem, selected, or batch exports." },
  "cubase.job": { title: "Cubase Job", description: "List, inspect, or cancel asynchronous Cubase MCP jobs." },
  "cubase.history": { title: "Cubase History", description: "Undo, redo, or create a recovery snapshot." },
  "cubase.batch": { title: "Cubase Batch", description: "Preview, validate, or sequentially execute multiple v2 actions without claiming atomicity." },
  "cubase.debug.command": { title: "Cubase Command Diagnostics", description: "Diagnostic-only raw Command Binding registry, canPerform, and trigger access.", diagnostic: true },
  "cubase.debug.direct_access": { title: "Cubase DirectAccess Diagnostics", description: "Diagnostic-only raw DirectAccess discovery and parameter access.", diagnostic: true }
};

export const v2ToolDefinitions: V2ToolDefinition[] = Object.entries(v2ActionSchemas).map(([name, inputSchema]) => ({
  name: name as V2ToolName,
  inputSchema,
  ...metadata[name as V2ToolName]
}));

export function getV2ToolDefinition(name: string): V2ToolDefinition {
  const definition = v2ToolDefinitions.find((candidate) => candidate.name === name);
  if (!definition) throw new Error(`Unknown Cubase MCP v2 tool: ${name}`);
  return definition;
}
