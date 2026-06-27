# Epic 6.3a — Multi-pass Post-process Foundation + High-frequency Effects — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the reusable ping-pong post-process chain (between optics and bloom) and port 6.3a's effects — frameStutter, exposurePump, whiteBalanceDrift, 7 exotic capture masks, ghosting, focusBreathing — at fidelity (< 6 mean-err vs CPU), lifting the routed set ~26 → ~40.

**Architecture:** Two parts. (1) Shader extension (no new architecture): the easy temporal/global modulations + exotic mask branches fold into the existing grade/optics/composite shader. (2) A new conditional ping-pong post-process chain inserted between `optics` (`T_optics`) and `bloom`, producing `T_filtered` (= `T_optics` when no chain filter is active, preserving 6.2); ghosting + focusBreathing are its first passes; bloom takes `T_filtered` as its sharp input.

**Tech Stack:** WebGPU + WGSL, TypeScript, vitest. Reuses the Epic 6.1/6.2 backend (separable Gaussian, cover-fit, fallback) and the `gpu-coverage` sweep.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-27-epic6-3a-multipass-postprocess-design.md`; strategy `docs/GPU-PORT-PLAN.md`; prior `docs/gpu/SIGNAL-FIDELITY.md`.
- **Authoritative CPU math** in `src/lib/crt-renderer-full.js`: frameStutter ~574–576; ghosting ~888–892; focusBreathing ~919–925; exposurePump/whiteBalanceDrift ~1089–1100; exotic masks ~732–779. Port to match; the sweep is the proof.
- **`effects-core/` stays portable** (no React/Electron imports). **Fallback order** WebGPU→WebGL2→CPU; any WebGPU failure falls back silently.
- **Fidelity bar:** a preset routes to WebGPU only at **mean-err < 6** vs CPU AND when `gpuSignalOK` allows it; `gpuSignalOK` must allow EXACTLY the < 6 set (verify `allowedFailing === []`, the 6.1/6.2 check).
- **Determinism:** renderer noise = `seededNoise` only. The stuttered frame is deterministic (integer math). Export forces `preferGPU=false` → CPU; Epic 1 parity sweep stays **455/455**.
- **`u_temporalFrame` (stuttered) ≠ `u_frameIndex` (real):** temporal noise uses `u_temporalFrame`; the gate-offset noise (CPU ~569–572) keeps using `u_frameIndex`. Do not conflate.
- **`tsc` is NOT the build:** run `npx vite build` before claiming a shader/backend task done. WGSL can't run in jsdom — shader/backend/gate are runtime-verified via the sweep + live app.
- **GPU caching gotcha:** a `.wgsl` edit needs `rm -rf node_modules/.vite` + preview restart + a genuinely fresh page before measuring (vite caches `?raw`; the browser caches the shader module across evals). Bit-identical mean-err across "changes" = stale shader.
- **WGSL reserved keywords** (e.g. `active`) are not valid identifiers — name locals defensively.
- Work on `main`; keep the **148 tests** green; `npx tsc --noEmit` + `npx vite build` clean. Commit per task; push after each. No `npm run dist`/R2.
- **Scope:** 6.3a effects ONLY. generationLoss, copyGeneration, macroBlocking, mediaAging, burnIn, restoration, quantization, OSD, NTSC/PAL composite, the long tail → 6.3b+. datamosh/pixel-sort → CPU forever.

---

### Task 1: New uniforms + mask codes + stuttered frame (TDD)

**Files:**
- Modify: `src/lib/effects-core/param-map.ts`
- Test: `src/test/effects-core-param-map.test.ts`

**Interfaces:**
- Produces: `CRT_SIGNAL_UNIFORMS` gains `u_exposurePump, u_whiteBalanceDrift, u_ghosting, u_focusBreathing, u_temporalFrame` (appended). `buildSignalUniforms` packs them and computes `u_temporalFrame` from `advancedFrameStutter` + `ctx.frameIndex` exactly as the CPU (`stutterHoldFrames = floor(s²·6)`, `stuttered = frameIndex − frameIndex mod (stutterHoldFrames+1)`). `MASK_CODES` gains `filmSuper8:9, film16mm:10, instantDyeCloud:11, irBloomSpeckle:12, cmosRollingColumn:13, lowBitrateBlockGrid:14, fisheyeMicrolens:15`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/test/effects-core-param-map.test.ts (inside the buildSignalUniforms describe or a new one)
describe("buildSignalUniforms — 6.3a", () => {
  const ctx = (frameIndex: number) => ({ width: 640, height: 480, seconds: frameIndex / 30, frameIndex, fps: 30 });
  const idx = (k: string) => CRT_SIGNAL_UNIFORMS.indexOf(k);
  it("packs the new 6.3a uniforms", () => {
    const u = buildSignalUniforms({ advancedExposurePump: 0.5, advancedWhiteBalanceDrift: 0.4, advancedGhosting: 0.3, advancedFocusBreathing: 0.2 }, ctx(0));
    expect(u[idx("u_exposurePump")]).toBeCloseTo(0.5, 5);
    expect(u[idx("u_whiteBalanceDrift")]).toBeCloseTo(0.4, 5);
    expect(u[idx("u_ghosting")]).toBeCloseTo(0.3, 5);
    expect(u[idx("u_focusBreathing")]).toBeCloseTo(0.2, 5);
  });
  it("computes the stuttered temporal frame (holds frames)", () => {
    // frameStutter 0.5 → stutterHoldFrames = floor(0.25*6)=1 → period 2 → frame 7 holds to 6
    const u7 = buildSignalUniforms({ advancedFrameStutter: 0.5 }, ctx(7));
    expect(u7[idx("u_temporalFrame")]).toBe(6);
    // no stutter → temporalFrame === frameIndex
    const u7n = buildSignalUniforms({}, ctx(7));
    expect(u7n[idx("u_temporalFrame")]).toBe(7);
  });
  it("maps the exotic mask codes", () => {
    const u = buildSignalUniforms({ maskType: "cmosRollingColumn" }, ctx(0));
    expect(u[idx("u_maskType")]).toBe(13);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/test/effects-core-param-map.test.ts`
Expected: FAIL (new uniforms/codes missing; `u_temporalFrame` index is -1).

- [ ] **Step 3: Implement in `param-map.ts`**

Append to `CRT_SIGNAL_UNIFORMS` (after the grain coef fields): `"u_exposurePump", "u_whiteBalanceDrift", "u_ghosting", "u_focusBreathing", "u_temporalFrame"`. Add the exotic codes to `MASK_CODES`. In `buildSignalUniforms`, add:

```ts
set("u_exposurePump", n(params.advancedExposurePump));
set("u_whiteBalanceDrift", n(params.advancedWhiteBalanceDrift));
set("u_ghosting", n(params.advancedGhosting));
set("u_focusBreathing", n(params.advancedFocusBreathing));
const fs = Math.max(0, Math.min(1, n(params.advancedFrameStutter)));
const hold = Math.floor(fs * fs * 6);
const tFrame = hold > 0 ? ctx.frameIndex - (ctx.frameIndex % (hold + 1)) : ctx.frameIndex;
set("u_temporalFrame", tFrame);
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/test/effects-core-param-map.test.ts` → PASS.

- [ ] **Step 5: Full suite + tsc + commit**

Run: `npx vitest run && npx tsc --noEmit`

```bash
git add src/lib/effects-core/param-map.ts src/test/effects-core-param-map.test.ts
git commit -m "effects-core: 6.3a uniforms (exposurePump/whiteBalanceDrift/ghosting/focusBreathing/temporalFrame) + exotic mask codes (TDD)"
```

---

### Task 2: Shader — frameStutter temporal split, exposurePump, whiteBalanceDrift, 7 exotic masks

**Files:**
- Modify: `src/lib/effects-core/crt-display.wgsl`

> Runtime-verified by the sweep (Task 5). Gate: `tsc` + `vite build` clean + isolated GPU spot-check.

- [ ] **Step 1: Grow the struct**

Add the 5 new fields (`u_exposurePump, u_whiteBalanceDrift, u_ghosting, u_focusBreathing, u_temporalFrame`) to the WGSL `Uniforms` struct in `CRT_SIGNAL_UNIFORMS` order. Update the header comment's mask-code list (9–15).

- [ ] **Step 2: frameStutter temporal split**

In `optics()`, change `let tFrame = U.u_frameIndex; let tSec = U.u_frameIndex / U.u_fps;` to use the stuttered frame for temporal terms: `let tFrame = U.u_temporalFrame; let tSec = U.u_temporalFrame / U.u_fps;`. Keep the gate-offset block using the REAL frame: those `seededNoise(...)` calls (judderHit/gateOffX/gateOffY/gateRot) must use `U.u_frameIndex` (define `let realFrame = U.u_frameIndex;` and use it there). Matches CPU: temporal noise uses `temporalFrame`, gate offsets use `frameIndex`.

- [ ] **Step 3: exposurePump + whiteBalanceDrift in `fs_composite`**

After the flicker block, before scanlineProfile, add (CPU ~1089–1098, in 0..1):

```wgsl
// Exposure pump (global brightness pulse) + white-balance drift (global warm screen).
if (U.u_exposurePump > 0.0) {
  let wave = 1.0 + (sin(U.u_temporalFrame / U.u_fps * 1.53) * 0.5 + 0.5) * U.u_exposurePump * 0.28;
  let a = min(0.35, U.u_exposurePump * 0.35);
  col = mix(col, col * wave, a);
}
if (U.u_whiteBalanceDrift > 0.0) {
  let warm = (sin(U.u_temporalFrame / U.u_fps * 0.37 + 2.4) * 0.5 + 0.5) * U.u_whiteBalanceDrift;
  let tint = vec3<f32>(30.0 + warm * 70.0, 18.0 + warm * 28.0, 40.0 + (1.0 - warm) * 80.0) / 255.0;
  let a = min(0.22, 0.05 + U.u_whiteBalanceDrift * 0.2);
  let screened = vec3<f32>(1.0) - (vec3<f32>(1.0) - col) * (vec3<f32>(1.0) - tint);
  col = mix(col, screened, a);
}
```

- [ ] **Step 4: 7 exotic mask branches in `optics()`**

Extend the mask `if`-chain (after plasmaCell, bounding plasma to `mt > 7.5 && mt < 8.5`) with codes 9–15, porting CPU `crt-renderer-full.js` ~732–779 to WGSL: `filmSuper8` (9), `film16mm` (10), `instantDyeCloud` (11), `irBloomSpeckle` (12), `cmosRollingColumn` (13), `lowBitrateBlockGrid` (14), `fisheyeMicrolens` (15). These use `x`/`y` (= `px`/`py`), `width`/`height` (= `W`/`H`), `temporalFrame` (= `tFrame`), `mask`/`maskStrength`, and small-arg `seededNoise` (within range). Set `rMask`/`gMask`/`bMask` per the CPU branch. Defensive local names (avoid reserved words).

- [ ] **Step 5: Verify it compiles + builds + isolated spot-check**

Run: `npx tsc --noEmit && npx vite build` → clean. Then `rm -rf node_modules/.vite`, restart preview, and spot-check (fresh page): frameStutter / exposurePump / whiteBalanceDrift / each exotic mask render < 6 vs CPU (isolated synthetic params, the 6.1/6.2 method). Iterate the WGSL until each is < 6.

- [ ] **Step 6: Commit**

```bash
git add src/lib/effects-core/crt-display.wgsl
git commit -m "effects-core: shader — frameStutter temporal split, exposurePump, whiteBalanceDrift, 7 exotic capture masks"
```

---

### Task 3: Ping-pong post-process chain — ghosting + focusBreathing (architecture)

**Files:**
- Modify: `src/lib/effects-core/crt-display.wgsl`
- Modify: `src/lib/effects-core/webgpu-backend.ts`

> The new architecture. Runtime-verified. Gate: `tsc` + `vite build` clean + isolated spot-check + 6.2 presets unchanged (chain is passthrough when inactive).

- [ ] **Step 1: Shader passes**

Add two fragment entries to `crt-display.wgsl`:
- `fs_ghost`: bindings = U, sampler, `u_tex` (the running chain result), `u_tex_sharp` (= `T_optics`). `ghostShift = round((0.5 + U.u_ghosting * 3.5) * sin(U.u_temporalFrame / U.u_fps * 1.7))`; sample `T_optics` (textureLoad) at `(clamp(px + ghostShift), py)`; output `mix(running, ghostSample, min(0.42, U.u_ghosting * 0.45))` (CPU ~888–892).
- `fs_focusBlend`: the focusBreathing vertical-blur + self-blend. `blurPx = (0.2 + (sin(U.u_temporalFrame/U.u_fps * 1.17 + 1.3) * 0.5 + 0.5) * 1.8) * U.u_focusBreathing`; `mix(self, gaussianBlur(self, blurPx), min(0.55, U.u_focusBreathing * 0.6))` (CPU ~919–925). Reuse the separable Gaussian (a horizontal `fs_blurH`-style pass at sigma=blurPx into a temp, then vertical+blend here), or a single 2D loop bounded by `BLUR_RADIUS` with a runtime sigma. Match the canvas `blur(blurPx)` stdDev = blurPx.

- [ ] **Step 2: Backend ping-pong orchestration**

In `webgpu-backend.ts`: add two intermediate textures `tPpA`/`tPpB` (rgba8unorm, RENDER_ATTACHMENT|TEXTURE_BINDING) + a `ghostPipeline` (layoutComposite: U, samp, tex, tex_sharp) and a `focusBlur` pipeline(s). In `render()`, after the optics pass produces `T_optics`, run the chain: start `src = T_optics`; if `u_ghosting` active, encode ghost pass (`src` + `T_optics` → `tPpA`), `src = tPpA`; if `u_focusBreathing` active, encode focus blur (`src` → `tPpB`, ping-ponging), `src = tPpB`. The chain's final `src` is `T_filtered`. Then the blurH pass blurs `T_filtered` (not `T_optics`) and the composite samples `T_filtered` as sharp. When no chain filter is active, `T_filtered = T_optics` (skip all chain passes) — 6.2 path unchanged. Read `u_ghosting`/`u_focusBreathing` from the `params` (the backend already has them) to decide which passes to encode.

- [ ] **Step 3: Verify compiles + builds + passthrough + isolated**

Run: `npx tsc --noEmit && npx vite build` → clean. Clear vite cache, restart, fresh page: (a) confirm a 6.2 preset (e.g. Consumer CRT TV) is UNCHANGED (chain passthrough, still ~1.0 mean-err); (b) isolated ghosting + focusBreathing render < 6 vs CPU; iterate the WGSL until < 6.

- [ ] **Step 4: Commit**

```bash
git add src/lib/effects-core/crt-display.wgsl src/lib/effects-core/webgpu-backend.ts
git commit -m "effects-core: ping-pong post-process chain (ghosting + focusBreathing); bloom takes T_filtered"
```

---

### Task 4: Gate — `gpuSignalOK` allows the 6.3a effects + exotic masks

**Files:**
- Modify: `src/lib/crt-renderer-hybrid.js`

- [ ] **Step 1: Extend the gate**

Add the 7 exotic masks to `WEBGPU_SUPPORTED_MASKS` (`filmSuper8, film16mm, instantDyeCloud, irBloomSpeckle, cmosRollingColumn, lowBitrateBlockGrid, fisheyeMicrolens`). Add `advancedExposurePump, advancedWhiteBalanceDrift, advancedFrameStutter, advancedGhosting, advancedFocusBreathing` to `WEBGPU_SIGNAL_SUPPORTED`. Everything else stays gated by the catch-all (generationLoss/macroBlocking/quantization/OSD/format/long-tail/datamosh).

- [ ] **Step 2: Verify fallback (no regression)**

Run: `npx vitest run && npx tsc --noEmit && npx vite build` → all green (backend null in jsdom; existing tests unaffected).

- [ ] **Step 3: Commit**

```bash
git add src/lib/crt-renderer-hybrid.js
git commit -m "hybrid: gpuSignalOK allows the 6.3a effects + 7 exotic capture masks"
```

---

### Task 5: Full-catalogue sweep + live verification + record

**Files:**
- Modify (if iterating): `src/lib/effects-core/crt-display.wgsl`
- Update: `docs/gpu/SIGNAL-FIDELITY.md`

> Controller-run against the live app (preview `build-together`:5176).

- [ ] **Step 1: Run the full sweep**

Reuse `window.__signalSweep` (tools/gpu-coverage.snippet.js). Warm modules; clear vite cache + restart first. Compute the allowed set (gpuSignalOK over DISPLAY_PRESETS + the 91 classics) and the per-preset mean-err. For any allowed preset ≥ 6, isolate the offending effect (single-effect synthetic params) and fix the WGSL until < 6.

- [ ] **Step 2: Verify the gate is sound + routed count**

`allowedFailing` MUST be `[]` (the 6.1/6.2 cross-check). Routed set should be ~40. If a supported effect can't reach < 6, move its param out of the supported set (→ CPU) and record why.

- [ ] **Step 3: Live verification via the production hybrid**

Drive `new CRTRendererHybrid(true)`, render a newly-routed preset (one using ghosting/focusBreathing/an exotic mask) at 1280×720: confirm `activeMode === "webgpu"` + the stall is gone vs the forced-CPU timing. Confirm WebGPU→WebGL2→CPU fallback, a still-gated look (e.g. quantization or datamosh) → CPU, and export (`preferGPU` off) bit-identical.

- [ ] **Step 4: Final checks + record + commit**

Run: `npx vitest run && npx tsc --noEmit && npx vite build` → green. Spot-check Epic 1 parity stays 455/455 (export untouched). Update `docs/gpu/SIGNAL-FIDELITY.md` with the new routed set, the 6.3a effects covered, and the live-verification table.

```bash
git add docs/gpu/SIGNAL-FIDELITY.md src/lib/effects-core/crt-display.wgsl src/lib/crt-renderer-hybrid.js
git commit -m "gpu: Epic 6.3a — multi-pass chain + high-frequency effects verified < 6, routed ~40, gate sound"
```

---

## Self-Review

**Spec coverage:** new uniforms + mask codes + stutter → Task 1. frameStutter temporal split + exposurePump + whiteBalanceDrift + 7 exotic masks → Task 2. ping-pong chain + ghosting + focusBreathing → Task 3. gate → Task 4. sweep + allowedFailing [] + live verify + record → Task 5. Determinism/export-CPU/parity → Global Constraints + Task 5. Boundaries (6.3b+ deferrals, datamosh CPU) → Global Constraints.

**Placeholder scan:** Task 1 carries full code + tests (TDD). Tasks 2–3 (WGSL + backend) are requirement-driven with exact CPU source line refs + the < 6 acceptance gate — the runtime-verified-shader treatment blessed in 6.1/6.2. Tasks 4–5 are operational with exact commands + the < 6 / `allowedFailing: []` gate.

**Type consistency:** `CRT_SIGNAL_UNIFORMS` order is the shared contract across `buildSignalUniforms` (Task 1), the WGSL struct (Task 2), and the backend write (existing). `u_temporalFrame` (stuttered) vs `u_frameIndex` (real) used consistently (Task 1 computes, Task 2 splits). Mask codes 9–15 consistent between `param-map` (Task 1) and the shader branches (Task 2) and the gate masks (Task 4). `T_filtered` (Task 3) replaces `T_optics` as bloom's sharp input.
