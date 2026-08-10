# Implementation Audit

Generated: 2026-08-10T08:02:09.190Z
Registered tools: 238
Missing tool contracts: 0
Forbidden executable implementation findings: 0

## File Structure

| Category | Path | Status | Limitation |
| -------- | ---- | ------ | ---------- |
| MCP server | src/server.ts | PRESENT |  |
| Adapter | src/adapters/CubaseAdapter.ts | PRESENT |  |
| Adapter | src/adapters/CompositeCubaseAdapter.ts | PRESENT |  |
| Adapter | src/adapters/MockCubaseAdapter.ts | PRESENT |  |
| Adapter | src/adapters/MidiRemoteAdapter.ts | PRESENT |  |
| Adapter | src/adapters/DirectAccessAdapter.ts | PRESENT |  |
| Adapter | src/adapters/MidiCommandSurfaceAdapter.ts | PRESENT |  |
| Adapter | src/adapters/PluginBridgeAdapter.ts | PRESENT |  |
| Adapter | src/adapters/OscAdapter.ts | PRESENT |  |
| Adapter | src/adapters/EuConOrMackieAdapter.ts | PRESENT |  |
| Adapter | src/adapters/ProjectStateAdapter.ts | PRESENT |  |
| MIDI bridge | src/bridge/midi/MidiPortManager.ts | PRESENT |  |
| MIDI bridge | src/bridge/midi/CubaseMidiProtocol.ts | PRESENT |  |
| MIDI bridge | src/bridge/midi/DirectAccessProtocol.ts | PRESENT |  |
| MIDI bridge | src/bridge/midi/MessageEncoder.ts | PRESENT |  |
| MIDI bridge | src/bridge/midi/MessageDecoder.ts | PRESENT |  |
| MIDI bridge | src/bridge/midi/RequestResponseRouter.ts | PRESENT |  |
| MIDI bridge | src/bridge/midi/ChunkedSysexTransport.ts | PRESENT |  |
| Plugin bridge | src/bridge/plugin/PluginBridgeProtocol.ts | PRESENT |  |
| Plugin bridge | src/bridge/plugin/PluginBridgeClient.ts | PRESENT |  |
| Plugin bridge | src/bridge/plugin/PluginParameterMapper.ts | PRESENT |  |
| OSC bridge | src/bridge/osc/OscClient.ts | PRESENT_PARTIAL | Requires a configured Cubase-side OSC endpoint. |
| Cubase MIDI Remote script | src/cubase-remote-script/ai-mcp-remote.js | PRESENT |  |
| Cubase MIDI Remote script | src/cubase-remote-script/direct-access-bridge.js | PRESENT |  |
| Cubase MIDI Remote script | src/cubase-remote-script/command-surface-bridge.js | PRESENT |  |
| Cubase MIDI Remote script | src/cubase-remote-script/README.md | PRESENT |  |
| Tool layer | src/tools/projectTools.ts | PRESENT |  |
| Tool layer | src/tools/trackTools.ts | PRESENT |  |
| Tool layer | src/tools/transportTools.ts | PRESENT |  |
| Tool layer | src/tools/audioTools.ts | PRESENT |  |
| Tool layer | src/tools/midiTools.ts | PRESENT |  |
| Tool layer | src/tools/mixerTools.ts | PRESENT |  |
| Tool layer | src/tools/pluginTools.ts | PRESENT |  |
| Tool layer | src/tools/automationTools.ts | PRESENT |  |
| Tool layer | src/tools/tempoTools.ts | PRESENT |  |
| Tool layer | src/tools/markerTools.ts | PRESENT |  |
| Tool layer | src/tools/mediaTools.ts | PRESENT |  |
| Tool layer | src/tools/exportTools.ts | PRESENT |  |
| Tool layer | src/tools/directAccessTools.ts | PRESENT |  |
| Tool layer | src/tools/safetyTools.ts | PRESENT |  |
| Tool layer | src/tools/index.ts | PRESENT |  |
| Tool layer | src/tools/registerTools.ts | PRESENT |  |
| Tool layer | src/tools/toolTypes.ts | PRESENT |  |
| Schema | src/schemas/commonSchemas.ts | PRESENT |  |
| Schema | src/schemas/projectSchemas.ts | PRESENT |  |
| Schema | src/schemas/trackSchemas.ts | PRESENT |  |
| Schema | src/schemas/transportSchemas.ts | PRESENT |  |
| Schema | src/schemas/audioSchemas.ts | PRESENT |  |
| Schema | src/schemas/midiSchemas.ts | PRESENT |  |
| Schema | src/schemas/mixerSchemas.ts | PRESENT |  |
| Schema | src/schemas/pluginSchemas.ts | PRESENT |  |
| Schema | src/schemas/automationSchemas.ts | PRESENT |  |
| Schema | src/schemas/tempoSchemas.ts | PRESENT |  |
| Schema | src/schemas/markerSchemas.ts | PRESENT |  |
| Schema | src/schemas/mediaSchemas.ts | PRESENT |  |
| Schema | src/schemas/exportSchemas.ts | PRESENT |  |
| Schema | src/schemas/state.ts | PRESENT |  |
| Safety | src/safety/SafetyController.ts | PRESENT |  |
| Safety | src/safety/PermissionModel.ts | PRESENT |  |
| Safety | src/safety/Permissions.ts | PRESENT |  |
| Safety | src/safety/DryRunPlanner.ts | PRESENT |  |
| Safety | src/safety/UndoManager.ts | PRESENT |  |
| Safety | src/safety/DestructiveActionGuard.ts | PRESENT |  |
| Safety | src/safety/ErrorCodes.ts | PRESENT |  |
| State | src/state/CubaseStateStore.ts | PRESENT |  |
| State | src/state/TrackRegistry.ts | PRESENT |  |
| State | src/state/EventRegistry.ts | PRESENT |  |
| State | src/state/PluginRegistry.ts | PRESENT |  |
| State | src/state/MarkerRegistry.ts | PRESENT |  |
| State | src/state/CapabilityMatrix.ts | PRESENT |  |
| Diagnostics | src/diagnostics/CubaseConnectionDoctor.ts | PRESENT |  |
| Diagnostics | src/diagnostics/MidiPortDoctor.ts | PRESENT |  |
| Diagnostics | src/diagnostics/DirectAccessDoctor.ts | PRESENT |  |
| Diagnostics | src/diagnostics/CommandBindingDoctor.ts | PRESENT |  |
| Diagnostics | src/diagnostics/PluginManagerDoctor.ts | PRESENT |  |
| Diagnostics | src/diagnostics/ReportWriter.ts | PRESENT |  |
| Jobs | src/jobs/JobManager.ts | PRESENT |  |
| Jobs | src/jobs/RenderJob.ts | PRESENT |  |
| Jobs | src/jobs/ExportJob.ts | PRESENT |  |
| Jobs | src/jobs/ScanJob.ts | PRESENT |  |
| Script | scripts/cubase-discover.ts | PRESENT |  |
| Script | scripts/cubase-smoke.ts | PRESENT |  |
| Script | scripts/cubase-command-audit.ts | PRESENT |  |
| Script | scripts/cubase-direct-access-audit.ts | PRESENT |  |
| Script | scripts/cubase-report.ts | PRESENT |  |
| Script | scripts/cubase-static-audit.ts | PRESENT |  |
| Example | examples/create-house-beat.json | PRESENT |  |
| Example | examples/vocal-forward-mix.json | PRESENT |  |
| Example | examples/export-stems.json | PRESENT |  |
| Example | examples/full-project-create.json | PRESENT |  |
| Tests | tests/unit | PRESENT |  |
| Tests | tests/integration | PRESENT |  |
| Tests | tests/fixtures/required-tools.json | PRESENT |  |
| Docs | docs/README.md | PRESENT |  |
| Docs | docs/architecture.md | PRESENT |  |
| Docs | docs/tools.md | PRESENT |  |
| Docs | docs/real-test-status.md | PRESENT |  |
| Experimental VST3 companion | experimental/vst3-companion-bridge/protocol.md | PRESENT_PARTIAL | Research only; excluded from the v2.0 runtime and package. |
| Experimental VST3 companion | experimental/vst3-companion-bridge/README.md | PRESENT_PARTIAL | Research only; excluded from the v2.0 runtime and package. |
| Experimental VST3 companion binary | experimental/vst3-companion-bridge/stub/named-pipe-server.ts | PLACEHOLDER_ONLY | Protocol simulator only; excluded from the v2.0 runtime and package. |
| Experimental VST3 companion binary | experimental/vst3-companion-bridge/stub/PluginBridgeStub.md | PLACEHOLDER_ONLY | Implementation plan only; excluded from the v2.0 runtime and package. |

## Tool Coverage

| Tool | Registered | Schema | Handler | Adapter Path | Capability Matrix | Test | Status |
| ---- | ---------- | ------ | ------- | ------------ | ----------------- | ---- | ------ |
| cubase.get_status | true | true | true | MidiRemoteAdapter | true | true | unknown_not_tested |
| cubase.get_project | true | true | true | ProjectStateAdapter | true | true | unknown_not_tested |
| cubase.get_project_path | true | true | true | ProjectStateAdapter | true | true | unknown_not_tested |
| cubase.get_project_metadata | true | true | true | ProjectStateAdapter | true | true | unknown_not_tested |
| cubase.create_project | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.open_project | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.save_project | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.save_project_as | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.close_project | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_backup | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_project_backup | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.apply_project_template | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_sample_rate | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_bit_depth | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_frame_rate | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.list_tracks | true | true | true | ProjectStateAdapter | true | true | partial_selection_dependent |
| cubase.get_track | true | true | true | ProjectStateAdapter | true | true | partial_selection_dependent |
| cubase.create_track | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_audio_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_midi_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_instrument_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_group_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_fx_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_folder_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_marker_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_tempo_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_chord_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.delete_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.rename_track | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_track_color | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.select_tracks | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_track_mute | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.set_track_solo | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.set_track_record_enable | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.set_track_monitor | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.duplicate_track | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.reorder_track | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.move_track_to_folder | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_track_visibility | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.freeze_track | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.unfreeze_track | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_track_default_audio | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_track_default_midi | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_track_default_instrument | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_track_default_group | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_track_default_fx | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_track_default_folder | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_track_default_marker | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_track_default_tempo | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_track_default_chord | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_track_from_preset | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_track_parameterized | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.transport_play | true | true | true | MidiRemoteAdapter | true | true | unknown_not_tested |
| cubase.transport_stop | true | true | true | MidiRemoteAdapter | true | true | unknown_not_tested |
| cubase.transport_pause | true | true | true | MidiRemoteAdapter | true | true | unknown_not_tested |
| cubase.transport_record | true | true | true | MidiRemoteAdapter | true | true | unknown_not_tested |
| cubase.transport_rewind | true | true | true | MidiRemoteAdapter | true | true | unknown_not_tested |
| cubase.transport_forward | true | true | true | MidiRemoteAdapter | true | true | unknown_not_tested |
| cubase.set_position | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.get_position | true | true | true | ProjectStateAdapter | true | true | unknown_not_tested |
| cubase.nudge_position | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_locators | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_cycle | true | true | true | MidiRemoteAdapter | true | true | unknown_not_tested |
| cubase.set_metronome | true | true | true | MidiRemoteAdapter | true | true | unknown_not_tested |
| cubase.set_punch_in_out | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_count_in | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_preroll | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_postroll | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_track_volume | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.set_track_pan | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.set_input_gain | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.set_phase_invert | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.set_send_level | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.set_send_enable | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.add_send | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.remove_send | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_routing | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_group_routing | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_sidechain_routing | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_eq_band | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.set_channel_strip | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.set_vca | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.bypass_insert_plugin | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.get_meter_levels | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.list_plugins | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.load_instrument | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.load_effect | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.add_insert_plugin | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.remove_insert_plugin | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.bypass_plugin | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.get_plugin_parameters | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.get_plugin_parameter | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.set_plugin_parameter | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.load_plugin_preset | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.enable_plugin | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.disable_plugin | true | true | true | MidiRemoteAdapter | true | true | partial_selection_dependent |
| cubase.enable_sidechain | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.open_plugin_window | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.close_plugin_window | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.enable_instrument_output | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_multi_output_routing | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_midi_part | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.delete_midi_part | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.copy_midi_part | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.move_midi_part | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.add_midi_note | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.delete_midi_note | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.edit_midi_note | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.edit_midi_notes | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.delete_midi_notes | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_midi_velocity | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.edit_midi_controller | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.edit_pitch_bend | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.edit_modulation | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.edit_sustain_pedal | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.quantize_midi | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.humanize_midi | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.transpose_midi | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.apply_legato | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.apply_fixed_length | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.apply_drum_map | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.apply_scale_assistant | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_chord | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_chord_progression | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.import_midi_file | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_midi_part_from_generated_file | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.import_audio | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_audio_event | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.edit_audio_event | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.split_audio_event | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.move_audio_event | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.copy_audio_event | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.delete_audio_event | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_fade | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_audio_fade_in | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.set_audio_fade_out | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.create_crossfade | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.normalize_audio | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.reverse_audio | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_audio_event_gain | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.render_in_place | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.bounce_selection | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.time_stretch_audio | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.pitch_shift_audio | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.quantize_audio | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.detect_silence | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_audio_warp | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.analyze_hitpoints | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.comp_audio | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.get_tempo | true | true | true | ProjectStateAdapter | true | true | unknown_not_tested |
| cubase.set_tempo | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.add_tempo_event | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_time_signature | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.add_marker | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.delete_marker | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.update_marker | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.move_marker | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.rename_marker | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.add_cycle_marker | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_selection_dependent |
| cubase.create_arranger_event | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_arranger_chain | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.reorder_arranger_chain | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.duplicate_section | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.reorder_section | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.analyze_song_structure | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_automation_lane | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.add_automation_point | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.delete_automation_point | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.edit_automation_point | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_automation_curve | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_automation_read | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.set_automation_write | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.write_volume_automation | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.write_pan_automation | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.write_plugin_parameter_automation | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.write_send_automation | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.write_tempo_automation | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.smooth_automation | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.trim_automation | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.create_tempo_map | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.delete_tempo_event | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_key_signature | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.get_chord_track | true | true | true | ProjectStateAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.update_chord_track | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_scale | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.control_arranger_track | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.import_audio_file | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.import_video_file | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.import_sample | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.get_pool | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.clean_unused_media | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.relink_missing_files | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.search_media_bay | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.export_selected_event | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.export_full_mix | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.export_mixdown | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.export_stems | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.export_selected_tracks | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.export_selected_events | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.batch_export | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_export_settings | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_export_filename_pattern | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_export_loudness_target | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_export_format | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_export_sample_rate | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_export_bit_depth | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_export_range | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.set_export_realtime | true | true | true | PluginBridgeAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.get_export_jobs | true | true | true | ProjectStateAdapter | true | true | unknown_not_tested |
| cubase.cancel_export_job | true | true | true | ProjectStateAdapter | true | true | unknown_not_tested |
| cubase.perform_current_audio_export | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_current_setting_only |
| cubase.undo | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.redo | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.create_undo_snapshot | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.preview_operation | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.validate_operation | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.trigger_command | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.execute_macro | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.get_capabilities | true | true | true | CompositeCubaseAdapter | true | true | unknown_not_tested |
| cubase.run_diagnostics | true | true | true | CompositeCubaseAdapter -> production Cubase-side bridge required | true | true | partial_bridge_required |
| cubase.discover_direct_access | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.audit_command_bindings | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.command_binding_get_registry | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.command_binding_can_perform | true | true | true | MidiCommandSurfaceAdapter | true | true | partial_command_binding |
| cubase.direct_access_get_capabilities | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_request | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_discover_object_tree | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_get_object_metadata | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_get_child_objects | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_get_parameters | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_get_parameter | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_set_parameter_process_value | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_set_parameter_plain_value | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_get_plugin_collections | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_set_slot_plugin | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_reset_slot_plugin | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_subscribe_object_changes | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |
| cubase.direct_access_subscribe_parameter_changes | true | true | true | DirectAccessAdapter | true | true | partial_direct_access |

## Forbidden Automation Scan

No forbidden executable implementation was found.
