# Real Cubase test status

Last probe: 2026-07-29, Asia/Seoul.

## Observed host

- executable: `C:\Program Files\Steinberg\Cubase 14\Cubase14.exe`
- product/file version: `14.0.32.342`
- runtime window: Cubase Pro Hub
- project: not opened

## Read-only connection probe

Cubase was launched and a real `CompositeCubaseAdapter` connection was attempted with:

```text
CUBASE_MIDI_INPUT=AI MCP Bridge From Cubase
CUBASE_MIDI_OUTPUT=AI MCP Bridge To Cubase
```

The connection failed before an application handshake:

```text
MIDI input port not found: "AI MCP Bridge From Cubase"
```

Available MIDI inputs at the time of the probe were:

```text
KL Essential 49 mk3 MCU/HUI
KL Essential 49 mk3 ALV
KL Essential 49 mk3 MIDI
KL Essential 49 mk3 DINTHRU
```

The installed MIDI Remote directory contains an older active Command Surface script. The v2 DirectAccess and Remote scripts are disabled, so no v2 application handshake has been observed from this machine.

## Interpretation

- No real Cubase v2 test has passed on this machine.
- No real transport, mixer, track, song, export, or destructive scenario was executed by this probe.
- Results from unit/mock/protocol tests must not be described as real Cubase evidence.
- Cubase 14.0.32 cannot certify the exact `safe14` target of Cubase Pro 14.0.41.

## Requirements before `npm run test:real`

1. Install or update to Cubase Pro 14.0.41 on the self-hosted release runner.
2. Create the two user-managed virtual MIDI ports named in `setup-windows.md`.
3. Install and activate the v2 `2.0.0-safe14` MIDI Remote script.
4. Open a disposable fixture project with a selected test track.
5. Confirm a v2/transport-v1 handshake with the exact safe14 script build.
6. Run the private release workflow and retain before/after/restore, crash-dump, audibility, and export-file evidence.

