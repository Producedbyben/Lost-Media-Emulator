# Per-pixel Signal Core — WebGPU Fidelity Sweep (Epic 6.2)

**Date:** 2026-06-27
**Harness:** `tools/gpu-coverage.snippet.js` → `window.__signalSweep` (run live via the preview
tooling; WebGPU needs the GPU + a canvas).
**Reference:** the authoritative CPU `CRTRendererFull.render()`.
**Metric:** mean per-channel abs difference over a 640×480 render of the standard test image,
frame 0 / 30 fps.
**Gate:** a preset flips to WebGPU only when mean-err **< 6** vs CPU AND the hybrid's
`gpuSignalOK()` allows it. `gpuSignalOK` must allow EXACTLY the < 6 set.

## Result: 21/21 routed presets pass; zero false positives

Swept the display building blocks (`DISPLAY_PRESETS`, prefix `D:`) + the full classics
catalogue (`PRESETS`, prefix `C:`). Every preset `gpuSignalOK` routes to WebGPU is < 6
(**allowedFailing: []**). The per-pixel signal core lifts the routed display family from 12
(Epic 6.1) to 17 — the previously-deferred scanline-profile / subpixel / pixelSize presets
now flip — plus 4 classics.

### Routed to WebGPU (gate = allow, all < 6)

| Preset | mean-err |
|---|---:|
| D:E-Paper Display | 0.01 |
| D:IMAX Large-Format Screen | 0.59 |
| D:Direct / No Display | 0.61 |
| D:Handheld LCD Screen (subpixel RGB) | 0.62 |
| D:Handheld Pixel LCD (Game Boy) | 0.77 |
| D:Cinema Projector | 0.86 |
| D:Consumer CRT TV | 0.98 |
| C:Retro Pixel LCD | 1.11 |
| D:Shadow-Mask Amber Terminal | 1.41 |
| D:Trinitron WEGA | 1.45 |
| D:Rear-Projection CRT | 1.47 |
| D:Portable Pocket TV (scanline-profile soft) | 1.49 |
| D:PAL Living-Room TV | 1.54 |
| D:Arcade Monitor | 1.90 |
| C:Arcade | 1.92 |
| C:Consumer TV | 2.04 |
| C:PVM/BVM | 3.32 |
| D:PVM/BVM Monitor | 3.34 |
| D:Stadium Jumbotron (pixelSize 2 + soft + RGB) | 4.25 |
| D:LED Billboard (pixelSize 2 + RGB) | 4.64 |
| D:CRT Viewfinder (pixelSize 2 + hard) | 5.77 |

### What the per-pixel core covers (isolated single-effect verification, mean-err)

grade gamma/contrast/sat 0.12–0.21 · IR false-colour 0.12 · haze 0.12 · black-crush 0.14 ·
monoTint 0.08 · timebase wobble 0.02 · line jitter 0.47 · head-switching 1.37 · chroma delay
0.64 · cross-color 0.02 · dropouts 0.40 · interlacing 0.01 · film dust 1.46 · film scratches
2.99 · halation 0.01 · Bayer dither 0.04 · scanline profile 0.16–0.23 · subpixel layout 0.23 ·
cctv-mono 0.76–1.21. **All < 6.**

## Deferred / kept on CPU (by `gpuSignalOK`, deliberately)

- **Film grain** — `advancedFilmGrain`/`grainSize`/`grainChromaticity`. The grain noise
  argument (`x*gf`) is large-magnitude and non-integer; the emulated-f64 hash reaches
  bit-parity for the low-magnitude geometric/temporal noise (jitter/dropouts/head-switch all
  matched ≤ 1.4) but NOT at grain's argument magnitude (~67k) on this GPU's float behaviour
  (FMA contraction / reassociation that strict-IEEE node can't reproduce). Grain-low (0.15)
  measures 4.29; grain-mid (0.35) 10.0. Rather than render uncorrelated grain, grain presets
  stay on CPU. Candidate future fix: upload a CPU-computed grain tile, or revisit in 6.3.
- **Color quantization** (`advancedQuantization`) — multi-pass on CPU (resolution
  downscale/upscale + 8×8 DCT block grid), not pointwise → Epic 6.3.
- **Multi-pass effects** — format-authenticity pre-pass (resolution + NTSC/PAL composite),
  ghosting/persistence, generation loss, copy generation, burn-in, focus breathing, media
  aging, restoration, macroblocking, nitrate decay, technicolor fringe, neon wide-bleed →
  Epic 6.3.
- **Inter-frame effects** — datamosh (P-frame feedback), pixel-sort (sequential) → CPU forever.
- **Exotic display masks** — `lcdStripeRGB`, `oledPentile`, `plasmaCell`, and the capture
  sensor masks (`lowBitrateBlockGrid`, `cmosRollingColumn`, `filmSuper8`, `film16mm`,
  `irBloomSpeckle`, `fisheyeMicrolens`, …) not implemented → CPU (later increments).
- **OSD** (`advancedTimestampOSD`) → CPU.

The gate is **conservative**: a handful of rejected presets (e.g. IPS Office LCD at 5.69,
DSLR Video 2010 at 1.81) would land < 6, but they rely on a mask geometry or a grain/quant
effect we don't faithfully reproduce, so we don't route them — we never claim a look the
shader can't render. This keeps `allowedFailing` empty.

## Notes

- Export is unaffected — it forces `preferGPU = false`, so the WebGPU branch is bypassed and
  the deterministic CPU path runs; the Epic 1 parity sweep stays 455/455.
- GPU is perceptual-parity (f32) to CPU (f64) — within the < 6 bar.
- Why the classics flip rate is low (4/88): the classics are deliberately rich multi-effect
  looks (grain + OSD + exotic masks + multi-pass), most of which are deferred to 6.3 / gated.
  The per-pixel core itself is broad (grade + ~all per-pixel artifacts, verified above); the
  building-block display family flips 17/24.
