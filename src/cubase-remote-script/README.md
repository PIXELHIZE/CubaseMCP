# AI MCP Remote MIDI Remote Script

This folder contains Cubase-side bridge scripts for `MidiRemoteAdapter` and `DirectAccessAdapter`.

Install `direct-access-bridge.js` for the current full bridge. `ai-mcp-remote.js` is the lite transport/selected-channel bridge kept for compatibility.

Copy the chosen script into the Cubase MIDI Remote Driver Scripts location for your user profile, then add the MIDI Remote device in Cubase and select the virtual MIDI ports:

- Input: `AI MCP Bridge To Cubase`
- Output: `AI MCP Bridge From Cubase`

The script maps MIDI CC messages to Cubase host values through the official MIDI Remote API:

- CC 20-26: transport play/stop/record/rewind/forward/cycle/metronome
- CC 30-37: selected track volume/pan/mute/solo/record enable/monitor/input gain/phase
- CC 40-47: selected track quick controls
- CC 50-57: focused quick controls

SysEx messages with manufacturer ID `0x7D` use `AIMCP1` single-frame or `AIMCP1C` checksummed chunk framing for bridge requests, responses, and state events. No OS-level UI, keyboard, mouse, screenshot, OCR, menu, or dialog automation is used.

`direct-access-bridge.js` additionally implements DirectAccess request/response, lifecycle callbacks, plugin-manager serialization, and MIDI Remote command binding inspection. Use `npm run cubase:discover` after installation to generate real evidence.

Do not load `direct-access-bridge.js` and `command-surface-bridge.js` on the same
port pair. The full bridge already contains the command registry. The
standalone script is a compatibility fallback.
