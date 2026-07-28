# VST3 Companion Bridge

The companion bridge is the permitted fallback when MIDI Remote DirectAccess
and Quick Controls do not expose a plugin or project operation. It is a
Cubase-side binary endpoint, not screen automation.

## Implemented server side

- Versioned JSON-line protocol in `src/bridge/plugin/PluginBridgeProtocol.ts`.
- Windows named-pipe client in `src/bridge/plugin/PluginBridgeClient.ts`.
- Request ID correlation, timeout, structured errors, jobs, and evidence.
- DirectAccess/MIDI Remote forwarding fallback where the operation is exposed.
- Parameter identity mapping in `src/bridge/plugin/PluginParameterMapper.ts`.
- Test-only named-pipe server under `src/vst3-companion-bridge/stub`.

Default pipe: `\\.\pipe\cubase-mcp-plugin-bridge`.

Set `CUBASE_PLUGIN_BRIDGE_TOKEN` on both processes. The production C++ server
must additionally create a current-user-only Windows named-pipe ACL and must
redact request authentication from logs/evidence.

## Required binary implementation

The production companion must be built with the Steinberg VST3 SDK and an
allowed Cubase integration point. It must implement protocol version 1 and
return explicit unsupported errors for commands the host does not expose. The
minimum command set is:

- plugin instance/catalog enumeration;
- parameter list, get, and set;
- preset load;
- bypass/enable;
- sidechain and multi-output capability checks;
- project/track/event operations only when an official host API exposes them;
- export/render job submission and progress where available.

The binary must never synthesize keyboard/mouse input, inspect dialogs, or
claim access to Cubase internals not exposed by the host. See
`src/vst3-companion-bridge/protocol.md` for framing and response examples.

Until such a binary answers a real request, affected tools remain
`partial_bridge_required` or `blocked_by_missing_cubase_side_bridge`; the
TypeScript stub never promotes a capability to `real`.
