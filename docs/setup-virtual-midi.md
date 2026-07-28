# Virtual MIDI Setup

On Windows, create loopback MIDI ports with a driver such as loopMIDI.

Required port names:

- `AI MCP Bridge To Cubase`: Node sends MIDI into Cubase.
- `AI MCP Bridge From Cubase`: Cubase sends MIDI/SysEx state back to Node.

Configure environment variables if you use different names:

```powershell
$env:CUBASE_MIDI_OUTPUT="Your Port Into Cubase"
$env:CUBASE_MIDI_INPUT="Your Port From Cubase"
```

The Node server opens existing MIDI ports. It does not create Windows virtual MIDI devices by itself.
