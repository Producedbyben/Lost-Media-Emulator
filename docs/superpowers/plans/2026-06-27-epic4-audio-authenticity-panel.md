# Epic 4 — Audio Authenticity Panel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-clip audio panel (waveform, level/gain, fade in/out, sync-to-trim, degrade suite) where preview audio is the exact same processed buffer that exports, on top of the existing `audio-degrade.ts` DSP.

**Architecture:** One DSP (`degradeAudioBuffer`) drives preview + web export + desktop export. The degrade is made deterministic (seeded noise) so a given profile always yields the same buffer ⇒ preview == export. Preview unmutes and plays the degraded buffer synced to the playhead; desktop export offline-renders the same buffer → temp WAV → ffmpeg mux.

**Tech Stack:** TypeScript, Web Audio (`OfflineAudioContext`), React, vitest. The renderer/video pipeline is untouched (audio is independent of Epic 6's GPU work).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-27-epic4-audio-authenticity-panel-design.md`.
- **One DSP:** all processed audio goes through `degradeAudioBuffer` — no second implementation. Preview, web export, and desktop export must use it.
- **Deterministic:** a given (buffer, profile) must always produce the same degraded buffer (replace `Math.random()` in the noise bed with a seeded PRNG) so preview == export.
- **Boundaries:** per-clip only — NO multi-track, NO import/replace audio (v3).
- Keep the suite green (**129 tests** at plan start) and `npx tsc --noEmit` clean. New pure helpers are TDD'd. jsdom has no Web Audio, so unit tests cover the **pure** helpers (PRNG, fade/gain/mono math, WAV bytes); OfflineAudioContext paths are manually verified via the preview tooling.
- Work on `main`; commit per task; push after each unit. No `npm run dist` / R2.

---

### Task 1: Deterministic degrade + gain/fade (TDD)

**Files:**
- Modify: `src/lib/audio-degrade.ts`
- Create: `src/test/audio-degrade.test.ts`

**Interfaces:**
- Produces: exported `type AudioProfile` (now also `gain?: number; fadeIn?: number; fadeOut?: number`); `degradeAudioBuffer(input, profile)` unchanged signature; new exported pure helpers `seededRng(seed: number): () => number`, `applyGainFade(channel: Float32Array, sampleRate: number, gain: number, fadeIn: number, fadeOut: number): void`.

- [ ] **Step 1: Write the failing test**

```ts
// src/test/audio-degrade.test.ts
import { describe, it, expect } from "vitest";
import { seededRng, applyGainFade } from "@/lib/audio-degrade";

describe("audio-degrade pure helpers", () => {
  it("seededRng is deterministic for a given seed and in [-1,1)-ish range", () => {
    const a = seededRng(1234); const b = seededRng(1234);
    const seqA = [a(), a(), a()]; const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seededRng(1)()).not.toEqual(seededRng(2)());
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });

  it("applyGainFade scales by gain", () => {
    const ch = new Float32Array([1, 1, 1, 1]);
    applyGainFade(ch, 4, 0.5, 0, 0);
    expect(Array.from(ch)).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it("applyGainFade ramps fade-in from 0 and fade-out to 0", () => {
    const ch = new Float32Array(8).fill(1);
    applyGainFade(ch, 8, 1, 0.5, 0.5); // 0.5s @ 8Hz = 4 samples each side
    expect(ch[0]).toBeCloseTo(0, 5);          // starts silent
    expect(ch[7]).toBeCloseTo(0, 1);          // ends near silent
    expect(ch[3]).toBeGreaterThan(ch[0]);     // ramps up
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/audio-degrade.test.ts`
Expected: FAIL — `seededRng`/`applyGainFade` not exported.

- [ ] **Step 3: Implement**

In `src/lib/audio-degrade.ts`: (a) `export type AudioProfile` and add `gain?`, `fadeIn?`, `fadeOut?`. (b) Add and export:

```ts
// Deterministic PRNG (mulberry32) so the noise bed is reproducible — a given
// profile always yields the same degraded audio, so preview == export.
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Apply level gain + linear fade-in/out (seconds) in place.
export function applyGainFade(channel: Float32Array, sampleRate: number, gain: number, fadeIn: number, fadeOut: number): void {
  const n = channel.length;
  const inN = Math.min(n, Math.max(0, Math.round(fadeIn * sampleRate)));
  const outN = Math.min(n, Math.max(0, Math.round(fadeOut * sampleRate)));
  for (let i = 0; i < n; i++) {
    let g = gain;
    if (inN > 0 && i < inN) g *= i / inN;
    if (outN > 0 && i >= n - outN) g *= (n - 1 - i) / outN;
    channel[i] *= g;
  }
}
```

(c) In `buildNoiseBed`, replace every `Math.random()` with a `seededRng` instance seeded from a fixed constant + channel index (e.g. `const rng = seededRng(0x9e37 + ch);` then use `rng()`), so the bed is deterministic. (d) After `const rendered = await ctx.startRendering();`, apply gain/fade per channel when any of `gain != 1 / fadeIn / fadeOut` is set: `for (let ch=0; ch<rendered.numberOfChannels; ch++) applyGainFade(rendered.getChannelData(ch), rendered.sampleRate, profile.gain ?? 1, profile.fadeIn ?? 0, profile.fadeOut ?? 0);` and include gain/fade in the `isEffectivelyClean` early-out (clean only if gain≈1 && no fades).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/audio-degrade.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Full suite + tsc + commit**

Run: `npx vitest run && npx tsc --noEmit`

```bash
git add src/lib/audio-degrade.ts src/test/audio-degrade.test.ts
git commit -m "audio: deterministic degrade (seeded noise) + gain/fade; export AudioProfile"
```

---

### Task 2: AudioBuffer → WAV encoder (TDD)

**Files:**
- Create: `src/lib/audio-wav.ts`
- Test: `src/test/audio-wav.test.ts`

**Interfaces:**
- Produces: `audioBufferToWav(buffer: { numberOfChannels: number; sampleRate: number; length: number; getChannelData: (c: number) => Float32Array }): ArrayBuffer` — a 16-bit PCM WAV.

- [ ] **Step 1: Write the failing test**

```ts
// src/test/audio-wav.test.ts
import { describe, it, expect } from "vitest";
import { audioBufferToWav } from "@/lib/audio-wav";

function fakeBuffer(ch: number, sr: number, samples: number[][]) {
  return { numberOfChannels: ch, sampleRate: sr, length: samples[0].length, getChannelData: (c: number) => Float32Array.from(samples[c]) };
}

describe("audioBufferToWav", () => {
  it("writes a valid RIFF/WAVE header with correct sizes", () => {
    const wav = audioBufferToWav(fakeBuffer(1, 8000, [[0, 0.5, -0.5, 1]]));
    const dv = new DataView(wav);
    const tag = (o: number) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(tag(12)).toBe("fmt ");
    expect(dv.getUint16(22, true)).toBe(1);     // channels
    expect(dv.getUint32(24, true)).toBe(8000);  // sample rate
    expect(tag(36)).toBe("data");
    expect(wav.byteLength).toBe(44 + 4 * 2);     // header + 4 mono 16-bit samples
  });

  it("clamps and quantizes samples to 16-bit", () => {
    const wav = audioBufferToWav(fakeBuffer(1, 8000, [[2, -2, 0]])); // out-of-range clamps
    const dv = new DataView(wav);
    expect(dv.getInt16(44, true)).toBe(32767);   // +clip
    expect(dv.getInt16(46, true)).toBe(-32768);  // -clip
    expect(dv.getInt16(48, true)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/test/audio-wav.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// src/lib/audio-wav.ts
// Encode a decoded AudioBuffer to a 16-bit PCM WAV (interleaved). Used to hand a
// degraded audio track to the desktop ffmpeg mux as a temp file.
export function audioBufferToWav(buffer: { numberOfChannels: number; sampleRate: number; length: number; getChannelData: (c: number) => Float32Array }): ArrayBuffer {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const n = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = n * blockAlign;
  const out = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(out);
  const wstr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); dv.setUint32(4, 36 + dataSize, true); wstr(8, "WAVE");
  wstr(12, "fmt "); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, numCh, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * blockAlign, true); dv.setUint16(32, blockAlign, true); dv.setUint16(34, 16, true);
  wstr(36, "data"); dv.setUint32(40, dataSize, true);
  const chans: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) chans.push(buffer.getChannelData(c));
  let off = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, chans[c][i]));
      dv.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes** → `npx vitest run src/test/audio-wav.test.ts` PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audio-wav.ts src/test/audio-wav.test.ts
git commit -m "audio: 16-bit PCM WAV encoder for degraded-audio export mux"
```

---

### Task 3: `useAudioPreview` — decode, degrade-render, playhead-synced playback

**Files:**
- Create: `src/hooks/useAudioPreview.ts`
- Modify: `src/hooks/useCRTRenderer.ts` (audioProfile state + remove unconditional mute; expose profile + setter)

**Interfaces:**
- Consumes: `degradeAudioBuffer`, `AudioProfile` (Task 1).
- Produces: `useAudioPreview({ sourceUrl, hasAudio, profile, playing, currentTime, trimIn, trimOut })` returning `{ buffer: AudioBuffer | null, ready: boolean }` and managing playback internally; an exported `DEFAULT_AUDIO_PROFILE: AudioProfile`.

> Runtime/Web-Audio — verified via the preview tooling (controller), not jsdom. Implement per the spec's monitoring model.

- [ ] **Step 1: Implement the hook**

Create `src/hooks/useAudioPreview.ts`: a `useRef`-held `AudioContext`; `decodeAudioData` of the source once (cache by `sourceUrl`); a debounced (150 ms) effect that re-renders `degradeAudioBuffer(decoded, profile)` (cancel in-flight via a token), storing the result; an effect that, on `playing`, starts an `AudioBufferSourceNode` from the degraded buffer at offset `(currentTime − trimIn)` and stops it on pause/seek/unmount. Guard: if `!hasAudio` or no `AudioContext`, no-op. Export `DEFAULT_AUDIO_PROFILE` (all degrade fields 0, `gain: 1`, `lowCutHz: 20`, `highCutHz: 20000`).

- [ ] **Step 2: Wire into `useCRTRenderer.ts`**

Add `const [audioProfile, setAudioProfile] = useState<AudioProfile>(DEFAULT_AUDIO_PROFILE);`. Change the preview video so its own track stays muted (`video.muted = true` stays — the WebAudio buffer is the monitor), and return `audioProfile`, `setAudioProfile`, and the source URL + trim + transport state needed by `useAudioPreview`. Call `useAudioPreview(...)` from the component (Index) or the hook.

- [ ] **Step 3: Verify (controller)**

Start the preview; load a video with audio; confirm: silence at profile-clean is the dry track; raising hiss/wow is audible; play/pause/seek start/stop the buffer in sync. (Manual — no unit test for Web Audio playback.)

- [ ] **Step 4: tsc + commit**

Run: `npx tsc --noEmit && npx vitest run`

```bash
git add src/hooks/useAudioPreview.ts src/hooks/useCRTRenderer.ts
git commit -m "audio: useAudioPreview — decode + debounced degrade-render + playhead-synced monitoring"
```

---

### Task 4: `AudioPanel.tsx` — waveform + controls

**Files:**
- Create: `src/components/AudioPanel.tsx`

**Interfaces:**
- Consumes: `AudioProfile` + setter (Task 3), the decoded `AudioBuffer` (for the waveform), `sourceHasAudio`, trim in/out + a sync-to-trim setter.

> UI — verified via the preview tooling.

- [ ] **Step 1: Build the panel**

Create `src/components/AudioPanel.tsx`, Edit-Bay styled (mirror `TapePanel.tsx`/`EffectSlider` patterns): a `<canvas>` waveform (downsample the decoded buffer to peaks; draw min/max columns; overlay the trim window + fade ramps); a **Level/gain** `EffectSlider`; **Fade in** / **Fade out** sliders (0–5 s); a **Sync to trim** toggle; and a **Degrade** sub-section with sliders for `hiss / hum / wow / flutter / mono / crackle` + a bandwidth control (lowCutHz/highCutHz). Each control updates `audioProfile` via the setter. When `!sourceHasAudio`, render an honest disabled "No audio in this source" empty state.

- [ ] **Step 2: Mount it in the layout**

Add the panel to the app (Index) alongside the other panels (the right-hand panel stack / a collapsible section), gated on having a source.

- [ ] **Step 3: Verify (controller)**

Preview: waveform draws; sliders change the heard audio; empty state shows for an audio-less source.

- [ ] **Step 4: tsc + commit**

```bash
git add src/components/AudioPanel.tsx src/pages/Index.tsx
git commit -m "audio: AudioPanel — waveform, level/gain, fades, sync-to-trim, degrade suite"
```

---

### Task 5: Desktop export — apply the degrade (WAV → ffmpeg mux)

**Files:**
- Modify: `src/hooks/useCRTRenderer.ts` (ffmpeg export handler, `audioMode === "degrade"`)
- Modify: `electron/__tests__/ffmpeg-pipeline.smoke.test.js` (WAV-mux spot-check)

**Interfaces:**
- Consumes: `degradeAudioBuffer` (Task 1), `audioBufferToWav` (Task 2), the desktop temp-file/save API.

- [ ] **Step 1: Implement the degrade export path**

In the ffmpeg export handler, when `audioMode === "degrade"` and a source audio buffer is available: decode the source audio → `degradeAudioBuffer(decoded, audioProfile)` → `audioBufferToWav(...)` → write to a temp file (via the existing desktop file API used for frames) → pass that temp path as `audioSourcePath` to the ffmpeg encode (instead of the original). `audioMode: "original"` and `"off"` paths are unchanged. On any failure, fall back to muxing the original (never fail the export).

- [ ] **Step 2: Add the mux spot-check**

In `electron/__tests__/ffmpeg-pipeline.smoke.test.js`, add a test: generate a small WAV on disk (write the bytes from a known PCM buffer), pass it as `audioSourcePath` to `session.encode({...})`, and assert ffprobe sees an `aac` audio stream. (The degrade math is unit-tested in Task 1; this proves the WAV→ffmpeg mux.)

- [ ] **Step 3: Run + verify**

Run: `npx vitest run electron/__tests__/ffmpeg-pipeline.smoke.test.js` → PASS. Controller: export a clip with `audioMode: "degrade"`, confirm the exported audio matches what preview played.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useCRTRenderer.ts electron/__tests__/ffmpeg-pipeline.smoke.test.js
git commit -m "audio: desktop export applies the degrade (degraded buffer → WAV → ffmpeg mux)"
```

---

### Task 6: Final sweep

- [ ] **Step 1: Full verification**

Run: `npx vitest run && npx tsc --noEmit && npx vite build`
Expected: all tests pass (129 + audio helper tests), tsc clean, build succeeds.

- [ ] **Step 2: Parity confirmation (controller)**

Confirm preview audio == exported audio for a degraded clip (same `degradeAudioBuffer` output; deterministic via the seeded bed). Confirm no regressions to video determinism (audio change shouldn't touch the video sweep, but run a quick determinism spot-check).

- [ ] **Step 3: Commit any cleanup**

```bash
git commit -am "audio: Epic 4 final sweep — preview==export parity confirmed" || echo "nothing to commit"
```

---

## Self-Review

**Spec coverage:** waveform/gain/fade/sync-to-trim/degrade panel → Tasks 3,4. Preview monitoring (unmute, synced) → Task 3. Desktop-export degrade → Task 5. One-DSP + determinism → Tasks 1,5 (seeded bed; same `degradeAudioBuffer`). No multi-track/import → not built (boundary respected). Empty state → Task 4. Testing (pure helpers TDD'd, mux spot-check, manual audio) → Tasks 1,2,5,6.

**Placeholder scan:** TDD tasks (1,2) carry full test + impl code. UI/Web-Audio tasks (3,4) are runtime/visual by nature with concrete file/responsibility specs + controller verification, matching how Epic 1/2 handled canvas/Web-Audio code that jsdom can't exercise.

**Type consistency:** `AudioProfile` (exported, Task 1) used in Tasks 3,4,5; `degradeAudioBuffer` signature unchanged; `audioBufferToWav` (Task 2) consumed in Task 5; `DEFAULT_AUDIO_PROFILE` (Task 3) used in Task 4. `seededRng`/`applyGainFade` names consistent.
