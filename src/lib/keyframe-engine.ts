// Keyframe engine: interpolation with easing curves

export type EasingType = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "step" | "bounce" | "elastic";

export interface Keyframe {
  time: number; // seconds
  value: number;
  easing: EasingType;
}

export interface KeyframeTrack {
  paramKey: string;
  keyframes: Keyframe[];
}

export interface KeyframeState {
  tracks: KeyframeTrack[];
  duration: number;
}

// Easing functions
const easings: Record<EasingType, (t: number) => number> = {
  "linear": (t) => t,
  "ease-in": (t) => t * t,
  "ease-out": (t) => t * (2 - t),
  "ease-in-out": (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  "step": (t) => t < 1 ? 0 : 1,
  "bounce": (t) => {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  },
  "elastic": (t) => {
    if (t === 0 || t === 1) return t;
    return -Math.pow(2, 10 * (t - 1)) * Math.sin((t - 1.1) * 5 * Math.PI);
  },
};

export function evaluateTrack(track: KeyframeTrack, time: number): number | undefined {
  const kfs = track.keyframes;
  if (kfs.length === 0) return undefined;
  if (kfs.length === 1) return kfs[0].value;

  // Clamp to range
  if (time <= kfs[0].time) return kfs[0].value;
  if (time >= kfs[kfs.length - 1].time) return kfs[kfs.length - 1].value;

  // Find segment
  for (let i = 0; i < kfs.length - 1; i++) {
    if (time >= kfs[i].time && time <= kfs[i + 1].time) {
      const segDuration = kfs[i + 1].time - kfs[i].time;
      if (segDuration <= 0) return kfs[i].value;
      const t = (time - kfs[i].time) / segDuration;
      const easeFn = easings[kfs[i].easing] || easings.linear;
      const eased = easeFn(t);
      return kfs[i].value + (kfs[i + 1].value - kfs[i].value) * eased;
    }
  }
  return kfs[kfs.length - 1].value;
}

export function evaluateAllTracks(
  tracks: KeyframeTrack[],
  time: number,
  baseParams: Record<string, number | string>
): Record<string, number | string> {
  const result = { ...baseParams };
  for (const track of tracks) {
    const val = evaluateTrack(track, time);
    if (val !== undefined) {
      result[track.paramKey] = val;
    }
  }
  return result;
}

export function addKeyframe(track: KeyframeTrack, kf: Keyframe): KeyframeTrack {
  // Replace existing keyframe at same time, or insert sorted
  const filtered = track.keyframes.filter(k => Math.abs(k.time - kf.time) > 0.01);
  const keyframes = [...filtered, kf].sort((a, b) => a.time - b.time);
  return { ...track, keyframes };
}

export function removeKeyframe(track: KeyframeTrack, time: number): KeyframeTrack {
  return {
    ...track,
    keyframes: track.keyframes.filter(k => Math.abs(k.time - time) > 0.01),
  };
}

export function createTrack(paramKey: string): KeyframeTrack {
  return { paramKey, keyframes: [] };
}

export const EASING_OPTIONS: { label: string; value: EasingType }[] = [
  { label: "Linear", value: "linear" },
  { label: "Ease In", value: "ease-in" },
  { label: "Ease Out", value: "ease-out" },
  { label: "Ease In-Out", value: "ease-in-out" },
  { label: "Step", value: "step" },
  { label: "Bounce", value: "bounce" },
  { label: "Elastic", value: "elastic" },
];

// Serialize / deserialize for preset storage
export function serializeKeyframeState(state: KeyframeState): string {
  return JSON.stringify(state);
}

export function deserializeKeyframeState(json: string): KeyframeState | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && Array.isArray(parsed.tracks) && typeof parsed.duration === "number") {
      return parsed;
    }
  } catch {}
  return null;
}
