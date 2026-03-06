# Lost Media Emulator (Local + Static Hosting)

A lightweight browser tool that loads an image, previews an animated lost-media simulation pipeline (including CRT display emulation), and exports an MP4 clip.

## Open locally

### Option A: open directly with `file://`
1. Double-click `index.html`.
2. Upload an image.
3. Tune controls and click **Export MP4**.

### Option B: static server (recommended)
```bash
python -m http.server 8080
```
Then open `http://localhost:8080`.

## Browser requirements

- Chromium-based browser recommended (Chrome/Edge 116+ preferred).
- Requires **WebCodecs** (`VideoEncoder`) for MP4 export.
- Requires network access the first time to fetch `mp4-muxer` from jsDelivr CDN.

## Known limitations

- `file://` mode can be stricter depending on browser security policies. If export fails in `file://`, use a local HTTP server.
- H.264 profile/codec support varies by OS/browser build.
- Large resolutions + long durations are CPU-intensive and may freeze the tab while encoding.


## Included presets

The preset list now includes a concrete “lost media” matrix that maps directly to this tool’s effect stack
(core CRT controls + advanced analog instability controls + pixelation controls).

- **Late-80s Home VHS**: consumer tape softness, head switching noise, and mild tracking drift.
- **90s Rental Tape (3rd Gen Dub)**: heavy generation loss, dropouts, and stronger chroma smear.
- **Hi8 Vacation Cam**: cleaner than VHS with gentle wobble and handheld-era tape character.
- **MiniDV Family Cam (2002)**: sharper digital-era baseline with interlace and mild artifacting.
- **Off-Air Analog Broadcast**: over-the-air jitter, cross-color artifacts, and RF-like instability.
- **Public Access Archive**: noisy mixed signal path with ghosting and interlace shimmer.
- **Early Web Rip (2006)**: macroblock-like chunkiness and compressed internet-era softness.
- **Security Camera Dump**: low-detail, high-noise surveillance aesthetic.
- **Bootleg Concert Cam**: extreme low-light bloom, clipping feel, and unstable tape behavior.
- **Damaged Archive Recovery**: severe dropout events and restoration-adjacent temporal damage.

These presets are intentionally non-destructive starting points; tweak from each baseline to dial in subtle
or extreme authenticity per shot.


## New lost-media controls

In addition to the original CRT + analog controls, the advanced panel now includes dedicated knobs for:

- **Frame stutter/drop** (temporal cadence instability)
- **RF interference bands** (horizontal signal bursts)
- **Exposure pumping** (auto-exposure breathing)
- **White balance drift** (warm/cool cast wandering over time)
- **Focus breathing** (periodic softness pulses)
- **Tape crease events** (localized horizontal warp/chew style damage)
- **Timestamp OSD** (camcorder-style date/time burn-in)
- **OSD style** (switches between camcorder/VCR/CCTV-like text treatments)
- **CCTV monochrome** (surveillance-style grayscale with slight green cast)
- **Quantization/crush** (reduced tonal levels for low-bitrate or low-quality capture feel)
- **Generation loss** (copy-of-copy dub degradation passes)

These are all deterministic per frame, so preview and export stay visually aligned.

## CRT tuning tips

- **Consumer TV look**: increase barrel distortion, bloom, chromatic aberration, and moderate scanlines.
- **PVM/BVM look**: reduce barrel distortion and bloom, increase phosphor mask clarity, keep flicker/noise low.
- For subtle realism, keep noise under `0.2` and flicker under `0.15`.

## Effect pass order

1. Geometry warp (barrel distortion)
2. Shadow mask and scanlines
3. Bloom/glow
4. Temporal flicker and deterministic noise

Export and preview both use deterministic frame timing (`frameIndex / fps`) so visual timing remains consistent.
