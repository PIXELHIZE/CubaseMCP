# Release gates

## Public CI

- clean install
- typecheck
- unit, MCP contract, protocol, Song Policy, and regression tests
- production build
- no-screen-automation scan
- 238-to-v2 mapping audit
- license/NOTICE/third-party checks
- CycloneDX SBOM
- ZIP/MSI package build
- SHA-256 checksums

## Private self-hosted Windows gate

- Cubase Pro 14.0.41 `safe14`
- non-mutating preflight proving MIDI port direction, bridge ping, Cubase
  application name, operator-attested Pro edition, exact patch, v2/transport-v1
  handshake, release profile, and script build before any real test
- fresh fixture project for each mutating action
- single-worker, non-parallel real test execution against the shared Cubase host
- state before, action response, state after, diff, restore, and restore verification
- crash dump check after each scenario
- meter/render audibility evidence for `cubase.song.create`
- output-file existence, size, and checksum for exports
- clean Windows VM MSI install/uninstall smoke

The gate builds `safe14.observations.json`, `safe14.manifest.json`, and
`safe14.evidence.json` from the fresh real-Cubase report. It does not accept a
pre-certified manifest as a repository variable. Missing real-hardware
candidate observations remain `unsupported_release_profile`, so the subsequent
release audit fails closed.

The private runner sets `CUBASE_REAL_DESTRUCTIVE=true` only for its disposable
fixture project. Command-binding mutation candidates must produce an observable
state diff and a verified Undo restoration; otherwise they remain unresolved.

## Release invariants

- exactly 25 MCP tools;
- all 199 declared actions covered by schemas, validated examples, routes/handlers, capabilities, and evidence;
- certified capability claims apply only to the exact product and patch version named by the manifest;
- all 238 legacy tools have a migration disposition;
- certified status contains no partial, unknown, mock-only, or unsupported-profile entries;
- every real or blocked action has matching evidence;
- no forbidden UI automation source;
- no VST3 SDK, binary, or third-party MIDI driver in v2 packages.

The release audit must fail closed. A mock pass or an older Cubase installation cannot certify `safe14`.
