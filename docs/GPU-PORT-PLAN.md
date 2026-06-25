# Lost Media Emulator — Path to an "Adobe-level" engine

## TL;DR

The app's value is the **effect suite**, not the shell. The single highest-leverage
investment — required no matter which future you pick (standalone, native, or Adobe
plugin) — is to **author every effect as a GPU shader with a fidelity test**, producing
one portable shader core. Build that core inside the current app first (cheapest place
to validate), then target it to a native shell and/or an Adobe/OFX plugin.

## The measured reality (why this matters)

Ran a GPU-vs-CPU fidelity sweep across all 91 presets (`tools/gpu-coverage.snippet.js`):
render the same frame on the authoritative CPU pipeline and the WebGL2 shader, diff them.

| Result | Count |
|---|---|
| GPU faithfully reproduces the look (mean err < 6 / 255) | **1** (the neutral preset) |
| Close (6–20) | 0 |
| Materially different (≥ 20, up to 118) | **90** |

**The GPU path is effectively decorative for real content.** The `_gpuCanHandle` gate
routes ~every real preset to the CPU to protect fidelity — which is exactly why real-preset
playback always hit the 525 ms/frame CPU path and froze. "Turning on GPU" can't help until
the shader actually implements the looks.

This is the real work to reach Adobe-level, and it's the same work regardless of language.

## Effect classification (from the code)

~106 parameters; ~30 distinct effects. Crucially, **most are GPU-portable**:

- **Per-pixel, frame-deterministic (≈80%) — fragment-shader-friendly.** scanlines, phosphor
  mask (+ `maskScale`, slot/aperture types), barrel/vignette, bloom, chroma aberration,
  grading, noise, RF interference, interlacing, film grain, quantization, generation loss,
  head-switching, chroma delay, cross-color, dropouts, tape crease, weave, exposure pump,
  white-balance drift, focus breathing, macroblocking, OSD. These are functions of
  `(x, y, frameIndex, seededNoise)` — they port to GLSL/WGSL with exact parity.
- **Multi-pass (needs ping-pong framebuffers) — moderate.** bloom done right, persistence/
  ghosting, composite NTSC/PAL encode-decode, chroma subsampling.
- **Inter-frame / sequential — genuinely hard on GPU (keep on CPU or do as compute).**
  datamosh (P-frame feedback), pixel-sort (sequential per-row sort), temporal feedback.

So: ~80% becomes a single big fragment shader; ~15% needs a small multi-pass graph; ~5%
stays CPU/compute. That's a tractable, finite port — not an open-ended one.

## The fidelity workflow (the enabler)

`tools/gpu-coverage.snippet.js` is the safety net. Loop:
1. Pick a preset family (start with the closest: CRT / LCD / flat-panel).
2. Port its missing effects into the shader.
3. Re-run the sweep; the family's mean-error must drop below ~6.
4. Only then remove its `_gpuCanHandle` gate so it routes to GPU.

This guarantees the looks don't silently change — the whole reason fidelity matters here.

## Recommended stack (from scratch, "Adobe-level")

The shell language is secondary; pick the **shader core** first.

| Concern | Recommendation | Why |
|---|---|---|
| Effect core | **One shader language**: WGSL (`wgpu`) or MSL (Metal) | Author once; reuse across app + plugin |
| Cross-platform app | **Rust + `wgpu`** core, thin shell (Tauri/native) | WGSL → Metal/Vulkan/DX12; portable |
| Mac-only, max perf | **Swift + Metal + AVFoundation** | Zero-copy decode→Metal→ProRes encode; unified memory; the one thing Electron can't match |
| Preserve current UI now | **Electron + WebGPU compute** | Keep React/shadcn; no rewrite; ship today |

**Pick:** build the shader core as a standalone, tested library (WGSL). Drive it from the
current Electron app via WebGPU first (no UI rewrite, fixes the freeze for real). Promote to
a native Metal shell later only if you need ProRes/AVFoundation/App-Store; the shaders carry
over.

## The Adobe plugin alternative

Fastest route to *literally* Adobe-level, because you inherit their timeline, media engine,
color management, GPU pipeline, and export — and a paying pro audience.

- **After Effects / Premiere Effect SDK (C++)** — one effect plugin runs in **both** Pr and Ae,
  GPU-accelerated via the Mercury/Smart-Render path (Metal/CUDA/OpenCL). The correct home for
  CRT/VHS/film effects.
- **OpenFX (C++)** — write-once for **Resolve / Nuke / Vegas / Flame**. ⚠️ Premiere does *not*
  support OFX, so the Adobe pair needs Adobe's SDK; OFX broadens to the rest of the market.
- **UXP / CEP panels (JS)** — UI/automation only, **not** pixel effects. Your React skills apply
  to panels, not to the effect itself.

Reuse: the **shaders port** to the AE GPU SDK and OFX; the **algorithms** transfer; the React UI
does **not** (params become native effect controls). So the shader core is again the shared asset.

## Recommended sequence

1. **Now:** all-GPU the current app via WebGPU, family by family, gated by the fidelity sweep.
   Deletes the resolution-governor bandaid; real-time preview of every look. (Weeks.)
2. **Then:** factor the shaders into a standalone `effects-core` lib (WGSL + manifest + tests).
3. **Fork A (own the product):** wrap `effects-core` in a native Metal/Rust shell for ProRes
   export, App Store, smallest footprint.
4. **Fork B (reach pros):** wrap the same shaders in an AE/Pr Effect-SDK + OFX plugin.

Do 1–2 first; they're prerequisites for both forks and validate the engine before any big
native/plugin commitment.

## Rough effort (one strong dev)

| Milestone | Effort |
|---|---|
| All-GPU the current app (the 80% per-pixel + key multi-pass) | 1–2 months core, + long tail |
| Factor portable `effects-core` lib | ~2 weeks |
| Native Metal/Rust shell to parity | 6–12 months |
| First AE/Pr GPU effect plugin (hero look) | 4–8 weeks |
| Full plugin suite matching the app | a few months |
