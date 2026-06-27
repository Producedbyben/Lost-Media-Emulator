# Epic 6.2 — Per-pixel Signal Core on WebGPU — Design

> Second increment of Epic 6 (the GPU engine leap), v2.x track. Epic 6.1 stood up the
> portable WGSL/WebGPU effects-core and flipped the CRT/display family (display-axis
> *Stage B* optics). This increment ports the **per-pixel capture/signal core** — the
> `renderGrade` colour stage plus the per-pixel, frame-deterministic artifacts in the
> fused render loop — so capture+display preset combinations flip to GPU at fidelity.
> Strategy: `docs/GPU-PORT-PLAN.md`. Prior increment: `2026-06-27-epic6-1-*`,
> `docs/gpu/CRT-DISPLAY-FIDELITY.md`.

## Goal

Take the **~80% per-pixel, frame-deterministic** slice of the effect suite from the
~525 ms CPU path to real-time GPU at full fidelity (mean-err < 6 vs CPU), by extending
the `effects-core` shader with the grade colour stage and the per-pixel signal artifacts,
and by solving GPU↔CPU **noise parity**. Acceptance is the full 91-preset catalogue sweep:
every preset that reaches < 6 on per-pixel work alone flips to GPU.

## The linchpin: emulated-f64 noise parity

Every noise lookup is the CPU hash
`seededNoise(x,y,frame) = fract(sin(x*12.9898 + y*78.233 + frame*19.17) * 43758.5453)`.
GPU f32 cannot reproduce it for large arguments: for pixel coords up to 640×480 the sine
argument reaches ~8000, where an f32 argument keeps only ~3 fractional digits, so `sin`
lands on an unrelated value and `fract(·*43758)` amplifies it — uncorrelated noise →
mean-err 13–20. (This is precisely why Epic 6.1 chose the noise-light display family.)

**Fix:** compute the argument and the mod-2π range reduction in **emulated double
precision** (double-f32 via `twoProduct`/`twoSum`/Dekker split), then take `sin` of the
small reduced argument in f32. With a ~14-significant-digit emulated argument the residual
`sin` error is ~1e-6, so `fract(sin·43758)` matches CPU to ~1e-4 → grain mean-err ≈ 0.4.
Pure GPU (no per-frame CPU noise cost), reusable by every later family.

- `noise.wgsl` gains the emulated-f64 `seededNoise` (replacing the naive f32 one) plus the
  double-f32 helpers. It stays a verbatim twin of the CPU formula (the existing
  `seeded-noise-ref.ts` JS reference pins the formula; a unit test keeps them in lockstep).
- Runtime proof: the sweep adds a noise-field check (sample the WGSL `seededNoise` at the
  same `(x,y,frame)` set as the JS ref and confirm match to ~1e-2) before the preset sweep.

## Architecture

Extends `src/lib/effects-core/` and the hybrid; same fidelity-gated workflow as 6.1.

### 4-pass pipeline (adds a grade pre-pass ahead of 6.1's optics→blurH→composite)

1. **`fs_grade`** → `T_graded`. Samples the backend's cover-fit source texture and applies
   the **pointwise** `renderGrade` (crt-renderer-full.js `renderGrade`, lines ~1641–1788
   + irHotspot ~1853): brightness, contrast, IR false-colour (Aerochrome remap), haze,
   print-fade C/M/Y, black-level crush, highlight roll-off, polaroid crossover,
   saturation, gamma, temperature, tint, monochrome tint (+ strength), IR hotspot (radial,
   pointwise). Matches CPU Stage A (grade is applied to the signal buffer before optics).
2. **`fs_optics`** (extends 6.1's `optics()`) → `T_optics`. Samples `T_graded`; ports the
   per-pixel fused-loop artifacts from `render()` (~596–870):
   - **Geometric warps** added to the barrel-warped source coords: timebase wobble, line
     jitter, head-switching tear band, tape crease, film gate weave, gate jitter X/Y, gate
     rotation, shutter judder.
   - **Chroma**: chroma delay + cross-color horizontal sampling offsets (on top of 6.1's
     chromatic aberration).
   - **Level**: dropouts (clustered horizontal streaks), interlacing gate, head-band noise.
   - **Colour**: film grain (+ grainSize, grainChromaticity), film dust, film scratches,
     halation soft-blend, Bayer-4×4 ordered dither (noise). (Neon phosphor bleed is NOT
     here — it also fires a wide screen-space glow in the bloom pass, so the whole param is
     gated to CPU in 6.2 and ported in 6.3.)
3. **`fs_blurH`** → `T_h`. Unchanged separable-Gaussian horizontal pass (6.1 bloom).
4. **`fs_composite`** → canvas. 6.1's vertical-blur + screen/lighter bloom + tube/lens
   vignette + flicker, **plus** the pointwise post-passes: colour quantization, scanline
   profile (off/soft/hard/triadAware), subpixel layout (RGB/BGR/PenTile), CCTV monochrome.

### Contract & uniforms

- Grow `CRT_DISPLAY_UNIFORMS` (21) into `CRT_SIGNAL_UNIFORMS` (~50 fields) and add
  `buildSignalUniforms(params, ctx)` in `param-map.ts` (pure; the 6.1 display fields keep
  their meaning, new capture/grade fields appended). Categorical string params
  (maskType, monochromeTint, scanlineProfile, subpixelLayoutOverride) map to numeric codes.
- The WGSL `Uniforms` struct and the backend uniform-buffer write stay **field-for-field
  aligned** with `CRT_SIGNAL_UNIFORMS` — the single source of truth, exactly as in 6.1.
  Buffer padded to a 16-byte multiple.

### Backend

`webgpu-backend.ts` gains the grade pre-pass: one more pipeline (`fs_grade`, target
`rgba8unorm`) and the `T_graded` texture + its bind group. `fs_optics`'s bind group now
samples `T_graded` instead of the source texture. Everything else (cover-fit upload,
device-lost fallback, null-on-unavailable, `flush()`/`outputCanvas` for the sweep) is
unchanged from 6.1.

### Gate

Generalise `gpuFamilyOK` → `gpuSignalOK(params, renderOptions)`:
- **Allow** all per-pixel params the shader now implements (the 6.1 display set + the grade
  set + the per-pixel artifact set), at any value.
- **Route to CPU** when any of these is active (multi-pass / inter-frame, deferred or
  permanent): `renderOptions.formatProfile` needing resolution reduction or NTSC/PAL
  composite; `renderOptions.sourceView`; OSD (`advancedTimestampOSD`); ghosting,
  burn-in, focus breathing, generation loss, copy generation, media aging, restoration,
  macroblocking, nitrate decay, technicolor fringe, the wide neon bleed; datamosh,
  datamosh displacement, pixel sort, bit-rot. Any param not in the supported set must be
  at its neutral value (same catch-all discipline as 6.1).

## Components & files

- Modify: `src/lib/effects-core/noise.wgsl` (emulated-f64 `seededNoise` + double-f32 helpers)
- Modify: `src/lib/effects-core/crt-display.wgsl` (add `fs_grade`; extend `fs_optics` +
  `fs_composite`; the `Uniforms` struct grows). Keep the filename as-is to minimise churn
  (its `?raw` import and the backend wiring stay put); the header comment notes it now
  covers the full signal core.
- Modify: `src/lib/effects-core/param-map.ts` (`CRT_SIGNAL_UNIFORMS` + `buildSignalUniforms`)
- Modify: `src/lib/effects-core/webgpu-backend.ts` (grade pipeline + `T_graded`)
- Modify: `src/lib/crt-renderer-hybrid.js` (`gpuSignalOK` gate)
- Modify: `tools/gpu-coverage.snippet.js` (full-catalogue WebGPU sweep + noise-field check)
- Create: `docs/gpu/SIGNAL-FIDELITY.md` (per-preset table; routed set; deferred set)
- Test: `src/test/effects-core-noise.test.ts` (extend), `src/test/effects-core-param-map.test.ts`
  (extend for `buildSignalUniforms`)

## Determinism & parity

- GPU stays **perceptual-parity** (f32) to CPU (f64), now including noise via the emulated
  arg — within the < 6 bar. Renderer noise is `seededNoise` only (no `Math.random`/
  `Date.now`/`performance.now`).
- **Export is unaffected** — it forces `preferGPU = false` (so the WebGPU branch is
  bypassed) and runs the deterministic CPU path. The Epic 1 determinism sweep stays
  455/455; spot-check it.

## Error handling & edge cases

- No WebGPU / device lost / shader compile fail → `WebGPUBackend.create()` returns null /
  the backend marks itself dead → hybrid falls back WebGPU→WebGL2→CPU (unchanged from 6.1).
- A preset whose noise or geometry still can't clear < 6 → it is **not** routed (gate +
  sweep keep it on CPU); reported honestly with numbers, never silently flipped.
- Resize / DPR / context loss handled as in 6.1.

## Testing

- Unit (jsdom): emulated-noise formula parity (`seededNoiseRef`), `buildSignalUniforms`
  packing + categorical codes.
- Integration (controller, live app): full 91-preset WebGPU-vs-CPU sweep; noise-field
  check first. Iterate `crt-display.wgsl` per failing preset (isolate stage, as in 6.1).
- Guards: 141 existing tests green, tsc + `vite build` clean, export-path bit-identical
  (preferGPU off), Epic 1 parity 455/455.

## Done criteria (Increment 2)

1. Emulated-f64 `seededNoise` matches the CPU/JS reference and is verified live.
2. The grade stage + per-pixel signal artifacts render via WebGPU at mean-err < 6 vs CPU
   for the routed presets; the hybrid routes them (no 525 ms stall) and `gpuSignalOK`
   allows **exactly** the < 6 set (zero false positives, as in 6.1).
3. WebGPU→WebGL2→CPU fallback intact and verified.
4. Export still CPU-deterministic (Epic 1 sweep 455/455).
5. Unit tests for noise + uniforms pass; existing tests green; tsc + build clean.
6. `docs/gpu/SIGNAL-FIDELITY.md` records the routed set, the deferred (6.3 multi-pass) set,
   and the CPU-forever (datamosh/pixel-sort) set, with per-preset mean-err.

## Boundaries (this increment only)

- **In:** per-pixel / frame-deterministic effects + emulated-f64 noise.
- **Deferred to 6.3 (multi-pass / ping-pong):** format-authenticity pre-pass (resolution
  reduction + NTSC/PAL composite encode-decode), chroma subsampling, ghosting/persistence,
  generation loss, copy generation, burn-in, focus breathing, media aging, restoration,
  macroblocking, nitrate decay, technicolor fringe, wide neon bleed.
- **CPU forever:** datamosh (P-frame feedback), pixel-sort (sequential per-row).
- No UI rewrite; export untouched.

## Relationship to other epics

- Reuses Epic 1's fidelity/parity philosophy and the `gpu-coverage` harness; export stays
  CPU-deterministic. Reuses the Epic 6.1 core (backend lifecycle, separable-blur bloom,
  fallback, gate discipline). The emulated-f64 noise is the shared asset every later family
  increment (6.3+) and any native/plugin fork reuse.
