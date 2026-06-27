# Exporter roadmap — remaining features

Living doc for the exporter rebuild. The design spec is
`docs/superpowers/specs/2026-06-26-exporter-ffmpeg-rebuild-design.md`; the Phase 1
plan is `docs/superpowers/plans/2026-06-26-exporter-ffmpeg-phase1.md`. All work
to date is on branch `feat/exporter-ffmpeg-phase1` (unmerged).

## Done & verified (branch `feat/exporter-ffmpeg-phase1`)

- **Filename + destination** — native Save panel, editable name (`save-file.js`).
- **Native ffmpeg pipeline** — `electron/ffmpeg-{locate,args,session}.cjs`,
  `src/lib/ffmpeg-export.ts`, IPC in `main.cjs`/`preload.cjs`. Renders frames →
  temp PNG sequence → ffmpeg encode. WebCodecs stays the web fallback.
- **Original audio** — muxed from the source file by ffmpeg; honest Original/Muted
  control driven by an ffprobe audio-track probe.
- **Codec tiers** — H.264 / HEVC / ProRes 422 HQ / ProRes 4444 / GIF.
- **Delivery presets** — Web / Social / Master / GIF.
- **Still export** — respects aspect ratio (centre-crop) + the shared Save dialog.
- **Trim (in/out points)** — export only `[inSec, outSec)`. `ffmpeg-export.ts`
  renders that window (`t = inSec + frame/fps`); `buildVideoArgs` adds `-ss`/`-t`
  on the audio input so the muxed audio matches (keeps `-shortest`). UI: in/out
  fields + "set from playhead" (`videoCurrentTime`) in `ExportPanel`, video-only.
  Full clip exports stay byte-identical (in/out forwarded only when trimmed).
  WebCodecs (web fallback) ignores trim.
- All verified by an `ffprobe` smoke test (`electron/__tests__/ffmpeg-pipeline.smoke.test.js`)
  doing real h264/hevc/ProRes encodes, an audio mux, and a trim (duration ≈ out−in).
  67 tests green.

**To run the real pipeline:** ffmpeg is installed in dev (`/opt/homebrew/bin`), so
`npm run electron:dev` uses the native path live, and `npm test` runs the real
smoke. For a DMG, drop arm64 `ffmpeg`/`ffprobe` into `build/vendor/` (see its
README) — `extraResources` bundles them only when present.

---

## Remaining features (pick up any of these)

### 2. Degrade-audio-to-match — ~35–50k tokens
**What:** the third audio mode — run the source audio through the look's analog
degradation (hiss, wow/flutter, bandwidth) so sound matches picture.
**Why:** thematic finish for an analog-emulation tool. Not essential; original
audio already works.
**Approach:**
- Reuse the existing `src/lib/audio-degrade.ts` (WebAudio) to render a degraded
  WAV in the renderer from the decoded source audio.
- New IPC `ffmpeg:write-audio` (or extend the session) to write the WAV to the
  session temp dir; `buildVideoArgs` muxes that WAV instead of the source file
  (use `-c:a aac`/`pcm` as per container; no `1:a:0?` needed — the WAV always
  has audio).
- UI: the audio control already has the shape for a third state — add "Degrade"
  next to Original/Muted (wire `audioMode: "degrade"`).
**Files:** `audio-degrade.ts` (reuse), `ffmpeg-session.cjs`, `main.cjs`/`preload.cjs`
(new IPC), `ffmpeg-export.ts`, `useCRTRenderer.ts`, `ExportPanel.tsx`.
**Verify:** smoke — mux a degraded WAV, ffprobe confirms an audio stream; spot-check
the WAV differs from source.

### 3. Route the export queue through ffmpeg — ~20–30k tokens
**What:** queued/batch exports currently run on WebCodecs (H.264/GIF only), so the
queue can't do ProRes/HEVC or reliable audio.
**Why:** consistency — batch should match direct export.
**Approach:** `runExportJob` in `useCRTRenderer.ts` chooses the ffmpeg engine like
`handleExportMp4` does; thread codec + audioSourcePath through `ExportJob`. Remove
the `queueable` gate in `ExportPanel`.
**Files:** `useCRTRenderer.ts`, `useExportQueue.ts`, `ExportPanel.tsx`.

### 4. Cancel during the encode phase — ~10–15k tokens
**What:** cancelling after all frames are sent only aborts the JS controller; the
ffmpeg child keeps encoding.
**Approach:** in `exportViaFfmpeg`, on `signal` abort during `await b.encode(...)`,
call `b.cancel({ sessionId })` (add an abort listener around the encode await).
**Files:** `ffmpeg-export.ts`. (The frame-render phase is already cancellable.)

### 5. NLE-style dialog polish — ~15–25k tokens
**What:** lay the export dialog out like a real NLE export panel (grouped
Output / Video / Audio sections, clearer hierarchy). Pure UI.
**Files:** `ExportPanel.tsx`.

---

## Pre-ship gate (not a feature, but blocks public release)

- **ffmpeg binary licensing** — bundling ffmpeg in a paid product. Prefer an LGPL
  build, invoked as a subprocess (mere aggregation), provenance documented in the
  app's About/credits. `ffmpeg-static` ships GPL — evaluate vs a self-built LGPL
  binary. See `build/vendor/README.md`.

## Suggested order

Trim ✅ → queue-through-ffmpeg (3) → degrade audio (2) → cancel-during-encode (4)
→ dialog polish (5). Or cherry-pick by need.
