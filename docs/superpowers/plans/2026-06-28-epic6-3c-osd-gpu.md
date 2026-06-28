# Epic 6.3c — OSD on GPU — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline; GPU-runtime-verified).

**Goal:** Route the OSD (timestamp / style) presets on WebGPU at fidelity (< 6 vs the CPU
`render()`), unlocking the largest single block of classics blocked only by OSD.

## Design decision (why not GPU glyph rendering)

The CPU burns the OSD into the **source after grade, before optics** (`crt-renderer-full.js`
~466-467: `renderGrade(fitCtx)` → `renderOSD(fitCtx)`), so the display optics ride over it.
The OSD is canvas-rendered text (10 styles, procedural bitmap + 7-segment + bundled OFL fonts,
shadows, blink). **True GPU glyph rendering can never match canvas-text antialiasing to < 6.**
The only faithful path is to **CPU-render the OSD onto a transparent overlay and composite it on
GPU between grade and optics** — the OSD pixels are then *identical* to the CPU, and the
expensive per-pixel optics still runs on GPU (the OSD text draw is ~µs). `renderOSD` is pure
source-over, and source-over compositing is associative, so `over(tGraded, osdLayer)` equals the
CPU drawing the OSD directly onto the graded source.

## Architecture

`grade → tGraded → **osd(tGraded, osdTex) → tGradedOsd** → optics → …`. The hybrid (which holds
`renderOptions`) renders the OSD onto a scratch transparent canvas via `cpuRenderer.renderOSD`
and passes it to `backend.render(…, osdSource)`; the backend uploads it to `osdTex` and the new
`fs_osd` pass source-over-composites it over `tGraded`. `u_osdActive` (set by the backend from
`osdSource != null`) makes `fs_osd` a byte-exact passthrough when off (6.1/6.2/6.3a/b unchanged).

## Tasks

### Task 1 — fs_osd pass + backend wiring (runtime-verified)
- `param-map.ts`: append `u_osdActive` to `CRT_SIGNAL_UNIFORMS` (default 0).
- `crt-display.wgsl`: add `u_osdActive` to the struct + `fs_osd` (reads tGraded[2] + osdTex[3];
  source-over; passthrough when `u_osdActive < 0.5`).
- `webgpu-backend.ts`: `osdTex` + `tGradedOsd` textures, `osdPipeline` (layoutComposite,
  INTERMEDIATE_FORMAT), `bgOsd`; optics reads `tGradedOsd`; `render(…, osdSource?)` uploads
  osdSource→osdTex + sets `u[I_OSD_ACTIVE]`; encode the osd pass after grade. Validate the
  source-over blend formula (straight vs premultiplied alpha) empirically.

### Task 2 — hybrid integration + gate
- `crt-renderer-hybrid.js`: in `render()`, when routing webgpu + `advancedTimestampOSD` active,
  render OSD onto a scratch WxH transparent canvas (`cpuRenderer.renderOSD`) and pass to
  `backend.render(…, osdSource)`. Remove the `advancedTimestampOSD > 0.01 → CPU` gate; add
  `advancedTimestampOSD`, `advancedOSDStyle` to `WEBGPU_SIGNAL_SUPPORTED`.

### Task 3 — sweep + verify + record
- Full-catalogue sweep WITH OSD rendered (scratch renderOSD passed to the backend), same
  renderOptions on both sides. `allowedFailing` MUST stay `[]`. Record the routed count + the
  OSD unlock. Live: an OSD preset routes webgpu; export bit-identical (parity 455/455). Update
  `docs/gpu/SIGNAL-FIDELITY.md`. Commit per task; push after each.

## Constraints

Keep the 153 tests green + tsc + `vite build` clean. GPU caching: `rm -rf node_modules/.vite`
+ preview restart + fresh page per `.wgsl` edit. No `npm run dist` / R2.
