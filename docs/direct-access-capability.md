# DirectAccess Capability PoC

This document records the headless DirectAccess and command-binding expansion.

## Official API points used

MIDI Remote API v1.3 for Cubase/Nuendo 15 adds:

- extended DirectAccess parameter introspection
- `getObjectTypeName`
- plugin manager access through `da.mPluginManager`
- command binding `canPerform(activeMapping)`

MIDI Remote API v1.2 provides the first full DirectAccess feature set. Scripts must feature-detect every method before use.

Primary sources:

- https://steinbergmedia.github.io/midiremote_api_doc/new_in_v1.3/
- https://steinbergmedia.github.io/midiremote_api_doc/versions/
- https://steinbergmedia.github.io/midiremote_api_doc/examples/commandbindings/

## Added files

- `src/adapters/DirectAccessAdapter.ts`
- `src/bridge/midi/DirectAccessProtocol.ts`
- `src/cubase-remote-script/direct-access-bridge.js`
- `tests/unit/directAccessProtocol.test.ts`
- `tests/integration/directAccess.real.test.ts`

## DirectAccess request types

The bridge implements:

- `DA_GET_API_VERSION`
- `DA_GET_CAPABILITIES`
- `DA_DISCOVER_OBJECT_TREE`
- `DA_GET_OBJECT_METADATA`
- `DA_GET_CHILD_OBJECTS`
- `DA_GET_PARAMETERS`
- `DA_GET_PARAMETER`
- `DA_SET_PARAMETER_PROCESS_VALUE`
- `DA_SET_PARAMETER_PLAIN_VALUE`
- `DA_GET_PLUGIN_COLLECTIONS`
- `DA_SET_SLOT_PLUGIN`
- `DA_RESET_SLOT_PLUGIN`
- `DA_SUBSCRIBE_OBJECT_CHANGES`
- `DA_SUBSCRIBE_PARAMETER_CHANGES`

Responses use:

```json
{
  "ok": true,
  "requestId": "id",
  "data": {}
}
```

or:

```json
{
  "ok": false,
  "requestId": "id",
  "error": {
    "code": "REQUIRES_CUBASE_15_API_1_3",
    "message": "DirectAccess plugin manager is not available",
    "cubaseApiVersion": "15.0.20",
    "objectId": 123
  }
}
```

## Host object tree example shape

Actual object IDs and titles come from Cubase at runtime. The expected shape is:

```json
{
  "root": "mixConsole",
  "baseObjectId": 1,
  "tree": {
    "objectId": 1,
    "title": "MixConsole",
    "typeName": "MixConsole",
    "uniqueId": "host-specific",
    "childCount": 32,
    "children": [
      {
        "objectId": 100,
        "title": "Audio 01",
        "typeName": "MixerBankChannel",
        "parameterCount": 12
      }
    ]
  }
}
```

## Parameter list example shape

```json
{
  "count": 4,
  "parameters": [
    {
      "objectId": 100,
      "parameterTag": 2001,
      "title": "Volume",
      "displayValue": "-6.0",
      "displayUnits": "dB",
      "processValueType": "float",
      "automatable": true
    }
  ]
}
```

## Plugin manager

The bridge checks `da.mPluginManager` and these methods:

- `getNumberOfPluginCollections`
- `getIndexOfActivePluginCollection`
- `getPluginCollectionByIndex`
- `trySetSlotPlugin`
- `resetSlotPlugin`

If unavailable, plugin slot assignment returns `REQUIRES_CUBASE_15_API_1_3`.
Assignment audit mutates only with `--execute-plugin-assignment`, requires a
safe current-plugin UID match, and must restore that UID before producing
positive evidence. Slot reset is destructive and requires `confirm:true`.

## Command binding candidates

The DirectAccess bridge script creates command bindings for:

- Add Track > Audio
- Add Track > MIDI
- Add Track > Instrument
- Add Track > Group
- Add Track > FX
- Add Track > Folder
- Add Track > Marker
- Add Track > Tempo
- Add Track > Chord
- Duplicate Track
- Remove Selected Tracks
- Quantize
- Bounce Selection
- Crossfade
- Apply Standard Fade In
- Apply Standard Fade Out
- Delete Overlaps
- Dissolve Part
- Add Position Marker on Selected Track
- Add Cycle Marker on Selected Track
- Audio Export > Perform Audio Export
- Undo
- Redo

`canPerform` is reported when the host exposes it. Commands that may open dialogs remain `partial_command_binding` until real Cubase logs prove they complete headlessly.

## Reclassification

New partial/real candidate tools:

- `cubase.create_track_default_audio`: `partial_command_binding`
- `cubase.create_track_default_midi`: `partial_command_binding`
- `cubase.perform_current_audio_export`: `partial_current_setting_only`, requires existing export settings and real export evidence
- `cubase.add_insert_plugin`: `partial_direct_access` when `pluginSlotObjectId` and `pluginUid` are provided
- `cubase.set_plugin_parameter`: `partial_direct_access` when `objectId` and `parameterTag` are provided
- `cubase.set_eq_band`: `partial_direct_access` when the caller provides discovered object/parameter tags
- `cubase.set_send_level`: `partial_direct_access` when the caller provides discovered object/parameter tags

The semantic tool schemas preserve explicit DirectAccess addresses rather than
silently stripping them. Object and parameter subscriptions are acknowledged in
`direct-access-tree.json`; while subscribed, the script calls feature-detected
`update(activeMapping)` from its idle callback.

Not-yet-proven tools remain `unknown/not_tested_yet`, not `BLOCKED_BY_CUBASE_API`.
