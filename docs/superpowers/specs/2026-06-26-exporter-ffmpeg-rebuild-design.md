# Exporter rebuild — native ffmpeg pipeline + ProRes + reliable audio

Date: 2026-06-26
Status: Approved (architecture + phasing) — pending spec review
Project: `~/Projects/build-together-desktop` (Lost Media Emulator desktop app)

## Problem

The current exporter looks feature-rich but fails at the basics a $50 creative
tool is judged on:

1. **Original audio silently never ships.** The extract → AAC → mux code exists
   and is broadly correct, but "Include original audio" defaults **off** and is
   buried inside "Show advanced options" (and only appears for video sources).
   A normal export produces a silent file. When audio *is* requested, extraction
   does `fetch(blob-url) → decodeAudioData(whole file)`, which Chromium fails on
   for some `.mov`/codec combinations; on failure it warns to console and drops
   audio with no user-visible signal.
2. **No master-quality / editorial deliverable.** Output is H.264/WebM/GIF only.
   There is no ProRes (or any high-bitrate intra-frame master) for round-tripping
   a graded clip back into Premiere/Resolve.
3. **Silent failures throughout.** Audio drop, encoder fallback (MP4→WebM→GIF),
   and the still-export path (which ignores the chosen aspect ratio entirely and
   downloads a `data:` URL) all fail or degrade quietly.

The earlier pass added filename + destination control (commit `f891f6d`). This
spec covers the engine and the remaining UX.

**Implementation note:** this spec is the umbrella for all four phases, but each
phase is independently shippable and gets its own implementation plan. The first
plan targets **Phase 1 (ffmpeg foundation)** only.

## Goals

- A **native ffmpeg encode/mux pipeline** on the desktop build, hardware
  accelerated where possible (VideoToolbox on Apple Silicon).
- **ProRes 422 / 4444** export, plus high-bitrate **H.264** and **HEVC** tiers.
- **Original audio that actually muxes**, pulled from the source file by ffmpeg,
  with an optional "degrade to match the look" treatment.
- **Honest errors** — every failure path surfaces a clear, actionable message in
  the export UI. No silent drops.
- **One-click delivery presets** (Web / Social / Master / GIF) over the current
  hand-tuned fps/resolution/quality knobs.
- **Trim (in/out points)** so a section of a video can be exported, not just from
  time 0.
- An export dialog **laid out like a real NLE export panel**.
- Fix the still-export path (respect aspect ratio; route through the shared save
  pipeline).

## Non-goals

- Replacing the WebCodecs path on the **web/dev** build. It stays as the fallback
  engine so the app still runs in a browser (ProRes/ffmpeg are desktop-only).
- Changing the **render** pipeline's look/accuracy. Rendering stays deterministic,
  frame-stepped, CPU-forced during export — only encode/mux moves to ffmpeg.
- A general media-conversion feature. ffmpeg is an export-engine implementation
  detail, not a user-facing transcoder.

## Architecture

Two engines behind one unchanged-feeling UI. The export entry point selects the
engine by platform capability:

```
ExportPanel (UI: presets, codec, audio, trim, name, destination)
        │  one ExportRequest
        ▼
useCRTRenderer export handlers
        │
        ├── desktop (window.desktop?.ffmpeg present)
        │      → FFmpegExporter (renderer side)
        │          1. frame-step render → write temp lossless sequence
        │          2. ipc 'export:ffmpeg' → main spawns ffmpeg
        │          3. ffmpeg encodes sequence + muxes audio → output path
        │
        └── web / no-ffmpeg
               → existing WebCodecs exporter.js / gif-exporter.js
```

### Desktop ffmpeg pipeline (primary)

1. **Source path capture.** Files load as `File` → blob URL today, with no native
   path. Add `window.desktop.getPathForFile(file)` in preload (Electron
   `webUtils.getPathForFile`) and store the resolved path in source state so
   ffmpeg can read the original audio (and, where useful, source video) directly.
2. **Frame production.** Reuse the existing deterministic frame-step renderer.
   Each rendered frame's pixels are written to a temp working dir as a lossless
   sequence (`frame_%06d.png`, or raw RGBA frames — see Frame transport). Temp dir
   under `app.getPath('temp')/lme-export-<id>/`, cleaned on success, cancel, or
   error.
3. **Encode + mux.** Main spawns the bundled ffmpeg with a codec-specific arg set
   (below), reading the frame sequence and the audio source, writing to the
   user-chosen output path. Progress parsed from ffmpeg `-progress pipe:` and
   forwarded to the existing progress UI. Cancel kills the child process.
4. **Reveal.** On success, `shell.showItemInFolder(outputPath)` (matches current
   behaviour).

**Frame transport decision:** temp lossless **sequence on disk**, ffmpeg reads via
`-i frame_%06d.png` (or rawvideo from a single appended file). Chosen over piping
raw frames to ffmpeg stdin: survives long exports and cancel cleanly, no IPC
backpressure, frame-accurate. Cost: disk I/O + (for PNG) per-frame encode. v1 uses
PNG for simplicity and broad correctness; raw-RGBA-to-temp is a later optimization
if encode cost dominates.

### Audio

- **Default ON for video sources.** Pulled out of "advanced" into a primary,
  three-state control: **Off / Original / Degraded to match.**
- **Original:** ffmpeg reads the source file directly (`-i <sourcePath>`), copies
  or transcodes the audio track, and muxes it, trimmed to the export's in/out
  range. No `decodeAudioData`.
- **Degraded to match:** reuse the existing `audio-degrade.ts` (WebAudio) to render
  a processed WAV to temp, then ffmpeg muxes that. (Alternative — ffmpeg `-af`
  filter chain — deferred; reusing the existing, tuned degrade keeps parity with
  preview.)
- **Honest errors:** if the source has no audio track, or the path is unavailable
  (web build, or a pasted/sample source with no file), the control explains why
  it's unavailable rather than silently producing a silent file.

### Codec tiers (ffmpeg)

| Tier            | Codec / container                      | Use                              |
|-----------------|----------------------------------------|----------------------------------|
| Master (ProRes) | `prores_ks` 422 / 422 HQ / 4444 `.mov` | Round-trip into Premiere/Resolve |
| HEVC            | `hevc_videotoolbox` `.mp4` (hardware)  | High quality, small              |
| H.264           | `h264_videotoolbox` / `libx264` `.mp4` | Universal delivery               |
| GIF             | existing gif path                      | Quick shareable                  |

### Delivery presets

One-click presets set codec + resolution + fps + audio in a single choice; the
detailed knobs remain available under "advanced" for power users:

- **Web (H.264 1080p, AAC)** — universal.
- **Social (H.264 9:16 1080×1920, AAC)** — vertical.
- **Master (ProRes 422 HQ, source res, original audio)** — editorial.
- **GIF (480px)** — quick share.

### Trim (in/out)

In/out points (seconds) on the export request. The frame-step loop renders only
`[in, out)`; ffmpeg trims the muxed audio to the same range. UI: two numeric
fields + setting in/out from the current playhead. Defaults to full clip.

### Web / dev fallback (unchanged engine)

When `window.desktop?.ffmpeg` is absent, the handlers call the existing
`exporter.js` (WebCodecs H.264/WebM) and `gif-exporter.js`, routed through the
`saveBlob` save dialog added in `f891f6d`. ProRes/HEVC tiers are hidden or marked
desktop-only in this mode.

## Components & interfaces

- **`electron/main.cjs`** — new `ipcMain.handle('export:ffmpeg', …)`: resolves the
  bundled ffmpeg path, spawns it with the composed args, streams `-progress` back
  via an event channel, supports cancel, cleans temp. New `export:reveal` (or
  reuse existing) for Finder reveal.
- **`electron/preload.cjs`** — expose `window.desktop.ffmpeg = { available, run,
  cancel, onProgress }` and `window.desktop.getPathForFile(file)`.
- **`electron/ffmpeg-args.cjs`** — pure function: `(request) → string[]` ffmpeg
  args per codec tier. Unit-testable in isolation.
- **`src/lib/ffmpeg-export.ts`** (renderer) — orchestrates frame-step render →
  temp sequence → ipc run → progress; mirrors the `exportMp4` signature so the
  handlers can swap engines.
- **`src/hooks/useCRTRenderer.ts`** — export handlers choose engine; thread the new
  `ExportRequest` (codec, audioMode, trim, fileName, preset).
- **`src/components/ExportPanel.tsx`** — preset row, codec tier control, 3-state
  audio control (promoted out of advanced), trim fields, NLE-style layout. Reuses
  the filename/destination block already shipped.
- **`electron-builder.config.cjs`** — bundle ffmpeg via `extraResources`;
  `build/afterSign.cjs` ad-hoc signs the binary.

### ExportRequest (shared shape)

```ts
interface ExportRequest {
  preset?: "web" | "social" | "master" | "gif" | "custom";
  codec: "prores422" | "prores4444" | "h264" | "hevc" | "gif";
  fps: number;
  durationIn: number;   // trim in, seconds
  durationOut: number;  // trim out, seconds
  resolution: number;   // 0 = source
  aspectRatio?: string;
  audio: "off" | "original" | "degrade";
  fileName: string;     // incl. extension
}
```

## Error handling

- ffmpeg spawn failure / non-zero exit → surface stderr tail in the export UI as a
  clear message; never claim success.
- Audio unavailable (no track / no source path) → the audio control is disabled
  with an inline reason; export proceeds video-only only if the user chose so.
- Encoder/tier unavailable on this machine → explain and offer the nearest
  supported tier rather than silently downgrading.
- Cancel → kill ffmpeg child, delete temp dir, restore preview frame.
- Temp cleanup is guaranteed in a `finally` on every path.

## Testing & verification

- **`ffmpeg-args.cjs`** — unit tests: each preset/codec/audio/trim combination
  produces the expected arg vector (pure function, no ffmpeg needed).
- **`ensureFilename` / save pipeline** — already covered behaviourally; extend for
  the new extensions (`.mov`).
- **Pipeline smoke test** — a headless script that renders a few frames, runs the
  real bundled ffmpeg, and asserts a valid output file with the expected streams
  (`ffprobe`): video codec, audio track present when requested, duration matches
  trim. Runs against the dev tree (binary present) — this is the only way to truly
  verify audio, since the web preview cannot.
- **Manual DMG check** — ProRes opens in Premiere/Resolve/QuickTime; audio present
  and in sync; trim correct. Required before shipping (cannot be verified in the
  web preview).

## Risks

- **Licensing (highest).** Bundling ffmpeg in a paid product. Mitigation: invoke a
  separately-bundled ffmpeg **binary** as a CLI subprocess (mere aggregation, not
  linking), prefer an **LGPL** build, and document the build provenance + license
  in the app. Confirm before any public release. `ffmpeg-static` ships a GPL build
  — evaluate vs a self-built LGPL binary.
- **Binary size** — a full ffmpeg adds ~40–80 MB to the DMG. Acceptable for the
  capability; consider a reduced build later.
- **Signing/Gatekeeper** — the binary must be signed (ad-hoc, matching the app) or
  it won't spawn under the hardened runtime. Covered in `afterSign.cjs`.
- **Desktop-only** — ProRes/ffmpeg features can't be verified in the dev preview;
  every phase needs a DMG build to confirm.

## Phasing (each independently shippable)

1. **ffmpeg foundation.** Bundle + sign ffmpeg; `getPathForFile`; `export:ffmpeg`
   IPC; `ffmpeg-args.cjs`; render→temp→encode for **H.264 + HEVC**; progress +
   cancel + cleanup. Replaces the desktop video path. Proves the pipeline.
2. **Audio done right.** Original-audio mux from source + degrade-to-match;
   three-state audio control promoted out of advanced; honest errors.
3. **ProRes + master tiers** and the **delivery-preset** UI.
4. **Trim (in/out)** and the NLE-style dialog polish; fix the still-export AR +
   route through the shared save pipeline.

## Out of scope / follow-ups

- Raw-RGBA frame transport optimization (if PNG encode proves the bottleneck).
- ffmpeg `-af` audio degrade (vs reusing WebAudio degrade).
- Reduced-size custom ffmpeg build.
