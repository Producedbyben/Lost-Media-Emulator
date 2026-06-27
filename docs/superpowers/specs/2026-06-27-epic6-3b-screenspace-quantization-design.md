# Epic 6.3b — Screen-space Filter Chain + Quantization — Design

> Second increment of Epic 6.3 (the multi-pass tier). 6.3a stood up the ping-pong post-process
> chain (ghosting + focusBreathing) and the high-frequency effects (routed 34). This increment
> extends that chain with the remaining screen-space self-composite filters and adds the
> resolution-reduction / block-structure effects. Prior: 6.3a spec; `docs/gpu/SIGNAL-FIDELITY.md`.

## Goal

Port the 6.3b effects to the ping-pong chain at fidelity (< 6 mean-err vs CPU), gating to CPU
any effect whose browser-specific canvas resampling/filter can't be matched. Per the blocker
analysis, quantization is the biggest single unlock in this group (+13); the screen-space
filters add fewer (they co-occur with quantization/OSD), but complete the aged/dub family.

## Effects (CPU `src/lib/crt-renderer-full.js`)

**Screen-space filter chain** (extend the ping-pong chain; each samples the running result or
T_optics, applies blur / saturate / contrast / brightness + a blend mode):
- `burnInGhost` (~901–917): screen + multiply blend of a desaturated/brightened T_optics copy.
- `advancedGenerationLoss` (~927–937): a loop of blur + saturate + contrast offset self-draws.
- `copyGenerationCount` (~942–957): integer N-pass dub — blur + saturate + contrast offset draws.
- `mediaAgeYears` + `storageCondition` (~960–1007): yellow multiply tint + desaturate/contrast/
  brightness self-blur + lifted-black screen fill + deterministic speckle dust.
- `restorationPassLevel` (~1010–1025): saturate/contrast/brightness self-draw + overlay sharpen.

**Resolution-reduction / block-structure** (new downscale→upscale passes):
- `advancedMacroBlocking` (~1115–1130): box-downscale to `width/blockSize` then nearest-upscale
  composite at alpha. `blockSize` derived from macroBlocking + resolution.
- `advancedQuantization` (~1133–1180): resolution downscale + per-channel level quantization +
  upscale, then (when > 0.18) an 8×8 DCT block-edge grid + mosquito ringing.

## Architecture

Reuse the 6.3a ping-pong chain; insert the new screen-space filters as additional conditional
passes BETWEEN focusBreathing and the bloom (matching the CPU order: burnIn → focusBreathing
(done) → generationLoss → copyGen → mediaAging → restoration). Each filter is a fragment pass
that reads the running `tPp*` texture (and `T_optics` for burnIn) and writes the next ping-pong
texture; blur-based filters reuse the separable Gaussian (a horizontal pre-pass + the in-pass
vertical), parameterised by the per-filter blur radius. Loops (generationLoss/copyGen dub
passes) are unrolled as a small fixed sequence of passes (the CPU caps them, e.g. ≤ 6).

**Resolution reduction** (macroBlocking, quantization) uses a dedicated low-res render target:
render the running result into a `lowW×lowH` texture (linear filter = box average to match the
canvas downscale), then sample it back upscaled (nearest for macroBlocking's blocky look; with
the level-quantization + DCT grid folded into quantization's upscale pass). The block grid +
mosquito ringing are pointwise/neighbourhood ops in the upscale pass.

The chain grows, so the backend needs more ping-pong textures (or reuse `tPpA`/`tPpB` by
alternating) + a low-res texture. Conditional encoding (skip inactive filters) keeps the cost
down; the chain remains a passthrough when all 6.3b effects are off (6.2/6.3a unchanged).

## Contract & gate

Extend `CRT_SIGNAL_UNIFORMS`/`buildSignalUniforms` with the new effect uniforms (burnInGhost,
generationLoss, copyGenerationCount, mediaAgeYears + storageCondition code, restorationPassLevel,
macroBlocking, quantization). Extend `gpuSignalOK` to allow them — BUT only after the sweep
confirms each clears < 6; any effect that can't (canvas-resampling mismatch) is left OUT of the
supported set and stays CPU, recorded in `docs/gpu/SIGNAL-FIDELITY.md`. `allowedFailing` must
stay `[]`.

## Determinism & parity

Renderer noise stays `seededNoise` (mediaAging's speckle uses the CPU's deterministic mulberry
RNG seeded on frameIndex — reproduce it deterministically or gate mediaAging if it can't match).
Export forces `preferGPU=false` → CPU; Epic 1 parity stays 455/455.

## Testing

- Unit: `buildSignalUniforms` packs the new uniforms + storageCondition code.
- Integration (live): per-effect isolated GPU verification; iterate the WGSL until < 6 or gate.
  Full-catalogue sweep — `allowedFailing: []`, record the new routed count.
- Guards: existing tests green, tsc + build clean, export bit-identical, parity 455/455.

## Done criteria (6.3b)

1. Each 6.3b effect that clears < 6 is ported + routed; any that can't is gated to CPU with a
   recorded reason. The chain is a passthrough when all 6.3b effects are off.
2. `gpuSignalOK` allows exactly the < 6 set (`allowedFailing: []`); the routed count grows.
3. Fallback intact; export CPU-deterministic (parity 455/455).
4. Unit tests pass; existing tests green; tsc + build clean. `SIGNAL-FIDELITY.md` updated.

## Boundaries

- **In:** burnIn, generationLoss, copyGeneration, mediaAging, restoration, macroBlocking,
  quantization — each subject to the < 6 gate (gated to CPU if canvas-resampling can't match).
- **Deferred to 6.3c+:** OSD (timestamp + style), NTSC/PAL format composite, chroma subsampling,
  the long tail (lumaNoise/chromaNoise/trackingError/tapeSkew/headClog/packetLoss/deblocking/
  ringing/gopLength/etc.).
- **CPU forever:** datamosh, pixel-sort.
