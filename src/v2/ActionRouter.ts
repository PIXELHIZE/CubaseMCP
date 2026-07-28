import type { CubaseAdapter, OperationContext, OperationResult } from "../adapters/CubaseAdapter.js";
import type { TargetRef } from "./contracts.js";
import { positionToCubaseString } from "./contracts.js";
import type { V2ToolName } from "./actionSchemas.js";
import { v2ActionNames } from "./actionManifest.js";

const operationByTool: Partial<Record<V2ToolName, Record<string, string>>> = {
  "cubase.project": {
    get: "getProject", create: "createProject", open: "openProject", save: "saveProject",
    save_as: "saveProjectAs", close: "closeProject", backup: "createBackup",
    apply_template: "applyProjectTemplate", configure: "setProjectSetup"
  },
  "cubase.track": {
    list: "listTracks", get: "getTrack", create_default_audio: "createTrackDefaultAudio",
    create_default_midi: "createTrackDefaultMidi", create_default_instrument: "createTrackDefaultInstrument",
    create_default_group: "createTrackDefaultGroup", create_default_fx: "createTrackDefaultFx",
    create_default_folder: "createTrackDefaultFolder", create_default_marker: "createTrackDefaultMarker",
    create_from_template: "createTrackFromPreset", create_parameterized: "createTrackParameterized",
    rename: "renameTrack", set_color: "setTrackColor", select: "selectTracks", delete: "deleteTrack",
    duplicate: "duplicateTrack", reorder: "reorderTrack", move_to_folder: "moveTrackToFolder",
    set_visibility: "setTrackVisibility", freeze: "freezeTrack", unfreeze: "unfreezeTrack"
  },
  "cubase.transport": {
    get: "getStatus", play: "transportPlay", stop: "transportStop", pause: "transportPause",
    record: "transportRecord", rewind: "transportRewind", forward: "transportForward", locate: "locate",
    nudge: "nudgeTransport", set_locators: "setLocators", set_cycle: "setTransportOptions",
    set_metronome: "setTransportOptions", set_punch: "setTransportOptions",
    set_count_in: "setTransportOptions", set_preroll: "setTransportOptions", set_postroll: "setTransportOptions"
  },
  "cubase.mixer_channel": {
    get: "getTrack", set_level: "setTrackVolume", set_pan: "setTrackPan",
    set_input_gain: "setInputGain", set_phase: "setPhaseInvert", set_mute: "setTrackMute",
    set_solo: "setTrackSolo", set_record_enable: "setTrackRecordEnable",
    set_monitor: "setTrackMonitor", get_meters: "getMeterLevels", set_eq_band: "setEqBand",
    set_strip: "setChannelStrip", set_vca: "setVca"
  },
  "cubase.mixer_routing": {
    set_output: "setRouting", route_to_group: "setGroupRouting",
    set_sidechain: "setSidechainRouting", set_send: "addSend", remove_send: "removeSend"
  },
  "cubase.plugin": {
    list: "listPlugins", assign: "directAccessSetSlotPlugin", remove: "directAccessResetSlotPlugin",
    enable: "setPluginEnabled", bypass: "bypassPlugin", list_parameters: "directAccessGetParameters",
    get_parameter: "directAccessGetParameter", set_parameter: "directAccessSetParameterProcessValue",
    load_preset: "loadPluginPreset", set_sidechain: "setPluginSidechain",
    set_output: "setInstrumentOutput", set_window: "setPluginWindow"
  },
  "cubase.midi_part": {
    create: "createMidiPart", get: "getMidiPart", delete: "deleteMidiPart", copy: "copyMidiPart",
    move: "moveMidiPart", import_file: "importMidiFile", generate_file: "createMidiPartFromGeneratedFile"
  },
  "cubase.midi_edit": {
    list_notes: "listMidiNotes", add_notes: "addMidiNote", update_notes: "editMidiNotes",
    delete_notes: "deleteMidiNotes", edit_controller: "editMidiController", edit_pitch_bend: "editPitchBend"
  },
  "cubase.midi_transform": {
    quantize: "quantizeMidi", humanize: "humanizeMidi", transpose: "transposeMidi",
    legato: "applyLegato", fixed_length: "applyFixedLength", apply_drum_map: "applyDrumMap",
    apply_scale: "applyScaleAssistant"
  },
  "cubase.audio_event": {
    import: "importAudio", create: "createAudioEvent", get: "getAudioEvent", update: "editAudioEvent",
    delete: "deleteAudioEvent", split: "splitAudioEvent", copy: "copyAudioEvent",
    move: "moveAudioEvent", set_fade: "setFade", crossfade: "createCrossfade"
  },
  "cubase.audio_process": {
    normalize: "normalizeAudio", reverse: "reverseAudio", render: "renderInPlace",
    bounce: "bounceSelection", time_stretch: "timeStretchAudio", pitch_shift: "pitchShiftAudio",
    quantize: "quantizeAudio", detect_silence: "detectSilence", set_warp: "setAudioWarp",
    analyze_hitpoints: "analyzeHitpoints", comp: "compAudio"
  },
  "cubase.tempo": {
    get: "getTempo", set: "setTempo", add_event: "addTempoEvent", update_event: "updateTempoEvent",
    delete_event: "deleteTempoEvent", set_time_signature: "setTimeSignature",
    set_key: "setKeySignature", set_scale: "setScale", create_map: "createTempoMap"
  },
  "cubase.chord": {
    get: "getChordTrack", create: "createChord", update: "updateChordTrack",
    delete: "updateChordTrack", create_progression: "createChordProgression"
  },
  "cubase.arrangement": {
    add_marker: "addMarker", update_marker: "updateMarker", delete_marker: "deleteMarker",
    add_cycle_marker: "addCycleMarker", create_arranger_event: "createArrangerEvent",
    create_arranger_chain: "createArrangerChain", reorder_arranger_chain: "reorderArrangerChain",
    duplicate_section: "duplicateSection", analyze_structure: "analyzeSongStructure"
  },
  "cubase.automation": {
    create_lane: "createAutomationLane", add_points: "addAutomationPoint",
    update_points: "editAutomationPoint", delete_points: "deleteAutomationPoint",
    set_curve: "setAutomationCurve", set_read: "setAutomationRead", set_write: "setAutomationWrite",
    write_series: "writePluginParameterAutomation", smooth: "smoothAutomation", trim: "trimAutomation"
  },
  "cubase.media": {
    get_pool: "getPool", import_video: "importVideoFile", import_sample: "importSample",
    clean_unused: "cleanUnusedMedia", relink: "relinkMissingFiles", search: "searchMediaBay"
  },
  "cubase.export_config": {
    get: "getExportSettings", set_format: "setExportFormat", set_sample_rate: "setExportSampleRate",
    set_bit_depth: "setExportBitDepth", set_range: "setExportRange", set_path: "setExportSettings",
    set_filename_pattern: "setExportFilenamePattern", set_loudness: "setExportLoudnessTarget",
    set_realtime: "setExportRealtime"
  },
  "cubase.export_run": {
    perform_current_settings: "performCurrentAudioExport", mixdown_explicit: "exportMixdown",
    stems: "exportStems", selected_tracks: "exportSelectedTracks",
    selected_events: "exportSelectedEvents", selected_event: "exportSelectedEvent", batch: "batchExport"
  },
  "cubase.job": { list: "listJobs", get: "getJob", cancel: "cancelExportJob" },
  "cubase.history": { undo: "undo", redo: "redo", snapshot: "createUndoSnapshot" },
  "cubase.debug.command": {
    get_registry: "commandBindingGetRegistry", can_perform: "commandBindingCanPerform", trigger: "triggerCommand"
  },
  "cubase.debug.direct_access": {
    get_capabilities: "directAccessGetCapabilities", discover_tree: "directAccessDiscoverObjectTree",
    get_object: "directAccessGetObjectMetadata", get_parameters: "directAccessGetParameters",
    get_parameter: "directAccessGetParameter", set_parameter: "directAccessSetParameterProcessValue"
  }
};

export const v2RouteEntries = Object.entries(operationByTool).flatMap(([tool, routes]) =>
  Object.entries(routes ?? {}).map(([action, operation]) => ({
    tool: tool as V2ToolName,
    action,
    actionKey: `${tool}.${action}`,
    operation
  }))
);

function omitControlFields(input: Record<string, unknown>): Record<string, unknown> {
  const { action: _action, requestId: _requestId, correlationId: _correlationId, timeoutMs: _timeoutMs, dryRun: _dryRun, confirm: _confirm, ...rest } = input;
  return rest;
}

function isTargetRef(value: unknown): value is TargetRef {
  return typeof value === "object" && value !== null && "kind" in value;
}

export class ActionRouter {
  constructor(private readonly adapter: CubaseAdapter) {
    const missing: string[] = [];
    for (const [tool, actions] of Object.entries(v2ActionNames)) {
      if (tool === "cubase.system" || tool === "cubase.song" || tool === "cubase.batch") continue;
      for (const action of actions) {
        if (!operationByTool[tool as V2ToolName]?.[action]) missing.push(`${tool}.${action}`);
      }
    }
    if (missing.length > 0) throw new Error(`Missing v2 action routes: ${missing.join(", ")}`);
  }

  routeCount(): number {
    return Object.values(operationByTool).reduce((count, routes) => count + Object.keys(routes ?? {}).length, 0);
  }

  async execute(
    tool: V2ToolName,
    action: string,
    input: Record<string, unknown>,
    context: OperationContext
  ): Promise<OperationResult> {
    if (tool === "cubase.history" && action === "snapshot") {
      return { changed: false, data: { snapshotId: await this.adapter.createUndoSnapshot(String(input.label)) } };
    }
    if (tool === "cubase.midi_part" && action === "get") return this.getMidiPart(input);
    if (tool === "cubase.midi_edit" && action === "list_notes") return this.listMidiNotes(input);
    if (tool === "cubase.audio_event" && action === "get") return this.getAudioEvent(input);
    if (tool === "cubase.tempo" && action === "get") {
      const state = await this.adapter.getState();
      return { changed: false, data: { tempo: state.project.tempo, events: state.tempoMap } };
    }
    if (tool === "cubase.chord" && action === "get") {
      const state = await this.adapter.getState();
      return { changed: false, data: { key: state.project.key, chordTrack: state.tracks.find((track) => track.type === "chord") } };
    }
    if (tool === "cubase.export_config" && action === "get") {
      return { changed: false, data: { source: "host_current_settings", configurable: false } };
    }

    const operation = operationByTool[tool]?.[action];
    if (!operation) throw new Error(`No adapter route for ${tool}.${action}`);
    return this.adapter.execute(operation, await this.transform(tool, action, input), context);
  }

  private async transform(tool: V2ToolName, action: string, raw: Record<string, unknown>): Promise<Record<string, unknown>> {
    const input = omitControlFields(raw);
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (isTargetRef(value)) {
        result[key] = await this.referenceValue(value);
      } else if (Array.isArray(value) && value.every(isTargetRef)) {
        result[key] = await Promise.all(value.map((target) => this.referenceValue(target)));
      } else if (typeof value === "object" && value !== null && "format" in value) {
        result[key] = positionToCubaseString(value as Parameters<typeof positionToCubaseString>[0]);
      } else {
        result[key] = value;
      }
    }

    const target = input.target && isTargetRef(input.target) ? await this.referenceValue(input.target) : undefined;
    if (tool === "cubase.project") {
      if (action === "create") result.path = input.directory ? `${String(input.directory)}\\${String(input.name)}.cpr` : undefined;
      if (action === "save_as") result.saveAsPath = input.path;
      if (action === "backup") result.destination = input.destination;
    }
    if (tool === "cubase.track") {
      if (action.startsWith("create_default_")) {
        result.type = action.slice("create_default_".length);
        result.count = input.count ?? 1;
      }
      if (action === "create_parameterized") {
        result.instrumentName = input.instrument;
        result.outputBus = input.outputBus;
      }
      if (action === "get" || ["rename", "set_color", "duplicate", "reorder", "move_to_folder", "set_visibility", "freeze", "unfreeze"].includes(action)) {
        result.trackId = target;
      }
      if (action === "rename") result.name = input.name;
      if (action === "set_color") result.color = input.color;
      if (action === "delete") result.trackIds = [target];
      if (action === "select") result.trackIds = result.targets;
      if (action === "reorder") result.targetIndex = input.index;
      if (action === "move_to_folder") result.folderId = result.folder;
      if (action === "freeze") result.enabled = true;
      if (action === "unfreeze") result.enabled = false;
    }
    if (tool === "cubase.transport") {
      if (action === "set_cycle") result.cycleEnabled = input.enabled;
      if (action === "set_metronome") result.metronomeEnabled = input.enabled;
      if (action === "set_count_in") result.countInEnabled = input.enabled;
      if (action === "set_preroll") result.preRollBars = input.bars;
      if (action === "set_postroll") result.postRollBars = input.bars;
      if (action === "set_punch") Object.assign(result, { punchEnabled: input.enabled, punchIn: result.in, punchOut: result.out });
    }
    if (tool === "cubase.mixer_channel") {
      result.trackId = target;
      if (action === "set_level") result.volumeDb = input.db;
      if (action === "get_meters") result.trackIds = result.targets;
    }
    if (tool === "cubase.mixer_routing") {
      result.trackId = target;
      if (action === "set_output") result.outputBus = result.destination;
      if (action === "route_to_group") result.groupTrackId = result.group;
      if (action === "set_send") Object.assign(result, { destination: result.destination, levelDb: input.levelDb ?? 0, enabled: input.enabled ?? true });
    }
    if (tool === "cubase.plugin") {
      if (input.slot && isTargetRef(input.slot)) {
        const value = await this.referenceValue(input.slot);
        if (input.slot.kind === "objectId") result.pluginSlotObjectId = value;
        else result.trackId = value;
      }
      if (input.plugin && isTargetRef(input.plugin)) {
        const value = await this.referenceValue(input.plugin);
        if (input.plugin.kind === "objectId") result.objectId = value;
        else result.pluginId = value;
      }
      if (action === "set_parameter") {
        result.parameterTag = Number(input.parameterId);
        result.value = input.value;
        result.plainValue = input.value;
      }
    }
    if (tool === "cubase.midi_part") {
      if (action === "create") result.trackId = result.track;
      if (["get", "delete", "copy", "move"].includes(action)) result.partId = target;
      if (action === "copy" || action === "move") result.targetTrackId = result.destinationTrack;
      if (action === "import_file") Object.assign(result, { filePath: input.path, targetTrackId: result.track });
    }
    if (tool === "cubase.midi_edit") {
      result.partId = action === "list_notes" ? target : result.part;
      if (action === "update_notes") result.edits = input.edits;
    }
    if (tool === "cubase.midi_transform") {
      result.partId = target;
      if (action === "fixed_length") result.length = input.length;
    }
    if (tool === "cubase.audio_event") {
      if (action === "import") Object.assign(result, { filePath: input.path, trackId: result.track });
      if (action === "create") Object.assign(result, { trackId: result.track, position: result.position });
      if (["get", "update", "delete", "split", "copy", "move", "set_fade"].includes(action)) result.eventId = target;
      if (action === "update") result.action = input.gainDb !== undefined ? "gain" : "move";
      if (action === "delete") result.action = "delete";
      if (action === "copy") Object.assign(result, { action: "copy", targetTrackId: result.destinationTrack });
      if (action === "move") Object.assign(result, { action: "move", targetTrackId: result.destinationTrack });
    }
    if (tool === "cubase.audio_process") {
      result.eventId = target;
      result.eventIds = result.targets;
      result.process = action;
    }
    if (tool === "cubase.tempo") {
      if (input.bpm !== undefined) result.tempo = input.bpm;
      if (action === "create_map") {
        result.events = (input.events as Array<Record<string, unknown>>).map((event) => ({
          ...event,
          position: positionToCubaseString(event.position as Parameters<typeof positionToCubaseString>[0])
        }));
      }
    }
    if (tool === "cubase.arrangement" && action === "add_cycle_marker") result.type = "cycle";
    if (tool === "cubase.media") {
      if (action === "import_video" || action === "import_sample") result.filePath = input.path;
      if (action === "clean_unused") result.deleteFromDisk = input.deleteFromDisk;
    }
    if (tool === "cubase.export_config") {
      if (action === "set_path") result.directory = input.directory;
      if (action === "set_loudness") result.targetLufs = input.lufs;
      if (action === "set_realtime") result.realtime = input.enabled;
    }
    if (tool === "cubase.export_run") {
      if (action === "stems") Object.assign(result, { destinationDirectory: input.directory, trackIds: result.tracks });
      if (action === "selected_tracks" || action === "selected_events") result.destinationDirectory = input.directory;
    }
    if (tool === "cubase.debug.command" && action === "trigger") result.name = input.key;
    if (tool === "cubase.debug.direct_access" && action === "set_parameter") {
      if (input.valueMode === "plain") result.plainValue = input.value;
      else result.value = input.value;
    }
    return result;
  }

  private async referenceValue(target: TargetRef): Promise<string | number> {
    if (target.kind === "uniqueId") return target.uniqueId;
    if (target.kind === "objectId") return target.objectId;
    const state = await this.adapter.getState();
    const selected = state.selectedObjects[0];
    if (!selected) throw new Error("The action requires an existing Cubase selection.");
    return selected.id;
  }

  private async getMidiPart(input: Record<string, unknown>): Promise<OperationResult> {
    const target = input.target as TargetRef;
    const id = await this.referenceValue(target);
    const state = await this.adapter.getState();
    const part = state.tracks.flatMap((track) => track.parts).find((candidate) => candidate.id === id);
    if (!part) throw new Error(`MIDI part not found: ${String(id)}`);
    return { changed: false, data: part };
  }

  private async listMidiNotes(input: Record<string, unknown>): Promise<OperationResult> {
    const result = await this.getMidiPart(input);
    return { changed: false, data: (result.data as { notes: unknown[] }).notes };
  }

  private async getAudioEvent(input: Record<string, unknown>): Promise<OperationResult> {
    const target = input.target as TargetRef;
    const id = await this.referenceValue(target);
    const state = await this.adapter.getState();
    const event = state.tracks.flatMap((track) => track.audioEvents).find((candidate) => candidate.id === id);
    if (!event) throw new Error(`Audio event not found: ${String(id)}`);
    return { changed: false, data: event };
  }
}
