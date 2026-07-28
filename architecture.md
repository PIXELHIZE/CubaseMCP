# Architecture

The canonical architecture is [docs/architecture.md](docs/architecture.md).

The execution path is MCP registration, Zod validation, permission/capability
checks, dry-run/confirmation/undo evidence, `CompositeCubaseAdapter`, then one
of MIDI Remote host values, DirectAccess, command bindings, an opt-in OSC/MCU
endpoint, structured project state, or the versioned Cubase-side named-pipe
bridge. No screen, keyboard, mouse, dialog, OCR, or screenshot automation is
present.
