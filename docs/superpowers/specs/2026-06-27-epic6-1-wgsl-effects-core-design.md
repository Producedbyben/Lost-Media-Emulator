# Epic 6.1 — Portable WGSL Effects-Core + CRT/Display Family on WebGPU — Design

> First increment of Epic 6 (the GPU engine leap), v2 roadmap Track E. Epic 6 is a 1–2 month
> family-by-family arc; this spec covers ONLY increment 1, which stands up the portable shader core and
> proves it on the closest family. Strategy context: `docs/GPU-PORT-PLAN.md`.

## Goal

Stand up a portable, fidelity-gated **WGSL shader core driven via WebGPU**, and take the **CRT/display
family** (~16 presets) from the 525ms CPU path to real-time GPU at full fidelity — establishing the
core, the determinism approach, and the gated workflow that every later Epic 6 increment reuses.

## Why this foundation (decision, owner-delegated 2026-06-27)

Chosen to maximise quality, future-proofing, and migration: **WGSL** is the write-once asset that ports
to native Metal/Vulkan/DX12 and to AE/OFX plugins later; **WebGPU** drives it from the current
Electron/React app with **no UI rewrite** (ships the perf win now); the **fidelity gate** guarantees the
looks don't drift. Verified feasible: the runtime has `navigator.gpu` + an adapter + compute; WebGL2
remains as fallback.

## Current state (measured)

The existing WebGL2 shader (`src/lib/crt-renderer-gpu.js`) implements basic CRT uniforms but only
**1/91** presets pass the fidelity sweep (`tools/gpu-coverage.snippet.js`); the `_gpuCanHandle` gate in
`crt-renderer-hybrid.js` routes ~everything to CPU. Increment 1 replaces that for ONE family.

## Architecture

### `src/lib/effects-core/` — the portable unit (no React/Electron imports)
- `noise.wgsl` — an **exact WGSL port of the CPU `seededNoise(x, y, frame)` hash** from
  `crt-renderer-full.js`. This bit-for-bit parity is what lets the GPU output match the CPU under the
  fidelity bar for noise-driven effects.
- `crt-display.wgsl` — the CRT/display fragment shader: scanlines, mask types (dot/aperture/slot/shadow
  via a `u_maskType` switch), barrel + vignette, bloom, chroma aberration, the colour grade, phosphor
  tint. Pure function of `(uv, frameIndex, uniforms, seededNoise)`.
- `param-map.ts` — maps a `CRTParams` object → a typed uniform buffer (Float32Array + layout). Pure,
  unit-testable; the single source of truth for param→uniform wiring.
- `webgpu-backend.ts` — owns the `GPUDevice`/pipeline/bind-group/render-to-canvas lifecycle; exposes
  `class WebGPUBackend { static async create(): Promise<WebGPUBackend|null>; render(ctx2dOrCanvas, w, h, seconds, params, frameIndex, fps): void; dispose(): void }`. Returns `null` when WebGPU is unavailable so callers fall back.

### `crt-renderer-hybrid.js` — backend selection + fallback
Add WebGPU as the **preferred** backend: `WebGPU → WebGL2 → CPU`. A family routes to WebGPU only when it
has passed the fidelity gate (a `gpuFamilyOK(presetName|familyKey)` check, seeded from the sweep
results); otherwise it falls back exactly as today. WebGPU init failure or shader-compile failure →
silent fallback (never a blank/broken frame). `activeMode` reports `"webgpu" | "webgl2" | "cpu"` for the
existing validator/telemetry.

### Fidelity gate
Extend `tools/gpu-coverage.snippet.js` to diff the **WebGPU** output against the authoritative CPU
render per preset×frame, reporting mean-err. The CRT/display family flips to GPU only when each of its
presets lands **mean-err < 6** (the perceptual bar; Epic 1's GPU parity tolerance was 12, so < 6 is
comfortably within preview↔export parity).

## Determinism & parity

- GPU is **perceptual-parity** to CPU (mean-err < 6), not byte-identical — GPU float math differs
  slightly. This is consistent with Epic 1 (export stays the authoritative CPU path; GPU is preview).
- The WGSL `seededNoise` MUST reproduce the CPU hash; it is cross-checked in a unit test against a JS
  reference of the same hash so the two can never silently diverge.
- Export is unaffected: exports continue to run the deterministic CPU path. Epic 6 accelerates
  **preview**; the parity sweep (Epic 1) still governs export.

## Components & files

- Create: `src/lib/effects-core/{noise.wgsl, crt-display.wgsl, param-map.ts, webgpu-backend.ts}`
- Create: `src/lib/effects-core/seeded-noise-ref.ts` (JS reference of the CPU hash, for the parity test)
- Modify: `src/lib/crt-renderer-hybrid.js` (WebGPU backend selection + fallback + `activeMode`)
- Modify: `tools/gpu-coverage.snippet.js` (WebGPU vs CPU diff)
- Test: `src/test/effects-core-param-map.test.ts`, `src/test/effects-core-noise.test.ts`

## Error handling & edge cases

- **No WebGPU** (`navigator.gpu` absent / no adapter): `WebGPUBackend.create()` returns null → hybrid
  uses WebGL2/CPU. No user-visible change beyond perf.
- **Shader compile / device-lost**: catch, dispose, mark WebGPU unavailable for the session, fall back.
- **Family not yet GPU-fidelity**: routes to CPU/WebGL2 (only CRT/display flips this increment).
- **Resize / DPR**: backend reconfigures the swapchain on canvas size change.
- **Context loss**: device-lost handler tears down + falls back without crashing playback.

## Testing

- `param-map.ts` — unit tests: a known `CRTParams` maps to the expected uniform layout/values.
- WGSL `seededNoise` parity — unit test compares the JS reference hash against expected values at sample
  `(x,y,frame)`; the WGSL is authored from the same constants (a comment links them), and the fidelity
  sweep is the runtime proof they match in practice.
- Fidelity sweep (controller-run, like the audit/parity sweeps) is the integration gate: CRT/display
  mean-err < 6 before the family is flipped to GPU.
- Existing 135 tests stay green; `tsc` clean; `vite build` clean. CPU/WebGL2 fallback verified so
  non-WebGPU runtimes are unaffected.

## Done criteria (Increment 1)

1. `effects-core` exists as a framework-free WGSL+driver unit with the CRT/display shader + noise port.
2. The CRT/display family renders via WebGPU at **mean-err < 6** vs CPU on the fidelity sweep, and is
   routed to GPU (no 525ms stall for those presets) in the live app.
3. WebGPU → WebGL2 → CPU fallback is intact and verified (the app works with WebGPU disabled).
4. Export still uses the deterministic CPU path (Epic 1 parity sweep unaffected).
5. Unit tests for param-map + noise parity pass; 135 existing tests green; tsc + build clean.

## Boundaries (this increment only)

- **Only the CRT/display family** is ported + flipped. Tape/film/digital/etc. = later Epic 6 increments,
  each its own spec→plan reusing this core + gate.
- **Inter-frame effects** (datamosh P-frame feedback, pixel-sort) stay on CPU permanently (per
  GPU-PORT-PLAN); they are never flipped to the per-pixel GPU path.
- No UI rewrite; no native/plugin shell (those are v3 forks the core is designed to enable later).

## Relationship to other epics

- Reuses Epic 1's fidelity/parity philosophy and the `gpu-coverage` harness; export remains CPU-deterministic.
- The portable `effects-core` is the asset the GPU-PORT-PLAN's native (Metal/Rust) and plugin (AE/OFX)
  forks would later reuse.
