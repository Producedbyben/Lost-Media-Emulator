# Lost Media Emulator — Audit Fix List

**Source:** VHS / consumer-tape pilot (14 scorecards: 11 preset + 3 effect).  
**Audit tracks:** Q = CPU-renderer quality pass; E = engine-leap port (Tracks defined in `docs/superpowers/specs/2026-06-27-v2-roadmap-design.md`).  
**Sort order:** severity high → med → low, then effort low → med within each tier.

---

## Defects to fix

| Effect / Preset | Medium | Problem (vs reference) | Severity | Est. effort | Fix lane |
|---|---|---|---|---|---|
| advancedDropouts | vhs | Renders uniform black salt-and-pepper speckle across the whole frame; real VHS dropouts are brief HORIZONTAL streaks (~1–4 lines tall, ~20–80 px wide), irregularly clustered, often a bright flash + dark recovery (polarity varies). Signature tape artifact; every VHS/aging preset inherits it. | high | med | CPU-now |
| advancedHeadSwitching | vhs | No visible change when swept 0.2→0.95 in isolation on a static frame; the bottom band reads as a smooth dark bar (bottom-row luma variance 49 < mid-frame 60), not a torn/noisy/skewed band of ~6–12 scanlines. Verify the param actually drives the visible band; add torn-noise texture + skew. | med | med | CPU-now |
| VHS Mold Damage (30yr Attic) + Betamax Humid Garage (1983) | vhs | Aging reads as uniform fine speckle + desaturation; real 30-yr oxide/mold damage is blotchy/CLUSTERED — horizontal oxide-shed streaks, sticky-shed dropout bursts, patchy chroma loss. Follows from the advancedDropouts shape fix. | med | low | CPU-now |
| advancedChromaDelay | vhs | Direction correct (chroma lags right of luma — confirmed), but edges read torn/jagged rather than a smooth horizontal chroma smear; a thin blue boundary artifact appears at the left frame edge at high values. Smooth the smear; clamp the edge artifact. | low | low | CPU-now |
| Consumer TV | vhs | Scanline depth is near brightness-INDEPENDENT (range 36 in highlights vs 32 in mids); a real CRT blooms in highlights and fills the gaps. Make scanline modulation vary with local brightness. | low | low | CPU-now |
| Betamax Home Recording (1981) | vhs | On-screen OSD label text appears garbled ("CTFID CHANNEL3"); verify the OSD glyph/label set for the Betamax style. | low | low | CPU-now |

---

## No-fix note

**S-VHS Master Tape (1996)** scored clean (severity `none` — all five rubric axes at 4/5). It is correctly configured cleaner than baseline VHS (chromaDelay 0.15, dropouts 0.10, headSwitching 0.14, scanline 0.36 — all well below the VHS presets), reflecting S-VHS's higher luma bandwidth and Y/C path. No fix required.

---

## Reference-gap backlog

The following presets could not be scored at full confidence (or at all) during the pilot because no format-matched cleared reference exists yet. They must not be scored until a `redistribute: true` reference is in `docs/audit/references/manifest.json` for their format:

| Preset | Reason |
|---|---|
| Hi8 Vacation Cam | Different tape/sensor format; no Hi8 reference |
| Video8 Handycam (1988) | Different tape format; no Video8 reference |
| U-matic Field Tape 1970s | Currently proxy-scored against the VHS reference at lower confidence — needs a proper 3/4″ U-matic reference |
| Betacam SP ENG 1980s | No Betacam SP reference |
| HDV Camcorder 2005 | Different tape format (HDV on MiniDV shell); no HDV reference |
| D-VHS HD Recording (2003) | Different format; no D-VHS reference |
| Night Vision Camcorder | Different sensor/optics domain; no cleared reference |

**Proxy-scored presets (lower confidence):** Betamax Home Recording (1981), Betamax Humid Garage (1983), and U-matic Field Tape 1970s were scored against the VHS reference (composite colour-under path is a reasonable proxy) but this is disclosed in their scorecard `note` fields. Betamax-specific and U-matic-specific behaviour is UNVERIFIED pending their own cleared references.
