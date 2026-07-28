# MCP Tool Contract

The executable catalog is generated from `src/tools/*Tools.ts`. The current
registry contains every tool listed in the project objective plus explicit
DirectAccess and command-binding diagnostics. `tests/fixtures/required-tools.json`
is the required-name contract; `tests/unit/toolCoverage.test.ts` prevents drift.

## Common input

```json
{
  "dryRun": false,
  "confirm": false,
  "timeoutMs": 5000,
  "correlationId": "client-operation-id",
  "requestId": "optional-request-id"
}
```

Destructive or overwrite operations do not execute without `confirm: true`.
With `dryRun: true`, the server returns the route, capability, input, affected
objects, confirmation requirement, and screen-automation flag without opening
Cubase transports.

## Common result

```json
{
  "ok": true,
  "tool": "cubase.transport_stop",
  "status": "unknown_not_tested",
  "adapter": "MIDI Remote Adapter",
  "dryRun": false,
  "changed": true,
  "correlationId": "client-operation-id",
  "data": {},
  "evidence": {
    "requestId": "request-id",
    "stateBefore": {},
    "stateAfter": {},
    "stateDiff": {}
  }
}
```

Errors use `{ code, message, details, recoverable }`. Typical codes are
`CUBASE_NOT_CONNECTED`, `ADAPTER_TIMEOUT`, `REQUIRES_EXISTING_SELECTION`,
`CONFIRMATION_REQUIRED`, `NEEDS_USER_SETUP`,
`NEEDS_CUBASE_SIDE_BRIDGE`, `BLOCKED_BY_CUBASE_API`, and
`BLOCKED_BY_NO_HEADLESS_API`.

## Capability meaning

- `real`: produced operation-level evidence against a connected Cubase host.
- `partial_direct_access`: exposed by the current DirectAccess tree only.
- `partial_command_binding`: command works but has no arbitrary parameters.
- `partial_current_setting_only`: uses existing Cubase settings.
- `partial_selection_dependent`: operates on current selection/focus.
- `partial_bridge_required`: protocol and routing exist; companion support is required.
- `unknown_not_tested`: candidate path exists without real evidence.
- `blocked_*`: a connected-host audit supplied the stated blocker evidence.
- `mock_only`: test adapter only.

Static `CapabilityMatrix` entries never set `testedWithRealCubase: true`.
Timestamped reports under `reports/real-cubase` are the evidence authority.
Static entries also keep `supportsUndo: false`: the server's pre-state snapshot
is recovery evidence, not a Cubase-native undo guarantee. Native Undo/Redo is
promoted only when a real command-binding audit observes and restores a state
change.

## Domain files

| Domain | Tool definitions | Schemas |
|---|---|---|
| Project | `src/tools/projectTools.ts` | `src/schemas/projectSchemas.ts` |
| Track | `src/tools/trackTools.ts` | `src/schemas/trackSchemas.ts` |
| Transport | `src/tools/transportTools.ts` | `src/schemas/transportSchemas.ts` |
| Audio | `src/tools/audioTools.ts` | `src/schemas/audioSchemas.ts` |
| MIDI | `src/tools/midiTools.ts` | `src/schemas/midiSchemas.ts` |
| Mixer | `src/tools/mixerTools.ts` | `src/schemas/mixerSchemas.ts` |
| Plugin | `src/tools/pluginTools.ts` | `src/schemas/pluginSchemas.ts` |
| Automation | `src/tools/automationTools.ts` | `src/schemas/automationSchemas.ts` |
| Tempo/chord | `src/tools/tempoTools.ts` | `src/schemas/tempoSchemas.ts` |
| Marker/arrangement | `src/tools/markerTools.ts` | `src/schemas/markerSchemas.ts` |
| Media | `src/tools/mediaTools.ts` | `src/schemas/mediaSchemas.ts` |
| Export/render | `src/tools/exportTools.ts` | `src/schemas/exportSchemas.ts` |
| Safety/diagnostics | `src/tools/safetyTools.ts` | common schemas |

Generate the complete per-tool table with `npm run cubase:audit`.
