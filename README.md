# Cubase MCP Server

This repository implements a Cubase MCP server with a real headless control path for Windows using:

- Cubase MIDI Remote API script
- virtual MIDI ports such as loopMIDI
- MIDI request/response SysEx bridge
- MIDI CC command surface triggers
- DirectAccess object and parameter discovery
- MIDI Remote command binding `canPerform` checks
- selected/focused quick controls for plugin parameters
- filesystem verification for export results
- versioned Windows named-pipe companion bridge protocol
- 238 registered MCP tools with generated static capability audit

It intentionally does not implement or include AutoHotkey, SendKeys, Win32 keyboard/mouse injection, UI Automation clicks, menu automation, dialog automation, screenshot detection, OCR, mouse coordinates, or OS-level shortcut sending.

## Real Adapter Mode

The default adapter is `composite`, not mock.

```powershell
$env:CUBASE_ADAPTER="composite"
$env:CUBASE_MIDI_INPUT="AI MCP Bridge From Cubase"
$env:CUBASE_MIDI_OUTPUT="AI MCP Bridge To Cubase"
npm run build
node dist/server.js
```

Use mock only for unit tests or client prototyping:

```powershell
$env:CUBASE_ADAPTER="mock"
npm run dev
```

## Real Cubase Communication Files

- `src/adapters/MidiRemoteAdapter.ts`
- `src/adapters/MidiCommandSurfaceAdapter.ts`
- `src/adapters/PluginBridgeAdapter.ts`
- `src/adapters/ProjectStateAdapter.ts`
- `src/adapters/CompositeCubaseAdapter.ts`
- `src/adapters/DirectAccessAdapter.ts`
- `src/bridge/midi/*`
- `src/cubase-remote-script/direct-access-bridge.js`

## Current Evidence Status

The static source tree contains no `real` capability claims. All entries have
`testedWithRealCubase: false` until `npm run cubase:discover` or forced real
integration tests produce operation-level evidence.

Implemented candidate headless paths include:

- `cubase.get_status`
- `cubase.transport_play`
- `cubase.transport_stop`
- `cubase.transport_record`
- `cubase.transport_rewind`
- `cubase.transport_forward`
- `cubase.set_cycle`
- `cubase.set_metronome`
- selected-track `cubase.set_track_volume`
- selected-track `cubase.set_track_pan`
- selected-track `cubase.set_track_mute`
- selected-track `cubase.set_track_solo`
- selected-track `cubase.set_track_record_enable`
- selected-track `cubase.set_track_monitor`
- quick-control based `cubase.get_plugin_parameters`
- quick-control based `cubase.set_plugin_parameter`
- user-mapped command trigger `cubase.trigger_command`
- DirectAccess discovery tools such as `cubase.direct_access_discover_object_tree`
- command binding registry tools such as `cubase.command_binding_get_registry`
- current-settings-only `cubase.perform_current_audio_export`
- DirectAccess semantic mixer/EQ/send/plugin writes using discovered ObjectIDs
  and parameter tags
- API 1.3 plugin slot assignment and destructive slot reset
- generated Standard MIDI File plus explicit companion import
- asynchronous export/render/scan jobs with bridge progress polling

Unknown or companion-bridge-required until real evidence proves support:

- parameterized project open/save/create
- arbitrary track create/delete/rename/reorder
- MIDI part and note editing
- audio event editing
- render/export/mixdown/stems
- arbitrary plugin insert/preset/window control

Non-executable functions return machine-readable errors such as `NEEDS_CUBASE_SIDE_BRIDGE`, `NEEDS_USER_SETUP`, `BLOCKED_BY_CUBASE_API`, or `BLOCKED_BY_NO_HEADLESS_API`.

The complete architecture, tool contract, and generated per-tool audit are in
`docs/architecture.md`, `docs/tools.md`, and
`docs/full-capability-audit.md`.

## Setup

Read these in order:

1. `docs/setup-windows.md`
2. `docs/setup-virtual-midi.md`
3. `docs/setup-cubase-midi-remote.md`
4. `docs/setup-command-surface.md`
5. `docs/troubleshooting.md`

## Verification

```powershell
npm run typecheck
npm test
npm run test:real
npm run build
```

Generate the timestamped real Cubase evidence bundle with:

```powershell
npm run cubase:discover
```

See `docs/real-test-guide.md` for the exact Windows/Cubase sequence and `docs/real-test-report-schema.md` for the evidence contract. `npm test` is unit/mock evidence only. `npm run test:real` detects its npm lifecycle name and does not skip integration tests when Cubase is unavailable.

## Sources

- Steinberg MIDI Remote API Programmer's Guide: https://steinbergmedia.github.io/midiremote_api_doc/
- Steinberg MIDI Remote API Reference: https://steinbergmedia.github.io/midiremote_api_doc/codedoc_api_reference/
- MCP TypeScript SDK: https://ts.sdk.modelcontextprotocol.io/
