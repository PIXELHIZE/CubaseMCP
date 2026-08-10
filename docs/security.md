# Security and distribution policy

- The MCP server does not drive Cubase windows, menus, file pickers, dialogs, keyboard, mouse, screen pixels, screenshots, or OCR.
- Destructive action modes require `confirm:true`.
- Action capability preflight runs before adapter execution.
- Song rollback deletes only stable targets marked `ownedByPlanner`.
- Paths are explicit; export actions do not infer or automate dialogs.
- Runtime object IDs carry a host session ID; stable unique IDs are preferred.
- The legacy named-pipe/VST3 research path is disabled in the public runtime and excluded from builds.
- No Steinberg SDK, sample code, logo, or binary is redistributed.
- No third-party virtual MIDI driver is bundled.
- Dependency licenses are recorded in `THIRD_PARTY_LICENSES.md`; release artifacts include an SBOM and checksums.

Report security issues privately to the repository owner rather than opening a public issue with sensitive logs or project paths.

