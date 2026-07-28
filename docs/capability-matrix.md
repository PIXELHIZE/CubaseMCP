# Capability Matrix

The source of truth is `src/state/CapabilityMatrix.ts`; the complete generated
table is `docs/full-capability-audit.md`.

The static matrix describes code paths, not Cubase evidence. It therefore has
no `real` entries and does not declare a host-specific blocker before
DirectAccess/command audit evidence exists. Every static capability has
`testedWithRealCubase: false` and `usesScreenAutomation: false`.

Current static registry: 238 tools.

| Status | Count | Meaning before real discovery |
|---|---:|---|
| `partial_bridge_required` | 139 | Versioned named-pipe request exists; production companion support is required. |
| `partial_command_binding` | 25 | Cubase command binding path exists; parameters/state effect remain contextual. |
| `partial_current_setting_only` | 1 | Uses current Cubase audio-export settings. |
| `partial_direct_access` | 29 | DirectAccess request or semantic ObjectID/parameterTag route exists. |
| `partial_selection_dependent` | 27 | Current selection/focus is the address. |
| `unknown_not_tested` | 17 | State/host-value path exists but lacks real evidence. |

`npm run cubase:discover` writes a separate host-specific matrix. That report
may promote an operation, retain it as partial, or mark it blocked when the
connected host returned sufficient evidence. A unit/mock pass never promotes a
capability.

DirectAccess semantic writes accept explicit IDs returned by discovery:

- plugin parameter: `objectId` + `parameterTag`;
- plugin assignment/removal: `pluginSlotObjectId` + `pluginUid`, or slot reset;
- volume/pan/mute/solo/input gain/phase/send/automation modes: `directAccess` target;
- EQ: ordered `directAccessWrites` for the discovered band parameters.

Runtime ObjectIDs can change after project/script reload. Rediscover before
reusing them across sessions.
