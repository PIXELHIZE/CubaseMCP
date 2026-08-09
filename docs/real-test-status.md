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

Test-only UI bootstrap imported the results into disposable projects; UI
automation is not included in the public runtime. Playback and Stop used the
same MIDI Remote adapter as the MCP server.

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

Committed evidence is indexed at
`reports/real-cubase/2026-08-10-jpop-audition.md`.

## Current release interpretation

- Real Cubase v2 connection and transport tests now pass on 14.0.32.
- The local run does not certify 14.0.41 and is not represented as doing so.
- Parameterized Instrument Track creation, instrument loading, routing, MIDI
  content insertion, and complete validation are still blocked on the stable
  Cubase 14 official headless path. The MCP reports the blocker rather than
  returning partial success.
- Public runtime UI automation remains prohibited; the direct UI steps above
  are explicit development-test evidence only.
- Source verification passes 85 automated tests plus three separate real-host
  smoke tests. Production and development npm audits report zero
  vulnerabilities.

## Remaining release gate

1. Run the private self-hosted gate on Cubase Pro 14.0.41.
2. Pass the exact nine-check preflight.
3. Collect current before/after/diff/restore observations for every candidate
   action and evidence-backed blockers for every other action.
4. Run the evidence assembly and release audit.
5. Smoke the MSI in a clean VM and sign the public installer with the release
   code-signing certificate.
