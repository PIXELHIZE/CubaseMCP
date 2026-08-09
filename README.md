# Cubase MCP

Cubase MCP v2 is a Windows MCP server for Cubase that exposes 25 action-based domain tools instead of hundreds of flat verbs. It uses Cubase MIDI Remote, DirectAccess, and Command Binding paths and does not use screen, keyboard, mouse, dialog, OCR, or coordinate automation.

The v2 design is evidence-first:

- every action resolves to `real`, `blocked_by_cubase_api`, `blocked_by_no_headless_api`, or `unsupported_release_profile`;
- no release manifest may contain `partial`, `unknown`, or mock-only claims;
- Cubase Pro 14.0.41 is the `safe14` v2.0 release target;
- Cubase 15 is reported as `unverified_host_profile` until the separate `safe15` matrix is certified;
- mock results are marked `constraints.testOnly: true` and never count as real Cubase evidence.

## Song creation

`cubase.song` implements `plan`, `create`, `validate`, `repair`, and `describe`.

Software drums, bass, chords, lead, pad, and arp always resolve to Instrument Tracks. External hardware and rack multi-timbral channels resolve to MIDI Tracks. A song does not pass validation if a required software role becomes a MIDI Track, an instrument is not loaded, MIDI content was not imported, routing is invalid, or audibility has no meter/render evidence.

```json
{
  "action": "plan",
  "prompt": "4마디 house 노래 만들어줘"
}
```

Use the returned `planId` with `cubase.song` action `create` only when `cubase.system` action `capabilities` reports `cubase.song.create` as `real`.

For a development-only deterministic J-pop render driven by an MCP `song.plan`
call against a connected host:

```powershell
$env:CUBASE_HOST_EDITION="Pro"
npm run cubase:jpop-demo -- --full --output artifacts/jpop-full
```

This renderer produces a master and six stems; it does not bypass the
capability gate or claim that Cubase imported/configured Instrument Tracks.

## Public MCP surface

The server exposes 23 public domain tools and 2 diagnostic tools:

`system`, `project`, `song`, `track`, `transport`, `mixer_channel`, `mixer_routing`, `plugin`, `midi_part`, `midi_edit`, `midi_transform`, `audio_event`, `audio_process`, `tempo`, `chord`, `arrangement`, `automation`, `media`, `export_config`, `export_run`, `job`, `history`, `batch`, plus `debug.command` and `debug.direct_access`.

See [docs/tools.md](docs/tools.md) and [docs/song-policy.md](docs/song-policy.md).

## Development

Requirements: Windows, Node.js 22+, and npm.

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

Run with the deterministic test adapter:

```powershell
$env:CUBASE_ADAPTER="mock"
npm run dev
```

Real Cubase setup requires two user-created virtual MIDI ports. No third-party MIDI driver is bundled. See [docs/setup-windows.md](docs/setup-windows.md).

## Release state

The source implementation and mock/protocol contracts are testable now. A public `safe14` release manifest is intentionally not certified until the self-hosted Windows runner has Cubase Pro 14.0.41, captures before/after/restore evidence for every real action, records evidence for every blocked action, checks crash dumps, and passes the clean-VM MSI smoke test.

The currently detected local host is older than the 14.0.41 release target, so it cannot close that gate. The server will reject unverified real-host actions instead of overstating support.

See [docs/release-gates.md](docs/release-gates.md).

## Runtime exclusions

- UI automation is forbidden.
- The v2.0 public runtime disables the legacy named-pipe/plugin bridge.
- No VST3 SDK or binary is included.
- Experimental VST3 research is isolated under `experimental/` and excluded from the build.
- Steinberg and third-party trademarks are not project endorsements.

## License

Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
