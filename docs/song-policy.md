# Song Creation Policy

## Role resolution

| Musical role or source | Cubase track type |
|---|---|
| drums, bass, chords, lead, pad, arp | Instrument Track |
| vocal recording, guitar recording | Audio Track |
| audio loop, stem | Audio Track |
| reverb, delay | FX Track |
| drum bus, music bus | Group Track |
| chord progression | Chord Track |
| markers | Marker Track |
| external hardware synth | MIDI Track |
| rack multi-timbral instrument channel | MIDI Track |

The resolver enforces these source rules:

```text
software_instrument -> instrument
external_midi       -> midi
audio_recording     -> audio
audio_loop          -> audio
bus                 -> group
send_fx             -> fx
```

## Creation transaction

1. Plan musical roles, arrangement, tempo, key, content, and routing.
2. Resolve and validate every track type.
3. Create all tracks and retain stable IDs.
4. Load instruments or record the instrument assigned by the official operation.
5. Generate and import MIDI parts/notes for required software parts.
6. Apply routing by stable target.
7. Validate the resulting project and audibility evidence.
8. On failure, remove only planner-owned targets and report rollback failures.

## Invalid success

Song creation is failed when any required condition is missing, including:

- software bass or drums created as a MIDI Track;
- Instrument Track without an instrument;
- required MIDI role without an imported part and notes;
- audio role that requires media without an audio event;
- MIDI file generated but not imported;
- invalid required routing;
- no meter or render evidence that the result is audible.

The mock adapter supplies only explicitly marked test evidence. On a real host, creation briefly locates to the first bar, starts transport, reads official meter state, and restores the previous position and play state. It accepts only observed non-silent meter values. If the host cannot expose that evidence, creation fails and planner-owned tracks are rolled back instead of returning a false success.
