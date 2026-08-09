# Cubase 14.0.32 J-pop development audition

This is development evidence from the locally installed Cubase Pro 14.0.32 host. It does **not** certify the `safe14` Cubase Pro 14.0.41 release profile.

## Path exercised

- The v2 MCP runtime connected to the installed `2.0.0-safe14` MIDI Remote command-surface bridge.
- An MCP client called `cubase.song` with `action=plan` for an 8-bar loop and a 120-bar J-pop arrangement.
- The deterministic renderer produced stereo master and drums, bass, chords, pad, arp, and lead stems at 48 kHz.
- Test-only UI bootstrap imported the resulting master into disposable Cubase projects. UI automation is not part of the public runtime.
- Playback and stop were sent through the MIDI Remote adapter used by the MCP runtime.

## Results

| Check | Result |
| --- | --- |
| Host handshake | Cubase Pro 14.0.32, MCP v2, transport v1, `safe14`, build `2.0.0-safe14` |
| Loop | 8 bars, 15.913 s, all six stems non-silent |
| Full arrangement | 120 bars, 210.696 s, ten sections from Intro through Outro |
| Editable Cubase stems | Drums, bass, chords, pad, arp, and lead imported as six bar-1-aligned Audio Tracks; master muted during stem audition |
| Full master | SHA-256 `0cada5f14985f91669f6d142620a44bfccdaf1afafb2d9cee48781e7d0bd8a4f` |
| Loudness | -16.9 LUFS integrated, 5.7 LU LRA, -0.7 dBFS true peak |
| Silence audit | No one-second gap before the intentional 1.867 s final fade tail |
| Cubase audition | Playing state and active audio meter captured at intro, verse/chorus, bridge, and outro |
| Stem audition | All six stem channel meters active during bridge-controlled playback |
| Final state | Stop command sent and bridge state re-read as `stopped` after 600 ms |
| Crash audit | No new or changed Cubase crash dump during the preceding real-host smoke run |

The full-song Cubase project contains an imported master plus six aligned Audio Track stems. The song plan itself resolves drums, bass, chords, lead, pad, and arp to Instrument Tracks; the stable Cubase 14 MIDI Remote path cannot headlessly pass instrument, name, routing, and content parameters, so that project mutation remains blocked rather than being reported as a successful `cubase.song.create`.

## Evidence files

- `loop-playback-20260810.json`
- `loop-audition-in-event.png`
- `full-song-imported.png`
- `full-song-playback-20260810.json`
- `full-song-playing-intro.png`
- `full-song-playing-chorus1.png`
- `full-song-playing-chorus2.png`
- `full-song-playing-outro.png`
- `full-song-stems-imported.png`
- `full-song-stems-playing.png`
