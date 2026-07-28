# Troubleshooting

## MIDI ports not found

Run the server with the exact loopback port names:

```powershell
$env:CUBASE_MIDI_IN="AI MCP Bridge From Cubase"
$env:CUBASE_MIDI_OUT="AI MCP Bridge To Cubase"
```

## Ping timeout

The MIDI ports opened, but the Cubase MIDI Remote script did not answer. Check:

- Cubase is running.
- `OpenAI / AI MCP DirectAccess Bridge` is added and active in MIDI Remote.
- Input/output ports are assigned in the correct direction.
- SysEx is not filtered by the virtual MIDI driver.

## Tool returns `NEEDS_CUBASE_SIDE_BRIDGE`

The selected DirectAccess/command/Quick Control path could not execute the
parameterized operation and the production named-pipe companion did not answer.
Inspect the error `attempts` array before deciding this is a Cubase API blocker.

## DirectAccess tree is empty

Confirm Cubase/Nuendo 13.0.50+ for API 1.2 basics, reload the full bridge
script, select a track, and inspect `direct-access-tree.json`. Cubase/Nuendo 15
is required for API 1.3 plugin manager and extended parameter metadata.

## Command binding was not created

Inspect `command-bindings.json` for the exact category/name and script error.
The bridge uses official names such as `Add Track / Effect`,
`Quantize Category / Quantize`, `Project / Remove Selected Tracks`, and
`Marker / Add Position Marker on Selected Track`.

## Tool returns `NEEDS_USER_SETUP`

Create an explicit MIDI Remote or Generic Remote mapping in Cubase and register that mapping in `src/config/commandMappings.ts`.
