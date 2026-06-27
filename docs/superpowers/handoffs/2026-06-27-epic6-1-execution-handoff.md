# Epic 6.1 — Execution Handoff (start here, new session)

**Resume at:** Task 2 of `docs/superpowers/plans/2026-06-27-epic6-1-wgsl-effects-core.md`
(spec: `docs/superpowers/specs/2026-06-27-epic6-1-wgsl-effects-core-design.md`; strategy: `docs/GPU-PORT-PLAN.md`).

**Skill to use:** `superpowers:executing-plans` (this is a GPU-runtime-iterative increment best driven
inline with the preview tooling) — or subagent-driven if you prefer, but Tasks 2/3/5/6 are
controller-verified (WebGPU can't run in jsdom), so inline is the natural fit.

## State at handoff
- `main` @ `cffbc5c`, in sync with `origin/main`. Working tree clean (ignore untracked `HANDOFF.md`, pre-existing, not ours).
- **140 tests green, `tsc` clean, `vite build` clean.**
- All fork worktrees/branches cleaned up; only `main` exists.
- **Task 1 DONE** (commit `cffbc5c`): `src/lib/effects-core/` started — `seeded-noise-ref.ts`, `noise.wgsl`, `param-map.ts`, all TDD'd.

## v2 context (one paragraph)
Epics 0–5 (the v2 quality milestone) are SHIPPED. Epic 6 (GPU engine leap) is v2.x; the owner delegated
the foundation decision → **portable WGSL shader core driven via WebGPU**, family-by-family, fidelity-gated,
WebGL2→CPU fallback. Epic 6.1 = stand up the core + flip the **CRT/display family** to GPU. The real v2
ship-gate is Apple Dev-ID signing/notarization (owner's non-coding task) — unrelated to this work.

## The contract that ties it together
`CRT_DISPLAY_UNIFORMS` (in `src/lib/effects-core/param-map.ts`) is the SINGLE source of truth for uniform
order. The WGSL uniform struct in `crt-display.wgsl` (Task 2) and the uniform-buffer write in
`webgpu-backend.ts` (Task 3) MUST match it field-for-field. Mask codes: none0 / dot1 / aperture2 / slot3 /
shadowMask4. Mono codes: none0 / green1 / amber2 / blue3.

## Gotchas discovered live (these save hours)
1. **Port source for the WGSL fragment shader (Task 2):** `src/lib/crt-renderer-gpu.js` is the existing
   WebGL2 GLSL shader — it ALREADY implements scan/mask/barrel/bloom/ca/grade/flicker/vignette/monoTint
   against matching uniforms. Port its fragment logic to WGSL; don't invent from scratch. The authoritative
   math (to match for fidelity) is in `src/lib/crt-renderer-full.js` (CPU) — esp. the mask branches
   (~line 616): `aperture` = vertical `maskX%3` RGB stripes (Trinitron), `dot`/`shadowMask` = 2D grid.
2. **`tsc` is NOT the build.** `npx tsc --noEmit` passed a JSX-in-object syntax error this session that
   `vite build` (swc) caught. **Always run `npx vite build` before claiming a UI/integration task done.**
3. **WebGPU is available in the runtime** — verified: `navigator.gpu` + adapter + compute (maxTexture 16384,
   workgroups 65535); WebGL2 fallback present. `WebGPUBackend.create()` must still return `null` gracefully
   when absent (other machines).
4. **The fidelity sweep overflows a single `preview_eval`** (30s limit; ~900 CPU renders). Run it in CHUNKS:
   set up renderer+source+results on `window.__X` once, then process ~10 presets per eval, accumulate. (Same
   pattern used for the Epic 1 parity sweep — see how that was driven.) Use a small render size (e.g. 240×180)
   for speed; mean-err is resolution-robust enough for the <6 gate, but confirm a couple at full size.
5. **First dynamic `import()` in preview triggers a slow vite first-compile** that can time out the first
   eval. Warm modules with a tiny `await import(...)` eval first, then run the real work.
6. **Preview server:** name `build-together`, serves on **port 5176** (the project `.claude/launch.json`
   port is ignored — the preview MCP uses a global config). `preview_start({name:"build-together"})`.
7. **Determinism / parity guardrails:** renderer noise must be `seededNoise` only — never
   `Math.random`/`Date.now`/`performance.now` (breaks the Epic 1 export-parity guarantee). **Export stays on
   the CPU path** — Epic 6 accelerates PREVIEW only. After any change, the Epic 1 determinism sweep
   (`docs/parity/`, `tools/parity/parity-sweep.snippet.js`) must still be 455/455 (it will be — GPU doesn't
   touch export — but spot-check).
8. **Render-to-2D-ctx contract:** the hybrid's `render(outCtx, ...)` gives a 2D context. WebGPU renders to its
   OWN canvas, then `outCtx.drawImage(webgpuCanvas, ...)` — same trick the WebGL2 renderer uses (read how
   `crt-renderer-gpu.js` lands its result into the 2D ctx and mirror it).
9. **Hybrid source frame:** the WebGPU backend needs the current source image to texture. See how
   `crt-renderer-hybrid.js` receives/holds the source (`setImage`) and pass that same image to the backend.
10. **`?raw` import for the WGSL** (`import shader from './crt-display.wgsl?raw'`). Check
    `node_modules/@webgpu/types` exists before adding it to devDeps (only add if missing).

## The Task 2→6 arc (what "done" looks like)
- T2: author `crt-display.wgsl` (port from the GLSL; uniform struct = `CRT_DISPLAY_UNIFORMS` order).
- T3: `webgpu-backend.ts` — `create()`/`render()`/`dispose()`, null-on-unavailable, render→2D ctx. `tsc`+`build` clean.
- T4: `crt-renderer-hybrid.js` — prefer WebGPU for the CRT/display family (`gpuFamilyOK`) with WebGL2→CPU
  fallback; `activeMode="webgpu"`. Suite green with backend null (no regression).
- T5: extend `tools/gpu-coverage.snippet.js` to WebGPU-vs-CPU; **iterate `crt-display.wgsl` until every
  CRT/display preset is <6 mean-err** (this is the real work — scan/mask/grade geometry are the usual
  mismatch sources). Record `docs/gpu/CRT-DISPLAY-FIDELITY.md`.
- T6: live-verify `activeMode==="webgpu"` + smooth playback (no 525ms stall) for a CRT/display preset;
  confirm fallback (force backend null) and that non-CRT presets still route CPU; export still CPU.
  Final `vitest`+`tsc`+`build` green.

## Boundaries (don't drift)
CRT/display family ONLY this increment. Inter-frame effects (datamosh P-frame feedback, pixel-sort) stay
CPU forever. No UI rewrite. Other families = later Epic 6 increments (each its own spec→plan reusing this core).

## Open minor follow-ups (not blocking; pick up anytime)
- Plasma burn-in: make the retained ghost a DISTINCT persistent image (logo/UI bug), not a ghost of the
  current frame (`burnInGhost` in `crt-renderer-full.js`). (Aerochrome green→red already fixed.)
- Audio: sync-to-trim toggle (fades cover the manual need today); a real EAR pass on the degrade (owner —
  the DSP is deterministic + unit-tested + mux-smoke-tested, but nobody has listened).
- CEP panel (`~/Projects/lost-media-premiere-cep`) is NOT git-tracked — `git init` it for versioning.
