# Migrating from v0.1

v0.1 exposed 238 flat tools. v2 groups them into 25 domain tools with explicit actions.

Examples:

| v0.1 | v2 |
|---|---|
| `cubase.get_status` | `cubase.system` with `action: "status"` |
| `cubase.create_instrument_track` | `cubase.track` with `action: "create_default_instrument"` |
| `cubase.create_midi_part` | `cubase.midi_part` with `action: "create"` |
| `cubase.add_midi_note` | `cubase.midi_edit` with `action: "add_notes"` |
| `cubase.export_mixdown` | `cubase.export_run` with `action: "mixdown_explicit"` |
| `cubase.direct_access_get_parameters` | `cubase.debug.direct_access` with `action: "get_parameters"` |

`src/v2/legacyMapping.ts` contains a machine-audited disposition for all 238 legacy tools. The mapping audit requires zero missing entries.

The complete old implementation remains recoverable from Git tag `v0.1.0-legacy`; it is not registered by the v2 server.

