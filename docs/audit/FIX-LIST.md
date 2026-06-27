# Lost Media Emulator — Audit Fix List

**Scope:** 7 families scored — VHS/consumer-tape, CRT/display, digital/compression, analog-broadcast + tape-format (vs real references); film, surveillance/IR, photographic (vs documented-knowledge proxies, owner-authorized, lower confidence). **88 / 91 presets scored (96.7%)** (see `coverage.md`); the only 3 unscored are the neutral baseline + 2 creative looks (out of scope — bottom of this file).
**Audit tracks:** Q = CPU-renderer quality pass; E = engine-leap port (defined in `docs/superpowers/specs/2026-06-27-v2-roadmap-design.md`).
**Sort order:** severity high → med → low, then effort low → med within each tier.
**How scores were made:** live preset renders (preview server) compared against the cleared references in `references/manifest.json`, with pixel probes + parameter sweeps. Method + per-card reasoning in `scorecards/*.json` and the audit `README.md`.

---

## Epic 3 progress (effect quality fixes landing against this list)

- ✅ **advancedDropouts** (was HIGH) — reworked from per-pixel speckle to horizontal clustered streaks
  with bright-flash head + dark recovery (commit `27f9a39`). Also improves the aging presets
  (VHS Mold Damage, Betamax Humid Garage) that inherit the dropout primitive.
- ✅ **advancedHeadSwitching** (was MED) — reworked from a weak smooth skew to a torn, noisy,
  darkened bottom band (commit `f96af22`).
- ✓ **Trinitron maskType** (was MED) — NOT a defect on inspection: WEGA / Trinitron Warm Glow / PVM-BVM
  already set `maskType: "aperture"`, and the renderer's `aperture` branch draws vertical RGB stripes
  (`maskX % 3`, no maskY term). The earlier "dot grid" read was a JPEG-scale aliasing false positive.
- Both effect fixes stay byte-identical-deterministic — the Epic 1 parity sweep remains 455/455 clean.

- ✅ **advancedQuantization** — hard 8×8 DCT block-edge + mosquito ringing on low-bitrate digital (commit `436f011`).
- ✅ **Analog Cable Scrambled Signal** — sync-suppression tearing/rolling + luma-inversion bands (`c240785`); verified strong.
- ✅ **MiniDV LP Mode** — analog streaks → sharp DV block-error concealment (`d7d0295`); verified.
- ✅ **LOW batch** (`46be5e8`): nitrate decay, Technicolor fringe, 35mm faded magenta, Kodachrome punch, Night-Vision IR hotspot, Polaroid crossover — all verified improved.
- 🔶 **CRT Plasma Burn-In** (`9c9d2b2`) — landed, but the ghost currently echoes the live frame; REFINE to a distinct persistent burned-in image.
- 🔶 **Aerochrome green→red** (in `46be5e8`) — overall magenta correct, but green→red mapping isn't strongly triggering on pure green; REFINE.
- All Epic 3 fixes verified byte-identical-deterministic (Epic 1 parity intact); merged to main (`22c81e0`).

Remaining refinements (post-OSD merge): CRT Plasma burn-in distinct-ghost, Aerochrome green→red strength.
Remaining LOW (optional polish): drone-jello in-motion verification.

## Defects to fix

| Effect / Preset | Medium | Problem (vs reference) | Severity | Est. effort | Fix lane |
|---|---|---|---|---|---|
| advancedDropouts | vhs | Uniform black salt-and-pepper speckle across the whole frame; real VHS dropouts are brief HORIZONTAL streaks (~1–4 lines tall, ~20–80 px wide), irregularly clustered, often a bright flash + dark recovery. Signature tape artifact; every VHS/analog/aging preset inherits it. | high | med | CPU-now |
| advancedHeadSwitching | vhs | No visible change swept 0.2→0.95 on a static frame; the bottom band reads as a smooth dark bar (bottom-row luma variance 49 < mid-frame 60), not a torn/noisy/skewed band of ~6–12 lines. Verify the param drives the band; add torn-noise + skew. | med | med | CPU-now |
| advancedQuantization (legacy low-bitrate digital) | digital | RealPlayer 240p / Video CD / YouTube 2007 / Early Web Rip read as gaussian blur rather than the hard 8×8 DCT block edges + mosquito ringing the codec reference shows. Add visible block-edge structure at low quality. | med | med | CPU-now |
| maskType (Trinitron-named presets) | display | WEGA / Trinitron Warm Glow / PVM-BVM render a dot/triad shadow-mask grid instead of Trinitron's defining aperture-grille vertical RGB stripes + damper-wire shadows. Switch mask geometry to match the named CRT. | med | med | CPU-now |
| CRT Plasma Burn-In | display | Shows a heavy mask but NO actual burn-in — the defining trait is a faint PERSISTENT retained ghost image independent of the live picture. Add a retained-ghost layer. (Name also conflates CRT and plasma.) | med | med | CPU-now |
| Analog Cable Scrambled Signal | analog | Does not look scrambled — reads as normal composite. Real sync-suppression scrambling tears/rolls the picture, suppresses/inverts luma, and distorts colour. Add the scrambling artifact. | med | med | CPU-now |
| MiniDV LP Mode (Dropout-Prone) | digital | DV dropouts are SHARP rectangular block hits / frozen-macroblock error concealment, not analog horizontal streaks. Replace the analog-style dropout with DV block-error concealment. | med | med | CPU-now |
| OSD label set (Public Access / Cable Access / Betamax / Betacam) | analog | On-screen OSD label renders garbled ("CTFID CHANNEL3"). Recurs across several presets — verify the OSD glyph/label table. | low | low | CPU-now |
| advancedChromaDelay | vhs | Direction correct (chroma lags right of luma), but edges read torn/jagged not a smooth horizontal chroma smear; thin blue boundary artifact at the left edge at high values. Smooth the smear; clamp the edge. | low | low | CPU-now |
| Consumer TV (CRT scanlines) | display | Scanline depth is near brightness-independent (range 36 highlights vs 32 mids); a real CRT blooms in highlights and fills the gaps. Make modulation vary with local brightness. | low | low | CPU-now |
| Pioneer Plasma TV (2007) | display | Correctly scanline-free, but lacks plasma's cell/pixel structure + dither/false-contour in gradients + slight afterglow. Add plasma signature. | low | low | CPU-now |
| LED Billboard Phone Capture | display | Needs a COARSE LED pixel pitch + phone-capture moiré beating against the grid; current grid is too fine/subtle. | low | low | CPU-now |
| Early Webcam (2008) | digital | Too clean — add heavy low-light luma/chroma noise, low frame-rate smear, aggressive auto-exposure. | low | low | CPU-now |
| Zoom Call Recording (2020) | digital | Add the H.264 motion-macroblocking + temporal smear that appears at low upstream bandwidth. | low | low | CPU-now |
| Betacam SP ENG 1980s | analog | Broadcast-grade component — should be markedly sharper/cleaner than the VHS-like composite look rendered. (Also needs a Betacam reference.) | low | low | CPU-now |
| Off-Air Analog Broadcast / PAL UHF Antenna | analog | Add antenna SNOW (RF noise) + ghosting (multipath) that define off-air/UHF reception. | low | low | CPU-now |
| OLED Smartphone PenTile / PenTile OLED Sunlight | display | PenTile's diamond (RGBG) subpixel + edge colour fringing not evident — reads as a generic clean panel. | low | med | CPU-now |
| DSLR Video 2010 | digital | Missing the defining early-HDSLR traits: line-skip moiré/aliasing on fine detail + rolling-shutter skew. | low | med | CPU-now |
| MiniDV Family Cam / HDV Camcorder 2005 | digital | Digital-tape formats lean an analog composite look; should show DV/MPEG-2 DCT texture/blocking instead of scanlines. (MiniDV OSD reads still-camera, not camcorder.) | low | med | CPU-now |
| PAL Living Room TV / PAL UHF Antenna | analog | PAL-specific traits not distinct (625-line finer scanlines, stable PAL chroma, Hanover bars). Needs a PAL reference + PAL chroma model. | low | med | CPU-now + ref |
| ATSC Broadcast Transition (2009) | digital | Too clean — add occasional MPEG-2 macroblock freeze/pixelation + the digital "signal cliff" (block-up then drop to black). | low | med | CPU-now |
| Nitrate Newsreel 1930s | film | Reads like generic B&W grain; add the defining nitrate DECAY — blooming chemical blotches, edge fogging, mottled emulsion damage — to distinguish it from Silent Film 1920s. | low | med | CPU-now |
| Silent Film 1920s | film | Add the silent-era motion tells: gate weave (vertical jitter), vertical scratches/tramlines, dust, brightness flicker. | low | med | CPU-now |
| Technicolor Print 1950s | film | Add the 3-strip registration fringe (slight R/G/B mis-registration coloured edges) — its signature alongside the saturation. | low | low | CPU-now |
| 35mm Faded Cinema Print | film | Push the dye-fade: cyan fades first, so faded prints skew strongly MAGENTA/PINK — make the cast more pronounced. | low | low | CPU-now |
| 8mm Kodachrome Home Movie | film | Kodachrome is PUNCHY (deep blacks, rich reds); render leans washed — deepen contrast/blacks, richen reds. | low | low | CPU-now |
| Aerochrome Infrared Film | film | Map GREEN vegetation → RED/magenta (the colour-IR false-colour signature); currently green→olive. | low | med | CPU-now |
| IR presets (Night Vision / Ring Night IR / Disposable IR Flood) | sensor | Add the central IR-illuminator HOTSPOT (bright near-field bloom) with rapid edge falloff; IR Flood should blow out the near field. | low | med | CPU-now |
| Covert Spycam Button Lens | sensor | Push the tight circular 'keyhole' vignette + pinhole fisheye that define a button/pinhole lens. | low | low | CPU-now |
| Police Bodycam 2016 | sensor | Add the wide-angle barrel/fisheye distortion bodycams have. | low | low | CPU-now |
| Polaroid SX-70 Instant | photo | Add the SX-70 colour crossover (greenish/yellow shadows, warm highlights) + optional white instant-frame border. | low | low | CPU-now |
| Drone Footage Jello | sensor | The defining 'jello' is rolling-shutter wobble (TEMPORAL) — verify it renders in motion AND survives export (preview↔export parity); not visible on a static frame. | low | med | verify/parity |

---

## Scored clean (no fix)

- **S-VHS Master Tape (1996)** — correctly cleaner than VHS (low chroma-delay/dropout/scanline); reflects S-VHS bandwidth. (severity none)
- **Restored Archive Master** — reduced artifacts + residual grain/dust = correct restoration read. (severity none)
- **Shadow Mask CRT Terminal (Amber), CRT PC Monitor (1995), Rear-Projection CRT TV (2004), Retro Pixel LCD, IPS Office LCD (2013)** — display types correctly differentiated. (severity none)
- **Blu-ray Disc Transfer (2008), 4K HDR Streaming 2020s, DVD Rip 2001, D-VHS HD Recording (2003)** — correctly pristine/clean for their high-bitrate formats. (severity none)
- **advancedMacroBlocking** (effect) — genuine block-aligned colour macroblock corruption matching real codec errors; drives the convincing Satellite/Datamosh/Bit-Rot/Vine/TikTok looks. (severity none)

**Confirmed strengths (keep):** rightward chroma-bleed direction; generational degradation scaling; macroblock/datamosh realism; Quadruplex head-banding; LaserDisc/D-VHS cleaner-than-tape differentiation; OLED perfect-blacks + bloom; period-accurate camcorder OSDs.

---

## Proxy-scored — re-score when real footage is sourced

These families are SCORED but at lower confidence, against documented-knowledge / category proxies (owner-authorized 2026-06-27) rather than cleared, medium-matched footage. Each scorecard `note` discloses the proxy. Sourcing the references below would let them be re-scored at full confidence (and would confirm/adjust the low-severity fixes above).

| Family | Reference that would upgrade confidence |
|---|---|
| Film (8) | PD/CC vintage MOTION film: B&W grain/scratch/gate-weave; nitrate decay; 3-strip Technicolor; Kodachrome; faded-dye print; colour-IR (Aerochrome) |
| Surveillance / IR / action (10) | Cleared CCTV/bodycam/doorbell footage; IR/night-vision (green & IR-flood); action-cam fisheye + rolling-shutter |
| Photographic / instant (2) | Cleared Polaroid/SX-70 + disposable-flash photo references |
| Analog composite cousins | PAL, Betamax, U-matic, Betacam SP, Hi8, Video8 references (currently VHS-composite proxies, disclosed) |

---

## Out of authenticity-rubric scope

- **Creative/stylistic looks** (judged on intent, not medium fidelity): Neon Sign Bloom (TikTok Style), Pixel Sort Glitch Art. Not scored against a medium reference.
- **True Zero (Neutral)** — the neutral pass-through baseline; nothing to audit.
