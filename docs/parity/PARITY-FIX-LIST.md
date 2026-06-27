# Lost Media Emulator — Export-Parity Fix List (Epic 1, Phase 1)

**Method:** the frame-accurate determinism sweep (`tools/parity/parity-sweep.snippet.js`) ran every
preset at the temporally-sampled frames `[0, 1, 7, 15, 29]`, rendering each frame's forced-CPU export
path twice from a clean `reset()` and checking byte-identical reproducibility. **Determinism is the
hard pass** (an export must render the same every time); preview↔export parity (Δmean ≤ 6 CPU / ≤ 12
GPU) is the soft pass, checked in-app via "Validate export ↔ preview".

**Result:** 91 presets × 5 frames = **455 checks. 451 clean on the first sweep (99.1%)**; 4 determinism
failures, all in the glitch/digital-corruption family, all at frame 1.

---

## Determinism failures — FIXED & verified

| Preset | Frame(s) | Failure | Root cause | Status |
|---|---|---|---|---|
| Vine Reupload Compilation (2014) | 1 | export not reproducible | datamosh inter-frame feedback carried across renders | ✅ fixed |
| MPEG-2 Satellite Glitch | 1 | export not reproducible | (same — `moshCanvas` / `_moshLastFrame` not cleared by `reset()`) | ✅ fixed |
| Datamosh Bloom (I-Frame Removal) | 1 | export not reproducible | (same) | ✅ fixed |
| Corrupted Codec (Bit-Rot) | 1 | export not reproducible | (same) | ✅ fixed |

**Root cause:** the datamosh / digital-decay effects use inter-frame feedback buffers
(`this.moshCanvas` P-frame accumulator + `this._moshLastFrame`, `src/lib/crt-renderer-full.js`).
The P-frame bloom only fires when `frameIndex === this._moshLastFrame + 1` (line ~1056), but `reset()`
cleared only the cached output, so that state carried over between renders. Rendering a frame twice
therefore diverged (pass A saw `lastFrame = previous`, pass B saw `lastFrame = current`), and an
export's result depended on whatever the preview had rendered first — a real preview↔export parity break.

**Fix:** `reset()` now clears the mosh feedback (`_moshLastFrame = -999`, `_moshLastW/H = 0`, clears
`moshCanvas`). Commit `cd9d5ed`. Re-sweep confirms all 4 presets byte-identical across frames
0/1/7/15/29 → **455/455 deterministic**. 102 tests green, tsc clean.

---

## Preview↔export parity (soft check)

The renderer-level determinism sweep is the automatable backbone. Perceptual preview↔export parity is
verified manually via the in-app **"Validate export ↔ preview"** button (export-path CPU render vs the
live preview pixels, Δmean ≤ 6 CPU / ≤ 12 GPU). Run it on a per-family subset whenever the render path
changes; it reuses the same `export-validator.js` primitives. No parity (non-determinism) failures
remain after the fix above.

## Encode-level parity

The ffmpeg encode (renderer output → MP4) is spot-checked in
`electron/__tests__/ffmpeg-pipeline.smoke.test.js` (Task 4): a decoded frame must match the encoded
source within codec tolerance.

## Re-running

```
# 1. start the app
npm run dev
# 2. paste tools/parity/parity-sweep.snippet.js into the devtools console (or eval via preview tooling)
#    -> prints "<clean>/<total> clean", stashes window.__parityResults
# 3. encode spot-check
npx vitest run electron/__tests__/ffmpeg-pipeline.smoke.test.js
```
