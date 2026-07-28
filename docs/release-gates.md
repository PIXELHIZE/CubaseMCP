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
- fresh fixture project for each mutating action
- state before, action response, state after, diff, restore, and restore verification
- crash dump check after each scenario
- meter/render audibility evidence for `cubase.song.create`
- output-file existence, size, and checksum for exports
- clean Windows VM MSI install/uninstall smoke

## Release invariants

- exactly 25 MCP tools;
- all 198 declared actions covered by schemas, validated examples, routes/handlers, capabilities, and evidence;
- certified capability claims apply only to the exact product and patch version named by the manifest;
- all 238 legacy tools have a migration disposition;
- certified status contains no partial, unknown, mock-only, or unsupported-profile entries;
- every real or blocked action has matching evidence;
- no forbidden UI automation source;
- no VST3 SDK, binary, or third-party MIDI driver in v2 packages.

The release audit must fail closed. A mock pass or an older Cubase installation cannot certify `safe14`.
