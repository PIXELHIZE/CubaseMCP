# Current Implementation Audit

This table audits the previous implementation before the real headless adapters were added. Mock-only behavior is not counted as complete.

| 기능 | MCP tool 존재 여부 | schema 존재 여부 | adapter interface 존재 여부 | mock 구현 여부 | 실제 Cubase 실행 구현 여부 | headless 구현 가능 여부 | 통합 테스트 여부 | 상태 |
| -- | -- | -- | -- | -- | -- | -- | -- | -- |
| status/project/track read | yes | yes | yes | yes | no | partial via MIDI Remote state | no | MOCK_ONLY |
| project create/open/save/close/setup/backup | partial | yes | yes | yes | no | needs Cubase-side bridge | no | MOCK_ONLY |
| track create/delete/update/duplicate/reorder | partial | yes | yes | yes | no | needs Cubase-side bridge | no | MOCK_ONLY |
| selected track mute/solo/record/monitor | yes | yes | yes | yes | no | yes via MIDI Remote | no | MOCK_ONLY |
| transport play/stop/record/locators/options | partial | yes | yes | yes | no | play/stop/record yes; locators need mapping/bridge | no | MOCK_ONLY |
| mixer volume/pan/send/EQ/routing/meters | partial | yes | yes | yes | no | selected volume/pan/meters partial via MIDI Remote; routing needs bridge | no | MOCK_ONLY |
| plugin list/add/remove/parameter/bypass | partial | yes | yes | yes | no | quick controls partial; arbitrary plugin API needs VST3 bridge | no | MOCK_ONLY |
| MIDI part/note/quantize/transform | partial | yes | yes | yes | no | needs Cubase-side bridge | no | MOCK_ONLY |
| audio import/edit/process | partial | yes | yes | yes | no | needs Cubase-side bridge | no | MOCK_ONLY |
| tempo/key/chord/marker | partial | yes | yes | yes | no | tempo/markers need mapping or bridge | no | MOCK_ONLY |
| media pool/import/relink | partial | yes | yes | yes | no | needs Cubase-side bridge | no | MOCK_ONLY |
| export/render/jobs | partial | yes | yes | yes | no | export requires Cubase-side bridge; dialog automation disallowed | no | MOCK_ONLY |
| undo/redo | yes | yes | yes | yes | no | needs user command mapping | no | MOCK_ONLY |
| OS/screen automation fallback | documented only | partial | no | no | no | disallowed | no | BLOCKED_BY_NO_HEADLESS_API |

After this audit, the implementation now includes real headless MIDI adapters and marks non-headless operations in `src/state/CapabilityMatrix.ts`.
