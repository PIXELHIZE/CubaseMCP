# v2 completion audit

This audit separates implementation readiness from release certification.

| Requirement | Authoritative evidence | State |
|---|---|---|
| Preserve the former implementation | Git tag `v0.1.0-legacy` points to the 238-tool baseline | complete |
| Action-based public MCP surface | MCP SDK integration test lists exactly 25 tools; `src/v2/actionManifest.ts` declares 198 unique actions | complete |
| Action-specific contracts and examples | Every action has a strict Zod variant and a generated example that is parsed by the same schema; exposed at `cubase://v2/actions` | complete |
| Legacy migration coverage | `auditLegacyMapping()` accounts for all 238 legacy tools with no missing or removed entry | complete |
| Song planning policy | Resolver tests prove software roles use Instrument Tracks and hardware/rack roles use MIDI Tracks | complete |
| Song execution and validation | Mock end-to-end test proves track creation, instruments, MIDI parts/notes, routing, tempo/signature, and explicitly test-only audibility | complete |
| Real song audibility safety | Real path performs transport/meter observation, restores transport, and rolls back planner-owned tracks when audibility is not observable | implemented; safe14 evidence pending |
| Capability status policy | v2 schema permits only `real`, two blocked statuses, or pre-release `unsupported_release_profile`; non-real claims require blocker reasons | complete |
| Host binding | Certified claims require the official Cubase application name, explicit Pro-edition attestation, exact patch, script build, MCP v2, transport v1, and a supported live-host state | complete |
| Evidence release gate | A fresh real report is assembled into observations, a 198-action manifest, and evidence; audit checks exact host/build/protocol, outcome, real-hardware method, mutation before/after/diff/restore, crash dumps, song audibility, and export file size/SHA-256 | complete |
| Cubase 15 wording | safe15 resolves to `unverified_host_profile` / `unsupported_release_profile`, not a technical unsupported-host claim | complete |
| UI automation prohibition | Static audit and regression test scan runtime source for prohibited screen/keyboard/mouse automation | complete |
| VST3/named-pipe exclusion | Experimental research is under `experimental/`, excluded from TypeScript and package files; static audit rejects forbidden runtime dependencies | complete |
| Public CI | Windows workflow runs install, audit, typecheck, tests, build, package dry run, SBOM, ZIP, MSI, and checksums | complete |
| Private Cubase gate | Self-hosted Windows workflow requires a non-mutating nine-check safe14 preflight, serial real tests, fresh evidence assembly, and fail-closed release audit before packaging | complete |
| Windows distribution | Bundled Node runtime ZIP/MSI, CycloneDX SBOM, checksums, and MSI install/uninstall smoke are generated successfully | complete |
| Licensing | Apache-2.0, NOTICE, third-party notices, SBOM, and packaging checks are present | complete |
| Public GitHub repository | `origin` points to the public `PIXELHIZE/CubaseMCP` repository; the v2 branch and draft PR #1 are published | complete |
| Cubase Pro 14.0.41 release certification | On installed Cubase Pro 14.0.32, the automated preflight passed MIDI ports and edition attestation but failed the other seven gates after the active legacy bridge timed out on `ping`; no v2 handshake or certified manifest/evidence was produced | pending self-hosted real-hardware gate |

## Reproducible local verification

```powershell
npm ci
npm audit --omit=dev
npm run typecheck
npm test
npm run v2:audit
npm run build
npm pack --dry-run
```

`npm run v2:assemble-safe14` builds the manifest/evidence paths from the newest
fresh real report. `npm run release:audit` intentionally fails while any
official-path candidate lacks a real-hardware observation, or when the
generated files fail any release invariant.
