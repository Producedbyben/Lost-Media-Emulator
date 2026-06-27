# Epic 6.3a — Multi-pass Post-process Foundation + High-frequency Effects — Design

> First increment of Epic 6.3 (the multi-pass tier of the GPU engine leap), v2.x. Epic 6.1
> flipped the display family; 6.2 ported the per-pixel signal core; post-6.2 fixes added
> grain parity + LCD/OLED/plasma masks (26 routed). This increment stands up the **ping-pong
> post-process architecture** that the rest of 6.3 reuses, and lands the highest-ROI tractable
> effects. Strategy: `docs/GPU-PORT-PLAN.md`. Prior: `docs/gpu/SIGNAL-FIDELITY.md`.

## Why this scope (blocker analysis, 2026-06-27)

A static analysis of all 112 presets showed incremental per-group porting unlocks almost
nothing (the classics are each blocked by ~10 co-occurring effects). The unlock curve is
back-loaded: implementing the **top ~15 most-common blockers** flips **85/112 (76%)**; the
remaining ~27 need a 40-effect long tail. The chosen sequence:

- **6.3a (this spec):** ping-pong architecture + easy temporal/global modulations
  (`frameStutter`, `exposurePump`, `whiteBalanceDrift`) + 7 exotic capture masks + **ghosting**
  + **focusBreathing** → ~40 routed.
- 6.3b: screen-space chain completion (generationLoss, macroBlocking, mediaAging, copyGen,
  burnIn, restoration) + quantization (8×8 DCT) → ~56.
- 6.3c: OSD on GPU (timestamp + style) → ~85.
- 6.3d: long tail + NTSC/PAL format composite → toward full coverage.

## Goal

Stand up the reusable **multi-pass post-process chain** (ping-pong framebuffers inserted
between optics and bloom) and port 6.3a's effects to it / to the existing shader, at fidelity
(< 6 mean-err vs CPU), lifting the routed set ~26 → ~40 and de-risking the architecture every
later 6.3 increment depends on.

## Architecture

Two parts: a shader extension (no new architecture) and the new ping-pong chain.

### Part 1 — Shader extension (fold into the existing grade/optics/composite shader)

- **`frameStutter`** (CPU `crt-renderer-full.js` ~574–576): `stutterHoldFrames =
  floor(frameStutter²·6)`, `stutteredFrame = frameIndex − (frameIndex mod (stutterHoldFrames+1))`.
  The **backend computes `stutteredFrame` in JS** (matching the CPU) and passes it as a NEW
  `u_temporalFrame` uniform (with `u_temporalSeconds = stutteredFrame/fps`). The shader uses
  `u_temporalFrame`/`u_temporalSeconds` for the temporal terms (wobble, jitter, head-switch,
  crease, weave, dropouts, grain, interlace, flicker, plasma pulse) — switching the current
  `tFrame = u_frameIndex` / `tSec = u_frameIndex/u_fps` over to them. **`u_frameIndex` stays the
  REAL frame** and is kept for the gate offsets (CPU ~569–572 use `frameIndex`, not the stutter),
  so the two must not be conflated.
- **`exposurePump`** (~1090, 1092–1093): `exposureWave = 1 + (sin(tSec·1.53)·0.5+0.5)·pump·0.28`;
  applied as `mix(col, col·exposureWave, min(0.35, pump·0.35))`. Pointwise → `fs_composite` after
  flicker.
- **`whiteBalanceDrift`** (~1091, 1094–1098): `warmShift = (sin(tSec·0.37+2.4)·0.5+0.5)·drift`;
  screen-blend a global colour `rgb(30+warmShift·70, 18+warmShift·28, 40+(1−warmShift)·80)/255` at
  `min(0.22, 0.05+drift·0.2)`. Pointwise → `fs_composite` after exposurePump.
- **7 exotic capture masks** (CPU ~732–779): `filmSuper8`, `film16mm`, `instantDyeCloud`,
  `irBloomSpeckle`, `cmosRollingColumn`, `lowBitrateBlockGrid`, `fisheyeMicrolens`. New `optics()`
  mask branches, codes 9–15, reusing the LCD/OLED/plasma pattern just shipped. Some use small-arg
  `seededNoise` (well within the emulated-f64 range). Bound each branch by its code (as done for
  phosphor).

### Part 2 — Ping-pong post-process chain (the reusable architecture)

Insert between optics and bloom. New pipeline order:

```
grade → T_graded → optics → T_optics
      → [ghosting pass] → [focusBreathing pass]   (ping-pong A↔B, only active filters encoded)
      → T_filtered
      → blurH(T_filtered) → T_h
      → composite(bloom from T_filtered + T_h, vignette, flicker, exposurePump, whiteBalanceDrift,
                  scanlineProfile, subpixel) → canvas
```

When no chain filter is active, `T_filtered = T_optics` (the chain is a passthrough), preserving
6.2 behaviour exactly. The backend owns two ping-pong textures (`T_ppA`/`T_ppB`) and conditionally
encodes only the active filters' passes; the final chain output is bound as bloom's "sharp" input
(replacing `T_optics`) and blurred for bloom.

- **`ghosting`** (CPU ~888–892): `ghostShift = round((0.5+ghosting·3.5)·sin(tSec·1.7))`; composite
  `T_optics` sampled at `(px+ghostShift, py)` over the running result at `min(0.42, ghosting·0.45)`.
  A fragment pass sampling two textures (running result + `T_optics`). (Ghosting reads `T_optics`,
  not the running result — keep `T_optics` bound alongside the ping-pong input.)
- **`focusBreathing`** (CPU ~919–925): `blurPx = (0.2 + (sin(tSec·1.17+1.3)·0.5+0.5)·1.8)·focus`;
  `mix(self, gaussianBlur(self, blurPx), min(0.55, focus·0.6))`. Reuses the separable Gaussian
  (a horizontal + a vertical blur pass, or fold the vertical into the composite-style step) — same
  machinery as bloom, parameterised by `blurPx`.

### Contract & uniforms

Extend `CRT_SIGNAL_UNIFORMS` / `buildSignalUniforms` with `u_exposurePump`, `u_whiteBalanceDrift`,
`u_ghosting`, `u_focusBreathing`, and `u_temporalFrame` (the stuttered frame; `u_temporalSeconds`
is derived in-shader as `u_temporalFrame/u_fps`). `buildSignalUniforms` computes the stuttered
frame from `advancedFrameStutter` + the real frame index. Add mask codes 9–15 to `MASK_CODES`. The
WGSL struct + backend buffer write stay field-aligned (the contract discipline from 6.1/6.2).

### Backend

`webgpu-backend.ts` gains: the stuttered-frame computation (JS), two ping-pong textures + their
bind groups, a ghosting pipeline and a focusBreathing-blur pipeline, and conditional pass encoding
(skip a filter's passes when its uniform is neutral). The bloom/composite passes take `T_filtered`
as input. `create()` null-on-unavailable, device-lost fallback, `flush()`/`outputCanvas` unchanged.

### Gate

Extend `gpuSignalOK`: add the 7 exotic masks to `WEBGPU_SUPPORTED_MASKS`; add `advancedExposurePump`,
`advancedWhiteBalanceDrift`, `advancedFrameStutter`, `advancedGhosting`, `advancedFocusBreathing` to
`WEBGPU_SIGNAL_SUPPORTED`. Everything else (generationLoss, macroBlocking, quantization, OSD, format
composite, the long tail, datamosh/pixel-sort) stays gated to CPU via the catch-all.

## Components & files

- Modify: `src/lib/effects-core/crt-display.wgsl` (frameStutter temporal frame, exposurePump,
  whiteBalanceDrift, 7 mask branches, ghosting pass, focusBreathing blur)
- Modify: `src/lib/effects-core/param-map.ts` (new uniforms + mask codes)
- Modify: `src/lib/effects-core/webgpu-backend.ts` (ping-pong chain, conditional passes, stutter frame)
- Modify: `src/lib/crt-renderer-hybrid.js` (`gpuSignalOK` + masks)
- Modify: `tools/gpu-coverage.snippet.js` (sweep already covers the catalogue)
- Update: `docs/gpu/SIGNAL-FIDELITY.md` (new routed set)
- Test: `src/test/effects-core-param-map.test.ts` (new uniforms/codes)

## Determinism & parity

- Renderer noise stays `seededNoise` only. The stuttered frame is deterministic (integer math on
  frameIndex). Export forces `preferGPU=false` → CPU path; Epic 1 sweep stays 455/455.
- GPU stays perceptual-parity (< 6) to CPU.

## Error handling & edge cases

- No WebGPU / device lost / compile fail → backend null → WebGPU→WebGL2→CPU fallback (unchanged).
- A preset that can't clear < 6 is NOT routed (gate + sweep keep it CPU), reported with numbers.
- Ping-pong texture resize handled with the other per-size resources.

## Testing

- Unit (jsdom): `buildSignalUniforms` packs the new uniforms + mask codes.
- Integration (controller, live): per-effect isolated GPU verification (frameStutter, exposurePump,
  whiteBalanceDrift, each exotic mask, ghosting, focusBreathing); then the full-catalogue sweep —
  `gpuSignalOK` must allow exactly the < 6 set (`allowedFailing: []`), routed set ~40.
- Guards: existing tests green, tsc + `vite build` clean, export bit-identical, parity 455/455.

## Done criteria (6.3a)

1. The ping-pong post-process chain exists and is a passthrough when no chain filter is active
   (6.2 presets unchanged).
2. frameStutter / exposurePump / whiteBalanceDrift / the 7 exotic masks / ghosting / focusBreathing
   render via WebGPU at < 6 vs CPU for the routed presets.
3. `gpuSignalOK` allows exactly the < 6 set (`allowedFailing: []`); routed set ~40.
4. WebGPU→WebGL2→CPU fallback intact; export CPU-deterministic (parity 455/455).
5. Unit tests pass; existing tests green; tsc + build clean. `docs/gpu/SIGNAL-FIDELITY.md` updated.

## Boundaries (this increment only)

- **In:** the ping-pong architecture + frameStutter, exposurePump, whiteBalanceDrift, 7 exotic
  masks, ghosting, focusBreathing.
- **Deferred to 6.3b+:** generationLoss, copyGeneration, macroBlocking, mediaAging, burnIn,
  restoration, quantization (DCT), OSD, NTSC/PAL format composite, the long tail.
- **CPU forever:** datamosh, pixel-sort.
