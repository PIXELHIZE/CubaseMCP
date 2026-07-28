# Third-party licenses

The release SBOM is authoritative for exact transitive versions. Direct runtime dependencies are:

| Package | Purpose | License |
|---|---|---|
| `@julusian/midi` | MIDI port access | MIT |
| `@modelcontextprotocol/sdk` | MCP server protocol | MIT |
| `zod` | Runtime schema validation | MIT |

Development-only dependencies include TypeScript, Vitest, tsx, Node.js type definitions, and cross-env under their respective open-source licenses.

No Steinberg SDK, VST3 SDK, loopMIDI binary, or other virtual MIDI driver is bundled.

Package license texts and transitive notices are included in generated release artifacts through the SBOM/license collection step.
