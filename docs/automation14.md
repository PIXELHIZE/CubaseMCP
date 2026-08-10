# automation14 profile

`automation14` is an explicit, non-release-certified execution profile for the
installed Cubase Pro 14.0.32 desktop. It exists because the official Cubase 14
MIDI Remote/Command Binding surface cannot parameterize Instrument Track,
program, routing, and MIDI-content creation end to end.

## Preconditions

- Windows interactive desktop with Cubase Pro 14.0.32 running;
- Cubase maximized on a 2560×1080 primary display;
- user-managed loopMIDI ports `AI MCP Bridge To Cubase` and
  `AI MCP Bridge From Cubase`;
- repository command-surface bridge connected;
- an existing project window from which the opt-in profile can open Cubase Pro Hub;
- `CUBASE_AUTOMATION14=true` explicitly set by the operator.

The profile never claims `supported_release_profile`. Its real actions include
constraints for the exact host, desktop requirement, non-official control path,
and `releaseCertified: false`.

## Song pipeline

1. `cubase.project.create` creates and saves a non-overwriting Empty project.
2. `cubase.song.program_catalog` reports verified HALion programs.
3. `cubase.song.plan` resolves software roles to Instrument Tracks and accepts
   an exact `tracks[].program` per role.
4. `cubase.song.create` creates FX, Group, Marker, and Instrument Tracks.
5. HALion Sonic is instantiated once per software role and the exact MediaBay
   program is loaded.
6. Section-aware MIDI is recorded through the real bridge port into one MIDI
   Part per Instrument Track.
7. Instrument outputs route through Group Tracks to Stereo Out while named FX
   Tracks remain independently addressable for send routing.
8. The project is saved and representative sections are played with MixConsole
   visible. Changing active meter pixels are required for success.
9. `cubase.export_run.perform_current_settings` sets the Stereo Out gain,
   configures a real-time WAV mixdown, refuses overwrite, waits for a stable
   file, and returns SHA-256 plus FFmpeg loudness/peak/silence evidence.

Verified program examples on 14.0.32 are:

| Role | HALion program |
|---|---|
| drums | SR Studio A Kit |
| bass | SR Smooth Bass |
| chords | [GM 002] Bright Acoustic Piano |
| lead | Butterfly Lead |
| pad | Alaska Sweep |
| arp | Easy Saw Comp |

Any installed exact HALion MediaBay program name is accepted. Names outside the
verified catalog remain dependent on the user's installed HALion content. The
loader rejects an empty MediaBay result instead of recording a false success.

Song creation requires a separate empty saved project and
`rollbackOnFailure:false`. The profile does not claim deterministic project
rollback through desktop automation; this limitation is returned directly in
the `cubase.song.create` capability constraints.

## Commands

```powershell
$env:CUBASE_AUTOMATION14="true"
npm run cubase:call -- cubase.song action=program_catalog
npm run cubase:automation14:project -- --current-project-title Existing_Project --name MCP_JPOP_Reference_Density_v2
npm run cubase:automation14:song -- --project-title MCP_JPOP_Reference_Density_v2 --bars 120 --output artifacts/automation14-jpop-reference-v2
npm run cubase:automation14:render -- --project-title MCP_JPOP_Reference_Density_v2 --expected-file "$env:USERPROFILE\Documents\Cubase Projects\MCP_JPOP_Reference_Density_v2\Mixdown\MCP_JPOP_Reference_Density_v2.wav" --evidence-directory artifacts/automation14-jpop-reference-v2
```

The generated evidence distinguishes MCP planning/creation, real Cubase meter
probes, and post-render audio analysis. A successful automation14 run does not
certify the separate Cubase Pro 14.0.41 `safe14` public release matrix.
