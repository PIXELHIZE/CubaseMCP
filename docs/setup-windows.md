# Windows and Cubase setup

## Prerequisites

- Windows 10/11
- Node.js 22+
- Cubase Pro 14.0.41 for the v2.0 certified profile
- two user-created virtual MIDI ports

The project does not bundle loopMIDI or any other virtual MIDI driver.

## MIDI ports

Create:

- `AI MCP Bridge To Cubase`
- `AI MCP Bridge From Cubase`

Install `src/cubase-remote-script/direct-access-bridge.js` in Cubase's user MIDI Remote Driver Scripts folder, restart Cubase, and select the matching input/output ports for the `AI MCP DirectAccess Bridge`.

The script handshake must report:

```json
{
  "version": 2,
  "transportVersion": 1,
  "releaseProfile": "safe14",
  "scriptBuild": "2.0.0-safe14"
}
```

## Server

```powershell
npm ci
npm run build
$env:CUBASE_ADAPTER="composite"
$env:CUBASE_MIDI_INPUT="AI MCP Bridge From Cubase"
$env:CUBASE_MIDI_OUTPUT="AI MCP Bridge To Cubase"
node dist/server.js
```

The certified capability manifest is supplied with `CUBASE_V2_CAPABILITY_MANIFEST`. Without a certified profile, non-server actions are rejected as unsupported release-profile operations.

Do not enable the experimental plugin bridge. It is excluded from the v2.0 runtime policy.

The MSI is a per-user install under `%LOCALAPPDATA%\Programs\Cubase MCP`, so it does not require machine-wide administrator rights.
