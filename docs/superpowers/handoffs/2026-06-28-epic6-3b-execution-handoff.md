# Epic 6.3b — Execution Handoff (start here, new session)

**Resume at:** `docs/superpowers/plans/2026-06-27-epic6-3b-screenspace-quantization.md`, **Task 2
continuation** — burnIn is DONE; next are restoration → mediaAging → generationLoss/copyGen
(the hard iterative ones) → macroBlocking/quantization (Task 4) → gate+sweep (Task 5).
Spec: `docs/superpowers/specs/2026-06-27-epic6-3b-screenspace-quantization-design.md`.
Skill: `superpowers:executing-plans` (inline — GPU-runtime-verified; subagents can't drive the preview).

## State at handoff
- `main` @ `98fe78f`, in sync with `origin/main`. Working tree clean (ignore untracked `HANDOFF.md`, pre-existing).
- **153 tests green, `tsc` clean, `vite build` clean.** Parity sweep still 455/455 (export untouched).
- **34 presets routed to WebGPU, `allowedFailing: []`** (the soundness invariant — must stay empty).
- Done so far in 6.3b: Task 1 uniforms (`aacb21a`); Task 2 burnIn + chain extension (`98fe78f`).

## The big picture (read once)
Epic 6 GPU port. SHIPPED: 6.1 (display family), 6.2 (per-pixel signal core + emulated-f64 noise),
grain/mask fixes, 6.3a (ping-pong post-process foundation + ghosting/focusBreathing/frameStutter/
exposurePump/whiteBalanceDrift/6 exotic masks), 6.3b-partial (burnIn). The classics are each blocked
by ~10 co-occurring effects, so **6.3b unlocks ~0 NEW presets until quantization AND OSD are also done**
(back-loaded — see the blocker analysis in `docs/gpu/SIGNAL-FIDELITY.md` + the roadmap memory). The
single biggest unlock is **6.3c OSD (+29 → 85 presets)**, which is also the hardest (glyph rendering).
So 6.3b is groundwork: port the effects correctly, keep the gate sound, ship per effect.

## The architecture (how the ping-pong chain works)
Pipeline order in `webgpu-backend.ts render()`:
```
grade → tGraded → optics → tOptics
   → ghost(in tOptics, sharp tOptics) → tPpA
   → burnIn(in tPpA, sharp tOptics) → tPpB
   → focus(in tPpB) → tPpA            ← tPpA is now T_filtered
   → blurH(in tOptics) → tH           ← bloom GLOW blurs T_optics (CPU blurs the pre-chain workCanvas!)
   → composite(in tH, sharp tPpA) → canvas   ← bloom BASE is T_filtered (tPpA)
```
**Each new chain filter you add shifts the ping-pong alternation** (tPpA↔tPpB) AND therefore which
texture is final (T_filtered) AND the `bgComposite` sharp binding AND `bgFocus`'s input. Trace it
each time. Filters are PASSTHROUGH in-shader when their uniform is ~0, so the chain stays a perfect
no-op for 6.2 presets (Consumer CRT TV must stay 0.98 — your regression check). `fs_ghost`/`fs_burnIn`
read TWO textures (running + tOptics) via `layoutComposite`; single-input filters use `layout3`.

**Iterative filters (generationLoss/copyGen) DON'T fit one pass** — each CPU dub pass reads the
previous full frame (blur+saturate+contrast at ±shift), so you need **N ping-pong passes**, one per
dub iteration, with the per-iteration params (shift/sat/con/blur, functions of `i` and the amount)
passed per pass. Either (a) a small fixed max number of passes (CPU caps dubPasses≤4, copyGen≤6) with
a per-pass "iteration index" uniform and passthrough when `i >= dubPasses`, or (b) unroll. This is the
fiddliest part of 6.3b — budget for it.

**Resolution reduction (macroBlocking, quantization, Task 4)** needs a low-res render target: render
the running result into a `width/blockSize × height/blockSize` texture (linear filter ≈ canvas box
downscale), then sample it back upscaled. macroBlocking = nearest upscale composite at alpha. quant =
level-quantize + (when amount>0.18) an 8×8 DCT block-edge grid + mosquito ringing. **The canvas
`drawImage` downscale filtering is browser-specific — matching < 6 is genuinely uncertain; if you can't,
gate that effect to CPU and record it** (the established pattern — see grain/irBloomSpeckle).

## Live gotchas (these save hours — learned the hard way)
1. **GPU CACHING IS THE #1 TIME-SINK.** After ANY `.wgsl` edit you MUST: `rm -rf node_modules/.vite`
   → `preview_stop` → `preview_start({name:"build-together"})` → measure on a FRESH page. vite caches
   the `?raw` transform AND the browser caches the shader module across `preview_eval`s.
   **Statistically-identical mean-err across "changes" = you're measuring a STALE shader.** (Don't
   trust `import('....wgsl?raw')` from a console eval — it returns a ~110-char stub; `fetch(...?raw)`
   + `device.createShaderModule(...).getCompilationInfo()` is how you read real WGSL compile errors.)
2. **`tsc` is NOT the build** — run `npx vite build` (swc catches things tsc misses). Backend `create()`
   returns null on a WGSL compile error → everything silently falls back to CPU; check compile info.
3. **WGSL reserved keywords** can't be identifiers — `active` bit us; pick defensive local names.
4. **Noise parity:** emulated-f64 `seededNoise` (`noise.wgsl`/`seeded-noise-f32.ts`) — `twoProd` MUST
   use `fma()` (GPU FMA contraction corrupts the Dekker error term). Any per-pixel noise with a
   NON-INTEGER coefficient diverges (grain, irBloomSpeckle) — mod-2π coefficient reduction (exact for
   integer pixel coords) shrinks the arg and helps, but it's still not bit-exact (GPU double-f32
   addition limit). Gate by amplitude / to CPU when it can't clear < 6.
5. **maskType default = `phosphor`** (CPU defaults an unset maskType to phosphor, NOT none) — already
   fixed in `buildSignalUniforms`; don't regress it. `u_quantization` already exists from 6.2.
6. **The fidelity gate is `gpuSignalOK` in `crt-renderer-hybrid.js`.** Add a new effect to
   `WEBGPU_SIGNAL_SUPPORTED` (or a mask to `WEBGPU_SUPPORTED_MASKS`) ONLY after the sweep shows it
   clears < 6. Re-run the sweep; `allowedFailing` MUST stay `[]` (that's the whole safety property).
7. **The sweep:** `tools/gpu-coverage.snippet.js` → `window.__signalSweep`, or the inline pattern used
   all session: build the test image, iterate DISPLAY_PRESETS + the 91 classics, `gpuSignalOK`-filter
   to the allowed set, render CPU `render()` vs `backend.render()` + `await backend.flush()` +
   re-`drawImage(backend.outputCanvas)` (race-free), mean per-channel diff, check `allowedFailing`.
   Preset isolation (the workhorse): zero/keep individual params to find the offending effect.
8. **Preview:** name `build-together`, port 5176. **Warm modules first** (tiny `await import(...)` eval)
   — the first import triggers a slow vite compile that times out the first real eval. **Chunk** sweeps
   (~10 presets/eval) past the 30 s `preview_eval` cap; persist state on `window.__*`.
9. **Determinism / export:** renderer noise = `seededNoise` only (no Math.random/Date.now/perf.now).
   Export forces `preferGPU=false` so the WebGPU branch is bypassed → CPU path → parity 455/455. Verify
   export bit-identical (preferGPU off, two renders, maxDiff 0) in the final live check.
10. **Bash cwd resets after a 2-min timeout** (the shell respawns from profile at `/Users/ben`, NOT the
    project) — if a long command times out, `cd /Users/ben/Projects/build-together-desktop` before the
    next command (node_modules will look "missing" otherwise — it's just the wrong cwd).
11. **frameStutter:** temporal terms use `u_temporalFrame` (stuttered); gate offsets use `u_frameIndex`
    (real). Don't conflate. exposurePump/whiteBalanceDrift are pointwise in `fs_composite` after flicker.

## Per-effect CPU source (port to match)
`src/lib/crt-renderer-full.js`: burnIn ~901–917 (DONE), generationLoss ~927–937, copyGen ~942–957,
mediaAging ~960–1007 (yellow multiply + desat/contrast/brightness blur + lifted-black screen + speckle
dust via a mulberry RNG seeded `frameIndex*2654435761` — reproduce deterministically or gate),
restoration ~1010–1025, macroBlocking ~1115–1130, quantization ~1133–1180 (resolution + level + DCT grid
+ mosquito ringing when >0.18). Helper already in the shader: `csFilter(c, grayscale, brightness, contrast)`
+ `screenBlend(a,b)`. CSS filter order = grayscale → brightness → contrast → clamp.

## After 6.3b
6.3c = OSD on GPU (timestamp + style glyph rendering — the +29 unlock, hardest; Epic 2 built `renderOSD`
on CPU). 6.3d = NTSC/PAL format composite (encode→decode, via `renderOptions.formatProfile`) + the long
tail. datamosh/pixel-sort stay CPU forever. Apple Dev-ID signing/notarization is the real v2 ship-gate
(owner's non-coding task). Roadmap memory `[[lost-media-v2-roadmap]]` has the full state.
