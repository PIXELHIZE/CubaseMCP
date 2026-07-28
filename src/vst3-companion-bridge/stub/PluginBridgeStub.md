# Plugin Bridge Stub

The companion bridge should run inside Cubase as a VST3 plugin and expose an explicit local protocol to the MCP server.

Minimum protocol commands:

```json
{
  "id": "uuid",
  "version": 1,
  "command": "list_parameters | set_parameter | load_preset | activate_sidechain | activate_output",
  "payload": {}
}
```

The bridge must not rely on window focus, keyboard injection, mouse coordinates, screenshots, OCR, or export dialogs.

Expected host data:

- Current track/channel identity if host exposes it
- Plugin instance ID
- Parameter stable ID, display name, normalized value, plain text value
- Preset list or preset load result

If Cubase or VST3 hosting APIs do not expose a requested operation to the plugin, the bridge must return `BLOCKED_BY_CUBASE_API`.
