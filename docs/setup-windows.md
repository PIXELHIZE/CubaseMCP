# Windows Setup

1. Install Node.js 22 or newer.
2. Install dependencies:

```powershell
npm install
npm run build
```

3. Install a virtual MIDI loopback driver such as loopMIDI.
4. Create two virtual MIDI ports:

- `AI MCP Bridge To Cubase`
- `AI MCP Bridge From Cubase`

5. Install the Cubase MIDI Remote script from `src/cubase-remote-script/ai-mcp-remote.js`.
6. Configure the MCP server:

```powershell
$env:CUBASE_ADAPTER="composite"
$env:CUBASE_MIDI_INPUT="AI MCP Bridge From Cubase"
$env:CUBASE_MIDI_OUTPUT="AI MCP Bridge To Cubase"
node dist/src/server.js
```

No screen, dialog, menu, keyboard, mouse, screenshot, or OCR automation is part of this setup.
