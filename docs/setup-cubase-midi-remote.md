# Cubase MIDI Remote Setup

1. Copy `src/cubase-remote-script/direct-access-bridge.js` into the Cubase MIDI Remote Driver Scripts folder for your user profile. Use `ai-mcp-remote.js` only for the lite transport/selected-channel bridge.
2. Restart Cubase or rescan MIDI Remote scripts.
3. Add the `OpenAI / AI MCP Remote` device.
4. Select these ports:

- MIDI input: `AI MCP Bridge To Cubase`
- MIDI output: `AI MCP Bridge From Cubase`

5. Start the MCP server in composite mode.
6. Call `cubase.get_status`. The result should include capabilities and bridge state.

The script maps MIDI Remote host values directly inside Cubase. It does not click UI elements or send keyboard shortcuts.
