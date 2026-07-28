# Cubase MCP Documentation

This directory documents the headless-only Cubase MCP implementation. A source
path is not real-Cubase evidence. Only a timestamped discovery report or a
forced integration test can set `testedWithRealCubase` to `true`.

## Start here

1. [Architecture](architecture.md)
2. [Tool contract](tools.md)
3. [Windows setup](setup-windows.md)
4. [Virtual MIDI setup](setup-virtual-midi.md)
5. [Cubase MIDI Remote setup](setup-cubase-midi-remote.md)
6. [Command surface setup](setup-command-surface.md)
7. [Real test guide](real-test-guide.md)

## Capability and bridge references

- [Full static capability audit](full-capability-audit.md)
- [DirectAccess capability notes](direct-access-capability.md)
- [VST3 companion bridge](vst3-companion-bridge.md)
- [Unsupported headless features](unsupported-headless-features.md)
- [Real report schema](real-test-report-schema.md)
- [Troubleshooting](troubleshooting.md)

Run `npm run cubase:audit` after changing the tool registry or capability
classifier. Run `npm run cubase:discover` on the Cubase PC to replace static
assumptions with host-specific evidence.
