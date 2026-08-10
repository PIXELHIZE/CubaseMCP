# Real Cubase test status

Last run: 2026-08-10, Asia/Seoul.

## Observed host

- executable: `C:\Program Files\Steinberg\Cubase 14\Cubase14.exe`
- product/file version: `14.0.32.342`
- edition attestation: Cubase Pro
- active bridge: repository `command-surface-bridge.js`
- bridge identity: MCP v2, transport v1, profile `safe14`, build `2.0.0-safe14`
- DirectAccess: deliberately inactive because the earlier 14.0.32 path reproduced a host crash

The active MIDI Remote script hash matched the repository source. loopMIDI
enumerated both required user-managed ports and the v2 ping/handshake succeeded.

## Safe14 preflight

The development host passed eight of the nine non-mutating checks: ports,
ping, official Cubase application name, Pro edition, `safe14` profile,
`2.0.0-safe14` script build, MCP v2, and transport v1. The only failure was
the intentional exact-patch gate: observed 14.0.32 versus release target
14.0.41.

This host is therefore useful real development evidence but cannot certify the
Cubase Pro 14.0.41 release matrix. Runtime system status/diagnose are available
as bootstrap diagnostics, while uncertified project actions continue to fail
closed as `unsupported_release_profile`.

## Real bridge smoke

With the disposable `CubaseMCP_JPOP_Full_20260810` project open, the real
integration test passed all three scenarios:

- connect and read the v2 host state;
- send Play, observe `playing`, send Stop, and observe `stopped` after a bounded
  state-propagation delay;
- read selected-track state and produce non-mutating mixer previews.

The broader smoke report also passed cycle and metronome toggles with restore
and observed no new or changed Cubase crash dump. DirectAccess/mixer-state
scenarios that require the inactive DirectAccess bridge remained blocked.

## J-pop development audition

An MCP client called `cubase.song` with `action=plan` through the real connected
runtime for an 8-bar loop and a 120-bar J-pop arrangement. The planner produced
Instrument Track intents for all software roles and a ten-section structure.
A deterministic development renderer produced a 48 kHz stereo master and six
stems.

Test-only UI bootstrap imported the earlier audio-render baseline into
disposable projects. Desktop automation is not included in the public release
runtime; it is now isolated as the explicit `automation14` profile. Playback
MIDI still travels through the same real MIDI bridge used by the MCP server.

- loop: 15.913 seconds; all six stems non-silent;
- full song: 210.696 seconds (about 3:31), 120 bars at 138 BPM;
- sections: Intro, two verses, two pre-choruses, two choruses, Bridge, Final
  Chorus, Outro;
- audio: -16.9 LUFS integrated, 5.7 LU LRA, -0.7 dBFS true peak;
- silence audit: no one-second gap before the intentional 1.867-second fade
  tail;
- project: muted master plus six aligned Audio Tracks for drums, bass, chords,
  pad, arp, and lead;
- audition: active meters captured at multiple full-song sections and on all
  six stem channels; final bridge state verified `stopped`.

## Instrument-track automation14 run

The corrected run used a separate empty project named
`Neon_Summer_JPOP_Full_120bars`; no user-authored track or earlier audio-stem
project was reused. A real MCP client called `cubase.song.plan` and
`cubase.song.create`, producing:

- 120 bars at 138 BPM, 3:28.70 rendered duration, and ten named song sections;
- six actual Instrument Tracks with six recorded MIDI Parts and 5,536 notes;
- HALion Sonic programs `SR Studio A Kit`, `SR Smooth Bass`,
  `[GM 001] Acoustic Grand Piano`, `Butterfly Lead`, `Alaska Sweep`, and
  `Easy Saw Comp`;
- two actual Group Tracks, RoomWorks SE and StereoDelay FX Tracks, and one
  Marker Track;
- `JPOP Drums -> Drum Bus -> Delay FX -> Stereo Out` and the other five
  instruments `-> Music Bus -> Reverb FX -> Stereo Out`;
- MixConsole probes at bars 1, 33, and 97, all verified with 1,164–1,510
  changing meter pixels and 1,361–2,361 active meter pixels;
- validator result: 11/11 tracks, 6 Instrument Tracks, 6 MIDI Parts, 5,536
  notes, 0 Audio Events, audible true, no issues.

The Cubase mix was lowered by 12 dB at both FX outputs after a float render
revealed excessive peak level. The safe Cubase render measured -3.1 dBFS true
peak. The final listening derivative is 48 kHz/24-bit stereo, 208.695646
seconds, -18.78 dB RMS, -16.1 LUFS integrated, -1.0 dBFS true peak, with no
detected 0.5-second silence intervals. Its SHA-256 is
`240F5676678BC009AD6ACD0926C0837538153F0D2E370CEC2B192BDBBCE73D59`.

Committed evidence is indexed at
`reports/real-cubase/2026-08-10-jpop-audition.md` and
`reports/real-cubase/2026-08-10-automation14-instrument-song.md`.

## Reduced-density end-to-end MCP run

A later run used only the registered automation14 MCP actions for project
creation, song planning/creation, and real-time export. The new project
`MCP_JPOP_Reference_Density_v2` contains 11 tracks, six Instrument Tracks, six
MIDI Parts, and 3,924 notes. Every HALion load, every isolated Instrument Track
meter probe, the final mix meter, and the song validator passed.

The final 48 kHz stereo float WAV is 208.695646 seconds and 80,141,248 bytes.
It measured -21.137898 dB RMS, -18.4 LUFS integrated, and -1.8 dBFS true peak
with no analyzer warnings. SHA-256 is
`8C8C2FAD2D7E0322572B0DC70CA31247F0D596AA048580709B71ECED6328F832`.
Section analysis measured Intro -20.5 LUFS, Verse 1 -19.3 LUFS, Chorus 1
-17.7 LUFS, and Outro -20.7 LUFS, confirming intentional section contrast.
The reproducible metadata record is
`research/jpop-reference/validation/automation14-density-v2.json`.

## Current release interpretation

- Real Cubase v2 connection and transport tests now pass on 14.0.32.
- The local run does not certify 14.0.41 and is not represented as doing so.
- Parameterized Instrument Track creation, instrument loading, routing, MIDI
  content insertion, and complete validation remain blocked on the stable
  Cubase 14 official headless path. They are implemented only in the explicit
  automation14 profile, which reports `releaseCertified: false`.
- Public runtime UI automation remains prohibited; the direct UI steps above
  are explicit development-test evidence only.
- Source verification passes 99 automated tests plus the separate real-host
  smoke and automation14 runs. Fifteen opt-in integration cases remain skipped
  in the default test command. Production and development npm audits report zero
  vulnerabilities.

## Remaining release gate

1. Run the private self-hosted gate on Cubase Pro 14.0.41.
2. Pass the exact nine-check preflight.
3. Collect current before/after/diff/restore observations for every candidate
   action and evidence-backed blockers for every other action.
4. Run the evidence assembly and release audit.
5. Smoke the MSI in a clean VM and sign the public installer with the release
   code-signing certificate.
