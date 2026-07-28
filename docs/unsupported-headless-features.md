# Unsupported or Unverified Headless Features

This file does not declare a Cubase API blocker without a connected-host audit.
Static status is either unknown, partial, or bridge-required.

## Current bridge-required categories

- project create/open/save-as/close with explicit paths and options;
- fully parameterized track creation, routing, rename, reorder, and folder moves;
- direct MIDI part/note/controller CRUD after import;
- arbitrary audio event CRUD and DSP processing;
- automation point/lane CRUD;
- arbitrary MediaBay/pool/project object access;
- export settings, stems/batch export, and render configuration;
- plugin-owned preset, bus, sidechain, and multi-output operations not exposed
  by DirectAccess.

These calls are sent through the explicit named-pipe bridge protocol. Without
a production Cubase-side binary they return `NEEDS_CUBASE_SIDE_BRIDGE`; they are
not silently handled by the mock adapter.

## Partial alternatives already present

- default track commands with current/default Cubase settings;
- selection-dependent quantize, fade, crossfade, bounce, marker, and related
  commands when `canPerform` and state evidence support them;
- generated Standard MIDI File plus explicit bridge import;
- selected/focused Quick Controls;
- DirectAccess ObjectID/parameterTag mixer, EQ, send, plugin, automation, and
  plugin-manager routes;
- current-settings-only audio export with optional filesystem verification.

## Explicitly disallowed fallbacks

No tool may use keyboard/mouse injection, Windows UI Automation, menu or dialog
automation, screenshots, OCR, file-picker automation, or forced window focus.
If a connected-host report proves those are the only paths, the report can use
`blocked_by_no_headless_api` with its evidence file.
