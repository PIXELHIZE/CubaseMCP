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

Every certified action points to one evidence record. Non-server `real` actions require `real_hardware` evidence. A mutating run must include before/after/diff and successful restore. Every hardware record must confirm crash-dump inspection.

Blocked actions also need evidence, such as an official API surface analysis, a missing method result, a non-parameterized command, or a reproduced dialog/headless limitation.

`EvidenceMatrix.audit` fails a release on missing actions, missing/mismatched evidence, insufficient real-device evidence, unrestored mutations, unchecked crash dumps, or any `unsupported_release_profile` entry.

