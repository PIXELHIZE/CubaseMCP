# Tools

The canonical tool contract is [docs/tools.md](docs/tools.md). The generated
238-row catalog and implementation audit is
[docs/full-capability-audit.md](docs/full-capability-audit.md).

Every registered tool has a Zod schema with common `dryRun`, `confirm`,
`timeoutMs`, `correlationId`, and `requestId` options; a capability entry; a
screen-free Composite route; a structured result/error envelope; and coverage
in `tests/unit/toolCoverage.test.ts`. Static entries never claim real-Cubase
validation.
