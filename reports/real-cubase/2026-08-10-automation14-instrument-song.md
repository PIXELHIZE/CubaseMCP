# Cubase Pro 14.0.32 automation14 Instrument-song evidence

Date: 2026-08-10 Asia/Seoul

Profile: `automation14` (`releaseCertified: false`)

Host: Cubase Pro 14.0.32.342

Project: `C:\Users\pixelhize\Documents\Cubase Projects\Neon_Summer_JPOP_Full_120bars\Neon_Summer_JPOP_Full_120bars.cpr`

The destination was a separate empty project. User-authored reference tracks
and the earlier audio-stem audition project were not used as generated-song
evidence.

## MCP result

- `cubase.song.plan` and `cubase.song.create` were called through an MCP client.
- 120 bars, 138 BPM, D major, ten sections from Intro through Outro.
- 11/11 expected tracks validated.
- 6 actual Instrument Tracks, 6 recorded MIDI Parts, 5,536 notes.
- 0 Audio Events.
- 2 Group Tracks, 2 FX Tracks, and 1 Marker Track.
- HALion programs: SR Studio A Kit, SR Smooth Bass, Acoustic Grand Piano,
  Butterfly Lead, Alaska Sweep, and Easy Saw Comp.
- Routing: Drums -> Drum Bus -> Delay FX -> Stereo Out; the other five
  instruments -> Music Bus -> Reverb FX -> Stereo Out.

After routing inspection, both FX output faders were set to -12 dB and the CPR
was saved. This replaced an over-level first float render.

## Playback evidence

MixConsole playback probes were repeated after the level correction:

| Position | Changed meter pixels | Active meter pixels | Result |
|---|---:|---:|---|
| 1.1.1.0 | 1,288 | 1,361 | verified |
| 33.1.1.0 | 1,510 | 2,315 | verified |
| 97.1.1.0 | 1,164 | 2,361 | verified |

Song validation then returned no issues: 11 tracks, 6 Instrument Tracks,
6 MIDI Parts, 5,536 notes, audible true.

## Render evidence

Final WAV:
`C:\Users\pixelhize\Documents\Cubase Projects\Neon_Summer_JPOP_Full_120bars\Mixdown\Neon_Summer_JPOP_Full_120bars_MCP_Final.wav`

- duration: 208.695646 seconds (3:28.70)
- format: PCM 24-bit, 48 kHz, stereo
- size: 60,104,448 bytes
- sample peak: -0.971402 dBFS
- true peak: -1.0 dBFS
- RMS: -18.783883 dB
- integrated loudness: -16.1 LUFS
- silence audit: no interval of 0.5 seconds or longer below -50 dB
- SHA-256: `240F5676678BC009AD6ACD0926C0837538153F0D2E370CEC2B192BDBBCE73D59`

A 320 kbps MP3 listening copy is beside the WAV. Automated evidence is written
to `artifacts/automation14-jpop-full/audio-render-evidence.json` and the MCP
summary is at `artifacts/automation14-jpop-full/mcp-call-summary.json`.

This proves the opt-in current-host engine, not the separate Cubase Pro 14.0.41
safe14 public release profile.
