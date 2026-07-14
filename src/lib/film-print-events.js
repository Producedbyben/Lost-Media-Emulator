// Worn-print projection events — reel-change cue marks + splice flashes (1.2.0).
//
// Both are TEMPORAL, frame-indexed and fully deterministic (same frame in → same
// pixels out), so exports are reproducible and preview matches export. A still
// (frame 0) shows neither: the schedules are phase-offset so events land only in
// motion — cue dots and splices are things you catch mid-playback, not baked into
// every poster frame.
//
// cueMarks 0..1  — how often reel-change cues appear (26s → ~8s of footage) and
//                  how bold the punched dot reads. Real cues come as TWO short
//                  bursts (motor cue, then changeover) a beat apart; we honour
//                  that pairing at a loop-friendly spacing.
// spliceFlash 0..1 — how often a splice passes the gate (rare: ~26s → ~6s), each
//                  a 1-frame bright wash with the splice bar itself visible.

/** Deterministic 0..1 hash — self-contained so this module has no renderer coupling. */
function eventHash(n, salt = 0) {
  const s = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

/**
 * Cue-mark visibility for a frame.
 * @returns {{ show: boolean, eventIndex: number }}
 */
export function cueMarkState(frame, fps, amount) {
  const a = Math.max(0, Math.min(1, Number(amount) || 0));
  if (a <= 0.001 || !Number.isFinite(frame) || frame < 0) return { show: false, eventIndex: 0 };
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const interval = Math.max(24, Math.round(safeFps * (26 - a * 18))); // 26s → 8s
  const dur = Math.max(3, Math.round(safeFps * 0.18)); // ~4 frames @ 24fps
  const gap = Math.round(safeFps * 1.6); // changeover dot 1.6s after motor dot
  // Phase-offset so frame 0 (stills, first frame) is always clean.
  const pos = (frame + Math.floor(interval * 0.62)) % interval;
  const cycle = Math.floor((frame + Math.floor(interval * 0.62)) / interval);
  if (pos < dur) return { show: true, eventIndex: cycle * 2 };
  if (pos >= gap && pos < gap + dur) return { show: true, eventIndex: cycle * 2 + 1 };
  return { show: false, eventIndex: 0 };
}

/**
 * Splice-flash strength for a frame: 0 = no splice at the gate, else 0..1.
 * Splices are irregular — each event is jittered inside its slot so the rhythm
 * never reads as a metronome.
 */
export function spliceFlashState(frame, fps, amount) {
  const a = Math.max(0, Math.min(1, Number(amount) || 0));
  if (a <= 0.001 || !Number.isFinite(frame) || frame < 0) return 0;
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const slot = Math.max(30, Math.round(safeFps * (26 - a * 20))); // 26s → 6s
  const dur = Math.max(1, Math.round(safeFps / 30)); // 1 frame (2 at 60fps)
  const k = Math.floor(frame / slot);
  if (k < 1) return 0; // never a splice in the opening slot — stills + clip heads stay clean
  const eventFrame = k * slot + Math.floor(eventHash(k, 7) * (slot - dur - 1));
  if (frame < eventFrame || frame >= eventFrame + dur) return 0;
  return 0.6 + eventHash(k, 13) * 0.4;
}

/** Vertical position (0..1 of height) of the splice bar for event slot k. */
export function spliceBarY(frame, fps, amount) {
  const a = Math.max(0, Math.min(1, Number(amount) || 0));
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const slot = Math.max(30, Math.round(safeFps * (26 - a * 20)));
  const k = Math.floor(frame / slot);
  return 0.24 + eventHash(k, 29) * 0.52;
}

/** Deterministic per-event jitter helper for cue-dot placement. */
export function cueJitter(eventIndex, salt) {
  return eventHash(eventIndex + 1, salt) - 0.5;
}
