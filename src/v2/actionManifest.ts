import type { V2ToolName } from "./actionSchemas.js";

export const v2ActionNames: Record<V2ToolName, readonly string[]> = {
  "cubase.system": ["status", "capabilities", "diagnose"],
  "cubase.project": ["get", "create", "open", "save", "save_as", "close", "backup", "apply_template", "configure"],
  "cubase.song": ["program_catalog", "plan", "create", "validate", "repair", "describe"],
  "cubase.track": [
    "list", "get", "create_default_audio", "create_default_midi", "create_default_instrument",
    "create_default_group", "create_default_fx", "create_default_folder", "create_default_marker",
    "create_from_template", "create_parameterized", "rename", "set_color", "select", "delete",
    "duplicate", "reorder", "move_to_folder", "set_visibility", "freeze", "unfreeze"
  ],
  "cubase.transport": [
    "get", "play", "stop", "pause", "record", "rewind", "forward", "locate", "nudge",
    "set_locators", "set_cycle", "set_metronome", "set_punch", "set_count_in", "set_preroll", "set_postroll"
  ],
  "cubase.mixer_channel": [
    "get", "set_level", "set_pan", "set_input_gain", "set_phase", "set_mute", "set_solo",
    "set_record_enable", "set_monitor", "get_meters", "set_eq_band", "set_strip", "set_vca"
  ],
  "cubase.mixer_routing": ["set_output", "route_to_group", "set_sidechain", "set_send", "remove_send"],
  "cubase.plugin": [
    "list", "assign", "remove", "enable", "bypass", "list_parameters", "get_parameter",
    "set_parameter", "load_preset", "set_sidechain", "set_output", "set_window"
  ],
  "cubase.midi_part": ["create", "get", "delete", "copy", "move", "import_file", "generate_file"],
  "cubase.midi_edit": ["list_notes", "add_notes", "update_notes", "delete_notes", "edit_controller", "edit_pitch_bend"],
  "cubase.midi_transform": ["quantize", "humanize", "transpose", "legato", "fixed_length", "apply_drum_map", "apply_scale"],
  "cubase.audio_event": ["import", "create", "get", "update", "delete", "split", "copy", "move", "set_fade", "crossfade"],
  "cubase.audio_process": [
    "normalize", "reverse", "render", "bounce", "time_stretch", "pitch_shift", "quantize",
    "detect_silence", "set_warp", "analyze_hitpoints", "comp"
  ],
  "cubase.tempo": ["get", "set", "add_event", "update_event", "delete_event", "set_time_signature", "set_key", "set_scale", "create_map"],
  "cubase.chord": ["get", "create", "update", "delete", "create_progression"],
  "cubase.arrangement": [
    "add_marker", "update_marker", "delete_marker", "add_cycle_marker", "create_arranger_event",
    "create_arranger_chain", "reorder_arranger_chain", "duplicate_section", "analyze_structure"
  ],
  "cubase.automation": [
    "create_lane", "add_points", "update_points", "delete_points", "set_curve",
    "set_read", "set_write", "write_series", "smooth", "trim"
  ],
  "cubase.media": ["get_pool", "import_video", "import_sample", "clean_unused", "relink", "search"],
  "cubase.export_config": [
    "get", "set_format", "set_sample_rate", "set_bit_depth", "set_range",
    "set_path", "set_filename_pattern", "set_loudness", "set_realtime"
  ],
  "cubase.export_run": [
    "perform_current_settings", "mixdown_explicit", "stems", "selected_tracks",
    "selected_events", "selected_event", "batch"
  ],
  "cubase.job": ["list", "get", "cancel"],
  "cubase.history": ["undo", "redo", "snapshot"],
  "cubase.batch": ["preview", "validate", "execute"],
  "cubase.debug.command": ["get_registry", "can_perform", "trigger"],
  "cubase.debug.direct_access": [
    "get_capabilities", "discover_tree", "get_object", "get_parameters",
    "get_parameter", "set_parameter"
  ]
};

export interface V2ActionDescriptor {
  tool: V2ToolName;
  action: string;
  key: string;
  diagnostic: boolean;
}

export const v2Actions: V2ActionDescriptor[] = Object.entries(v2ActionNames).flatMap(([tool, actions]) =>
  actions.map((action) => ({
    tool: tool as V2ToolName,
    action,
    key: `${tool}.${action}`,
    diagnostic: tool.startsWith("cubase.debug.")
  }))
);

export function actionKey(tool: string, action: string): string {
  return `${tool}.${action}`;
}

export function hasV2Action(tool: string, action: string): boolean {
  return v2Actions.some((candidate) => candidate.tool === tool && candidate.action === action);
}
