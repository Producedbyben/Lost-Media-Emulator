# Epic 6.2 — Per-pixel Signal Core on WebGPU — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the ~80% per-pixel/frame-deterministic effect slice (the `renderGrade` colour stage + the fused-loop signal artifacts) to the WGSL/WebGPU effects-core, solving GPU↔CPU noise parity, so capture+display preset combinations flip to GPU at mean-err < 6 vs CPU.

**Architecture:** Extends the Epic 6.1 effects-core. Adds a grade pre-pass (`fs_grade` → `T_graded`) ahead of the existing optics→blurH→composite passes; extends `fs_optics` with per-pixel artifacts and `fs_composite` with pointwise post-passes; replaces the naive f32 `seededNoise` with an emulated-f64 (double-f32) version so the GPU noise field matches the CPU f64 hash. Acceptance is the full 91-preset catalogue fidelity sweep; the hybrid's `gpuSignalOK` gate routes only presets that pass.

**Tech Stack:** WebGPU + WGSL, TypeScript, vitest. Reuses `tools/gpu-coverage.snippet.js`, the hybrid renderer, and the Epic 6.1 backend.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-27-epic6-2-signal-core-design.md`; strategy: `docs/GPU-PORT-PLAN.md`; prior increment: `docs/gpu/CRT-DISPLAY-FIDELITY.md`.
- **Authoritative CPU math** lives in `src/lib/crt-renderer-full.js`: `renderGrade()` (~1641–1866, grade stage) and `render()` (~485–1075, the fused per-pixel loop + pointwise post-passes). Port to match it; the fidelity sweep is the proof.
- **`effects-core/` stays portable** — no React/Electron imports.
- **Fallback order unchanged:** WebGPU → WebGL2 → CPU. Any WebGPU failure falls back silently; never a blank/broken frame.
- **Fidelity bar:** a preset routes to WebGPU only when its mean-err is **< 6** vs the CPU render on the full 91-preset sweep, AND `gpuSignalOK` allows it. `gpuSignalOK` must allow EXACTLY the < 6 set (zero false positives — verify with the same `allowedFailing: []` check as 6.1).
- **Determinism:** renderer noise is `seededNoise` only (never `Math.random`/`Date.now`/`performance.now`). Export stays the deterministic CPU path — the export call sites set `preferGPU = false`, and the WebGPU branch is `preferGPU`-gated, so export is bypassed. The Epic 1 parity sweep (`tools/parity/parity-sweep.snippet.js`) must stay **455/455** — spot-check it.
- **Scope:** per-pixel / frame-deterministic effects only. Multi-pass effects (format composite pre-pass, ghosting/persistence, generation loss, copy generation, burn-in, focus breathing, media aging, restoration, macroblocking, nitrate decay, technicolor fringe, neon wide-bleed) are DEFERRED to Epic 6.3 → `gpuSignalOK` routes them to CPU. Inter-frame effects (datamosh, pixel-sort) stay CPU forever.
- **`tsc` is NOT the build:** always run `npx vite build` (swc) before claiming a shader/UI/integration task done. WGSL/WebGPU cannot run in jsdom — shader/backend/gate are runtime-verified via the sweep + live app (preview server name `build-together`, port 5176).
- **Fidelity sweep overflows a single 30s `preview_eval`** — warm modules with a tiny import first, set up shared state on `window`, process presets in chunks (~10/eval), and read the WebGPU canvas back only after `await backend.flush()` + a re-`drawImage` (race-free).
- Work on `main`; keep the **141 tests** green; `npx tsc --noEmit` + `npx vite build` clean. Commit per task; push after each. No `npm run dist` / R2.

---

### Task 1: Emulated-f64 `seededNoise` — TS reference (f32-simulated) + WGSL port (TDD)

**Files:**
- Create: `src/lib/effects-core/seeded-noise-f32.ts`
- Modify: `src/lib/effects-core/noise.wgsl`
- Test: `src/test/effects-core-noise.test.ts` (extend)

**Interfaces:**
- Consumes: `seededNoiseRef(x,y,frame)` from `seeded-noise-ref.ts` (the f64 authority twin).
- Produces:
  - `seededNoiseF32(x: number, y: number, frame: number): number` — the emulated-f64 hash computed with `Math.fround`-simulated f32 arithmetic (double-f32 argument + mod-2π reduction + f32 sin), matching `seededNoiseRef` to < 0.02 even at large coords.
  - `noise.wgsl` exports the SAME algorithm as `fn seededNoise(x: f32, y: f32, frame: f32) -> f32` (runtime-verified in Task 7's noise-field check).

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/test/effects-core-noise.test.ts
import { seededNoiseF32 } from "@/lib/effects-core/seeded-noise-f32";

// Naive single-precision hash — the BROKEN baseline, to prove emulation is needed.
const fr = Math.fround;
function naiveF32(x: number, y: number, frame: number) {
  const arg = fr(fr(fr(x * 12.9898) + fr(y * 78.233)) + fr(frame * 19.17));
  const s = fr(Math.sin(arg) * 43758.5453);
  return s - Math.floor(s);
}

describe("seededNoiseF32 (emulated-f64 in f32)", () => {
  const samples: [number, number, number][] = [
    [0, 0, 0], [1, 2, 3], [123.5, 7, 29], [480, 360, 1], [639, 479, 29], [320.7, 240.2, 13],
  ];
  it("matches the f64 reference within 0.02 across samples incl. large coords", () => {
    for (const [x, y, f] of samples) {
      expect(Math.abs(seededNoiseF32(x, y, f) - seededNoiseRef(x, y, f))).toBeLessThan(0.02);
    }
  });
  it("naive f32 diverges at large coords (proving emulation is necessary)", () => {
    // At least one large-coord sample is wildly off for the naive hash.
    const worst = Math.max(
      ...[[480, 360, 1], [639, 479, 29]].map(([x, y, f]) =>
        Math.abs(naiveF32(x, y, f) - seededNoiseRef(x, y, f))),
    );
    expect(worst).toBeGreaterThan(0.1);
  });
  it("returns a value in [0,1)", () => {
    const v = seededNoiseF32(639, 479, 29);
    expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/test/effects-core-noise.test.ts`
Expected: FAIL (`seededNoiseF32` missing).

- [ ] **Step 3: Implement `seeded-noise-f32.ts`**

```ts
// src/lib/effects-core/seeded-noise-f32.ts
// Emulated-f64 twin of the CPU seededNoise, computed entirely in Math.fround-simulated
// f32 so it faithfully predicts what the WGSL f32 shader produces. Naive f32 fails because
// the argument (up to ~8000) loses its low bits before sin(); we carry the argument as a
// double-f32 pair (hi+lo) through a Dekker-split product and a two-sum accumulation, then
// reduce mod 2π in extended precision so the final f32 sin is of a small, accurate angle.
const f = Math.fround;
const TWO_PI = f(2 * Math.PI);
const TWO_PI_LO = f(2 * Math.PI - TWO_PI); // ~0; keeps the reduction honest

// Dekker split product: a*b as (hi, lo) f32 pair.
function twoProd(a: number, b: number): [number, number] {
  const p = f(a * b);
  const SPLIT = 4097; // 2^12 + 1 (f32 mantissa = 24 bits → split at 12)
  const ca = f(SPLIT * a), cb = f(SPLIT * b);
  const ah = f(ca - f(ca - a)), al = f(a - ah);
  const bh = f(cb - f(cb - b)), bl = f(b - bh);
  const err = f(f(f(f(ah * bh - p) + f(ah * bl)) + f(al * bh)) + f(al * bl));
  return [p, err];
}
// Error-free sum of two f32s as (hi, lo).
function twoSum(a: number, b: number): [number, number] {
  const s = f(a + b);
  const bb = f(s - a);
  const err = f(f(a - f(s - bb)) + f(b - bb));
  return [s, err];
}
// (hi,lo) + (hi,lo) → renormalised (hi,lo).
function addDD(ah: number, al: number, bh: number, bl: number): [number, number] {
  let [sh, sl] = twoSum(ah, bh);
  sl = f(sl + f(al + bl));
  const [h, l] = twoSum(sh, sl);
  return [h, l];
}

export function seededNoiseF32(x: number, y: number, frame: number): number {
  // arg = x*12.9898 + y*78.233 + frame*19.17, as a double-f32 pair.
  const [xh, xl] = twoProd(f(x), f(12.9898));
  const [yh, yl] = twoProd(f(y), f(78.233));
  const [fh, fl] = twoProd(f(frame), f(19.17));
  let [h, l] = addDD(xh, xl, yh, yl);
  [h, l] = addDD(h, l, fh, fl);
  // Range-reduce mod 2π in extended precision: arg - round(arg/2π)*2π.
  const k = Math.round(f(h / TWO_PI));
  const [kh, kl] = twoProd(k, TWO_PI);
  // subtract k*2π (and the tiny TWO_PI_LO correction) from (h,l)
  [h, l] = addDD(h, l, f(-kh), f(-kl));
  [h, l] = addDD(h, l, f(-(k * TWO_PI_LO)), 0);
  const reduced = f(h + l); // small angle, ~[-π, π]
  const s = f(Math.sin(reduced) * 43758.5453);
  return s - Math.floor(s);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/test/effects-core-noise.test.ts` → PASS (all three).

> If the < 0.02 assertion fails for a sample, the reduction lost precision — verify `addDD` renormalises and that `twoProd` uses the 4097 split. Do NOT loosen the threshold below 0.05 without recording why; the whole increment depends on this matching.

- [ ] **Step 5: Port the SAME algorithm into `noise.wgsl`**

Replace the naive `seededNoise` in `src/lib/effects-core/noise.wgsl` with the emulated-f64 version: WGSL `fn twoProd`, `fn twoSum`, `fn addDD` (returning `vec2<f32>` hi/lo) and `fn seededNoise(x,y,frame) -> f32` transcribing `seeded-noise-f32.ts` line-for-line (WGSL `f32` ops are already single-precision, so no `fround` wrapper is needed — the arithmetic order is what matters; keep it identical). Keep the comment cross-link to `seeded-noise-f32.ts` + `seeded-noise-ref.ts`. (Runtime-verified in Task 7.)

- [ ] **Step 6: Full suite + tsc + commit**

Run: `npx vitest run && npx tsc --noEmit`

```bash
git add src/lib/effects-core/seeded-noise-f32.ts src/lib/effects-core/noise.wgsl src/test/effects-core-noise.test.ts
git commit -m "effects-core: emulated-f64 seededNoise (double-f32 arg + mod-2π reduction) for GPU noise parity (TDD)"
```

---

### Task 2: `CRT_SIGNAL_UNIFORMS` + `buildSignalUniforms` (TDD)

**Files:**
- Modify: `src/lib/effects-core/param-map.ts`
- Test: `src/test/effects-core-param-map.test.ts` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `CRT_SIGNAL_UNIFORMS: readonly string[]` — the superset uniform field order (the 6.1 `CRT_DISPLAY_UNIFORMS` fields FIRST, in their existing order and indices, then the new capture/grade fields appended; this keeps the 6.1 display fields stable). The single source of truth shared with the shader struct + backend write.
  - `buildSignalUniforms(params, ctx): Float32Array` — packs all signal params (display + grade + per-pixel artifacts) in `CRT_SIGNAL_UNIFORMS` order; maps categorical strings (`maskType`, `monochromeTint`, `scanlineProfile`, `subpixelLayoutOverride`) to numeric codes.
- `CRT_DISPLAY_UNIFORMS` and `buildUniforms` stay exported (unchanged) so nothing else breaks.

**Field list** (append AFTER the existing 21 `CRT_DISPLAY_UNIFORMS` fields, preserving their order/indices):
`u_pixelSize, u_lineJitter, u_timeWobble, u_headSwitching, u_chromaDelay, u_crossColor, u_dropouts, u_interlacing, u_tapeCrease, u_gateWeave, u_gateJitterX, u_gateJitterY, u_gateRotation, u_shutterJudder, u_filmGrain, u_grainSize, u_grainChromaticity, u_filmDust, u_filmScratches, u_filmHalation, u_noise, u_quantization, u_irFalseColor, u_printFadeC, u_printFadeM, u_printFadeY, u_blackCrush, u_highlightRolloff, u_haze, u_polaroidCrossover, u_monoTintStrength, u_scanlineProfile, u_subpixelLayout, u_cctvMono, u_rfInterference`.

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/test/effects-core-param-map.test.ts
import { CRT_SIGNAL_UNIFORMS, buildSignalUniforms } from "@/lib/effects-core/param-map";

describe("buildSignalUniforms", () => {
  const ctx = { width: 640, height: 480, seconds: 1, frameIndex: 30, fps: 30 };
  const idx = (k: string) => CRT_SIGNAL_UNIFORMS.indexOf(k);
  it("keeps the 6.1 display fields at the front in their original order", () => {
    // u_scan stays index 0; the display block is a stable prefix.
    expect(idx("u_scan")).toBe(0);
    expect(idx("u_resolutionY")).toBe(20);
  });
  it("packs new per-pixel + grade params", () => {
    const u = buildSignalUniforms({ advancedFilmGrain: 0.3, imageGamma: 1.2, haze: 0.4 }, ctx);
    expect(u.length).toBe(CRT_SIGNAL_UNIFORMS.length);
    expect(u[idx("u_filmGrain")]).toBeCloseTo(0.3, 5);
    expect(u[idx("u_gamma")]).toBeCloseTo(1.2, 5);
    expect(u[idx("u_haze")]).toBeCloseTo(0.4, 5);
  });
  it("maps categorical params to numeric codes", () => {
    const u = buildSignalUniforms(
      { maskType: "aperture", monochromeTint: "amber", scanlineProfile: "hard", subpixelLayoutOverride: "RGB" }, ctx);
    expect(u[idx("u_maskType")]).toBe(2);            // none0 dot1 aperture2 slot3 shadow4 phosphor5
    expect(u[idx("u_monoTint")]).toBe(2);            // none0 green1 amber2 blue3 (white4)
    expect(u[idx("u_scanlineProfile")]).toBe(2);     // off0 soft1 hard2 triadAware3
    expect(u[idx("u_subpixelLayout")]).toBe(1);      // none0 RGB1 BGR2 PenTile3
  });
  it("uses neutral defaults (gamma/contrast/sat/brightness/pixelSize/maskScale = 1)", () => {
    const u = buildSignalUniforms({}, ctx);
    for (const k of ["u_gamma", "u_contrast", "u_saturation", "u_brightness", "u_pixelSize", "u_maskScale"]) {
      expect(u[idx(k)]).toBeCloseTo(1, 5);
    }
    expect(u[idx("u_monoTintStrength")]).toBeCloseTo(1, 5); // CPU defaults strength to 1
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/test/effects-core-param-map.test.ts`
Expected: FAIL (`buildSignalUniforms`/`CRT_SIGNAL_UNIFORMS` missing).

- [ ] **Step 3: Implement in `param-map.ts`**

Add `CRT_SIGNAL_UNIFORMS = [...CRT_DISPLAY_UNIFORMS, <the appended field list above>] as const;`. Add the new code maps: `SCANLINE_PROFILE_CODES = { off:0, soft:1, hard:2, triadAware:3 }`, `SUBPIXEL_CODES = { none:0, RGB:1, BGR:2, PenTile:3 }`, and extend `MONO_CODES` with `white:4`. Implement `buildSignalUniforms(params, ctx)` mirroring `buildUniforms` (reuse the same `set`/`n` helpers) for the display block, then set every appended field from its param with the right neutral default (clamp ranges are NOT applied here — the shader clamps; param-map only packs):
`pixelSize` (def 1), `advancedLineJitter`, `advancedTimebaseWobble`, `advancedHeadSwitching`, `advancedChromaDelay`, `advancedCrossColor`, `advancedDropouts`, `advancedInterlacing`, `advancedTapeCrease`, `advancedFilmGateWeave`, `gateJitterX`, `gateJitterY`, `gateRotation`, `shutterJudder`, `advancedFilmGrain`, `grainSize`, `grainChromaticity`, `advancedFilmDust`, `advancedFilmScratches`, `advancedFilmHalation`, `noise`, `advancedQuantization`, `infraredFalseColor`, `printFadeCyan`, `printFadeMagenta`, `printFadeYellow`, `blackLevelCrush`, `highlightRollOff`, `haze`, `polaroidCrossover`, `monochromeTintStrength` (def 1), `scanlineProfile`→code, `subpixelLayoutOverride`→code, `advancedCctvMonochrome`, `advancedRfInterference`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/test/effects-core-param-map.test.ts` → PASS.

- [ ] **Step 5: Full suite + tsc + commit**

Run: `npx vitest run && npx tsc --noEmit`

```bash
git add src/lib/effects-core/param-map.ts src/test/effects-core-param-map.test.ts
git commit -m "effects-core: CRT_SIGNAL_UNIFORMS + buildSignalUniforms (display+grade+per-pixel params, TDD)"
```

---

### Task 3: Grade pre-pass — `fs_grade` shader + backend `T_graded` pipeline

**Files:**
- Modify: `src/lib/effects-core/crt-display.wgsl`
- Modify: `src/lib/effects-core/webgpu-backend.ts`

**Interfaces:**
- Consumes: `CRT_SIGNAL_UNIFORMS`/`buildSignalUniforms` (Task 2), emulated `seededNoise` (Task 1).
- Produces: a 4-pass pipeline where `fs_optics` samples a graded source texture.

> Shader + backend are runtime-verified by the sweep (Task 7), not jsdom. This task's gate is `tsc` + `vite build` clean AND the 6.1 display sweep still passing (grade is identity for display presets).

- [ ] **Step 1: Grow the `Uniforms` struct**

In `crt-display.wgsl`, expand `struct Uniforms` to list ALL `CRT_SIGNAL_UNIFORMS` fields in order (the 21 existing + the appended fields from Task 2), so the Float32Array maps field-for-field. Update the header comment: this shader now covers the full per-pixel signal core; document the new code enums (scanlineProfile off0/soft1/hard2/triadAware3, subpixel none0/RGB1/BGR2/PenTile3, monoTint adds white4).

- [ ] **Step 2: Author `fs_grade`**

Add `@fragment fn fs_grade(@builtin(position)) -> @location(0) vec4<f32>` that samples the source texture (binding 2, via the sampler at the pixel) and applies the POINTWISE `renderGrade` math from `crt-renderer-full.js` in this order (match the CPU exactly; all terms no-op at neutral):
1. brightness×, then contrast `(c-0.5)*contrast+0.5` (renderGrade ~1664–1667; CPU works in 0–255 → operate in 0–1 equivalently).
2. Film/sensor colour pass (~1673–1737): IR false-colour Aerochrome remap, haze lift, print-fade C/M/Y (shadow-weighted), black-level crush, highlight roll-off (knee 205/255), polaroid crossover. Use the exact constants from those lines, scaled to 0–1 (e.g. `185 → 185/255`, `tempShift = temperature*28/255`).
3. saturation, gamma (`pow(c, 1/gamma)`), temperature/tint shifts (~1741–1761).
4. monochrome tint with `u_monoTintStrength` (~1767–1787): `lerp(c, luma*tintColor, strength)`; tint table green/amber/blue/white.
5. IR hotspot radial screen-blend (~1853–1865): pointwise from distance to centre.
   (Nitrate decay + technicolor fringe are NOT here — deferred to 6.3.)
Output the graded colour. Keep `applyGrade` (the 6.1 identity grade) only if still referenced; otherwise fold its neutral math into `fs_grade`.

- [ ] **Step 3: `fs_optics` samples the graded texture**

`fs_optics`/`optics()` currently sample `u_tex` (the source). They will now sample `T_graded` instead — but the binding stays `u_tex` at binding 2; the BACKEND swaps which texture is bound (Step 4). No shader change beyond confirming `optics()` reads binding 2.

- [ ] **Step 4: Backend — add the grade pipeline + `T_graded`**

In `webgpu-backend.ts`: add a `gradePipeline` (`vs_main` + `fs_grade`, target `rgba8unorm`) using `layout3`. Add a per-size `tGraded` texture (`RENDER_ATTACHMENT | TEXTURE_BINDING`) and bind groups: `bgGrade` (U, sampler, `srcTex`) and change `bgOptics` to sample `tGraded` (U, sampler, `tGraded`). In `render()`, prepend a grade pass (source → `tGraded`) before the optics pass. Switch the uniform write to `buildSignalUniforms` and the buffer size to `CRT_SIGNAL_UNIFORMS.length` rounded to 16 bytes. Everything else (cover-fit, fallback, flush/outputCanvas) unchanged.

- [ ] **Step 5: Verify it compiles + builds**

Run: `npx tsc --noEmit && npx vite build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/effects-core/crt-display.wgsl src/lib/effects-core/webgpu-backend.ts
git commit -m "effects-core: grade pre-pass (fs_grade → T_graded) + signal uniform struct; backend 4-pass"
```

---

### Task 4: Extend `fs_optics` with the per-pixel signal artifacts

**Files:**
- Modify: `src/lib/effects-core/crt-display.wgsl`

> Runtime-verified by the sweep (Task 7). Gate: `tsc` + `vite build` clean.

- [ ] **Step 1: Port the geometric warps**

In `optics()`, add to the barrel-warped source coords (`srcNx`/`srcNy`) the same additive terms as `render()`'s loop (~604–628), all using the emulated `seededNoise`: timebase wobble (`u_timeWobble`, ~608), per-line jitter (`u_lineJitter`, ~609), head-switching tear band (`u_headSwitching`, ~615–620), tape crease (`u_tapeCrease`, ~621–623), film gate weave (`u_gateWeave`, ~625–626), gate jitter X/Y + rotation + shutter judder (`u_gateJitterX/Y`, `u_gateRotation`, `u_shutterJudder`, ~569–572, 627–628). Use `u_time`/`u_frameIndex`/`u_fps` for the temporal terms exactly as the CPU derives `temporalSeconds`/`temporalFrame` (frame-stutter is a 6.3 concern → treat `temporalFrame = frameIndex`).

- [ ] **Step 2: Port chroma delay + cross-color**

Extend the per-channel sampling offsets (`ru`/`gu`/`bu`) with chroma delay (`u_chromaDelay`, ~639) and cross-color (`u_crossColor`, ~640, 642) on top of the existing chromatic aberration. Match ~641–643.

- [ ] **Step 3: Port level modulation (dropouts, interlacing, head-band noise)**

After computing `scanlineGain`, fold in: dropouts (`u_dropouts`, clustered horizontal streaks with bright-flash head + dark recovery, ~840–855), interlacing gate (`u_interlacing`, ~862), and the head-switch band per-pixel noise/darkening (~856–861). Final `level = scanlineGain * dropoutMul * interlaceGate` (~863).

- [ ] **Step 4: Port colour artifacts (grain, dust, scratches, halation, dither)**

In the soft-blend section, add: film halation soft-blend (`u_filmHalation`, ~788–793); film grain with `u_grainSize`/`u_grainChromaticity` (~807–821, operate in 0–1: the CPU `*255` terms become `/255`-scaled); film dust (`u_filmDust`, ~823–827); film scratches (`u_filmScratches`, ~829–833); Bayer-4×4 ordered dither gated on `u_noise` (~782) — embed the 4×4 Bayer matrix as a WGSL `const`. Apply `+ dither` to the final channels (~865–867).

- [ ] **Step 5: Verify it compiles + builds**

Run: `npx tsc --noEmit && npx vite build` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/effects-core/crt-display.wgsl
git commit -m "effects-core: port per-pixel signal artifacts into fs_optics (warps, chroma, dropouts, grain/dust/scratches/dither)"
```

---

### Task 5: Extend `fs_composite` with the pointwise post-passes

**Files:**
- Modify: `src/lib/effects-core/crt-display.wgsl`

> Runtime-verified by the sweep. Gate: `tsc` + `vite build` clean.

- [ ] **Step 1: Port the pointwise post-passes**

In `fs_composite`, after the bloom composite and before/around the existing vignette/flicker, add (matching the CPU order in `render()` post-loop): colour quantization (`u_quantization`, level reduction); scanline profile (`u_scanlineProfile`: soft = darken every 2nd row ~0.18, hard = darken 2px every 3 rows ~0.45, triadAware = soft rows + faint vertical columns, ~1461–1478); subpixel layout (`u_subpixelLayout`: RGB/BGR/PenTile column multiply at 0.5 + a screen self-blend at 0.2 to recover brightness, ~1482–1510); lens vignette (`u_vignette` already wired in 6.1 — confirm it uses the radial r0=min·0.32→r1=max·0.62 form, ~1514–1520); CCTV monochrome (`u_cctvMono`: grayscale + faint green multiply, ~1029–1037). Keep RF interference (`u_rfInterference`) as the horizontal-band UV nudge inside `optics()` if simplest (matches the GLSL ~133–136); otherwise omit and let the sweep flag it.

- [ ] **Step 2: Verify it compiles + builds**

Run: `npx tsc --noEmit && npx vite build` → clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/effects-core/crt-display.wgsl
git commit -m "effects-core: pointwise post-passes in fs_composite (quantization, scanline profile, subpixel, cctv-mono)"
```

---

### Task 6: Hybrid gate — `gpuSignalOK` + backend wiring

**Files:**
- Modify: `src/lib/crt-renderer-hybrid.js`

**Interfaces:**
- Consumes: `WebGPUBackend` (already wired in 6.1; now driven by `buildSignalUniforms`).
- Produces: `gpuSignalOK(params, renderOptions)` replacing/extending the 6.1 `gpuFamilyOK`.

- [ ] **Step 1: Widen the gate**

Rename `gpuFamilyOK` → `gpuSignalOK` (keep a thin `gpuFamilyOK` alias if referenced elsewhere — grep first). Define `WEBGPU_SIGNAL_SUPPORTED` = the 6.1 display set ∪ the per-pixel artifact + grade params now implemented (every appended param from Task 2 that the shader ports): `imageBrightness, imageContrast, advancedSaturation, imageGamma, imageTemperature, imageTint, infraredFalseColor, printFadeCyan/Magenta/Yellow, blackLevelCrush, highlightRollOff, haze, polaroidCrossover, monochromeTintStrength, advancedLineJitter, advancedTimebaseWobble, advancedHeadSwitching, advancedChromaDelay, advancedCrossColor, advancedDropouts, advancedInterlacing, advancedTapeCrease, advancedFilmGateWeave, gateJitterX, gateJitterY, gateRotation, shutterJudder, advancedFilmGrain, grainSize, grainChromaticity, advancedFilmDust, advancedFilmScratches, advancedFilmHalation, noise, advancedQuantization, advancedCctvMonochrome, advancedRfInterference` (+ the 6.1 display params). Allow `pixelSize` only at 1 (shader fixes it). Allow the string params `maskType` (supported set + extend?), `monochromeTint` (now supported — remove the 6.1 "monoTint must be none" rejection), `scanlineProfile`, `subpixelLayoutOverride` at any value.
- **Still route to CPU** — `irHotspot` is ALLOWED (ported in the grade pass). The numeric catch-all (any param not in `WEBGPU_SIGNAL_SUPPORTED` must be neutral) already forces the deferred-multi-pass and inter-frame params to CPU; these are the ones to confirm are NOT in the supported set: `advancedGhosting, burnInGhost, advancedFocusBreathing, advancedGenerationLoss, copyGenerationCount, mediaAgeYears, restorationPassLevel, advancedMacroBlocking, nitrateDecay, technicolorFringe, advancedNeonPhosphorBleed, syncSuppression, bandingHorizontal, hanoverBars, advancedFrameStutter, advancedExposurePump, advancedWhiteBalanceDrift, datamoshBloom, datamoshDisplacement, pixelSort, bitrotCorruption`. Plus explicit rejects for `renderOptions.formatProfile` (resolution/composite), `renderOptions.sourceView`, and `advancedTimestampOSD` (OSD), and the string `chromaSubsamplingMode !== "444"`.

- [ ] **Step 2: Point `render()` at the new gate**

In `render()`, the WebGPU branch condition uses `this.gpuSignalOK(params, renderOptions)`.

- [ ] **Step 3: Verify fallback (no regression)**

Run: `npx vitest run && npx tsc --noEmit && npx vite build` → all green (backend null in jsdom; existing tests unaffected).

- [ ] **Step 4: Commit**

```bash
git add src/lib/crt-renderer-hybrid.js
git commit -m "hybrid: gpuSignalOK gate — route the per-pixel signal family to WebGPU, multi-pass/inter-frame stay CPU"
```

---

### Task 7: Full-catalogue fidelity sweep + noise check (controller); iterate to < 6

**Files:**
- Modify: `tools/gpu-coverage.snippet.js`
- Create: `docs/gpu/SIGNAL-FIDELITY.md`
- Modify (as needed): `src/lib/effects-core/crt-display.wgsl` (iteration)

> Controller-run against the live app (preview `build-together`:5176), like the 6.1 sweep.

- [ ] **Step 1: Add a noise-field check + full-catalogue sweep**

Extend `tools/gpu-coverage.snippet.js` with `window.__signalSweep`: (a) a noise-field check — render a tiny WGSL pass (or reuse `fs_optics` with grain-only params) and confirm the GPU `seededNoise` field matches `seededNoiseF32` to ~1e-2 at sample coords; (b) iterate the FULL catalogue `PRESETS` (91, capture+display) comparing `WebGPUBackend` vs `cpu.render()` mean-err, like 6.1's `__crtSweep`. Read back race-free (`flush()` + re-`drawImage`).

- [ ] **Step 2: Run it (live app), per-stage isolate, iterate**

Warm modules; set shared state on `window`; run in ~10-preset chunks. For any routed-candidate preset ≥ 6, isolate the offending stage with single-effect synthetic params (the 6.1 method that found bloom) and fix the WGSL to match the CPU. Re-run until every preset that `gpuSignalOK` allows is < 6.

- [ ] **Step 3: Verify the gate is sound + record**

Run the `allowed` vs `mean<6` cross-check (as in 6.1): `allowedFailing` MUST be `[]` (no preset the gate routes fails < 6). If a supported effect can't reach < 6, move its param out of `WEBGPU_SIGNAL_SUPPORTED` (→ CPU) and record why. Write `docs/gpu/SIGNAL-FIDELITY.md` with the per-preset table (routed < 6 set, deferred-6.3 set, CPU-forever set), the date, and the per-stage notes.

```bash
git add tools/gpu-coverage.snippet.js docs/gpu/SIGNAL-FIDELITY.md src/lib/effects-core/crt-display.wgsl src/lib/crt-renderer-hybrid.js
git commit -m "gpu: full-catalogue WebGPU fidelity sweep — per-pixel signal family verified < 6, gate sound (allowedFailing [])"
```

---

### Task 8: Live verification + final checks

> Controller.

- [ ] **Step 1: Confirm GPU routing + no stall via the production hybrid**

In the live app, drive `new CRTRendererHybrid(true)`, `setImage`, render a capture+display preset that `gpuSignalOK` allows (e.g. a VHS look) at 1280×720: confirm `activeMode === "webgpu"` and time it vs the CPU path (force `webgpuRenderer=null`+`gpuRenderer=null`) — expect the ~hundreds-of-ms stall gone. Confirm WebGPU→WebGL2→CPU fallback (null `webgpuRenderer` → `"gpu"`; null both → `"cpu"`), a deferred/inter-frame look (e.g. `datamoshBloom`) → `"cpu"`, and the export path (`preferGPU` false) bit-identical across two renders.

- [ ] **Step 2: Final checks**

Run: `npx vitest run && npx tsc --noEmit && npx vite build` → all green. Spot-check the Epic 1 parity sweep stays 455/455 (export untouched).

- [ ] **Step 3: Record + commit**

Append a "Live verification" section to `docs/gpu/SIGNAL-FIDELITY.md` (activeMode, GPU vs CPU ms, fallback chain, export bit-identical).

```bash
git commit -am "gpu: Epic 6.2 — per-pixel signal core real-time on WebGPU, live-verified + fallback intact" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:** emulated-f64 noise → Task 1. CRT_SIGNAL_UNIFORMS + buildSignalUniforms → Task 2. Grade pre-pass (fs_grade) → Task 3. Per-pixel artifacts in fs_optics → Task 4. Pointwise post-passes in fs_composite → Task 5. gpuSignalOK gate (allow per-pixel, route multi-pass/inter-frame to CPU) → Task 6. Full 91-preset sweep + noise check + iterate + record → Task 7. Live verify + fallback + export-CPU + parity → Task 8. Boundaries (6.3 multi-pass deferred, datamosh/pixel-sort CPU) → Global Constraints + Task 6 gate. Determinism/export-CPU → Global Constraints + Task 8.

**Placeholder scan:** Task 1 + 2 carry full code + tests (TDD). Tasks 3–5 (WGSL shader) and the backend/gate are requirement-driven with exact CPU source line references + the acceptance gate — the same treatment Epic 6.1 used for runtime-verified shader code (jsdom can't run WGSL). Tasks 7–8 are operational with exact commands + the < 6 / `allowedFailing: []` gate.

**Type consistency:** `CRT_SIGNAL_UNIFORMS` order is the shared contract across `buildSignalUniforms` (Task 2), the WGSL `Uniforms` struct (Task 3), and the backend uniform-buffer write (Task 3). `seededNoiseF32` (Task 1) ↔ WGSL `seededNoise` (Task 1) ↔ `seededNoiseRef` (existing) verified by unit test + Task 7 runtime check. `gpuSignalOK` (Task 6) consumed by `render()` (Task 6). Mask/mono/scanlineProfile/subpixel codes consistent between param-map (Task 2) and the shader struct comment (Task 3).
