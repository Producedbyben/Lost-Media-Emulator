# Handoff — Export resolution bug (native ffmpeg path bakes preview size)

Status: **diagnosed, not fixed.** Video exports come out low-resolution, the
preview's scaling looks off, and the preview can mislead about real output. This
doc has the confirmed root cause, the fix plan, the regression-test plan, and the
ship steps. Paste the prompt at the bottom into a **fresh** Claude Code session.

---

## Symptom (user report)
- A video exported at a **low resolution** (much smaller than the source).
- Playback/preview is "doing something weird with scaling."
- The render preview "might be misleading" (what you see ≠ what you get).

## Root cause (confirmed by tracing the code)

There are **two export engines** and they disagree on output dimensions:

1. **WebCodecs path** (web/dev fallback) — `src/lib/exporter.js` → `prepareRender()`
   (~lines 262–275) renders at the **source** resolution:
   ```js
   const renderWidth  = isVideoSource ? videoElement.videoWidth  : canvas.width;
   const renderHeight = isVideoSource ? videoElement.videoHeight : canvas.height;
   const encodedSize  = getEvenFrameSize(renderWidth, renderHeight);
   ```

2. **Native ffmpeg path** (the PRIMARY path on desktop) — `src/lib/ffmpeg-export.ts`
   → `exportViaFfmpeg()` (~line 67) sizes the export work canvas from the **on-screen
   preview canvas**:
   ```js
   const { width, height } = evenSize(canvas.width, canvas.height);
   ```
   The preview canvas is **fit-to-container, DPR-capped (≤2), and adaptively
   downscaled** during playback (`src/hooks/useCRTRenderer.ts`: sizing ~695–717,
   adaptive resolution scaling ~825–857). So `canvas.width/height` is the *preview*
   size, not the source. → **The ffmpeg export bakes the preview resolution.**

When the native ffmpeg pipeline became the default export (Phases 1–3), it
regressed resolution relative to the old WebCodecs path. That is the core bug.

### Secondary defects found in the same area
- **The "Resolution" dropdown is effectively dead** (Source / 2160p / 1080p / 720p…).
  `handleExportMp4` (`useCRTRenderer.ts` ~1247–1300) collects `options.resolution`
  but the **ffmpeg branch never passes it** to `exportViaFfmpeg`, and the WebCodecs
  path ignores it too (always renders source). So the control changes nothing for
  video, and for images it falls back to the preview-canvas size.
- **Aspect ratio / frame mode ignored on the ffmpeg path.** `aspectRatio` +
  `frameMode` (letterbox / pillarbox / crop-to-fill) are collected but never applied
  to the ffmpeg render (no crop/pad). Only the still-export crops (`handleExportStill`).
- **Source proxy can further shrink exports.** Large videos use `sourceScale < 1`
  (`useCRTRenderer.ts` ~1064–1068 `workingW = videoWidth*sourceScale`, proxy ~1111).
  Export passes `sourceScale: previewSettingsRef.current.sourceScale`, so an
  optimized (downscaled) proxy makes the export even smaller. Export must force
  full-res source (`sourceScale = 1`).
- **Misleading preview.** The live canvas shows an adaptively downscaled frame; the
  Output summary's "Resolution" row (added in the new ExportPanel) currently shows
  the *chosen option*, not the true exported dimensions. Make it show the real
  output size so the preview stops lying.

## Fix plan (do it once, properly)

1. **One shared "compute export size" helper.** Add a pure function (e.g.
   `src/lib/export-size.ts`) `computeExportSize({ sourceW, sourceH, resolution, aspectRatio })`
   → `{ width, height }`, even-dimensioned (reuse `getEvenFrameSize`):
   - base dims = video `videoWidth/Height`, or for an image the intrinsic/source dims;
   - `resolution === 0` (Source) → base; else scale to that target (height or longest
     edge — match whatever the UI implies) keeping aspect;
   - apply `aspectRatio` + `frameMode` (crop-to-fill changes dims to the AR; letterbox/
     pillarbox keep dims and pad — decide and document).
   Unit-test this helper thoroughly (Source, 1080p, 720p; landscape/portrait/square
   sources; each aspect/frame mode).

2. **`exportViaFfmpeg`** — accept the target size (or `resolution` + `aspectRatio` +
   source dims) and size the work canvas to **that**, not `canvas.width/height`.
   Render each frame at target size; for video draw the **full-res** source frame
   (`sourceScale = 1`) and apply the aspect crop/pad. Keep the trim loop intact.

3. **`handleExportMp4`** — thread `resolution`, `aspectRatio`/`frameMode`, and source
   dims into `exportViaFfmpeg`; force `sourceScale = 1` for the export render.

4. **Unify WebCodecs** — make `exporter.js` use the same helper so both engines emit
   identical dimensions and the Resolution dropdown finally works there too.

5. **Honest preview** — make the Output-summary "Resolution" row show the true
   computed export size. Verify the preview's adaptive downscale never leaks into
   export (it shouldn't after #2). Consider a small "preview at export res" affordance.

6. **Investigate the "weird scaling" on playback** — confirm whether it's just the
   low-res preview, or an actual aspect-ratio distortion in the preview fit
   (`useCRTRenderer.ts` ~695–717) or in `renderer.setImage` sourceScale. Repro with a
   non-16:9 clip.

## Verify

- **Unit:** the new `computeExportSize` helper (cheap, deterministic).
- **Pipeline:** extend `electron/__tests__/ffmpeg-pipeline.smoke.test.js` — encode and
  `ffprobe` the output, asserting `width×height` equals the expected target for
  `Source` and for `1080p`. (Today's smoke writes frames at a fixed size; add a case
  that exercises the real target-size math end-to-end, or at least assert the encoder
  honours the frame dimensions it's given.)
- **Manual (the real proof):** load a known clip (e.g. 1920×1080 and a 4K), Export
  H.264 at Resolution = Source → `ffprobe` shows the source dims (NOT the preview
  size). Then 1080p / 720p → exact. Then a 9:16 crop on a 16:9 source → correct crop.
- Preview tools on port 5176 (`build-together` launch config) for UI checks; the
  Export validator compares preview↔export determinism, not resolution.

## Ship (once green)

- Work on `main`. `npm test` (currently **67 green**), `npx tsc --noEmit`, lint the
  touched files (repo has pre-existing `no-explicit-any` / one `@ts-ignore` — ignore those).
- **Bump `package.json`** (currently `1.1.1`) to the next version so it's a fresh
  release; artifacts auto-name `Lost Media Emulator-v<ver>-arm64.dmg` (see
  `electron-builder.config.cjs` `mac.artifactName`).
- `npm run dist` → push the DMG to the shop from `~/Projects/lost-media-emulator-site`:
  `./.claude/skills/lme-r2-release/push.sh dmg "<path to .dmg>"`.
- **Still unsigned** (Apple Developer enrolment pending). Do NOT bump the KV
  `versions` pointer or push the update feed until a signed build exists — it would
  show a dead update banner. See `docs/NOTARIZATION.md` + the `lme-r2-release` skill.
  When signed: `npm run dist:signed` (`.env.signing`), then dmg + update + versions.
- Commit + `git push origin main`.

## Key files
- `src/lib/ffmpeg-export.ts` — `exportViaFfmpeg`, `evenSize` (THE bug, ~line 67).
- `src/lib/exporter.js` — `prepareRender` / `getEvenFrameSize` (source-res reference, ~262–275).
- `src/hooks/useCRTRenderer.ts` — `handleExportMp4` (~1247–1300), canvas sizing
  (~695–717), adaptive resolution (~825–857), source proxy/sourceScale (~1064–1111).
- `src/components/ExportPanel.tsx` — Resolution / Aspect / Output-summary "Resolution" row.
- `electron/__tests__/ffmpeg-pipeline.smoke.test.js` — where the ffprobe dim assertion goes.

Memory: `[[lost-media-emulator-desktop]]`, `[[lost-media-exporter-rebuild]]`,
`[[lme-licensing-handoff]]` (signing/notarization state).

---

## Prompt for the new session (paste verbatim)

```
Fix the Lost Media Emulator export-RESOLUTION bug in ~/Projects/build-together-desktop
and ship it. Read docs/EXPORT-RESOLUTION-HANDOFF.md first — it has the confirmed root
cause, file/line map, fix plan, test plan, and ship steps. Also read your auto-loaded
memory ([[lost-media-emulator-desktop]], [[lost-media-exporter-rebuild]],
[[lme-licensing-handoff]]); don't re-derive what they record.

The bug: the native ffmpeg export (the PRIMARY desktop path) renders at the on-screen
PREVIEW canvas size — fit-to-container, DPR-capped, adaptively downscaled — instead of
the source/selected resolution, so video exports come out low-res. The WebCodecs path
renders at source res; the two disagree. The Resolution dropdown and Aspect/frame-mode
are also ignored on the ffmpeg path, and a <1 source proxy can shrink exports further.

Use systematic-debugging: FIRST reproduce with a real clip. Start the dev app
(preview_start, launch config "build-together", port 5176), load a known-resolution
video (or have me supply one), export H.264 at Resolution=Source, and ffprobe the
output to confirm it's the preview size, not the source size. Capture the actual vs
expected dimensions before changing anything.

Then implement the fix from the handoff: a shared computeExportSize() helper
(source dims + resolution + aspectRatio/frameMode → even target dims), make
exportViaFfmpeg render at that target (full-res source, sourceScale=1, apply aspect
crop/pad) instead of canvas.width/height, thread resolution+aspect through
handleExportMp4, unify the WebCodecs path on the same helper, and make the
Output-summary "Resolution" row show the true exported size. Use TDD for the helper;
add an ffprobe smoke that asserts output WxH for Source and 1080p. Keep trim, audio,
codecs, and the 67 existing tests green.

Verify by re-exporting and ffprobing (Source / 1080p / 720p, plus a 9:16 crop of a
16:9 source) — paste the dimensions as proof. Also check whether the "weird playback
scaling" is just low-res or a real aspect distortion in the preview, and tell me which.

Ship: bump package.json from 1.1.1 to the next version, npm run dist (artifacts
auto-name v<ver>), then push the DMG to the shop from ~/Projects/lost-media-emulator-site
via ./.claude/skills/lme-r2-release/push.sh dmg "<dmg>". Build is still UNSIGNED
(Apple enrolment pending) so do NOT bump the KV versions pointer or update feed. Commit
and git push origin main. Stop and check with me before the R2 push.
```
