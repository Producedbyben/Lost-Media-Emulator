# Epic 6.3b — Screen-space Filter Chain + Quantization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline; GPU-runtime-verified). Steps use `- [ ]`.

**Goal:** Port the 6.3b effects (burnIn, generationLoss, copyGeneration, mediaAging, restoration, macroBlocking, quantization) to the 6.3a ping-pong chain at < 6 vs CPU, gating to CPU any effect whose browser-specific canvas resampling/filter can't be matched.

**Architecture:** Extend the 6.3a chain with conditional screen-space filter passes (CPU order: burnIn → focusBreathing(done) → generationLoss → copyGen → mediaAging → restoration), then add resolution-reduction passes (macroBlocking, quantization) via a low-res render target. Passthrough when all 6.3b effects off (6.2/6.3a unchanged).

**Tech Stack:** WebGPU + WGSL, TypeScript, vitest. Reuses the 6.1/6.2/6.3a backend + separable Gaussian + sweep.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-27-epic6-3b-screenspace-quantization-design.md`. CPU math: `src/lib/crt-renderer-full.js` — burnIn ~901–917, generationLoss ~927–937, copyGen ~942–957, mediaAging ~960–1007, restoration ~1010–1025, macroBlocking ~1115–1130, quantization ~1133–1180.
- **Fidelity bar < 6** vs CPU AND `gpuSignalOK` allows it; `allowedFailing` must stay `[]`. An effect that can't clear < 6 is left OUT of the supported set (stays CPU), recorded in `docs/gpu/SIGNAL-FIDELITY.md`.
- **Determinism:** renderer noise = `seededNoise` / the CPU's deterministic mulberry RNG (mediaAging speckle). Export forces `preferGPU=false` → CPU; Epic 1 parity stays 455/455.
- **GPU caching gotcha:** `.wgsl` edit → `rm -rf node_modules/.vite` + preview restart + fresh page before measuring. `tsc` is NOT the build — run `npx vite build`.
- Work on `main`; keep the **151 tests** green; tsc + build clean. Commit per task; push after each. No `npm run dist`/R2.
- **Scope:** 6.3b effects only. OSD, NTSC/PAL composite, chroma subsampling, long tail → 6.3c+. datamosh/pixel-sort → CPU forever.

---

### Task 1: Uniforms (TDD)

**Files:** Modify `src/lib/effects-core/param-map.ts`; Test `src/test/effects-core-param-map.test.ts`.

**Interfaces:** `CRT_SIGNAL_UNIFORMS` gains `u_burnIn, u_generationLoss, u_copyGen, u_mediaAge, u_storageCond, u_restoration, u_macroBlocking, u_quantization`. `buildSignalUniforms` packs them; `u_mediaAge` = `mediaAgeYears` × the storage-severity factor (CPU ~535: ideal .45/dry .55/humid .95/hot 1.1/moldRisk 1.45) folded into a normalised value, OR pass `u_mediaAge` raw + `u_storageCond` code and combine in-shader (match CPU `ageNorm = mediaAgeYears/100 * storageSeverity`). `copyGenerationCount` is an integer count.

- [ ] **Step 1: Failing tests** — append a `buildSignalUniforms — 6.3b` describe:

```ts
describe("buildSignalUniforms — 6.3b", () => {
  const ctx = { width: 640, height: 480, seconds: 0, frameIndex: 0, fps: 30 };
  const idx = (k: string) => CRT_SIGNAL_UNIFORMS.indexOf(k);
  it("packs the 6.3b uniforms", () => {
    const u = buildSignalUniforms({ advancedGenerationLoss: 0.5, advancedQuantization: 0.4, advancedMacroBlocking: 0.3, restorationPassLevel: 0.2, burnInGhost: 0.1, copyGenerationCount: 3 }, ctx);
    expect(u[idx("u_generationLoss")]).toBeCloseTo(0.5, 5);
    expect(u[idx("u_quantization")]).toBeCloseTo(0.4, 5);
    expect(u[idx("u_macroBlocking")]).toBeCloseTo(0.3, 5);
    expect(u[idx("u_restoration")]).toBeCloseTo(0.2, 5);
    expect(u[idx("u_burnIn")]).toBeCloseTo(0.1, 5);
    expect(u[idx("u_copyGen")]).toBe(3);
  });
  it("folds storage severity into mediaAge (ageNorm)", () => {
    // mediaAgeYears 50, storage humid (0.95) → ageNorm = 0.5*0.95 = 0.475
    const u = buildSignalUniforms({ mediaAgeYears: 50, storageCondition: "humid" }, ctx);
    expect(u[idx("u_mediaAge")]).toBeCloseTo(0.475, 4);
  });
});
```

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement (append the fields to `CRT_SIGNAL_UNIFORMS`; in `buildSignalUniforms` set them; `u_mediaAge` = `clamp(mediaAgeYears,0,100)/100 * severity[storageCondition]`). **Step 4:** Run → PASS. **Step 5:** `npx vitest run && npx tsc --noEmit`; commit `effects-core: 6.3b uniforms (burnIn/genLoss/copyGen/mediaAge/restoration/macroBlocking/quantization) (TDD)`.

---

### Task 2: Screen-space blur/blend filters — burnIn, generationLoss, copyGen, restoration

**Files:** Modify `src/lib/effects-core/crt-display.wgsl`, `src/lib/effects-core/webgpu-backend.ts`.

> Extend the ping-pong chain. Each is a fragment pass reading the running result (burnIn also reads T_optics), applying the CPU blur/saturate/contrast/brightness + blend, passthrough when off. Runtime-verified.

- [ ] **Step 1:** Add fragment passes `fs_burnIn`, `fs_genLoss`, `fs_copyGen`, `fs_restore` to the shader, porting the CPU math (refs above). Blur reuses a Gaussian (sample the running texture); saturate/contrast/brightness are pointwise; blend modes (screen/multiply/lighter/overlay) are pointwise. Loops (genLoss/copyGen dub passes) → unroll a fixed ≤6 sequence inside the pass (accumulate), or as repeated passes. Helper `fn applyFilter(c, sat, con, bri)` for the canvas-filter math: `brightness` ×, `contrast` (c-0.5)*con+0.5, `saturate` mix(luma,c,sat).
- [ ] **Step 2:** Backend: add the passes to the chain after focus (ping-pong `tPpA`/`tPpB`, alternating), conditionally encoded. The chain's final texture stays `tPpB` semantics (T_filtered → bloom).
- [ ] **Step 3:** `npx tsc --noEmit && npx vite build`; clear cache, restart, fresh page; isolated GPU spot-check each effect vs CPU. For any ≥ 6, iterate; if a canvas-filter mismatch is unfixable, note it for Task 5's gate (leave that param OUT of supported). Confirm a 6.2 preset is unchanged (passthrough).
- [ ] **Step 4:** Commit `effects-core: screen-space chain filters (burnIn, generationLoss, copyGen, restoration)`.

---

### Task 3: mediaAging (+ deterministic speckle)

**Files:** Modify `src/lib/effects-core/crt-display.wgsl`.

> CPU ~960–1007: yellow multiply tint + desaturate/contrast/brightness self-blur + lifted-black screen fill + speckle dust (deterministic mulberry RNG seeded on frameIndex).

- [ ] **Step 1:** Add `fs_mediaAge` (or fold into the chain): port the yellow multiply (`rgb(245, 235-ageNorm*40, max(150,205-ageNorm*70))`), the desat/contrast/brightness blur blend, the lifted-black screen fill. The speckle dust (CPU draws `floor(ageNorm*140)` dots via a mulberry RNG seeded `frameIndex*2654435761`) — reproduce the SAME RNG sequence deterministically in-shader (or skip dust if it can't match cheaply and gate mediaAging if the sweep then fails).
- [ ] **Step 2:** tsc + build; isolated spot-check mediaAging at a few ages/storage. Iterate or gate.
- [ ] **Step 3:** Commit `effects-core: mediaAging (yellow fade + lifted blacks + speckle)`.

---

### Task 4: Resolution reduction — macroBlocking + quantization

**Files:** Modify `src/lib/effects-core/crt-display.wgsl`, `src/lib/effects-core/webgpu-backend.ts`.

> CPU macroBlocking ~1115–1130 (box-downscale → nearest-upscale composite); quantization ~1133–1180 (resolution downscale + level quant + upscale + 8×8 DCT block grid + mosquito ringing when > 0.18). Resolution reduction needs a low-res render target.

- [ ] **Step 1:** Backend: add a low-res texture (sized per-frame to `width/blockSize`); render the running result into it with linear filtering (box-average ≈ canvas downscale), then an upscale pass samples it. macroBlocking: nearest-upscale composite at alpha. quantization: level-quantize per channel + the 8×8 DCT grid (pointwise pattern) + mosquito ringing (neighbour taps) in the upscale pass.
- [ ] **Step 2:** Shader: `fs_lowres` (downscale sampling) + extend the composite/a new pass for the quant level + DCT grid + ringing.
- [ ] **Step 3:** tsc + build; isolated spot-check macroBlocking + quantization (at a few amplitudes, incl. > 0.18 for the DCT grid). The canvas downscale filtering may not match exactly — iterate; if < 6 is unreachable, gate that effect to CPU and record.
- [ ] **Step 4:** Commit `effects-core: macroBlocking + quantization (resolution reduction + DCT block grid)`.

---

### Task 5: Gate + full-catalogue sweep + record

**Files:** Modify `src/lib/crt-renderer-hybrid.js`; Update `docs/gpu/SIGNAL-FIDELITY.md`.

- [ ] **Step 1:** Extend `gpuSignalOK` `WEBGPU_SIGNAL_SUPPORTED` with ONLY the 6.3b effects that cleared < 6 in isolation (Tasks 2–4). Effects that couldn't match stay out (CPU).
- [ ] **Step 2:** Run the full-catalogue sweep (`window.__signalSweep` pattern). `allowedFailing` MUST be `[]`. If an allowed preset fails, find the offending effect (isolate, the 6.3a method) and either fix the WGSL or remove that effect from supported. Record the new routed count.
- [ ] **Step 3:** Live verification (production hybrid): a newly-routed preset → `activeMode "webgpu"` + no stall; fallback + a still-gated look → CPU; export bit-identical.
- [ ] **Step 4:** `npx vitest run && npx tsc --noEmit && npx vite build` green; parity 455/455 spot-check. Update `SIGNAL-FIDELITY.md` (routed count, 6.3b effects covered + gated). Commit `gpu: Epic 6.3b — screen-space chain + quantization verified < 6, gate sound`.

---

## Self-Review

**Spec coverage:** uniforms → Task 1. burnIn/genLoss/copyGen/restoration → Task 2. mediaAging → Task 3. macroBlocking/quantization → Task 4. gate + sweep + record → Task 5. Determinism/export/parity → Global Constraints + Task 5. Boundaries (6.3c+ deferrals) → Global Constraints.

**Placeholder scan:** Task 1 carries full code + tests. Tasks 2–4 (WGSL + backend) are requirement-driven with exact CPU line refs + the < 6 gate + an explicit gate-to-CPU fallback for canvas-resampling mismatches — the runtime-verified-shader treatment from 6.1/6.2/6.3a. Task 5 operational.

**Type consistency:** `CRT_SIGNAL_UNIFORMS` order shared across `buildSignalUniforms` (Task 1), the WGSL struct (Tasks 2–4), the backend write. New chain passes append to the 6.3a ping-pong flow; T_filtered (tPpB) → bloom unchanged.
