# VST3 Companion / Cubase-Side Bridge

The TypeScript client and named-pipe protocol are implemented. No prebuilt VST3 or Cubase extension binary is included, so operations that require this binary remain `partial_bridge_required` or `blocked_by_missing_cubase_side_bridge` until a real binary and evidence report exist.

## Binary split

1. VST3 companion component

   - Built with the Steinberg VST3 SDK and CMake.
   - Exposes the parameters, presets, bypass, sidechain state, bus activation, and output buses owned by that plugin instance.
   - Runs no UI automation and does not infer project objects from windows.

2. Cubase-side host extension

   - Owns project/track/event/import/export operations only where Steinberg exposes an authorized extension API.
   - Maintains a named-pipe server and serializes all host calls onto the host-authorized thread.
   - Returns `BLOCKED_BY_CUBASE_API` for functionality not exposed by the installed Cubase SDK/API.

## Implementation plan

- Pin an explicit VST3 SDK revision and document its license/redistribution terms.
- Implement `IComponent`, `IAudioProcessor`, and `IEditController` for the companion plugin.
- Add a Windows named-pipe server with one JSON-line request per correlation ID, maximum frame size, cancellation, and reconnect handling.
- Map VST parameter IDs to stable string IDs and return normalized/plain/display values.
- Implement preset loading through plugin-owned state APIs, not Cubase preset dialogs.
- Implement bus activation and sidechain/multi-output capability queries through VST3 bus APIs.
- Add a Cubase 15 integration harness that verifies each claimed command and writes the same real-evidence report format used by `cubase:discover`.

See `protocol.md`. The files under `stub/` are test/development scaffolding only and are never classified as real Cubase control.
