# Handoff — Rebuild the OSD overlays (period-accurate fonts + correct compositing layer)

Status: **investigated & scoped, not started.** This rebuilds the burned-in OSD
(camcorder timestamp / REC / battery / CCTV / film-counter overlays) so that:

1. **Everything works as intended** — the OSD you configure in the preview is the
   OSD that gets **exported** (today it isn't), and the timecode advances correctly.
2. **Fonts are super accurate to their periods** — today they silently fall back to
   generic mono/sans because no period fonts are bundled.
3. **The OSD sits OVER the capture effects but UNDER the display effects** — today it
   floats on top of the CRT optics, which is backwards.

Decision already taken (Ben, 2026-06-27): **Font strategy = HYBRID** — procedural
bitmap/segment glyphs for the low-res analog eras (VHS, camcorder, CCTV, LED/segment),
plus a small set of permissively-licensed (OFL) TTF/woff2 for the clean digital eras
(DSLR/broadcast). LME is a **commercial** product, so every bundled font must be
license-clear.

Paste the prompt at the bottom into a **fresh** Claude Code session.

---

## The mental model (the contract the rebuild must satisfy)

The app already documents the chain in `src/lib/effect-info.ts`:
- **Capture / signal side** — the lens & sensor saw it first, then format degradation
  (`sensorLens`: "conceptually the start of the chain"; format/tape/dub/aging). This is
  *what was recorded*.
- **Display side** — `display`: "Tune this last: it models the screen the signal is
  shown on, **after** capture/format degradation" (CRT optics: scanlines, geometry,
  mask, bloom, vignette, glass).

A camcorder/CCTV OSD is **burned into the recorded signal**. Therefore:

```
CAPTURE SIGNAL  =  source → format pre-pass → tape/dub/aging/dropout/banding/hanover
                   → datamosh → grade/colour → ★ OSD BURN-IN ★
DISPLAY OPTICS  =  (that whole signal) → barrel/curvature warp → scanlines → shadow/
                   aperture/slot mask → bloom/phosphor → tube vignette → glass glare
                   → interlacing → output
```

The OSD is the **last thing in the capture signal** and the **first thing the display
optics act on** — so scanlines, mask, curvature and glare ride *over* it, exactly like
watching a tape that already had the timestamp burned in.

---

## Current architecture (grounded — file/line map)

**Renderer:** `src/lib/crt-renderer-full.js` (the CPU "full" renderer; `CRTRendererHybrid`
forces this path during export). One monolithic `render()` (starts **line 378**).

Current pass order inside `render()`:
| Order | Pass | Lines | Capture or Display? |
|---|---|---|---|
| 1 | Fit source + format pre-pass (native res, composite colour) | 384–417 | capture |
| 2 | **Fused warp loop**: barrel/curvature resample + scanlines + phosphor/aperture/slot mask + film halation + neon bleed + interlace + dropout | ~536–820 | **mostly DISPLAY** (+ a few capture: dropout, head-switching, weave) |
| 3 | Copy-gen dubbing | 821–839 | capture |
| 4 | Media aging | 841–889 | capture |
| 5 | Restoration | 891–920 | capture |
| 6 | Bloom / phosphor glow | 922–941 | display |
| 7 | Tube vignette | 943–948 | display |
| 8 | Datamosh / digital decay | 1038–~1280 | capture (signal) |
| 9 | Banding, PAL Hanover bars | 1290–1321 | capture (signal) |
| 10 | **OSD** (`renderOSD`) | **1323–1324** | — |
| 11 | Grade: brightness/contrast | 1327–1331 | capture (grade) |
| 12 | Film/sensor colour pass | 1333–1391 | capture (grade) |
| 13 | Saturation/gamma/temp/tint | 1393–~1440 | capture (grade) |

**Two things are obviously wrong in this order:**
- The **display optics** (steps 2, 6, 7) run **EARLY** — before dub/aging/datamosh/
  banding (3,4,5,8,9), before grade (11–13), and before OSD (10). So scanlines/mask/
  curvature act on a *clean* fitted source and never even see the tape degradation, the
  grade, or the OSD.
- The **OSD** (10) is drawn **after** the display optics but **before** the grade — so it
  floats *over* the scanlines/mask/curvature (wrong: should be under) yet *under* the
  grade (so it gets colour-graded as if it were part of the scene — also wrong for a
  burn-in).

**OSD renderer internals** (`crt-renderer-full.js`):
- `renderOSD()` — **line 1450**. 10 styles (0–9): VHS clock, camcorder REC/battery, TBC/
  zoom, CCTV multi-line, digicam IMG_, film 7-seg counter, police/dashcam timecode,
  broadcast token templates, security. Reads everything from `renderOptions.osd*`.
- `osdFontByPreset` — **lines 1479–1491** — CSS font stacks referencing **VCR OSD Mono,
  MS Gothic, OCR A Std, Arial Narrow, Digital-7 Mono, DS-Digital, MS Sans Serif, Inter**.
- Procedural glyph renderers (these ARE period-accurate, keep/extend them):
  `osdPixelFontPresets` + `getOSDPixelGlyph` + `drawPixelOSDText` (**41–120**, 5×7 bitmap;
  only 3 `hdzero*` presets defined) and `drawSevenSegmentOSDText` (**122–180**, LED 7-seg).

**Options plumbing** (`src/hooks/useCRTRenderer.ts`):
- `buildOSDOpts` (**~424–456**) builds the full OSD option set; `buildRenderOpts`
  (**458–461**) merges `{ ...osdOpts, formatProfile }`. **Preview uses this** (615, 792).
- **Every EXPORT / offscreen render site passes `renderOptions: { formatProfile }` ONLY**
  — no OSD fields: lines **1316** (ffmpeg), **1342** (WebCodecs mp4/webm args), **1368**
  (gif), **1449** (still/other), **1501** (validator/RAM build). ⇒ exported OSD silently
  uses defaults (vhs font, 1998 date, "CAM2"/"CTFID CHANNEL3", no synced clock).
- `OSDProfile` auto-derivation from preset name/era: `src/lib/osd-profile.ts`.

**UI:** `src/components/OSDControls.tsx`, `src/components/OSDTemplateEditor.tsx`.
**Fonts:** none bundled — `grep` finds **no `@font-face`, no `.woff/.ttf`, no
`document.fonts.*`** anywhere. Canvas `fillText` silently substitutes a fallback when the
named font isn't installed, so the analog look is lost on most machines.

---

## Confirmed defects (fix all)

1. **Wrong compositing layer.** OSD must move to *after* the full capture signal (incl.
   grade) and *before* a unified display-optics stage. Requires restructuring `render()`
   (see Target architecture) — not just moving the `renderOSD` call.
2. **Exports don't carry the configured OSD.** Thread the full OSD option set into every
   export/offscreen render path; compute `osdElapsedSeconds` from the export's own frame
   clock (respecting trim in/out) so the burned timecode advances correctly per frame.
3. **Fonts not bundled → wrong fonts.** Implement the hybrid font plan below; gate the
   first render on `document.fonts.ready` for any TTF/woff2 face (canvas won't wait).
4. **OSD currently gets scene-graded** (drawn before grade). Decide per-era: a burn-in is
   part of the signal so it *should* receive the **display** chain (scanlines/mask/glow)
   but generally **not** the scene **grade/colour** (its phosphor colour is its own).
   Default: render OSD after grade, so it's not colour-shifted by the scene grade, then
   let display optics ride over it. Document the choice.

---

## Target architecture (the rebuild)

Split `render()` into two explicit stages with one intermediate buffer:

- **Stage A — `renderSignal(signalCtx, w, h, …)`**: fitted source → format pre-pass →
  tape/dub/aging/dropout/datamosh/banding/hanover → grade/colour → **`renderOSD()` last**.
  Everything that is "what was recorded." Output = a full-res **signal buffer** canvas.
- **Stage B — `renderDisplay(outCtx, signalCanvas, w, h, …)`**: read the signal buffer →
  barrel/curvature warp (geometric resample) + scanlines + shadow/aperture/slot mask +
  bloom/phosphor + tube vignette + glass glare + interlacing → output.

The existing fused warp loop (~536–820) already reads one buffer (`fitCtx`) and writes
`outCtx`; **repurpose it as Stage B** reading the *signal* buffer instead of the clean
fitted source. Move dub/aging/datamosh/banding/hanover/grade out of their current spots
into Stage A *before* `renderOSD`. Keep every effect's math identical — this is a
**re-ordering / re-bucketing**, not a visual redesign of individual effects.

Watch-outs:
- **Performance.** The fused loop exists for speed and the preview path is adaptively
  downscaled. Adding a full-frame intermediate buffer + second pass is fine on the CPU
  export path; verify the preview stays responsive (reuse a cached signal canvas; only
  re-run Stage A when inputs change). Hybrid/GPU renderers (`crt-renderer-hybrid.js`,
  `crt-renderer-gpu.js`) — keep behaviour equivalent or route OSD through the same Stage-A
  hook so GPU preview and CPU export agree.
- **Curvature must warp the OSD too** (it's on the tube) — that falls out naturally once
  OSD is in the signal buffer that Stage B resamples. This is the visible proof the layer
  order is right: scanlines + mask + barrel must visibly ride over the timestamp.
- **Determinism / export parity.** `export-validator.js` compares export vs preview;
  keep them rendering through the same staged path so parity holds.

---

## Font plan (HYBRID — the chosen strategy)

Build a small OSD font registry keyed by the existing `osdFontPreset` names.

**Procedural (own it, no licensing) — for the analog/low-res eras:**
- Extend `osdPixelFontPresets` / `getOSDPixelGlyph` with full glyph sets (A–Z 0–9 punct)
  for: **vhs** (chunky VCR OSD block caps), **camcorder** (thinner Sony/JVC-style),
  **cctv** (OCR-ish mono). Today only digits + a few glyphs exist for 3 hdzero presets.
- Keep `drawSevenSegmentOSDText` for **led / filmSegmentThin** (film counters, LED clocks).
- Bitmap glyphs are the *most* period-accurate for these sub-720p overlays and dodge the
  MS Gothic / OCR-A / DS-Digital licensing entirely.

**Bundled TTF/woff2 (OFL/permissive only) — for the clean digital eras:**
- **broadcast** (Arial Narrow → an OFL condensed grotesque, e.g. a "Roboto/IBM Plex
  Condensed"-class face) and **modern/lcd** (DSLR/phone menu sans). Pick faithful,
  license-clear faces; record each license in `docs/` and bundle the file in-repo.
- Add `src/styles/osd-fonts.css` `@font-face` (woff2), and a `loadOSDFonts()` that
  `await document.fonts.ready` (or `document.fonts.load("16px <face>")`) **before the
  first render and before each export** so canvas never substitutes.

**Era → font mapping** lives in `osd-profile.ts` (already maps preset names → fontPreset);
extend it so each era picks the right procedural or bundled face.

---

## Phased plan (suggested)

0. **Reproduce** the export defect first (systematic-debugging): export a clip with a
   configured OSD (custom era/font/corner text) and confirm the file shows the *default*
   OSD, not yours. Capture the discrepancy before changing code.
1. **Options threading (TDD).** Extract one `buildRenderOptions({elapsed, params, forExport})`
   used by BOTH preview and every export site; export computes `osdElapsedSeconds` from its
   frame clock + trim. Unit-test the option object + elapsed math. Now exports match preview.
2. **Font registry (TDD where pure).** Procedural glyph sets + `loadOSDFonts()` + `@font-face`.
   Unit-test glyph metrics (`measureOsdWidth`, 7-seg width). Manual: each era renders its
   real face.
3. **Pipeline split.** Introduce `renderSignal` (Stage A, OSD last) + `renderDisplay`
   (Stage B). Re-bucket existing passes; keep per-effect math identical. Verify scanlines/
   mask/barrel now ride over the OSD.
4. **Grade decision (defect #4)** — OSD after grade, not colour-shifted by scene grade.
5. **Parity + perf** — export-validator green; preview responsive; GPU/hybrid agree.

## Test / verify
- **Unit:** option-threading + elapsed/trim math; glyph metrics. (vitest, jsdom)
- **Pipeline smoke (visual, deterministic):** render one frame at a fixed size with OSD +
  strong scanlines/mask/barrel, assert (a) OSD pixels exist in a corner region, (b) the
  scanline/mask modulation is present *within* the OSD region (proves display-over-OSD).
- **Export proof:** render the same params via the export path and the preview path and
  assert the OSD bytes/region match (parity) — the export-OSD-desync regression guard.
- **Manual:** load a clip, pick a 1988 VHS era + custom corner text, export H.264, scrub:
  timestamp advances, font is the period face, scanlines/curvature sit over it.
- Keep the **87 existing tests green**; `npx tsc --noEmit`; lint touched files (pre-existing
  `no-explicit-any`/`@ts-ignore` may be ignored).

## Ship (once green)
- Work on `main`. Bump `package.json` (currently **1.1.2** after the export-resolution fix).
- `npm run dist` (unsigned — Apple enrolment still pending per `[[lme-licensing-handoff]]`).
  Push DMG to the shop from `~/Projects/lost-media-emulator-site` via
  `./.claude/skills/lme-r2-release/push.sh dmg "<dmg>"`. **Do NOT** bump the KV `versions`
  pointer or update feed (unsigned). **Stop and check with Ben before the R2 push.**
- Commit + `git push origin main`. Repo: `Producedbyben/Lost-Media-Emulator`.

## Skills to invoke (in order)
1. **superpowers:brainstorming** — lock the exact capture/display bucket for every effect
   (edge cases: lens vignette = capture vs tube vignette = display; interlacing; where
   glass glare sits) and confirm the OSD-grade decision, before writing code.
2. **superpowers:writing-plans** — turn this handoff into a phased, checkpointed plan.
3. **superpowers:test-driven-development** — for the pure helpers (option threading,
   elapsed/trim math, glyph metrics) and the parity guard.
4. **superpowers:systematic-debugging** — Phase 0 reproduction of the export-OSD desync.
5. **superpowers:verification-before-completion** — before declaring done / shipping.

## Key files
- `src/lib/crt-renderer-full.js` — `render()` (378), fused warp loop (~536–820), bloom
  (922), vignette (943), OSD call (1323), `renderOSD` (1450), `osdFontByPreset` (1479),
  procedural glyph + 7-seg renderers (41–180).
- `src/hooks/useCRTRenderer.ts` — `buildOSDOpts` (~424), `buildRenderOpts` (458), export
  renderOptions sites (1316/1342/1368/1449/1501).
- `src/lib/osd-profile.ts` — era → font/style/colour derivation.
- `src/lib/effect-info.ts` — the capture/display taxonomy (source of truth for bucketing).
- `src/components/OSDControls.tsx`, `OSDTemplateEditor.tsx` — UI.
- `src/lib/crt-renderer-hybrid.js`, `crt-renderer-gpu.js` — keep preview parity.
- `src/lib/export-validator.js` — export↔preview parity check.

Memory: `[[lost-media-emulator-desktop]]`, `[[lost-media-exporter-rebuild]]`,
`[[lost-media-design-system]]`, `[[lme-licensing-handoff]]`.

---

## Prompt for the new session (paste verbatim)

```
Rebuild the Lost Media Emulator OSD overlays in ~/Projects/build-together-desktop. Read
docs/OSD-REBUILD-HANDOFF.md first — it has the grounded file/line map, the confirmed
defects, the target two-stage pipeline, the chosen HYBRID font plan, the phased plan,
test plan, ship steps, and the skill order. Also read your auto-loaded memory
([[lost-media-emulator-desktop]], [[lost-media-exporter-rebuild]],
[[lost-media-design-system]], [[lme-licensing-handoff]]); don't re-derive what they record.

Goals: (1) the OSD configured in the preview must be what EXPORTS (today exports pass
renderOptions:{formatProfile} only, so OSD falls back to defaults and the timecode doesn't
sync); (2) fonts super accurate to their periods via the HYBRID plan (procedural bitmap/
segment glyphs for VHS/camcorder/CCTV/LED; OFL TTF/woff2 for DSLR/broadcast; bundle +
document.fonts.ready gating — nothing is bundled today); (3) the OSD must sit OVER the
capture effects but UNDER the display effects — restructure render() in
src/lib/crt-renderer-full.js into renderSignal (capture → grade → OSD last) then
renderDisplay (curvature/scanlines/mask/bloom/vignette/glare over the signal buffer).

Start with superpowers:brainstorming to lock the per-effect capture/display buckets and
the OSD-grade decision. Then writing-plans. Use systematic-debugging to FIRST reproduce
the export-OSD desync, and TDD the pure helpers (option threading, elapsed/trim math,
glyph metrics) + a parity guard. Keep the 87 existing tests green, tsc clean.

Verify: export a clip with a custom era/font/corner-text OSD and prove (ffprobe + a frame
grab or pixel assertion) the exported OSD matches the preview, the period font renders,
and scanlines/mask/curvature visibly ride OVER the timestamp. Ship: bump package.json
from 1.1.2, npm run dist (unsigned), push DMG to the shop via
./.claude/skills/lme-r2-release/push.sh dmg "<dmg>" — but STOP and check with me before
the R2 push, and do NOT bump the KV versions pointer or update feed. Commit + git push
origin main.
```
