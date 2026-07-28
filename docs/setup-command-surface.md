# Command Surface and Command Bindings

The recommended `direct-access-bridge.js` creates the audited command bindings
with `page.makeCommandBinding(...)`. No OS keyboard shortcut is sent.

The standalone `command-surface-bridge.js` is for hosts where DirectAccess is
unavailable. Install one bridge script for the two configured ports, not both.
Both scripts use correlated `AIMCP1`/`AIMCP1C` SysEx and chunk large registry
responses.

Bindings include default track creation, duplicate/remove selected tracks,
quantize, bounce/crossfade/fades, marker commands, current-settings render and
audio export, Undo/Redo, Legato, and Fixed Lengths. The exact category/name
pairs follow the official Cubase command registry; `canPerform` is
feature-detected on API 1.3.

Commands marked dialog-risk are listed but not executed by audit. Destructive,
marker, render, and export candidates execute only with
`--execute-destructive`. Parameterized creation, rename text, export path,
format, and range cannot be supplied by command binding.

For a custom user mapping, add a unique CC/note/program entry to
`src/config/commandMappings.ts` and call `cubase.trigger_command`. The command
must still be validated and its state effect verified on the real host.
