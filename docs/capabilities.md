# Capability and evidence model

## Action status

```text
real
blocked_by_cubase_api
blocked_by_no_headless_api
unsupported_release_profile
```

`unsupported_release_profile` is a runtime/pre-release state. A certified release matrix may contain only `real` or a blocked status.

Blockers are separate from top-level status and include `dialog_required`, `command_has_no_parameters`, `object_not_enumerable`, `path_not_headless_configurable`, `requires_existing_selection`, `requires_existing_export_settings`, `requires_track_template`, `host_crash_reproduced`, and `api_method_missing`.

## Profiles

- `safe14`: Cubase Pro 14.0.41, target of v2.0.
- `safe15`: Cubase 15/API 1.3, deliberately unverified until the v2.1 matrix closes.
- `mock`: deterministic test profile; every result carries `testOnly`.

A Cubase 15 host is not labeled technically unsupported. It is rejected as an unverified or unsupported release profile.

## Evidence

Every certified action points to one evidence record whose host product, exact patch version, profile, script build, application protocol, transport protocol, action, and outcome match the manifest. Runtime claims are enabled only when the live handshake matches the same values. Only the pure server actions `system.capabilities`, `song.plan`, `batch.preview`, and `batch.validate` may use unit evidence for a `real` claim. All other `real` actions require `real_hardware` evidence.

A project-mutating run must include before/after/diff, the state after restoration, and a successful restoration verdict. Every hardware record must confirm crash-dump inspection. A real `song.create` record must contain observed meter or render audibility evidence. Real export actions must name output files with size and SHA-256; the release audit reads those files and verifies both values.

Blocked actions also need evidence, such as an official API surface analysis, a missing method result, a non-parameterized command, or a reproduced dialog/headless limitation.

`EvidenceMatrix.audit` fails a release on missing actions, host/evidence mismatches, insufficient real-device evidence, incomplete or unrestored mutations, missing export or audibility evidence, unchecked crash dumps, or any `unsupported_release_profile` entry.

## safe14 certification assembly

`safe14-v1` partitions all 199 actions into:

- 4 server-side actions eligible for unit evidence;
- 53 official-path candidates that require a fresh real-hardware observation;
- 141 actions with reviewed static API blockers.

The candidate set is deliberately not converted to a blocker merely because a
test has not run. `npm run v2:assemble-safe14` consumes the newest correlated
real-Cubase report, records only restored or read-only observations, and leaves
every unobserved candidate as `unsupported_release_profile`. The release audit
therefore cannot turn missing evidence into a release claim.

Real report collection also snapshots configured Cubase crash-dump directories
before and after the scenario bundle. Any new or changed dump prevents
observations from being assembled.
