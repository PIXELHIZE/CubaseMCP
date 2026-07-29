# Real Cubase test status

Last probe: 2026-07-29, Asia/Seoul.

## Observed host

- executable: `C:\Program Files\Steinberg\Cubase 14\Cubase14.exe`
- product/file version: `14.0.32.342`
- runtime window: Cubase Pro Hub
- project: not opened

## Read-only connection probes

Cubase was launched and a real `CompositeCubaseAdapter` connection was attempted with:

```text
CUBASE_MIDI_INPUT=AI MCP Bridge From Cubase
CUBASE_MIDI_OUTPUT=AI MCP Bridge To Cubase
```

The first connection attempt failed before an application handshake because
loopMIDI was installed but not running:

```text
MIDI input port not found: "AI MCP Bridge From Cubase"
```

After starting loopMIDI, both required ports were enumerated:

```text
AI MCP Bridge To Cubase
AI MCP Bridge From Cubase
```

The second connection attempt opened the MIDI ports but timed out waiting for
the Cubase bridge:

```text
MIDI ports opened, but Cubase MIDI Remote bridge did not answer ping.
cause: MIDI request timed out: ping
```

The installed MIDI Remote directory contains an older active Command Surface
script whose content differs from the repository's v2 script and does not
contain the v2 protocol/profile identifiers. The v2 DirectAccess and Remote
scripts are disabled. Consequently, no v2 application handshake has been
observed from this machine.

## Interpretation

- No real Cubase v2 test has passed on this machine.
- No real transport, mixer, track, song, export, or destructive scenario was executed by this probe.
- Results from unit/mock/protocol tests must not be described as real Cubase evidence.
- Cubase 14.0.32 cannot certify the exact `safe14` target of Cubase Pro 14.0.41.

## Requirements before `npm run test:real`

1. Install or update to Cubase Pro 14.0.41 on the self-hosted release runner.
2. Start loopMIDI and confirm the two user-managed virtual MIDI ports named in
   `setup-windows.md` are present.
3. Install and activate the v2 `2.0.0-safe14` MIDI Remote script.
4. Restart Cubase after the ports and script are available.
5. Open a disposable fixture project with a selected test track.
6. Confirm a v2/transport-v1 handshake with the exact safe14 script build.
7. Run the private release workflow and retain before/after/restore, crash-dump,
   audibility, and export-file evidence.
