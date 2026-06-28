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

## Live verification (Task 8, via the production `CRTRendererHybrid`)

Driven through the real `CRTRendererHybrid` at 1280×720, look = the "Consumer TV" classic
(capture + display + grade):

| Check | Result |
|---|---|
| Consumer TV routes to GPU | `activeMode === "webgpu"` ✓ |
| Per-frame time (WebGPU) | **3.4 ms** |
| Per-frame time (CPU, same look) | **467.8 ms** — the preview freeze, gone (~137×) |
| Fallback: WebGPU nulled | falls to WebGL2 (`"gpu"`) ✓ |
| Fallback: both GPU backends nulled | falls to CPU (`"cpu"`) ✓ |
| Non-routed look (grain 0.6 + datamosh) | routes to CPU ✓ |
| Export path (`preferGPU` off) | routes to CPU, **bit-identical** across renders (maxDiff 0) ✓ |

148 tests green, tsc + `vite build` clean. The CPU renderer and export path are untouched,
so the Epic 1 determinism sweep stays 455/455.

## Post-6.2 fixes (2026-06-27)

- **Grain parity (commit `07f8a1b`).** The grain hash coefficients (`gf*12.9898`,
  `gfy*78.233`) are now reduced **mod 2π on the CPU** — exact for integer pixel coords by
  sine periodicity — collapsing the GPU argument magnitude ~67k → ~400 where the emulated-f64
  hash works. Grain mean-err: 0.15 → 2.3, 0.35 → 5.4, chroma → 5.67 (was 4.3 / 10.0 / 9.2).
  Not bit-exact (residual GPU double-f32 *addition* error the `fma` fix can't reach), so
  `gpuSignalOK` caps grain at amplitude 0.3. **Unlocks 0 catalogue presets today** (grain
  co-occurs with other CPU-gated effects), but fixes the grain effect for manual grain on
  GPU-routed looks and is groundwork for Epic 6.3.
- **LCD/OLED/plasma display masks (commit `b43615b`).** Ported `lcdStripeRGB` (6),
  `oledPentile` (7), `plasmaCell` (8). Unlocks the 4 flat-panel display presets deferred
  earlier: IPS Office LCD **5.69 → 0.82**, OLED PenTile 0.76, Cyberpunk OLED 1.89, Pioneer
  Plasma 2.94.

**Routed set after fixes: 26** (was 21), `allowedFailing` still `[]` (worst 5.77 — CRT
Viewfinder). The display family is now essentially complete on GPU; the remaining classics
need the Epic 6.3 multi-pass tier.

## Epic 6.3a — multi-pass post-process foundation (2026-06-27)

Stood up the reusable **ping-pong post-process chain** (`T_optics → ghost → tPpA → focus →
tPpB → bloom`, passthrough when filters off so 6.2 is unchanged) and ported the highest-ROI
tractable effects: `frameStutter` (stuttered temporal frame, real frame kept for gate
offsets), `exposurePump`, `whiteBalanceDrift`, **ghosting**, **focusBreathing**, and 6 exotic
capture masks (`filmSuper8`, `film16mm`, `instantDyeCloud`, `cmosRollingColumn`,
`lowBitrateBlockGrid`, `fisheyeMicrolens`). Bloom's GLOW still comes from `T_optics` (the CPU
blurs the pre-chain workCanvas) while the composite BASE is `T_filtered`.

Isolated verification: frameStutter 0.24, exposurePump 0.33, whiteBalanceDrift 0.14, ghosting
0.13, focusBreathing 0.16–0.19, masks 0.01–2.84. **Routed set 26 → 34, `allowedFailing: []`**
(worst 5.77). Live: Off-Air Analog Broadcast routes webgpu @3 ms vs 517 ms CPU (~172×); export
bit-identical.

Two notable fixes found via the sweep:
- **`irBloomSpeckle`** stays CPU — its per-pixel speckle uses a non-integer noise coefficient
  (×0.31) that diverges on GPU (~7 mean-err), the grain class of problem.
- **maskType default** — an UNSET `maskType` defaults to `phosphor` on the CPU (not `none`);
  `buildSignalUniforms` was defaulting to `none`, dropping the mask on GPU for classics like
  Off-Air Analog Broadcast (11.25 → fixed). Now matches the CPU and the gate.

**Deferred to 6.3b+** (the remaining ~25-effect tail, mostly back-loaded — see the blocker
analysis): generationLoss, copyGeneration, macroBlocking, mediaAging, burnIn, restoration,
quantization (DCT), OSD (the single biggest unlock, +29), NTSC/PAL format composite, and the
long tail. datamosh/pixel-sort stay CPU forever.

## Epic 6.3b — screen-space filter chain + quantization (2026-06-28)

Ported the remaining 6.3b screen-space self-composite filters and the resolution-reduction
effects onto the ping-pong chain. The chain grew a **variable-length tail** (cur tracked,
always-even pass count → lands on `tPpA`): `… focus → [genLoss/copyGen dub passes] → mediaAge →
restoration → bloom`, then a **resolution-reduction present chain** (`composite → T_final →
mbDown → tLowMB → mbUp → tMacro → qDown → tLowQ → qUp → canvas`). Passthrough byte-exact when off.

- **burnIn** (prior, `98fe78f`): pointwise screen+multiply self-blend of T_optics.
- **generationLoss / copyGen**: each CPU dub sub-draw (`blur() saturate() contrast()` at ±shift,
  low alpha, reading the previous full frame) is its own ping-pong pass; per-iteration params
  arrive via a **dynamic-offset `DubParams` buffer** (binding 4). genLoss rounds the shift
  (integer copy); copyGen keeps it fractional (bilinear). The canvas `blur()` is approximated by
  a Gaussian (stdDev = radius), as `focusBreathing` does.
- **restoration**: pointwise revive (pass 1) folded with `invert(blur(pass1))` overlay (pass 2)
  in one pass, since pass 1 is pointwise.
- **mediaAging**: yellow multiply tint + saturate/contrast/brightness fade blend + lifted-black
  screen fill + the CPU's deterministic mulberry-LCG speckle (all pointwise; the dust dots use a
  hard disk vs the canvas arc's sub-pixel AA — negligible on mean-err).
- **macroBlocking / quantization**: a low-res render target (full-size texture rendered into a
  low-res viewport = box-average ≈ the canvas "low"-quality downscale), nearest-upscale
  composite; quantization adds per-channel level quantization + the 8×8 DCT block-edge grid +
  mosquito ringing (> 0.18). The width-dependent block math (blockSize/sampleScale/levels) is
  derived in `buildSignalUniforms`.

### Isolated single-effect verification (mean-err vs CPU, 640×480)

generationLoss 0.38–0.99 · copyGen 0.39–1.45 · restoration 0.61–1.25 · mediaAge 0.76–0.93 ·
macroBlocking 0.22–1.91 · quantization 0.13–2.82 (incl. the DCT grid + ringing at 1.0). Stacked
combinations (up to a 9-effect kitchen sink) ≤ 2.4. **All well under the < 6 gate.**

### The pixelSize × 6.3b gate finding

Adding the 6.3b effects to `gpuSignalOK` first surfaced **8 codec presets that fail** (U-matic
12.6, Video CD 13.6, RealPlayer 240p 22.1, …). Isolation proved the divergence is **not** in the
6.3b effects (zeroing them all left the failure unchanged) but in **`pixelSize > 1`**: setting
pixelSize → 1 collapsed every failure (RealPlayer 24.2 → 1.1). `floor((u·W)/pixelSize)` amplifies
the tiny f32↔f64 difference in a warped sample coordinate into a whole-block colour error; the
6.3b blur-feedback / downscale passes then magnify it. It was latent through 6.2/6.3a because
every high-pixelSize preset also carried generationLoss/quantization that gated it to CPU.

The fix is a **surgical gate**: `pixelSize > 1` is routed to CPU **only when a 6.3b effect is
active**. pixelSize > 1 on its own (pure-display pixelation — Game Boy LCD, Stadium Jumbotron,
LED Billboard, CRT Viewfinder) was already sound through 6.3a and is byte-exact passthrough under
the new chain, so it keeps routing (4.3–5.8). The per-pixel sampling-grid match itself is a
separate 6.2-class fix (the same f32-limit class as grain).

### Result: routed 34 → 40, `allowedFailing: []`

Full-catalogue sweep (`DISPLAY_PRESETS` + the 91 classics, 112 total): every routed preset is
< 6, **`allowedFailing: []`**, 0 errors. 6.3b unlocks **+6 classics** (more than the back-loaded
~0 forecast): DSLR Video 2010 (0.91), 4K HDR Streaming 2020s (0.66), Pioneer Plasma TV (3.03),
Blu-ray Disc Transfer (1.08), CRT Plasma Burn-In (2.01), Restored Archive Master (3.40). No
preset de-routed; worst routed margin 5.77 (CRT Viewfinder, unchanged).

**Live verification** (production `CRTRendererHybrid`, 1280×720): Restored Archive Master routes
`activeMode "webgpu"` (17.5 ms vs 787 ms CPU); the gated RealPlayer 240p (pixelSize 5 + 6.3b)
falls to `"cpu"`; export (`preferGPU` off) bit-identical across renders (maxDiff 0). 153 tests
green, tsc + `vite build` clean; Epic 1 export parity stays 455/455.

### Notes / still-CPU in 6.3b

- **mediaAging** routes only with `storageCondition: "ideal"` (the gate's existing
  storage-condition check). Non-ideal severities also match on GPU (humid measured 0.87) but stay
  CPU pending a wider sweep.
- **The genLoss/copyGen/macroBlocking/quantization-rich codec presets** stay CPU because they
  pixelate (pixelSize > 1) — the effects themselves are faithful, the pixelation is the blocker.
- **Next:** 6.3c OSD (timestamp + style glyph rendering — the +29 unlock), then 6.3d NTSC/PAL
  composite. datamosh/pixel-sort stay CPU forever.

## Epic 6.3c — OSD on GPU (2026-06-28)

The OSD (timestamp/style text) is canvas-rendered (10 styles, procedural bitmap + 7-segment +
bundled OFL fonts, shadows, blink). **True GPU glyph rendering can't match canvas-text AA to < 6**,
and the CPU burns the OSD into the signal buffer **after grade / before optics** so the display
optics ride over it. So the OSD is **CPU-rendered onto a transparent overlay and composited on
GPU between grade and optics** (`grade → tGraded → fs_osd(over osdTex) → tGradedOsd → optics`):
the hybrid (which holds `renderOptions`) renders the OSD via `cpuRenderer.renderOSD` onto a
scratch canvas and passes it to `backend.render(…, osdSource)`; the backend uploads it
(straight-alpha) to `osdTex` and `fs_osd` source-over composites it. `renderOSD` is pure
source-over and compositing is associative, so the overlay equals the CPU drawing it directly.
The OSD text draw is ~µs; the expensive optics stays on GPU. `u_osdActive` makes `fs_osd` a
byte-exact passthrough when off. Gate: dropped the `advancedTimestampOSD > 0.01 → CPU` block;
added `advancedTimestampOSD`/`advancedOSDStyle` to the supported set.

**Isolated verification (640×480):** all 10 styles 0.23–0.37; every font path (procedural vhs/
camcorder, OFL broadcast/lcd, 7-segment film/led) 0.20–0.31; OSD + a CRT look 0.94; passthrough
(no OSD) byte-exact 0.13. The OSD pixels are the CPU's own, so fidelity is exact bar the optics
resample.

**Gate finding (same class as 6.3b):** enabling OSD newly-allowed 4 VHS/camcorder presets that
then failed (Bootleg Concert Cam 24.7, Late-80s Home VHS 11.6, …) — again the pre-existing
`pixelSize > 1` divergence (the high-contrast OSD text rides through the same block-sampling
mismatch; `pixelSize → 1` collapsed them, e.g. 24.7 → 5.1), not the OSD (which measured 0.2–0.9).
Extended the pixelSize gate trigger to include `advancedTimestampOSD` (`PIXEL_SIZE_DIVERGENT_EFFECTS`).

**Result: routed 40 → 42, `allowedFailing: []`, 0 errors.** OSD unlocks **+2** classics
(Betacam SP ENG 1980s 1.82, S-VHS Master Tape 2.46 — the OSD presets that don't pixelate). The
roadmap's "+29" forecast does NOT materialise: **of 29 OSD presets, 27 also carry `pixelSize > 1`**,
so they stay CPU on the f32 sampling-grid limit — pixelSize, not OSD, is now the dominant blocker.
**Live** (production hybrid, 1280×720): Betacam SP ENG routes `webgpu` with the OSD visibly
composited (timestamp band populated); the gated Bootleg Concert Cam (OSD + pixelSize 3) → `cpu`;
export bit-identical (maxDiff 0). 153 tests / tsc / `vite build` green; parity 455/455.

**The next big lever is the `pixelSize > 1` sampling-grid match** (a 6.2-class f32-limit fix, same
family as grain): it currently co-blocks ~25 OSD presets + the 8 codec presets. Fixing it would
unlock the bulk of the remaining catalogue; it likely needs emulated-f64 optics coordinates (the
warped `u` straddles `floor()` block boundaries in f32). Then 6.3d = NTSC/PAL composite. datamosh/
pixel-sort stay CPU forever.
