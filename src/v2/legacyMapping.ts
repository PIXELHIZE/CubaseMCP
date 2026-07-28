import { toolDefinitions } from "../tools/definitions.js";
import { v2RouteEntries } from "./ActionRouter.js";

export type LegacyDisposition = "routed" | "consolidated" | "removed";

export interface LegacyToolMapping {
  legacyTool: string;
  legacyOperation: string;
  disposition: LegacyDisposition;
  v2Actions: string[];
  notes: string;
}

const domainFallbacks: Array<[RegExp, string]> = [
  [/^cubase\.load_effect$/, "cubase.plugin.assign"],
  [/^cubase\.(edit_modulation|edit_sustain_pedal)$/, "cubase.midi_edit.edit_controller"],
  [/^cubase\.(get_status|get_capabilities|run_diagnostics|discover_direct_access|audit_command_bindings)/, "cubase.system.diagnose"],
  [/^cubase\.(get|create|open|save|close|set|apply).*project|^cubase\.(set_sample_rate|set_bit_depth|set_frame_rate|create_backup)/, "cubase.project.get"],
  [/track/, "cubase.track.list"],
  [/transport|position|locator|cycle|metronome|punch|preroll|postroll|count_in|nudge/, "cubase.transport.get"],
  [/plugin|insert|instrument|quick_control/, "cubase.plugin.list"],
  [/mixer|volume|pan|mute|solo|monitor|record_enable|meter|eq|channel_strip|vca/, "cubase.mixer_channel.get"],
  [/routing|send|sidechain/, "cubase.mixer_routing.set_output"],
  [/midi|drum_map|legato|scale_assistant/, "cubase.midi_part.get"],
  [/audio|fade|crossfade|bounce|hitpoint|warp|comp/, "cubase.audio_event.get"],
  [/tempo|time_signature|key_signature|scale/, "cubase.tempo.get"],
  [/chord/, "cubase.chord.get"],
  [/marker|arranger|section|song_structure/, "cubase.arrangement.analyze_structure"],
  [/automation/, "cubase.automation.create_lane"],
  [/media|pool|sample|video|relink/, "cubase.media.get_pool"],
  [/export/, "cubase.export_config.get"],
  [/job/, "cubase.job.list"],
  [/undo|redo|snapshot/, "cubase.history.snapshot"],
  [/preview|validate|batch|macro/, "cubase.batch.validate"],
  [/command_binding|trigger_command/, "cubase.debug.command.get_registry"],
  [/direct_access/, "cubase.debug.direct_access.get_capabilities"]
];

const routesByOperation = new Map<string, string[]>();
for (const route of v2RouteEntries) {
  const list = routesByOperation.get(route.operation) ?? [];
  list.push(route.actionKey);
  routesByOperation.set(route.operation, list);
}

export const legacyToolMappings: LegacyToolMapping[] = toolDefinitions.map((definition) => {
  const exact = routesByOperation.get(definition.operation);
  if (exact?.length) {
    return {
      legacyTool: definition.name,
      legacyOperation: definition.operation,
      disposition: "routed",
      v2Actions: exact,
      notes: "The legacy operation is routed through one or more v2 domain actions."
    };
  }
  const fallback = domainFallbacks.find(([pattern]) => pattern.test(definition.name))?.[1];
  if (fallback) {
    return {
      legacyTool: definition.name,
      legacyOperation: definition.operation,
      disposition: "consolidated",
      v2Actions: [fallback],
      notes: "The broad legacy verb is represented by a domain action or capability query; consult the action-level blocker."
    };
  }
  return {
    legacyTool: definition.name,
    legacyOperation: definition.operation,
    disposition: "removed",
    v2Actions: [],
    notes: "Removed from the public v2 surface because no precise, evidence-backed action contract exists."
  };
});

export function auditLegacyMapping(): {
  total: number;
  mapped: number;
  removed: number;
  missing: string[];
} {
  const names = new Set(legacyToolMappings.map((mapping) => mapping.legacyTool));
  const missing = toolDefinitions.map((definition) => definition.name).filter((name) => !names.has(name));
  return {
    total: toolDefinitions.length,
    mapped: legacyToolMappings.filter((mapping) => mapping.disposition !== "removed").length,
    removed: legacyToolMappings.filter((mapping) => mapping.disposition === "removed").length,
    missing
  };
}
