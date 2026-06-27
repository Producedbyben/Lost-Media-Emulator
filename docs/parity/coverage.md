# Export-parity coverage (Epic 1, Phase 1)

**Determinism sweep:** 91 presets × 5 frames `[0,1,7,15,29]` = **455 checks**.

| Run | Clean | Failing | % |
|---|---|---|---|
| First sweep | 451 | 4 | 99.1% |
| After `reset()` fix (commit `cd9d5ed`) | **455** | 0 | **100%** |

All 4 first-sweep failures were determinism (non-reproducible export) in the glitch/digital-corruption
family (Vine Reupload, MPEG-2 Satellite Glitch, Datamosh Bloom, Corrupted Codec), all at frame 1 — see
`PARITY-FIX-LIST.md`. After the fix every preset renders byte-identically across all sampled frames.

**By family (post-fix):** all clean — Display/CRT, Digital/Compression, Analog/Tape, Film, Surveillance/IR,
Photographic, VHS/consumer-tape, and the glitch family. The renderer uses a deterministic `seededNoise`
(no `Math.random`/wall-clock in the render path), so temporal effects are reproducible by frame index.

**Preview↔export parity (soft):** verified in-app via "Validate export ↔ preview" on a per-family subset;
no parity failures after the determinism fix.

**Encode-level:** spot-checked in `electron/__tests__/ffmpeg-pipeline.smoke.test.js`.

Regenerate: run `tools/parity/parity-sweep.snippet.js` in the app console (see `README.md`).
