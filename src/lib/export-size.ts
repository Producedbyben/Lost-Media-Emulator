// Single source of truth for export output dimensions, shared by BOTH export
// engines (native ffmpeg `exportViaFfmpeg` and the WebCodecs `exporter.js`).
//
// The bug this fixes: the ffmpeg path used to size the export from the on-screen
// PREVIEW canvas (fit-to-container, DPR-capped, adaptively downscaled), so video
// exports came out at preview resolution instead of the source/selected size, and
// the Resolution / Aspect controls did nothing. Both engines now derive the target
// purely from the SOURCE dimensions + the user's chosen resolution + aspect ratio.
//
// Conventions (documented so the UI summary and tests agree):
//   • resolution === 0  → "Source": keep the source's pixels. For an aspect change
//     the output is the largest target-AR rectangle that fits INSIDE the source
//     (a crop, never an upscale).
//   • resolution > 0    → that number is the SHORT edge (the "p"): 1080p landscape
//     is 1920×1080, 1080p 9:16 is 1080×1920, 1080p 1:1 is 1080×1080. This matches
//     how "1080p" reads for both landscape and vertical deliverables.
//   • aspectRatio "original" (or unparseable) keeps the source ratio.
//   • Output is always even (H.264 4:2:0 requires even W/H).
//
// NOTE: frame MODE (letterbox / pillarbox / crop-to-fill) does NOT change the
// output dimensions — the frame is the target-AR box in every case. The mode only
// decides how the source is mapped INTO that box (cover vs. contain), which is
// applied at draw time, not here.

export interface ExportSizeInput {
  sourceW: number;
  sourceH: number;
  /** 0 = Source; otherwise the short-edge target in pixels (e.g. 1080, 720). */
  resolution: number;
  /** "original" | "16:9" | "9:16" | "1:1" | "4:5" | "4:3" | … */
  aspectRatio?: string;
}

export interface ExportSize {
  width: number;
  height: number;
}

/** Round to the nearest even integer ≥ 2 (H.264 4:2:0 needs even dimensions). */
function toEven(n: number): number {
  if (!Number.isFinite(n)) return 2;
  const v = Math.max(2, Math.round(n));
  return v % 2 ? v + 1 : v;
}

/** Parse "a:b" → a/b. Returns null for "original" or anything unparseable. */
function parseAspectRatio(ar: string | undefined): number | null {
  if (!ar || ar === "original") return null;
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(ar.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (!(a > 0) || !(b > 0)) return null;
  return a / b;
}

export function computeExportSize({ sourceW, sourceH, resolution, aspectRatio }: ExportSizeInput): ExportSize {
  const sw = Number.isFinite(sourceW) && sourceW > 0 ? sourceW : 0;
  const sh = Number.isFinite(sourceH) && sourceH > 0 ? sourceH : 0;
  if (sw <= 0 || sh <= 0) return { width: 2, height: 2 };

  const srcAR = sw / sh;
  const targetAR = parseAspectRatio(aspectRatio) ?? srcAR;
  const res = Number.isFinite(resolution) && resolution > 0 ? resolution : 0;

  if (res === 0) {
    // Source resolution. Original ratio → source pixels verbatim. An aspect change
    // crops to the largest target-AR rectangle that fits inside the source (so we
    // never upscale just to reframe).
    if (targetAR === srcAR) return { width: toEven(sw), height: toEven(sh) };
    if (targetAR > srcAR) {
      // Target is wider than source → keep full width, crop top/bottom.
      return { width: toEven(sw), height: toEven(sw / targetAR) };
    }
    // Target is taller/narrower → keep full height, crop the sides.
    return { width: toEven(sh * targetAR), height: toEven(sh) };
  }

  // Fixed-resolution target: `res` is the short edge.
  if (targetAR >= 1) {
    // Landscape or square → short edge is the height.
    return { width: toEven(res * targetAR), height: toEven(res) };
  }
  // Portrait → short edge is the width.
  return { width: toEven(res), height: toEven(res / targetAR) };
}

export interface ContentRect {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * "Contain" geometry for letterbox / pillarbox: the largest rectangle of the
 * source aspect ratio that fits INSIDE the target box, centered. The renderer
 * draws the look into {width,height} (its own aspect → no crop), and the caller
 * composites it onto a black target-sized frame at {x,y}, leaving the bars.
 * Bar orientation falls out of the geometry (source wider → top/bottom bars;
 * source taller → side bars), so letterbox and pillarbox share this path.
 */
export function computeContentRect({
  sourceW, sourceH, targetW, targetH,
}: { sourceW: number; sourceH: number; targetW: number; targetH: number }): ContentRect {
  const srcAR = sourceW > 0 && sourceH > 0 ? sourceW / sourceH : 1;
  const boxAR = targetW > 0 && targetH > 0 ? targetW / targetH : 1;
  let w: number, h: number;
  if (srcAR > boxAR) {
    w = targetW;
    h = toEven(targetW / srcAR);
  } else {
    h = targetH;
    w = toEven(targetH * srcAR);
  }
  w = Math.min(toEven(w), targetW);
  h = Math.min(toEven(h), targetH);
  return { width: w, height: h, x: Math.round((targetW - w) / 2), y: Math.round((targetH - h) / 2) };
}
