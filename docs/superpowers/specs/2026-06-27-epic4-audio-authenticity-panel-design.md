# Epic 4 — Audio Authenticity Panel — Design

> Part of the Lost Media Emulator v2 roadmap, Track Q. Brainstormed + approved 2026-06-27.

## Goal

A per-clip audio surface in the Edit Bay style — **waveform, level/gain, fade in/out, sync-to-trim**,
and the **period-degradation suite** (tape hiss, mains hum, wow/flutter, mono fold, crackle, bandwidth
limiting) — where **what you hear in preview is exactly what exports**, because preview and both export
paths run the same single DSP.

## What already exists (do not rebuild)

- `src/lib/audio-degrade.ts` — the degradation DSP: `AudioProfile` (hiss, hum, wow, flutter, mono,
  crackle, bandwidth) + `degradeAudioBuffer(buffer, profile)` via `OfflineAudioContext`. Built and working.
- The **web** export path (`src/lib/exporter.js`) already calls `degradeAudioBuffer` when
  `degradeAudio && audioProfile`.
- Export options already carry `audioMode: "off" | "original" | "degrade"` and `degradeAudio`.

## The gaps this epic closes

1. **No audio panel UI** exposing the profile + level/gain + fade in/out + sync-to-trim + waveform.
2. **Preview audio is muted** (`video.muted = true` in `useCRTRenderer`) — there is no monitoring at all.
3. **Desktop ffmpeg export muxes the *original* audio** — it does not apply the degrade profile (the web
   path does; the desktop path does not).

## Architecture — one DSP, offline-render-and-play (parity-first)

`degradeAudioBuffer(buffer, profile)` is the **single source of truth** for processed audio. It is
extended with `gain`, `fadeIn`, `fadeOut` so those also flow through the one function (no second path).

- **Decode once:** the source audio → an `AudioBuffer` (drives the waveform and feeds the degrade).
- **Preview monitoring:** the video element stays muted; a WebAudio `AudioBufferSourceNode` plays the
  *degraded* buffer in sync with the playhead + trim window. On any change to profile / gain / fade /
  trim, re-render the degraded buffer (debounced ~150 ms; `OfflineAudioContext` renders faster than
  realtime), cancelling any in-flight render. Playback start offset = current playhead − trim-in.
- **Export (both paths) reuse the same render:** web export already calls `degradeAudioBuffer`; desktop
  export, when `audioMode === "degrade"`, offline-renders the buffer → encodes a temp WAV → passes it to
  ffmpeg as `audioSourcePath` (instead of muxing the original). One function ⇒ preview == web == desktop.

This is the same lesson as Epic 1/2: one code path drives preview and export, so they cannot desync.

## Components & layout

- `src/components/AudioPanel.tsx` (new) — the per-clip audio surface:
  - **Waveform** (canvas peaks computed from the decoded `AudioBuffer`), with the trim window + fade
    ramps drawn as an overlay.
  - **Level/gain** slider, **fade in** / **fade out** controls (seconds), **sync-to-trim** toggle
    (when on, audio in/out follow the existing video trim in/out).
  - **Degrade sub-section** — hiss / hum / wow / flutter / mono / crackle / bandwidth sliders bound to
    the `AudioProfile`. Instrument-styled (Edit Bay), distinct from the existing audio-*reactive* panel.
- `src/hooks/useAudioPreview.ts` (new) — owns: decode the source audio, the debounced degrade-render,
  and the playhead-synced `AudioBufferSourceNode` playback (start/stop/seek tied to the transport).
- `src/lib/audio-degrade.ts` — extend `AudioProfile` with `gain`, `fadeIn`, `fadeOut`; apply them in
  `degradeAudioBuffer` (gain scale; linear fade ramps at the buffer head/tail within the trim window).
- Desktop export — in the ffmpeg export handler, when `audioMode === "degrade"`: offline-render via
  `degradeAudioBuffer`, encode the result to a temp WAV (a small `audioBufferToWav` helper), and pass
  that path as `audioSourcePath`. The existing `audioMode: "original"` path is unchanged.

## Data flow

source file → decode → `AudioBuffer` → [waveform peaks] + [`degradeAudioBuffer(buffer, profile)` on
change, debounced] → preview plays the degraded buffer synced to the playhead; export encodes the same
degraded buffer (web: in-browser; desktop: temp WAV → ffmpeg mux).

## Error handling & edge cases

- **No audio track:** the panel shows an honest "no audio in this source" empty state and disables the
  controls (reuse the existing `sourceHasAudio` probe).
- **Web / pasted / sample input** (no file path): degrade still works on the decoded buffer; export via
  the web path (already wired).
- **OfflineAudioContext unavailable:** gracefully fall back to muxing the original audio (degrade is a
  no-op) rather than failing the export.
- **Debounce / cancellation:** a new change cancels the in-flight offline render so the preview buffer
  never lags more than one render behind the controls.
- **Trim/sync:** when sync-to-trim is on, audio in/out = video trim in/out; the degraded buffer is
  rendered for the trimmed span so export length matches.

## Testing

- **TDD `audio-degrade.ts` additions** (pure-buffer, no DOM): gain scales sample values; fadeIn/fadeOut
  ramp linearly to/from zero over the requested seconds; mono collapses L≈R; hiss adds high-frequency
  energy; a clean profile returns the input untouched. (OfflineAudioContext is mocked or the pure math
  helpers are factored out for unit testing.)
- **Desktop export degrade** — extend `electron/__tests__/ffmpeg-pipeline.smoke.test.js`: feed a known
  WAV as `audioSourcePath`, mux, and assert ffprobe sees the audio stream (the degrade itself is
  unit-tested separately; this proves the WAV→ffmpeg mux path).
- **Waveform + playback sync** — UI/manual verification via the preview tooling (controller).

## Boundaries (out of scope — v3)

- **No multi-track. No import/replace audio.** Per-clip only — degrade and shape the source's own track.

## Done criteria

1. The audio panel exposes waveform + level/gain + fade in/out + sync-to-trim + the degrade suite.
2. Preview audio plays the *degraded* result (no longer muted), synced to the playhead/trim.
3. Desktop export with `audioMode: "degrade"` produces audio that matches the preview (same
   `degradeAudioBuffer` output), verified by ear + the mux smoke test; web export unchanged.
4. `audio-degrade` additions are unit-tested; suite stays green; tsc clean.
5. One DSP drives preview + web export + desktop export (no second implementation).

## Relationship to other epics

- Reuses the export-path plumbing touched by Epic 2 (OSD-into-exports) and Epic 5 (queue-through-ffmpeg)
  — both already merged, so the export handler is stable to extend.
- Independent of Epic 6 (GPU video leap); audio does not run on the GPU video pipeline.
