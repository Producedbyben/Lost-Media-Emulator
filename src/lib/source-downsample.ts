// Ingest-time source downsample (opt-in, Task 2 — "Downsample source at import").
//
// When a source is far larger than the intended output workflow (e.g. a 4K still
// destined for a 480p deliverable), the user can choose to downsize it ONCE at
// import so the WHOLE pipeline — preview AND export — runs at the smaller size.
// That is faster and matches the target. Crucially this is NOT the old adaptive
// preview-quality degrade: it is a deliberate, user-chosen working resolution, so
// WYSIWYG still holds — what you edit at the chosen size is exactly what exports.
//
// Convention: `targetShortEdge` is the SHORT edge in pixels (the "p"), matching
// computeExportSize in export-size.ts ("resolution > 0 → the short edge"). So a
// 3840×2160 source at target 480 becomes 853×480. Aspect ratio is preserved and
// the source is NEVER upscaled — a source already at or below the target is left
// untouched (scaled = false), so smaller sources pass through unchanged.

export interface DownsampleDims {
  width: number;
  height: number;
  /** True only when the source was actually shrunk. */
  scaled: boolean;
}

/**
 * Compute the working dimensions for an ingest downsample.
 * @param sourceW native source width
 * @param sourceH native source height
 * @param targetShortEdge desired short-edge px (0 / ≤0 = off → native, no scaling)
 */
export function computeDownsampleDims(
  sourceW: number,
  sourceH: number,
  targetShortEdge: number,
): DownsampleDims {
  const sw = Number.isFinite(sourceW) && sourceW > 0 ? Math.round(sourceW) : 0;
  const sh = Number.isFinite(sourceH) && sourceH > 0 ? Math.round(sourceH) : 0;
  if (sw <= 0 || sh <= 0) return { width: Math.max(1, sw), height: Math.max(1, sh), scaled: false };

  const target = Number.isFinite(targetShortEdge) ? Math.floor(targetShortEdge) : 0;
  if (target <= 0) return { width: sw, height: sh, scaled: false }; // off → native

  const shortEdge = Math.min(sw, sh);
  if (shortEdge <= target) return { width: sw, height: sh, scaled: false }; // never upscale

  const scale = target / shortEdge;
  const width = Math.max(1, Math.round(sw * scale));
  const height = Math.max(1, Math.round(sh * scale));
  return { width, height, scaled: true };
}
