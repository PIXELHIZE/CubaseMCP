# J-pop reference corpus

This directory stores reproducible metadata and research notes used to improve the song planner without copying commercial recordings, lyrics, MIDI files, stems, or complete song transcriptions.

## Contents

- `catalog/billboard-japan-hot-100-2025.json`: 100-song major-title index collected from the official Billboard Japan year-end chart.
- `catalog/sources.json`: source, license, reliability, and product-use decisions.
- `catalog/harmonic-archetypes.json`: generalized Roman-numeral patterns and form vocabulary supported by the cited research; these are not song transcriptions.
- `catalog/derived-density-policy.json`: before/after note-density budget derived from the failed crowded render.
- `catalog/installed-steinberg-content.json`: local inventory of relevant licensed Steinberg content; no content files are copied.
- `catalog/collection-manifest-2025.json`: collection timestamp and checksum.
- `validation/automation14-density-v2.json`: real Cubase MCP action chain, render hash, and section-dynamics evidence for the reduced-density arrangement.
- `cache/`: ignored local cache for research-only datasets. Nothing in this folder is shipped, published, or used by the runtime.

Refresh the chart index with:

```powershell
npm run research:jpop:collect -- --year 2025
```

## Legal boundary

Billboard rankings are stored as a metadata index only. Songle is personal-use oriented and its automatic analyses may contain errors. RWC 2.0 annotations are CC BY-NC 4.0. IdolSongsJp prohibits training generative models on its instrumental signals and requires permission for commercial product use. These restricted sources may guide human evaluation or source discovery, but their raw data is not bundled into the Apache-2.0 runtime.

The production engine consumes only independently implemented, generalized musical rules. Each rule must have a source and must not reproduce a complete identifiable song arrangement.
