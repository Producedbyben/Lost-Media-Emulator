# Epic 6.1 — Portable WGSL Effects-Core + CRT/Display on WebGPU — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a framework-free WGSL effects-core driven via WebGPU and route the CRT/display family to it at fidelity (mean-err < 6 vs CPU), killing the 525ms freeze for those looks, with full WebGL2→CPU fallback.

**Architecture:** A portable `src/lib/effects-core/` unit (WGSL shaders + a WebGPU driver + a pure param→uniform map + a noise port). The existing `crt-renderer-hybrid.js` gains a WebGPU backend it prefers (when available AND the family passed the fidelity gate), falling back to the current WebGL2 then CPU path. Export stays CPU-deterministic; the fidelity sweep is the acceptance gate.

**Tech Stack:** WebGPU + WGSL, TypeScript, vitest. Reuses `tools/gpu-coverage.snippet.js` (CPU↔GPU diff) and the hybrid renderer.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-27-epic6-1-wgsl-effects-core-design.md`; strategy: `docs/GPU-PORT-PLAN.md`.
- **Foundation:** WGSL shader core driven via WebGPU; `effects-core/` has NO React/Electron imports (portable asset).
- **Fallback order:** WebGPU → WebGL2 (existing `crt-renderer-gpu.js`) → CPU (`crt-renderer-full.js`). Any WebGPU init/compile/device-lost failure falls back silently; never a blank/broken frame.
- **Fidelity bar:** a family routes to WebGPU only when each preset is **mean-err < 6** vs the CPU render on the sweep. Only the **CRT/display family** is flipped this increment.
- **Export unaffected:** exports keep running the deterministic CPU path (Epic 1 parity sweep governs export). Epic 6 accelerates **preview** only.
- **Determinism note:** GPU is perceptual-parity (f32 ≠ CPU f64), not bit-identical — that's expected and within Epic 1's GPU tolerance.
- **Inter-frame effects** (datamosh, pixel-sort) are NEVER on the per-pixel GPU path — they stay CPU.
- Keep the **135 tests** green; `npx tsc --noEmit` + `npx vite build` clean. New pure helpers TDD'd; shader/backend are runtime-verified via the sweep (WebGPU/WGSL can't run in jsdom).
- Work on `main`; commit per task; push after each unit. No `npm run dist`/R2.

---

### Task 1: Noise port (+ JS reference) and param→uniform map (TDD)

**Files:**
- Create: `src/lib/effects-core/seeded-noise-ref.ts`
- Create: `src/lib/effects-core/noise.wgsl`
- Create: `src/lib/effects-core/param-map.ts`
- Test: `src/test/effects-core-noise.test.ts`, `src/test/effects-core-param-map.test.ts`

**Interfaces:**
- Produces:
  - `seededNoiseRef(x: number, y: number, frame: number): number` — exact JS twin of the CPU `seededNoise`.
  - `CRT_DISPLAY_UNIFORMS: readonly string[]` (ordered uniform field names) and
    `buildUniforms(params: Record<string, number | string>, ctx: { width: number; height: number; seconds: number; frameIndex: number; fps: number }): Float32Array` — packs the CRT/display params into the std140-friendly uniform array in `CRT_DISPLAY_UNIFORMS` order.
  - `noise.wgsl` exports a `fn seededNoise(x: f32, y: f32, frame: f32) -> f32` with the same formula.

- [ ] **Step 1: Write the failing tests**

```ts
// src/test/effects-core-noise.test.ts
import { describe, it, expect } from "vitest";
import { seededNoiseRef } from "@/lib/effects-core/seeded-noise-ref";

// Mirror of the CPU seededNoise in crt-renderer-full.js (the authority).
function cpuSeededNoise(x: number, y: number, frame: number) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - Math.floor(v);
}

describe("seededNoiseRef", () => {
  it("matches the CPU seededNoise exactly across samples", () => {
    for (const [x, y, f] of [[0, 0, 0], [1, 2, 3], [123.5, 7, 29], [480, 360, 1]] as const) {
      expect(seededNoiseRef(x, y, f)).toBeCloseTo(cpuSeededNoise(x, y, f), 12);
    }
  });
  it("returns a value in [0,1)", () => {
    const v = seededNoiseRef(5, 9, 17);
    expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1);
  });
});
```

```ts
// src/test/effects-core-param-map.test.ts
import { describe, it, expect } from "vitest";
import { CRT_DISPLAY_UNIFORMS, buildUniforms } from "@/lib/effects-core/param-map";

describe("buildUniforms", () => {
  const ctx = { width: 640, height: 480, seconds: 1, frameIndex: 30, fps: 30 };
  it("packs values in the declared uniform order", () => {
    const u = buildUniforms({ scanlineStrength: 0.5, barrelDistortion: 0.2 }, ctx);
    expect(u).toBeInstanceOf(Float32Array);
    expect(u.length).toBe(CRT_DISPLAY_UNIFORMS.length);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_scan")]).toBeCloseTo(0.5, 5);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_barrel")]).toBeCloseTo(0.2, 5);
  });
  it("maps maskType string to its numeric code", () => {
    const u = buildUniforms({ maskType: "aperture" }, ctx);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_maskType")]).toBe(2); // none0 dot1 aperture2 slot3 shadow4
  });
  it("carries frame context", () => {
    const u = buildUniforms({}, ctx);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_frameIndex")]).toBe(30);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_resolutionX")]).toBe(640);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/test/effects-core-noise.test.ts src/test/effects-core-param-map.test.ts`
Expected: FAIL (modules missing).

- [ ] **Step 3: Implement the three files**

```ts
// src/lib/effects-core/seeded-noise-ref.ts
// Exact JS twin of CPU seededNoise (crt-renderer-full.js) — used to prove the WGSL
// port transcribes the same formula. (GPU f32 differs slightly at runtime; the
// fidelity sweep is the runtime proof. This keeps the FORMULA honest.)
export function seededNoiseRef(x: number, y: number, frame: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - Math.floor(v);
}
```

```wgsl
// src/lib/effects-core/noise.wgsl
// Twin of CPU seededNoise (crt-renderer-full.js) + seeded-noise-ref.ts. f32 here,
// f64 on CPU — values differ slightly but statistically match; CRT/display is
// chosen first precisely because it is light on noise.
fn seededNoise(x: f32, y: f32, frame: f32) -> f32 {
  let v: f32 = sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - floor(v);
}
```

```ts
// src/lib/effects-core/param-map.ts
// Pure CRTParams → uniform Float32Array for the CRT/display WGSL shader. The order
// here is the single source of truth shared with crt-display.wgsl's uniform struct.
export const CRT_DISPLAY_UNIFORMS = [
  "u_scan", "u_mask", "u_maskType", "u_maskScale", "u_barrel", "u_vignette",
  "u_bloom", "u_ca", "u_flicker", "u_brightness", "u_contrast", "u_saturation",
  "u_gamma", "u_temperature", "u_tint", "u_monoTint",
  "u_time", "u_frameIndex", "u_fps", "u_resolutionX", "u_resolutionY",
] as const;

const MASK_CODES: Record<string, number> = { none: 0, dot: 1, aperture: 2, slot: 3, shadowMask: 4 };
const MONO_CODES: Record<string, number> = { none: 0, green: 1, amber: 2, blue: 3 };
const n = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function buildUniforms(
  params: Record<string, number | string>,
  ctx: { width: number; height: number; seconds: number; frameIndex: number; fps: number },
): Float32Array {
  const out = new Float32Array(CRT_DISPLAY_UNIFORMS.length);
  const set = (k: string, v: number) => { out[CRT_DISPLAY_UNIFORMS.indexOf(k)] = v; };
  set("u_scan", n(params.scanlineStrength));
  set("u_mask", n(params.phosphorMask));
  set("u_maskType", MASK_CODES[String(params.maskType ?? "none")] ?? 0);
  set("u_maskScale", n(params.maskScale, 1));
  set("u_barrel", n(params.barrelDistortion));
  set("u_vignette", n(params.vignette));
  set("u_bloom", n(params.bloom));
  set("u_ca", n(params.chromaticAberration));
  set("u_flicker", n(params.flicker));
  set("u_brightness", n(params.imageBrightness, 1));
  set("u_contrast", n(params.imageContrast, 1));
  set("u_saturation", n(params.advancedSaturation, 1));
  set("u_gamma", n(params.imageGamma, 1));
  set("u_temperature", n(params.imageTemperature));
  set("u_tint", n(params.imageTint));
  set("u_monoTint", MONO_CODES[String(params.monochromeTint ?? "none")] ?? 0);
  set("u_time", ctx.seconds);
  set("u_frameIndex", ctx.frameIndex);
  set("u_fps", ctx.fps);
  set("u_resolutionX", ctx.width);
  set("u_resolutionY", ctx.height);
  return out;
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run src/test/effects-core-noise.test.ts src/test/effects-core-param-map.test.ts` → PASS.

- [ ] **Step 5: Full suite + tsc + commit**

Run: `npx vitest run && npx tsc --noEmit`

```bash
git add src/lib/effects-core/ src/test/effects-core-noise.test.ts src/test/effects-core-param-map.test.ts
git commit -m "effects-core: WGSL seededNoise port (+JS ref) + CRT/display param→uniform map (TDD)"
```

---

### Task 2: CRT/display WGSL fragment shader

**Files:**
- Create: `src/lib/effects-core/crt-display.wgsl`

**Interfaces:**
- Consumes: `noise.wgsl` (`seededNoise`), the uniform order from `param-map.ts` (`CRT_DISPLAY_UNIFORMS`).
- Produces: a WGSL module with a vertex entry (fullscreen triangle) and a fragment entry sampling `u_tex` and applying the CRT/display chain; a uniform struct whose fields are in EXACTLY the `CRT_DISPLAY_UNIFORMS` order.

> Shader code — verified by the fidelity sweep (Task 5), not a unit test (WGSL can't run in jsdom).

- [ ] **Step 1: Author the shader**

Port the fragment logic from the existing GLSL in `src/lib/crt-renderer-gpu.js` (the authoritative WebGL2 shader: it already implements scan/mask/barrel/bloom/ca/grading/flicker/vignette/monoTint against matching uniforms) into WGSL in `crt-display.wgsl`. Requirements:
- A `struct Uniforms { u_scan: f32, u_mask: f32, ... }` whose field order is byte-for-byte the `CRT_DISPLAY_UNIFORMS` array (so `buildUniforms`'s Float32Array maps directly), `@group(0) @binding(0) var<uniform> U: Uniforms;`, plus `@binding(1) var u_samp: sampler; @binding(2) var u_tex: texture_2d<f32>;`.
- `#include`-free: paste the `seededNoise` fn from `noise.wgsl` at the top (WGSL has no includes; keep them identical, comment-linked).
- Implement, in order: barrel-distort the UV, sample the texture, grade (brightness/contrast/saturation/gamma/temp/tint/monoTint), chroma aberration, scanlines (`u_scan`), phosphor mask by `u_maskType` (0 none /1 dot /2 aperture /3 slot /4 shadow, scaled by `u_maskScale` — geometry must match the CPU `aperture`=vertical `maskX%3` stripes, `dot`/`shadow`=2D), bloom, flicker, vignette. Match the CPU math in `crt-renderer-full.js`'s mask/scan/grade branches so the sweep passes.
- Fullscreen-triangle vertex entry (`@vertex` emitting 3 verts covering the screen, UV from position).

- [ ] **Step 2: Syntax sanity**

There is no offline WGSL validator in the repo; correctness is proven when `WebGPUBackend` (Task 3) compiles it (a compile error surfaces in Task 3's device init and the sweep). Confirm the uniform struct field list length equals `CRT_DISPLAY_UNIFORMS.length`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/effects-core/crt-display.wgsl
git commit -m "effects-core: CRT/display WGSL fragment shader (ported from the WebGL2 shader)"
```

---

### Task 3: WebGPU backend (device, pipeline, render-to-2d-ctx)

**Files:**
- Create: `src/lib/effects-core/webgpu-backend.ts`

**Interfaces:**
- Consumes: `crt-display.wgsl` (imported as a string via `?raw`), `buildUniforms` + `CRT_DISPLAY_UNIFORMS` (Task 1).
- Produces: `class WebGPUBackend { static create(): Promise<WebGPUBackend | null>; render(outCtx: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number, seconds: number, params: Record<string, number|string>, frameIndex: number, fps: number): void; dispose(): void; }`. `create()` resolves null when WebGPU is unavailable or shader compile fails.

> Runtime/WebGPU — verified via the app + sweep (controller), not jsdom.

- [ ] **Step 1: Implement the backend**

Create `src/lib/effects-core/webgpu-backend.ts`:
- `static async create()`: `if (!navigator.gpu) return null;` request adapter+device (return null on failure); create an offscreen `GPUCanvasContext` (`document.createElement('canvas')` + `getContext('webgpu')`), configure with `navigator.gpu.getPreferredCanvasFormat()`; compile the shader (`device.createShaderModule({ code })` with `import shaderCode from './crt-display.wgsl?raw'`); build the render pipeline (fullscreen triangle, the fragment target = canvas format), a uniform `GPUBuffer` sized `CRT_DISPLAY_UNIFORMS.length*4`, a sampler, and a reusable bind-group layout. Wrap in try/catch → return null on any failure.
- `render(outCtx, source, w, h, seconds, params, frameIndex, fps)`: resize the internal canvas to w×h if changed (reconfigure); upload `device.queue.writeBuffer(uniformBuf, 0, buildUniforms(params, {width:w,height:h,seconds,frameIndex,fps}))`; upload `source` to a `GPUTexture` via `device.queue.copyExternalImageToTexture`; encode a render pass drawing 3 verts; submit; then `outCtx.drawImage(this.canvas, 0, 0, w, h)` so the WebGPU result lands in the caller's 2D context (same contract the WebGL2 renderer uses).
- `dispose()`: destroy device/buffers; mark disposed.
- Register a `device.lost` handler that marks the backend dead so the hybrid falls back.

- [ ] **Step 2: Confirm it compiles + builds**

Run: `npx tsc --noEmit && npx vite build` (the `?raw` import + WebGPU types must resolve; add `@webgpu/types` to devDeps if `GPUDevice` types are missing — check `node_modules/@webgpu/types` first, only add if absent).
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/effects-core/webgpu-backend.ts package.json
git commit -m "effects-core: WebGPU backend — device/pipeline/uniform upload, render to 2D ctx, null on unavailable"
```

---

### Task 4: Hybrid integration + family gate + fallback

**Files:**
- Modify: `src/lib/crt-renderer-hybrid.js`

**Interfaces:**
- Consumes: `WebGPUBackend` (Task 3).
- Produces: hybrid prefers WebGPU for fidelity-passed families; `activeMode` can be `"webgpu"`; WebGL2/CPU fallback unchanged.

- [ ] **Step 1: Wire the WebGPU backend with fallback**

In `crt-renderer-hybrid.js`: import `WebGPUBackend`. In the constructor kick off `WebGPUBackend.create().then(b => { this.webgpuRenderer = b; })` (async; null-safe). Add `gpuFamilyOK(params)` returning true only for the CRT/display family this increment (gate on the display-defining params / a passed-family set — e.g. presence of `scanlineStrength`/`phosphorMask`/`maskType` and ABSENCE of the inter-frame/tape/film params the shader doesn't implement yet). In `render(...)`, before the existing WebGL2/CPU branch:

```js
if (this.preferGPU && this.webgpuRenderer && this.gpuFamilyOK(params) && this._noInterFrame(params)) {
  try {
    this.webgpuRenderer.render(outCtx, this._sourceImage, width, height, seconds, params, frameIndex, fps);
    this.activeMode = "webgpu";
    return;
  } catch (e) { /* fall through to WebGL2/CPU */ }
}
```

Keep the existing WebGL2 (`_gpuCanHandle`) and CPU branches exactly as the fallback. (`this._sourceImage` is whatever the hybrid already holds as the current source frame — reuse the same source the CPU/WebGL2 path renders from; if the hybrid passes the source via `setImage`, store it.)

- [ ] **Step 2: Verify fallback (no WebGPU regression)**

Run: `npx vitest run && npx tsc --noEmit && npx vite build` → all green (the hybrid still works with `webgpuRenderer` null; existing tests unaffected).

- [ ] **Step 3: Commit**

```bash
git add src/lib/crt-renderer-hybrid.js
git commit -m "hybrid: prefer WebGPU for the CRT/display family with WebGL2→CPU fallback (activeMode webgpu)"
```

---

### Task 5: Fidelity sweep extension + run (controller)

**Files:**
- Modify: `tools/gpu-coverage.snippet.js`
- Create: `docs/gpu/CRT-DISPLAY-FIDELITY.md`

> Controller-run against the live app (WebGPU needs the GPU + canvas), like the audit/parity sweeps.

- [ ] **Step 1: Extend the sweep**

Add a WebGPU pass to `tools/gpu-coverage.snippet.js`: for each preset, render the CPU frame and the WebGPU-backend frame (via `WebGPUBackend.create()` + `render`), `comparePixels` (reuse `export-validator`), report mean-err. Filter/print the CRT/display family.

- [ ] **Step 2: Run it (live app)**

Start `npm run dev`; eval/paste the sweep; record per-CRT/display-preset mean-err. Iterate on `crt-display.wgsl` (Task 2) until every CRT/display preset is **< 6**. (Scanline/mask geometry + grade are the usual mismatch sources — match the CPU math.)

- [ ] **Step 3: Record + commit**

Write `docs/gpu/CRT-DISPLAY-FIDELITY.md` with the per-preset mean-err table (all < 6) and the date. Update `gpuFamilyOK` if the passing set differs from the assumption.

```bash
git add tools/gpu-coverage.snippet.js docs/gpu/CRT-DISPLAY-FIDELITY.md src/lib/crt-renderer-hybrid.js
git commit -m "gpu: WebGPU fidelity sweep — CRT/display family verified < 6 mean-err vs CPU"
```

---

### Task 6: Live verification + final sweep

> Controller.

- [ ] **Step 1: Confirm GPU routing + no stall in the app**

Start the app, load a source, select a CRT/display preset, confirm `activeMode === "webgpu"` (via a preview eval on the renderer) and smooth playback (no 525ms stall). Then disable WebGPU (force `webgpuRenderer = null` or a non-WebGPU runtime) and confirm it falls back to WebGL2/CPU with no visual break.

- [ ] **Step 2: Final checks**

Run: `npx vitest run && npx tsc --noEmit && npx vite build` → all green. Confirm a non-CRT/display preset still routes to CPU (unchanged) and export still uses CPU.

- [ ] **Step 3: Commit any cleanup**

```bash
git commit -am "gpu: Epic 6.1 — CRT/display real-time on WebGPU, fallback verified" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:** effects-core portable unit → Tasks 1–3. WGSL seededNoise parity → Task 1. CRT/display shader → Task 2. WebGPU backend + null-on-unavailable → Task 3. Hybrid prefer-WebGPU + WebGL2/CPU fallback + activeMode → Task 4. Fidelity gate < 6 + family flip → Tasks 4,5. Export stays CPU → Global Constraints + Task 6. Boundaries (CRT/display only, inter-frame stays CPU) → Task 4 gate + constraints. Testing (param-map + noise TDD; sweep integration) → Tasks 1,5,6.

**Placeholder scan:** Task 1 carries full code. Tasks 2–3 (WGSL shader + WebGPU pipeline) are runtime-verified and specify the exact port source (`crt-renderer-gpu.js` GLSL), the uniform-order contract, the class interface, and the acceptance gate — the same treatment Web-Audio/canvas code got (jsdom can't run them). Tasks 5–6 are operational with exact commands + the < 6 gate.

**Type consistency:** `CRT_DISPLAY_UNIFORMS` order is the shared contract between `buildUniforms` (Task 1), the WGSL uniform struct (Task 2), and the uniform-buffer write (Task 3). `WebGPUBackend.create()/render()/dispose()` signatures match between Tasks 3 and 4. Mask codes (none0/dot1/aperture2/slot3/shadow4) consistent across param-map + shader.
