# v2 tools

Each MCP tool takes one discriminated `action`. Action schemas remain small and explicit even though actions are grouped by domain.

| Tool | Actions |
|---|---|
| `cubase.system` | `status`, `capabilities`, `diagnose` |
| `cubase.project` | `get`, `create`, `open`, `save`, `save_as`, `close`, `backup`, `apply_template`, `configure` |
| `cubase.song` | `plan`, `create`, `validate`, `repair`, `describe` |
| `cubase.track` | list/get, default typed creation, template/parameterized creation, rename/color/select/delete/duplicate/reorder/folder/visibility/freeze |
| `cubase.transport` | state, playback, location, locators, cycle, metronome, punch, count-in, pre/post-roll |
| `cubase.mixer_channel` | values, meters, EQ, strip, VCA |
| `cubase.mixer_routing` | output, group, sidechain, send |
| `cubase.plugin` | slots, parameters, presets, sidechain, outputs, window |
| `cubase.midi_part` | create/get/delete/copy/move/import/generate |
| `cubase.midi_edit` | notes, controller, pitch bend |
| `cubase.midi_transform` | quantize, humanize, transpose, legato, fixed length, drum map, scale |
| `cubase.audio_event` | import/create/get/update/delete/split/copy/move/fade/crossfade |
| `cubase.audio_process` | normalize/reverse/render/bounce/stretch/pitch/quantize/silence/warp/hitpoints/comp |
| `cubase.tempo` | tempo events, time signature, key, scale, map |
| `cubase.chord` | get/create/update/delete/progression |
| `cubase.arrangement` | markers, arranger events/chains, sections, analysis |
| `cubase.automation` | lanes, points, curves, read/write, series, smooth, trim |
| `cubase.media` | pool, video/sample import, cleanup, relink, search |
| `cubase.export_config` | one explicit setting per action |
| `cubase.export_run` | current settings, explicit mixdown, stems, selected, batch |
| `cubase.job` | list/get/cancel |
| `cubase.history` | undo/redo/snapshot |
| `cubase.batch` | preview/validate/execute |
| `cubase.debug.command` | Command Binding diagnostics |
| `cubase.debug.direct_access` | DirectAccess diagnostics |

Before any action, query `cubase.system` action `capabilities`. A blocked action returns its `blockerReason` and is never forwarded to Cubase.

The `cubase://v2/actions` resource exposes all 199 action summaries, schema-validated examples, and capability claims for the active host. `cubase://v2/capabilities` provides the compact capability-only view.
