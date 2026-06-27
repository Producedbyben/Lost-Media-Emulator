# Epic 1 — Function-Correctness & Export-Parity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the export matches the preview at any frame (still + temporal) and that no control is dead or half-wired, producing a prioritized `PARITY-FIX-LIST.md` and a feature checklist, then land the must-fixes.

**Architecture:** Two phases, audit-style. Phase 1 is an automated, in-browser **determinism sweep** across all 91 presets at temporally-sampled frames (reusing the existing `src/lib/export-validator.js` primitives), plus a **preview↔export parity** pass run through the existing in-app "Validate export ↔ preview" tool on a representative subset, plus an **encode-fidelity** spot-check in the ffmpeg smoke tests. Phase 2 is a manual feature-correctness pass for what pixels can't catch. Pure helpers are TDD'd in `src/lib/parity/`; the sweep harness is an in-app snippet under `tools/parity/`; artifacts live under `docs/parity/`.

**Tech Stack:** TypeScript + vitest (jsdom) for helpers; an in-browser devtools/preview snippet (`.js`) for the sweep, reusing `CRTRendererFull` (`src/lib/crt-renderer-full.js`) + `PRESETS` (`src/lib/presets.js`); the bundled ffmpeg + the existing `electron/__tests__/ffmpeg-pipeline.smoke.test.js` for the encode spot-check; Markdown for artifacts.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-27-epic1-function-correctness-export-parity-design.md`. Epic 1 only proves export **matches** preview; effect **authenticity** is Epic 3 (`docs/audit/FIX-LIST.md`), the OSD **rebuild** is Epic 2 — detect-and-fix-list OSD parity gaps, do not rebuild OSD here.
- **Determinism** (byte-identical export re-render) is the **hard** pass. **Preview↔export parity** is the **soft** pass at `meanDiff ≤ 6` for a CPU preview, `≤ 12` for a GPU preview (verbatim from `export-validator.js`). The CPU path is the authoritative baseline.
- Temporal frame sample set is exactly `[0, 1, 7, 15, 29]`.
- Reuse `export-validator.js` for pixel compare/render — do NOT duplicate its logic.
- Keep the **96 existing tests green**; `npx tsc --noEmit` clean. New `src/lib/parity/` helpers are TDD'd.
- Artifacts under `docs/parity/`; harness under `tools/parity/`; helpers under `src/lib/parity/`.
- Preset source of truth: `src/lib/presets.js` (`export const PRESETS`, 91 flat param objects).
- Work on `main`; commit per task; push after each unit of work. No `npm run dist` / R2 release — Epic 1 ships no build.

---

### Task 1: Reusable validator primitives + parity helpers (TDD)

**Files:**
- Modify: `src/lib/export-validator.js` (add two named exports)
- Create: `src/lib/parity/sweep.ts`
- Test: `src/test/parity-sweep.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `export function comparePixels(a, b)` and `export function renderCpuFrame(renderer, width, height, seconds, params, frameIndex, fps, renderOptions)` from `export-validator.js` (made reusable).
  - `SAMPLE_FRAMES: readonly number[]` = `[0,1,7,15,29]`
  - `type Severity = "none" | "low" | "med" | "high"`
  - `type ParityResult = { preset?: string; frame?: number; error?: string | null; determinism: { identical?: boolean; meanDiff?: number }; parity: { meanDiff?: number; tolerance?: number } }`
  - `classifyParityResult(r: ParityResult): { severity: Severity; reason: string }`
  - `coverageSummary(results: ParityResult[]): { total: number; passed: number; failed: number; pct: number }`

- [ ] **Step 1: Make the validator primitives reusable**

In `src/lib/export-validator.js`, add the `export` keyword to the two currently module-private helpers (no other change):

```js
export function readPixels(canvas) {
```
```js
export function renderCpuFrame(renderer, width, height, seconds, params, frameIndex, fps, renderOptions) {
```
```js
export function comparePixels(a, b) {
```

(The default `validateExportAgainstPreview` export and its internal calls are unchanged — these just become additionally importable.)

- [ ] **Step 2: Write the failing test**

```ts
// src/test/parity-sweep.test.ts
import { describe, it, expect } from "vitest";
import { SAMPLE_FRAMES, classifyParityResult, coverageSummary } from "@/lib/parity/sweep";

describe("parity sweep helpers", () => {
  it("samples frames that exercise temporal effects", () => {
    expect([...SAMPLE_FRAMES]).toEqual([0, 1, 7, 15, 29]);
  });

  it("flags non-deterministic export as high severity", () => {
    const r = classifyParityResult({ determinism: { identical: false, meanDiff: 4 }, parity: { meanDiff: 1, tolerance: 6 }, error: null });
    expect(r.severity).toBe("high");
    expect(r.reason).toMatch(/reproduc|determin/i);
  });

  it("passes a deterministic, in-tolerance result", () => {
    const r = classifyParityResult({ determinism: { identical: true, meanDiff: 0 }, parity: { meanDiff: 2, tolerance: 6 }, error: null });
    expect(r.severity).toBe("none");
  });

  it("scales parity severity by how far over tolerance", () => {
    expect(classifyParityResult({ determinism: { identical: true }, parity: { meanDiff: 7, tolerance: 6 } }).severity).toBe("low");
    expect(classifyParityResult({ determinism: { identical: true }, parity: { meanDiff: 12, tolerance: 6 } }).severity).toBe("med");
    expect(classifyParityResult({ determinism: { identical: true }, parity: { meanDiff: 30, tolerance: 6 } }).severity).toBe("high");
  });

  it("treats a render error as high severity", () => {
    expect(classifyParityResult({ error: "boom", determinism: {}, parity: {} }).severity).toBe("high");
  });

  it("summarizes coverage across results", () => {
    const results = [
      { determinism: { identical: true }, parity: { meanDiff: 1, tolerance: 6 }, error: null },
      { determinism: { identical: false }, parity: { meanDiff: 1, tolerance: 6 }, error: null },
    ];
    const s = coverageSummary(results);
    expect(s.total).toBe(2);
    expect(s.passed).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.pct).toBe(50);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/test/parity-sweep.test.ts`
Expected: FAIL — `Cannot find module '@/lib/parity/sweep'`.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/parity/sweep.ts
// Pure helpers for the Epic 1 export-parity sweep. Severity classification and
// coverage roll-up; the actual pixel compare/render lives in export-validator.js.

export const SAMPLE_FRAMES = [0, 1, 7, 15, 29] as const;

export type Severity = "none" | "low" | "med" | "high";

export interface ParityResult {
  preset?: string;
  frame?: number;
  error?: string | null;
  determinism: { identical?: boolean; meanDiff?: number };
  parity: { meanDiff?: number; tolerance?: number };
}

export function classifyParityResult(r: ParityResult): { severity: Severity; reason: string } {
  if (r.error) return { severity: "high", reason: `render error: ${r.error}` };
  if (r.determinism?.identical === false)
    return { severity: "high", reason: "export not reproducible (determinism failed — likely unseeded temporal randomness or stale state)" };
  const md = r.parity?.meanDiff ?? 0;
  const tol = r.parity?.tolerance ?? 6;
  if (md <= tol) return { severity: "none", reason: "parity within tolerance" };
  const over = md / tol;
  if (over > 3) return { severity: "high", reason: `parity Δmean ${md} >> tol ${tol}` };
  if (over > 1.5) return { severity: "med", reason: `parity Δmean ${md} > tol ${tol}` };
  return { severity: "low", reason: `parity Δmean ${md} slightly over tol ${tol}` };
}

export function coverageSummary(results: ParityResult[]): { total: number; passed: number; failed: number; pct: number } {
  let passed = 0;
  for (const r of results) if (classifyParityResult(r).severity === "none") passed++;
  const total = results.length;
  return { total, passed, failed: total - passed, pct: total ? +((100 * passed) / total).toFixed(1) : 0 };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/test/parity-sweep.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Confirm full suite + tsc**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass (96 existing + 6 new), tsc clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/export-validator.js src/lib/parity/sweep.ts src/test/parity-sweep.test.ts
git commit -m "parity: reusable validator primitives + sweep severity/coverage helpers"
```

---

### Task 2: Determinism sweep harness (in-app snippet)

**Files:**
- Create: `tools/parity/parity-sweep.snippet.js`

**Interfaces:**
- Consumes: `CRTRendererFull` (`src/lib/crt-renderer-full.js`), `PRESETS` (`src/lib/presets.js`), `comparePixels` + `renderCpuFrame` (Task 1), `SAMPLE_FRAMES` + `classifyParityResult` (Task 1).
- Produces: `window.__parityResults` (array of `ParityResult` with a `classification`), a `console.table` of failures, and a one-line summary.

- [ ] **Step 1: Write the snippet (adapt `tools/gpu-coverage.snippet.js`)**

```js
// tools/parity/parity-sweep.snippet.js
// Epic 1 — frame-accurate export DETERMINISM sweep.
// Paste into the app's devtools console (or run via the preview tooling) while
// `npm run dev` is running. For every preset, at the temporally-sampled frames,
// it renders the forced-CPU export frame TWICE from a clean reset and checks the
// two are byte-identical. A mismatch means the export is not reproducible —
// unseeded temporal randomness or stale state — the class behind the OSD-export
// desync. Preview↔export PARITY (vs the live preview) is checked separately by
// the in-app "Validate export ↔ preview" tool on a representative subset.
(async () => {
  const cpuMod = await import('/src/lib/crt-renderer-full.js');
  const presetsMod = await import('/src/lib/presets.js');
  const valMod = await import('/src/lib/export-validator.js');
  const sweepMod = await import('/src/lib/parity/sweep.ts');
  const PRESETS = presetsMod.PRESETS || presetsMod.default || {};
  const { renderCpuFrame, comparePixels, readPixels } = valMod;
  const { SAMPLE_FRAMES, classifyParityResult } = sweepMod;

  // Neutral test source with detail in every region (gradient + saturated blocks + text).
  const W = 480, H = 360;
  const src = document.createElement('canvas'); src.width = W; src.height = H;
  const g = src.getContext('2d');
  const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, '#e8e8e8'); grd.addColorStop(1, '#203050');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = '#d04030'; g.fillRect(60, 60, 160, 120);
  g.fillStyle = '#30a060'; g.fillRect(260, 180, 150, 120);
  g.fillStyle = '#fff'; g.font = 'bold 54px sans-serif'; g.fillText('LME', 180, 240);

  const renderer = new cpuMod.CRTRendererFull();
  renderer.setImage?.(src, 1);

  const results = [];
  for (const preset of Object.keys(PRESETS)) {
    const params = PRESETS[preset].params || PRESETS[preset];
    if (typeof params !== 'object') continue;
    for (const frame of SAMPLE_FRAMES) {
      const rec = { preset, frame, error: null, determinism: {}, parity: { meanDiff: 0, tolerance: 6 } };
      try {
        const seconds = frame / 30;
        const a = renderCpuFrame(renderer, W, H, seconds, params, frame, 30, {});
        const b = renderCpuFrame(renderer, W, H, seconds, params, frame, 30, {});
        const det = comparePixels(readPixels(a), readPixels(b));
        rec.determinism = { identical: det.identical, maxDiff: det.maxDiff, meanDiff: +det.meanDiff.toFixed(3) };
      } catch (e) { rec.error = e?.message || String(e); }
      rec.classification = classifyParityResult(rec);
      results.push(rec);
    }
  }
  const fails = results.filter((r) => r.classification.severity !== 'none');
  console.table(fails.map((r) => ({ preset: r.preset, frame: r.frame, severity: r.classification.severity, reason: r.classification.reason })));
  console.log(`parity determinism sweep: ${results.length - fails.length}/${results.length} clean (${Object.keys(PRESETS).length} presets × ${SAMPLE_FRAMES.length} frames); ${fails.length} failing`);
  window.__parityResults = results;
  return { total: results.length, clean: results.length - fails.length, failing: fails.length };
})();
```

- [ ] **Step 2: Syntax-check**

Run: `node -c tools/parity/parity-sweep.snippet.js`
Expected: no output (valid JS). (Visual/operational tool — run for real in Task 3.)

- [ ] **Step 3: Commit**

```bash
git add tools/parity/parity-sweep.snippet.js
git commit -m "parity: in-app determinism sweep harness (91 presets × temporal frames)"
```

---

### Task 3: Run the sweep → PARITY-FIX-LIST + coverage

**Files:**
- Create: `docs/parity/PARITY-FIX-LIST.md`
- Create: `docs/parity/coverage.md`

**Interfaces:**
- Consumes: the harness (Task 2), the in-app "Validate export ↔ preview" tool (`validateExport` in `src/hooks/useCRTRenderer.ts`), `coverageSummary` (Task 1).

> Operational/controller-driven (like the Epic 0 audit pilot): requires running the live app. Not a pure subagent task.

- [ ] **Step 1: Run the determinism sweep**

Start the app (`npm run dev` / preview tooling, port 5176). Paste `tools/parity/parity-sweep.snippet.js` into the devtools console (or eval it via the preview tooling). Record the summary line and the failures table from `window.__parityResults`.

- [ ] **Step 2: Run the preview↔export parity subset**

For a representative subset (≥1 per family: e.g. `Late-80s Home VHS`, `Consumer TV`, `90s Rental Tape (3rd Gen Dub)`, `MPEG-2 Satellite Glitch`, `Damaged Archive Recovery`, plus any preset that failed determinism in Step 1), load each look in the app and click **"Validate export ↔ preview"** in the Export dialog. Record `determinism`, `parity.meanDiff`, `parity.tolerance`, and `ok` for each.

- [ ] **Step 3: Author `docs/parity/PARITY-FIX-LIST.md`**

A prioritized table of every failing preset×frame (severity high→med→low), columns: `Preset / Effect | Frame(s) | Failure (determinism / parity Δ) | Severity | Suspected cause | Fix lane (CPU-now / port-time)`. Determinism failures first. Note which presets/effects are implicated and the suspected root (e.g. "uses `Math.random()` per frame without a seed", "OSD timestamp advances differently in export"). If the sweep is fully clean, the file states that explicitly and records the swept matrix as the evidence.

- [ ] **Step 4: Author `docs/parity/coverage.md`**

`Presets swept: 91 × 5 frames = 455 checks. Clean: <n> (<pct>%).` Plus the per-family rollup and the parity-subset results. Use the `coverageSummary` numbers from Step 1.

- [ ] **Step 5: Commit**

```bash
git add docs/parity/PARITY-FIX-LIST.md docs/parity/coverage.md
git commit -m "parity: determinism + preview-parity sweep results + prioritized fix-list"
```

---

### Task 4: Encode-fidelity spot-check (ffmpeg)

**Files:**
- Modify: `electron/__tests__/ffmpeg-pipeline.smoke.test.js` (add one test)

**Interfaces:**
- Consumes: `makeSolidPngWH`, `createSession`, `resolveFfmpeg`, `execFileSync` (all already in the smoke test file).

- [ ] **Step 1: Add the failing test**

Append inside the existing `describe.skipIf(!ffmpeg || !ffprobe)("ffmpeg pipeline smoke", ...)` block:

```js
it("encode is colour-faithful: a decoded frame matches the encoded source within codec tolerance", () => {
  const W = 64, H = 64, RGB = [200, 40, 40];
  const frame = makeSolidPngWH(W, H, RGB);
  const session = createSession({ width: W, height: H, fps: 10, tmpRoot: os.tmpdir() });
  for (let i = 0; i < 10; i++) session.writeFrame(i, frame);
  const out = session.finalize({ ffmpeg, codec: "h264" });

  // Decode the middle frame back to raw RGB and compare to the source colour.
  const raw = execFileSync(
    ffmpeg,
    ["-v", "error", "-i", out, "-vf", "select=eq(n\\,5)", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { maxBuffer: 1 << 24 }
  );
  expect(raw.length).toBe(W * H * 3);
  let sum = 0;
  for (let i = 0; i < raw.length; i += 3) {
    sum += Math.abs(raw[i] - RGB[0]) + Math.abs(raw[i + 1] - RGB[1]) + Math.abs(raw[i + 2] - RGB[2]);
  }
  const meanDiff = sum / raw.length;
  // h264 4:2:0 introduces a few levels of chroma error; a faithful encode stays well under this.
  expect(meanDiff).toBeLessThan(10);
  fs.rmSync(out, { force: true });
});
```

> If `session.finalize(...)` has a different signature in this repo, match the call already used by the sibling `encodes a h264 mp4…` test in the same file (read it first) — the encode invocation must be identical to the existing tests, only the decode-and-compare is new.

- [ ] **Step 2: Run the test**

Run: `npx vitest run electron/__tests__/ffmpeg-pipeline.smoke.test.js`
Expected: PASS (skips cleanly if ffmpeg is absent; on this machine ffmpeg is at `/opt/homebrew/bin/ffmpeg`, so it runs and passes).

- [ ] **Step 3: Commit**

```bash
git add electron/__tests__/ffmpeg-pipeline.smoke.test.js
git commit -m "parity: ffmpeg encode-fidelity spot-check (decoded frame ≈ source within codec tolerance)"
```

---

### Task 5: Phase 2 — feature-correctness pass

**Files:**
- Create: `docs/parity/FEATURE-CHECKLIST.md`
- Modify: any component(s) with a confirmed dead/half-wired control or state gap (one fix per commit)

**Interfaces:**
- Consumes: the Phase 1 results (Task 3), the live app.

> Manual/controller-driven. The deliverable is the checklist + fixes for genuine defects only (no churn on working controls).

- [ ] **Step 1: Inventory the interactive surface**

List every interactive control / toggle / panel across: top bar, tab strip, left (Capture/Presets/Settings), right (Effect Stack + all effect panels: Color, Display/CRT, Tape, Film, Digital, Sensor/Lens, Meta-Aging, Audio-Reactive, OSD), Masks painter, Preview controls + transport + mini-timeline, Export dialog + queue, command palette, theme/density. Record each in `docs/parity/FEATURE-CHECKLIST.md` with a status column.

- [ ] **Step 2: Verify each control**

For each control verify three things and mark status (`works` / `dead` / `half-wired` / `state-gap`): (1) it changes the render or app state; (2) its effect survives export (cross-check Task 3); (3) enabled/disabled/empty/loading states are correct and explained (e.g. the gated "Master" export chip should say why it's disabled).

- [ ] **Step 3: Fix genuine defects**

For each `dead` / `half-wired` / `state-gap` finding, fix it in the owning component and commit individually (`fix: <component> — <what was wrong>`). Keep the 96 tests green + tsc clean after each. Do NOT change working controls.

- [ ] **Step 4: Commit the checklist**

```bash
git add docs/parity/FEATURE-CHECKLIST.md
git commit -m "parity: phase-2 feature-correctness checklist (status per control)"
```

---

### Task 6: README + final verification

**Files:**
- Create: `docs/parity/README.md`

**Interfaces:**
- Consumes: all prior tasks.

- [ ] **Step 1: Write `docs/parity/README.md`**

Document the repeatable method: the parity bar (determinism hard, parity soft at Δ6/Δ12), the frame sample set `[0,1,7,15,29]`, the exact sweep command (paste `tools/parity/parity-sweep.snippet.js` while `npm run dev` runs; read `window.__parityResults`), how to run the in-app parity check, the encode spot-check (`npx vitest run electron/__tests__/ffmpeg-pipeline.smoke.test.js`), and the loop (sweep → fix-list → fix → re-sweep). Link every artifact (`PARITY-FIX-LIST.md`, `coverage.md`, `FEATURE-CHECKLIST.md`, `src/lib/parity/sweep.ts`, `src/lib/export-validator.js`). Note this sweep is the pass/fail harness Epic 6 (GPU port) will reuse.

- [ ] **Step 2: Final test sweep**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass (96 existing + 6 parity helper + 1 encode spot-check), tsc clean.

- [ ] **Step 3: Commit**

```bash
git add docs/parity/README.md
git commit -m "parity: README — repeatable export-parity sweep method + Epic 1 artifacts"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-06-27-epic1-...-design.md`):
- "Frame-accurate determinism + parity" → Task 1 (helpers), Task 2 (determinism sweep), Task 3 (run + parity subset). Frame set `[0,1,7,15,29]` in Task 1.
- "Two layers (renderer-level / encode-level)" → renderer-level = Tasks 2–3; encode-level = Task 4 (ffmpeg decode-compare).
- "Phase 2 deep feature pass" → Task 5 (`FEATURE-CHECKLIST.md` + fixes).
- "Artifacts under docs/parity, tools/parity, src/lib/parity" → Tasks 1–6.
- "Reuse export-validator, don't duplicate" → Task 1 exports its primitives; harness imports them.
- "PARITY-FIX-LIST + coverage tracker + README" → Tasks 3, 6.
- "Done criteria (parity clean or fix-listed; encode spot-check; no dead controls; tests green)" → Tasks 3, 4, 5, 6.
- Boundaries (authenticity=Epic 3, OSD rebuild=Epic 2) → Global Constraints.

**Placeholder scan:** code steps contain full code; the one runtime unknown (exact `session.finalize` signature in Task 4) is called out with the concrete fallback ("match the sibling test in the same file"). Tasks 3 & 5 are operational by nature (run the live app, author findings) and specify exact commands + the exact artifact contents required.

**Type consistency:** `ParityResult` / `classifyParityResult` / `coverageSummary` / `SAMPLE_FRAMES` defined in Task 1 are used unchanged in Tasks 2–3; `comparePixels` / `renderCpuFrame` / `readPixels` names match `export-validator.js`; the `render(ctx,w,h,seconds,params,frameIndex,fps,renderOptions)` signature matches the renderer used in Tasks 2/4.
