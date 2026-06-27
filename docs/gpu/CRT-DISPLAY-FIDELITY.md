# CRT/Display Family — WebGPU Fidelity Sweep (Epic 6.1)

**Date:** 2026-06-27
**Harness:** `tools/gpu-coverage.snippet.js` → `window.__crtSweep` (run live via the preview
tooling; WebGPU needs the GPU + a canvas).
**Reference:** the authoritative CPU `CRTRendererFull.render()`.
**Metric:** mean per-channel abs difference over a 640×480 render of the standard test
image (gradient + red/green rects + "LME" text), frame 0 / 30 fps.
**Gate:** a preset flips to WebGPU only when mean-err **< 6** vs CPU. The hybrid's
`gpuFamilyOK()` additionally restricts routing to mask geometries the shader implements
(none/phosphor/dot/aperture/slot/shadowMask), `pixelSize === 1`, `scanlineProfile "off"`,
`subpixelLayoutOverride "none"`, and neutral grade/capture/advanced/OSD params.

## Result: 12/12 routed presets pass; zero false positives

Every preset `gpuFamilyOK()` routes to WebGPU is < 6 (`allowedFailing: []`). The whole
marquee CRT family flips to GPU, killing the ~525 ms CPU preview freeze for those looks.

### Routed to WebGPU (gate = allow, all < 6)

| Preset | maskType | mean-err | % px > 12 |
|---|---|---:|---:|
| E-Paper Display | dot | 0.01 | 0.0 |
| IMAX Large-Format Screen | none | 0.59 | 0.2 |
| Direct / No Display | none | 0.70 | 0.2 |
| Handheld Pixel LCD (Game Boy) | dot | 0.77 | 0.2 |
| Cinema Projector | none | 0.86 | 0.5 |
| Shadow-Mask Amber Terminal | shadowMask | 1.41 | 0.4 |
| Trinitron WEGA | aperture | 1.45 | 0.7 |
| Rear-Projection CRT | none | 1.47 | 1.6 |
| PAL Living-Room TV | dot | 1.54 | 1.1 |
| Arcade Monitor | slot | 1.90 | 1.4 |
| Consumer CRT TV | phosphor | 1.99 | 0.9 |
| PVM/BVM Monitor | aperture | 3.34 | 0.2 |

### Not routed (correctly kept on CPU)

| Preset | mean-err | why CPU |
|---|---:|---|
| Cyberpunk OLED | 2.30 | maskType `oledPentile` not implemented (deferred to a later Epic 6 increment) |
| Pioneer Plasma | 3.34 | maskType `plasmaCell` not implemented |
| OLED PenTile Smartphone | 4.61 | maskType `oledPentile` not implemented |
| IPS Office LCD | 5.69 | maskType `lcdStripeRGB` not implemented |
| Portable Pocket TV | 14.32 | `scanlineProfile: soft` not implemented |
| CRT Viewfinder | 40.31 | `pixelSize 2` + `scanlineProfile: hard` |
| Handheld LCD Screen | 53.28 | `subpixelLayoutOverride: RGB` |
| LED Billboard | 65.41 | `pixelSize 2` + `subpixelLayoutOverride: RGB` |
| Stadium Jumbotron | 75.51 | `pixelSize 2` + `scanlineProfile: soft` + subpixel RGB |

The four OLED/LCD/plasma presets land < 6 only because their subpixel masks are subtle;
the shader doesn't reproduce those geometries, so they are deferred rather than routed —
we never claim GPU support for a mask we don't implement.

## How the fidelity was reached

Per-stage isolation showed every stage was already bit-exact (≤ 0.17 mean-err) except
**bloom**, where a single-pass in-shader approximation diverged badly (~17). The CPU bloom
is a true canvas `blur()`, so the shader was rebuilt as a 3-pass separable Gaussian
(optics → T_optics, horizontal blur → T_h, vertical blur + screen/lighter composite),
which brought every bloom level to ≤ 1.2 and the whole routed family under the gate.

## Notes / scope

- Inter-frame effects (datamosh, pixel-sort) and all capture/tape/film/digital looks stay
  on CPU permanently (the gate rejects them); this increment flips the CRT/display family
  only.
- Export is unaffected — it runs the deterministic CPU path; the Epic 1 parity sweep still
  governs export. WebGPU accelerates **preview** only.
- GPU is perceptual-parity (f32) to CPU (f64), not bit-identical — expected and well
  within the < 6 bar (Epic 1's GPU tolerance was 12).
