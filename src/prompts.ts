import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";

export function registerCubasePrompts(server: McpServer): void {
  server.registerPrompt(
    "cubase_create_song",
    { title: "Create Song", description: "Plan a project/track/tempo/chord workflow with explicit capability fallbacks.", argsSchema: { brief: z.string(), bars: z.string().default("32").optional() } },
    ({ brief, bars }) => ({ messages: [{ role: "user", content: { type: "text", text: `Create a ${bars ?? "32"}-bar Cubase song from: ${brief}. Inspect capabilities, use dry-run first, then call project, tempo, chord, track, MIDI-file fallback, mixer and transport tools explicitly. Return partial_bridge_required for unavailable host edits.` } }] })
  );
  server.registerPrompt(
    "cubase_create_house_beat",
    {
      title: "Create House Beat",
      description: "Convert a natural-language drum programming request into safe Cubase tool calls.",
      argsSchema: {
        trackName: z.string().default("Drums").optional(),
        bars: z.string().default("4").optional(),
        style: z.string().default("house").optional()
      }
    },
    ({ trackName, bars, style }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Create a ${bars ?? "4"} bar ${style ?? "house"} beat on track "${trackName ?? "Drums"}".`,
              "Use explicit tool calls only:",
              "1. cubase.create_instrument_track (record default/current-setting limitations)",
              "2. cubase.discover_direct_access and cubase.load_instrument with a discovered slot/UID, or return bridge-required",
              "3. cubase.create_midi_part_from_generated_file",
              "4. preserve generated-file evidence if headless import is unavailable",
              "5. cubase.quantize_midi",
              "End with dryRun preview or playback only after the edit succeeds."
            ].join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "cubase_clean_project",
    { title: "Clean Project", description: "Preview project cleanup before destructive media or track changes.", argsSchema: { scope: z.string().default("unused media and empty tracks").optional() } },
    ({ scope }) => ({ messages: [{ role: "user", content: { type: "text", text: `Clean ${scope ?? "unused media and empty tracks"}. Read cubase://project, cubase://tracks and cubase.get_pool, then preview affected IDs. Never call delete/clean tools without explicit confirm:true.` } }] })
  );

  server.registerPrompt(
    "cubase_prepare_recording_session",
    { title: "Prepare Recording Session", description: "Configure tracks, routing, locators, count-in and monitoring.", argsSchema: { inputs: z.string(), start: z.string().default("1.1.1.0").optional() } },
    ({ inputs, start }) => ({ messages: [{ role: "user", content: { type: "text", text: `Prepare a recording session for ${inputs}, starting at ${start ?? "1.1.1.0"}. Use create_audio_track, set_routing, set_track_record_enable, set_track_monitor, set_position, set_count_in, set_preroll and transport_stop. Dry-run routing first.` } }] })
  );

  server.registerPrompt(
    "cubase_fix_timing",
    { title: "Fix Timing", description: "Choose MIDI or audio timing tools based on selected objects.", argsSchema: { strength: z.string().default("subtle").optional() } },
    ({ strength }) => ({ messages: [{ role: "user", content: { type: "text", text: `Fix timing with ${strength ?? "subtle"} strength. Inspect selected objects. Use quantize_midi/humanize_midi for MIDI, or analyze_hitpoints/quantize_audio for audio. Preview selection-dependent changes and require confirmation for destructive batch edits.` } }] })
  );

  server.registerPrompt(
    "cubase_make_chord_progression",
    { title: "Make Chord Progression", description: "Create chord-track or generated-MIDI harmony.", argsSchema: { key: z.string().default("C major").optional(), style: z.string().default("pop").optional() } },
    ({ key, style }) => ({ messages: [{ role: "user", content: { type: "text", text: `Create a ${style ?? "pop"} chord progression in ${key ?? "C major"}. Use set_key_signature, create_chord_track/update_chord_track when available; otherwise create_midi_part_from_generated_file. Quantize only after import evidence.` } }] })
  );

  server.registerPrompt(
    "cubase_master_rough_mix",
    { title: "Master Rough Mix", description: "Prepare a conservative rough master without unsupported claims.", argsSchema: { targetLufs: z.string().default("-14").optional() } },
    ({ targetLufs }) => ({ messages: [{ role: "user", content: { type: "text", text: `Prepare a rough master targeting ${targetLufs ?? "-14"} LUFS. Inspect mixer/meters/plugins, preview gain/EQ/compression changes, then set export loudness only if the bridge capability is verified. Otherwise use perform_current_audio_export and report current-setting limitations.` } }] })
  );

  server.registerPrompt(
    "cubase_diagnose_project",
    { title: "Diagnose Project", description: "Audit connection, state freshness, routing, media and capabilities.", argsSchema: {} },
    () => ({ messages: [{ role: "user", content: { type: "text", text: "Run cubase.get_status, cubase.get_capabilities and cubase.run_diagnostics. Inspect cubase://diagnostics, project, tracks, mixer, plugins, markers, automation and jobs. Separate real evidence, partial paths, unknowns and explicit blockers." } }] })
  );

  server.registerPrompt(
    "cubase_mix_vocal_forward",
    {
      title: "Mix Vocal Forward",
      description: "Plan a dry-run first vocal-forward mix move.",
      argsSchema: {
        vocalTrackHint: z.string().optional(),
        intensity: z.enum(["subtle", "medium", "strong"]).default("medium").optional()
      }
    },
    ({ vocalTrackHint, intensity }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Make the vocal feel more forward. Track hint: ${vocalTrackHint ?? "identify likely vocal tracks"}. Intensity: ${intensity ?? "medium"}.`,
              "First inspect tracks and current mixer/plugin/send state.",
              "Then present dry-run changes for volume, EQ presence, compression, de-essing if available, and reverb send.",
              "Only apply changes after explicit user approval."
            ].join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "cubase_safe_batch_edit",
    {
      title: "Safe Batch Edit",
      description: "Turn destructive batch edits into preview-confirm-execute workflow.",
      argsSchema: {
        goal: z.string(),
        selectionHint: z.string().optional()
      }
    },
    ({ goal, selectionHint }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Batch edit goal: ${goal}`,
              `Selection hint: ${selectionHint ?? "inspect current selection/resources"}`,
              "Use dryRun:true first, list affected IDs, require confirm:true for destructive actions, and preserve pre-state evidence. Treat native Cubase Undo as available only when a real command-binding audit verifies it."
            ].join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "cubase_export_stems",
    {
      title: "Export Stems",
      description: "Prepare a stems export plan with file format and overwrite policy.",
      argsSchema: {
        destination: z.string(),
        format: z.enum(["wav", "aiff", "flac", "mp3"]).default("wav").optional()
      }
    },
    ({ destination, format }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              `Export stems to ${destination} as ${format ?? "wav"}.`,
              "List tracks, choose stem set, dry-run export, ask for overwrite confirmation when needed, then call cubase.export_stems. If export-setting control is bridge-required, offer perform_current_audio_export with explicit current-setting-only and filesystem-verification limitations."
            ].join("\n")
          }
        }
      ]
    })
  );

  server.registerPrompt(
    "cubase_diagnose_connection",
    {
      title: "Diagnose Cubase Connection",
      description: "Inspect server status and adapter capabilities.",
      argsSchema: {}
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Check cubase.get_status and cubase://capabilities. Clearly mark unsupported direct-control features and bridge requirements."
          }
        }
      ]
    })
  );
}
