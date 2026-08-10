export const readOnlyActionKeys = new Set([
  "cubase.system.status",
  "cubase.system.capabilities",
  "cubase.system.diagnose",
  "cubase.project.get",
  "cubase.song.program_catalog",
  "cubase.song.plan",
  "cubase.song.validate",
  "cubase.song.describe",
  "cubase.track.list",
  "cubase.track.get",
  "cubase.transport.get",
  "cubase.mixer_channel.get",
  "cubase.mixer_channel.get_meters",
  "cubase.plugin.list",
  "cubase.plugin.list_parameters",
  "cubase.plugin.get_parameter",
  "cubase.midi_part.get",
  "cubase.midi_edit.list_notes",
  "cubase.audio_event.get",
  "cubase.tempo.get",
  "cubase.chord.get",
  "cubase.arrangement.analyze_structure",
  "cubase.media.get_pool",
  "cubase.media.search",
  "cubase.export_config.get",
  "cubase.job.list",
  "cubase.job.get",
  "cubase.batch.preview",
  "cubase.batch.validate",
  "cubase.debug.command.get_registry",
  "cubase.debug.command.can_perform",
  "cubase.debug.direct_access.get_capabilities",
  "cubase.debug.direct_access.discover_tree",
  "cubase.debug.direct_access.get_object",
  "cubase.debug.direct_access.get_parameters",
  "cubase.debug.direct_access.get_parameter"
]);

export const unitEligibleRealActionKeys = new Set([
  "cubase.system.capabilities",
  "cubase.song.program_catalog",
  "cubase.song.plan",
  "cubase.batch.preview",
  "cubase.batch.validate"
]);

export const nonProjectMutationActionKeys = new Set([
  "cubase.midi_part.generate_file",
  "cubase.history.snapshot",
  "cubase.export_run.perform_current_settings",
  "cubase.export_run.mixdown_explicit",
  "cubase.export_run.stems",
  "cubase.export_run.selected_tracks",
  "cubase.export_run.selected_events",
  "cubase.export_run.selected_event",
  "cubase.export_run.batch"
]);

export function requiresRestoreEvidence(actionKey: string): boolean {
  return !readOnlyActionKeys.has(actionKey) && !nonProjectMutationActionKeys.has(actionKey);
}

export function requiresOutputArtifact(actionKey: string): boolean {
  return actionKey.startsWith("cubase.export_run.");
}
