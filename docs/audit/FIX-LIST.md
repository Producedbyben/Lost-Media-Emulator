# Lost Media Emulator — Audit Fix List

**Scope so far:** 4 families scored against real references — VHS/consumer-tape, CRT/display, digital/compression, analog-broadcast + tape-format. **68 / 91 presets scored** (see `coverage.md`); the rest are reference-blocked or out-of-scope (bottom of this file).
**Audit tracks:** Q = CPU-renderer quality pass; E = engine-leap port (defined in `docs/superpowers/specs/2026-06-27-v2-roadmap-design.md`).
**Sort order:** severity high → med → low, then effort low → med within each tier.
**How scores were made:** live preset renders (preview server) compared against the cleared references in `references/manifest.json`, with pixel probes + parameter sweeps. Method + per-card reasoning in `scorecards/*.json` and the audit `README.md`.

---

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

---

## Scored clean (no fix)

- **S-VHS Master Tape (1996)** — correctly cleaner than VHS (low chroma-delay/dropout/scanline); reflects S-VHS bandwidth. (severity none)
- **Restored Archive Master** — reduced artifacts + residual grain/dust = correct restoration read. (severity none)
- **Shadow Mask CRT Terminal (Amber), CRT PC Monitor (1995), Rear-Projection CRT TV (2004), Retro Pixel LCD, IPS Office LCD (2013)** — display types correctly differentiated. (severity none)
- **Blu-ray Disc Transfer (2008), 4K HDR Streaming 2020s, DVD Rip 2001, D-VHS HD Recording (2003)** — correctly pristine/clean for their high-bitrate formats. (severity none)
- **advancedMacroBlocking** (effect) — genuine block-aligned colour macroblock corruption matching real codec errors; drives the convincing Satellite/Datamosh/Bit-Rot/Vine/TikTok looks. (severity none)

**Confirmed strengths (keep):** rightward chroma-bleed direction; generational degradation scaling; macroblock/datamosh realism; Quadruplex head-banding; LaserDisc/D-VHS cleaner-than-tape differentiation; OLED perfect-blacks + bloom; period-accurate camcorder OSDs.

---

## Reference-blocked — NOT scored (need cleared references before scoring)

Per the rubric hard rule, these are not scored until a `redistribute: true`, medium-matched reference exists in `references/manifest.json`. Renders exist and look plausible, but scoring them honestly requires the right reference.

| Family | Presets | Reference needed |
|---|---|---|
| Film (8) | Silent Film 1920s, Nitrate Newsreel 1930s, Technicolor Print 1950s, 16mm Broadcast Kinescope, Super 8 Home Reel 1970s, 8mm Kodachrome Home Movie, 35mm Faded Cinema Print, Aerochrome Infrared Film | PD/CC vintage film (B&W grain/scratch/halation; colour Technicolor/Kodachrome; faded-dye print; colour-IR) |
| Surveillance / IR / action (10) | Security Camera Dump, Digital Surveillance, Night Vision Camcorder, Police Bodycam 2016, Covert Spycam Button Lens, Ring Doorbell Daytime, Ring Doorbell Night IR, GoPro Hero3 Action Cam, Disposable Security IR Flood, Drone Footage Jello | Cleared CCTV/bodycam/doorbell footage + IR/night-vision (green & IR-flood) + action-cam (fisheye/rolling-shutter) references |
| Photographic / instant (2) | Polaroid SX-70 Instant, Disposable Camera 35mm Flash | Cleared Polaroid/instant + disposable-flash photo references |

**Format-matched references still wanted for already-proxy-scored presets** (currently scored against the VHS composite reference with disclosure): Hi8, Video8, U-matic, Betamax (×2), Betacam SP, and a PAL reference for the PAL presets.

---

## Out of authenticity-rubric scope

- **Creative/stylistic looks** (judged on intent, not medium fidelity): Neon Sign Bloom (TikTok Style), Pixel Sort Glitch Art. Not scored against a medium reference.
- **True Zero (Neutral)** — the neutral pass-through baseline; nothing to audit.
