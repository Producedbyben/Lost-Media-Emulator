# Export Parity & Function-Correctness (Epic 1)

The repeatable method that proves **what you see in preview is what you get in export, at any frame**,
and that no control is dead or half-wired. Part of the v2 roadmap, Track Q.

## The parity bar

- **Determinism (hard pass):** a forced-CPU export frame, rendered twice from a clean `reset()`, must
  be **byte-identical**. A failure means the export is not reproducible (carried inter-frame state,
  unseeded randomness, or wall-clock timing).
- **Preview↔export parity (soft pass):** an export-path CPU render vs the live preview pixels, within
  `Δmean ≤ 6` (CPU preview) / `≤ 12` (GPU preview). The CPU path is the authoritative baseline.
- **Temporal coverage:** frames are sampled at `[0, 1, 7, 15, 29]` to exercise animated effects
  (line-jitter, dropouts, flicker, wow/flutter, head-switching, frame-stutter, OSD timestamp).

## Run the sweep

1. Start the app: `npm run dev` (port 5176).
2. Paste `tools/parity/parity-sweep.snippet.js` into the devtools console (or eval it via the preview
   tooling). It renders every preset × the sampled frames twice and prints
   `"<clean>/<total> clean"`, stashing full results on `window.__parityResults`.
   - Note: the full sweep is ~900 CPU renders; if run via a time-limited eval, process the presets in
     slices (the snippet loops all presets in one paste in a normal console).
3. Preview↔export parity (soft, per-family subset): load a look in the app and click
   **"Validate export ↔ preview"** in the Export dialog (reuses the same `export-validator.js`).
4. Encode-level spot-check: `npx vitest run electron/__tests__/ffmpeg-pipeline.smoke.test.js`
   (the *colour-faithful* test decodes an encoded frame and compares it to the source within codec
   tolerance).

## The loop

`sweep → PARITY-FIX-LIST → fix (determinism failures first) → re-sweep`. Re-run the sweep after any
change to the render path; this is also the pass/fail harness the Epic 6 GPU port will reuse.

## Artifacts

- `PARITY-FIX-LIST.md` — prioritized parity defects (currently: all 4 determinism failures fixed).
- `coverage.md` — sweep coverage (455/455 deterministic after the `reset()` fix).
- `FEATURE-CHECKLIST.md` — Phase 2 feature-correctness status per control group.
- `tools/parity/parity-sweep.snippet.js` — the in-app determinism sweep harness.
- `src/lib/parity/sweep.ts` — pure helpers (`SAMPLE_FRAMES`, `classifyParityResult`, `coverageSummary`).
- `src/lib/export-validator.js` — `validateExportAgainstPreview` + the reusable `comparePixels` /
  `renderCpuFrame` / `readPixels` primitives.

## Result (2026-06-27)

First sweep: 451/455 clean (99.1%). The 4 failures were determinism in the glitch family (datamosh /
bit-rot / satellite / Vine reupload) — `reset()` wasn't clearing the datamosh inter-frame feedback, so
exports were non-reproducible and preview-dependent. Fixed (commit `cd9d5ed`); re-sweep → **455/455
deterministic**. No dead/half-wired controls found (Phase 2). Scope: Epic 1 proves export *matches*
preview; effect *authenticity* is Epic 3 (`docs/audit/FIX-LIST.md`), the OSD *rebuild* is Epic 2.
