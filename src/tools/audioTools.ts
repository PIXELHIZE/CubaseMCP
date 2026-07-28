import { Permission } from "../safety/PermissionModel.js";
import { AudioEventIdInputShape, BounceSelectionInputShape, CrossfadeInputShape, EditAudioEventInputShape, FadeInputShape, ImportAudioInputShape, MoveAudioEventInputShape, RenderInPlaceInputShape, SplitAudioEventInputShape, CreateAudioEventInputShape, CopyAudioEventInputShape, AudioFadeInputShape, AudioGainInputShape, AudioProcessInputShape } from "../schemas/audioSchemas.js";
import { writeTool, type ToolDefinition } from "./toolTypes.js";

export const audioTools: ToolDefinition[] = [
  writeTool("cubase.import_audio", "Import Audio", "Import audio through Cubase-side bridge.", "importAudio", ImportAudioInputShape, Permission.Media),
  writeTool("cubase.create_audio_event", "Create Audio Event", "Create an event from an existing audio file through the Cubase-side bridge.", "createAudioEvent", CreateAudioEventInputShape, Permission.EditAudio),
  writeTool("cubase.edit_audio_event", "Edit Audio Event", "Edit audio event through Cubase-side bridge.", "editAudioEvent", EditAudioEventInputShape, Permission.EditAudio),
  writeTool("cubase.split_audio_event", "Split Audio Event", "Split audio event through Cubase-side bridge.", "splitAudioEvent", SplitAudioEventInputShape, Permission.EditAudio),
  writeTool("cubase.move_audio_event", "Move Audio Event", "Move audio event through Cubase-side bridge.", "moveAudioEvent", MoveAudioEventInputShape, Permission.EditAudio),
  writeTool("cubase.copy_audio_event", "Copy Audio Event", "Copy an audio event to a new position/track through the bridge.", "copyAudioEvent", CopyAudioEventInputShape, Permission.EditAudio),
  writeTool("cubase.delete_audio_event", "Delete Audio Event", "Delete audio event. Requires confirm:true.", "deleteAudioEvent", AudioEventIdInputShape, Permission.EditAudio, { destructive: true }),
  writeTool("cubase.set_fade", "Set Fade", "Set fade in/out through Cubase-side bridge.", "setFade", FadeInputShape, Permission.EditAudio),
  writeTool("cubase.set_audio_fade_in", "Set Audio Fade In", "Apply fade-in through selection-dependent command binding or bridge.", "setAudioFadeIn", AudioFadeInputShape, Permission.EditAudio),
  writeTool("cubase.set_audio_fade_out", "Set Audio Fade Out", "Apply fade-out through selection-dependent command binding or bridge.", "setAudioFadeOut", AudioFadeInputShape, Permission.EditAudio),
  writeTool("cubase.create_crossfade", "Create Crossfade", "Create crossfade through Cubase-side bridge.", "createCrossfade", CrossfadeInputShape, Permission.EditAudio),
  writeTool("cubase.normalize_audio", "Normalize Audio", "Normalize audio through Cubase-side bridge.", "normalizeAudio", AudioEventIdInputShape, Permission.EditAudio),
  writeTool("cubase.reverse_audio", "Reverse Audio", "Reverse audio through Cubase-side bridge.", "reverseAudio", AudioEventIdInputShape, Permission.EditAudio),
  writeTool("cubase.set_audio_event_gain", "Set Audio Event Gain", "Set non-destructive event gain through a bridge.", "setAudioEventGain", AudioGainInputShape, Permission.EditAudio),
  writeTool("cubase.render_in_place", "Render In Place", "Render in place through Cubase-side bridge.", "renderInPlace", RenderInPlaceInputShape, Permission.Export),
  writeTool("cubase.bounce_selection", "Bounce Selection", "Bounce selection through command binding or Cubase-side bridge.", "bounceSelection", BounceSelectionInputShape, Permission.EditAudio),
  writeTool("cubase.time_stretch_audio", "Time Stretch Audio", "Time-stretch selected/identified audio through a Cubase-side bridge.", "timeStretchAudio", AudioProcessInputShape, Permission.EditAudio),
  writeTool("cubase.pitch_shift_audio", "Pitch Shift Audio", "Pitch-shift selected/identified audio through a Cubase-side bridge.", "pitchShiftAudio", AudioProcessInputShape, Permission.EditAudio),
  writeTool("cubase.quantize_audio", "Quantize Audio", "Quantize selected audio through command binding where available or a bridge.", "quantizeAudio", AudioProcessInputShape, Permission.EditAudio),
  writeTool("cubase.detect_silence", "Detect Silence", "Run detect-silence as an asynchronous bridge job.", "detectSilence", AudioProcessInputShape, Permission.EditAudio, { longRunning: true }),
  writeTool("cubase.set_audio_warp", "Set Audio Warp", "Configure AudioWarp through a Cubase-side bridge.", "setAudioWarp", AudioProcessInputShape, Permission.EditAudio),
  writeTool("cubase.analyze_hitpoints", "Analyze Hitpoints", "Analyze hitpoints as an asynchronous bridge job.", "analyzeHitpoints", AudioProcessInputShape, Permission.EditAudio, { longRunning: true }),
  writeTool("cubase.comp_audio", "Comp Audio", "Apply comping changes through a Cubase-side bridge.", "compAudio", AudioProcessInputShape, Permission.EditAudio)
];
