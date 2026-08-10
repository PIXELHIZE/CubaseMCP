# Cubase MCP Companion Bridge Protocol

The experimental Windows bridge listens on `\\.\pipe\cubase-mcp-plugin-bridge`. It is excluded from the v2.0 public runtime and build. Frames are UTF-8 JSON followed by `\n`. The protocol never drives Cubase windows, menus, dialogs, keyboard, or mouse input.

## Request

```json
{
  "id": "uuid",
  "correlationId": "client-operation-id",
  "protocol": "cubase-mcp-plugin-bridge",
  "version": 1,
  "command": "execute",
  "payload": {
    "operation": "setPluginParameter",
    "input": {},
    "dryRun": false,
    "timeoutMs": 30000
  },
  "timestamp": "ISO-8601"
}
```

When `CUBASE_PLUGIN_BRIDGE_TOKEN` is configured, requests also contain an
`auth` bearer object. Production named-pipe servers must compare it in constant
time, omit it from logs, and create the pipe with a Windows ACL restricted to
the current interactive user. Token authentication does not replace the ACL.

## Response

```json
{
  "id": "uuid",
  "correlationId": "client-operation-id",
  "protocol": "cubase-mcp-plugin-bridge",
  "version": 1,
  "ok": true,
  "payload": {},
  "job": {
    "id": "job-id",
    "type": "export",
    "status": "running",
    "progress": 0.25
  },
  "evidence": {
    "stateBefore": {},
    "stateAfter": {},
    "stateDiff": {},
    "outputFiles": []
  }
}
```

Responses must preserve `id`. A failed response includes a stable error code, recoverability flag, and optional details. Destructive host operations must reject requests that do not carry server-side confirmation evidence.

## Commands

- `ping`, `get_capabilities`, `execute`
- `list_plugins`, `list_parameters`, `get_parameter`, `set_parameter`
- `load_preset`, `set_bypass`, `set_enabled`, `activate_sidechain`
- `activate_output`, `set_multi_output_routing`
- `import_midi_file`, `import_audio_file`
- `get_job`, `cancel_job`

The VST3 component can implement parameter/preset/audio-processing functions it owns. Project track/event CRUD and export configuration require a Cubase extension component with host-authorized APIs; a VST3 processor alone must return `BLOCKED_BY_CUBASE_API` instead of claiming support.
