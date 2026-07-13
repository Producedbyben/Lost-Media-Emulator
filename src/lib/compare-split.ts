// A/B split compositor for the live preview.
//
// When the user enables the split compare handle, the canvas must show the CLEAN
// source on one side of a draggable divider and the PROCESSED look on the other,
// aligned pixel-for-pixel. Before this existed, `compareSplit` fell through to a
// full processed render and nothing drew the two halves — the split "did nothing".
//
// Why a dedicated compositor instead of ctx.clip():
//   1. The two halves come from TWO SEPARATE renders — render() (processed) and
//      renderOriginal() (clean) — so a single clip region can't split one render.
//   2. The CPU renderer finalizes frames through getImageData/putImageData into
//      offscreen buffers; putImageData IGNORES canvas clip regions, so a naive
//      ctx.clip() + render would not clip at all.
// So we render each side to its OWN offscreen canvas and copy columns
// [0..splitX) from one and [splitX..width) from the other, then draw a divider.
//
// Convention (matches most NLE A/B tools): ORIGINAL on the LEFT, PROCESSED on the
// RIGHT, divided at `ratio` (0..1 across the canvas WIDTH). Both renders receive
// the SAME renderOptions (which carries the sourceView/zoom crop) so the halves
// line up exactly — the renderer's renderOriginal() honors sourceView identically
// to render(), so a zoomed/panned preview still splits pixel-accurately.

/** The subset of the renderer this compositor drives. */
export interface SplitRenderer {
  render: (
    ctx: unknown,
    width: number,
    height: number,
    elapsed: number,
    params: unknown,
    frame: number,
    fps: number,
    renderOptions: unknown,
  ) => void;
  renderOriginal: (
    ctx: unknown,
    width: number,
    height: number,
    renderOptions?: unknown,
  ) => boolean | void;
}

/** A canvas + its 2D context. Kept structural so tests can pass plain mocks. */
export interface SplitCanvas {
  canvas: { width: number; height: number };
  ctx: unknown;
}

/** Reusable offscreen buffers (one per side), owned by the caller for reuse. */
export interface SplitOffscreen {
  processed: SplitCanvas;
  original: SplitCanvas;
}

export interface CompareSplitArgs {
  outCtx: CanvasRenderingContext2D;
  renderer: SplitRenderer;
  offscreen: SplitOffscreen;
  width: number;
  height: number;
  /** 0..1 divider position across the canvas width. */
  ratio: number;
  elapsed: number;
  params: unknown;
  frame: number;
  fps: number;
  renderOptions?: unknown;
  /** Divider core colour (default white). */
  dividerColor?: string;
}

/** Split column (device px) for a 0..1 ratio across `width`. Clamped; NaN → centre. */
export function computeSplitX(width: number, ratio: number): number {
  const w = Math.max(0, Math.floor(width) || 0);
  const r = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0.5;
  return Math.round(r * w);
}

/**
 * Draw the vertical divider handle at `x`. A bright core with dark edges so it
 * reads on any content. Skipped when the split sits on either extreme edge (the
 * frame is then entirely one side, so a handle would just paint over the border).
 */
function drawDivider(
  ctx: CanvasRenderingContext2D,
  x: number,
  width: number,
  height: number,
  color: string,
): void {
  if (x <= 0 || x >= width) return;
  ctx.save();
  // Dark shoulders (2 px each side) for contrast against light content.
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x - 2, 0, 2, height);
  ctx.fillRect(x, 0, 2, height);
  // Bright core.
  ctx.fillStyle = color;
  ctx.fillRect(x - 1, 0, 2, height);
  ctx.restore();
}

/**
 * Render an A/B split into `outCtx`: clean original on the left of `ratio`,
 * processed look on the right, with a divider at the split. Reuses the caller's
 * offscreen buffers, resizing them to match the output when needed.
 */
export function renderCompareSplit(args: CompareSplitArgs): void {
  const {
    outCtx, renderer, offscreen, width, height, ratio,
    elapsed, params, frame, fps, renderOptions, dividerColor = "#ffffff",
  } = args;
  if (!(width > 0) || !(height > 0)) return;

  const { processed, original } = offscreen;
  // Keep the offscreen buffers matched to the output size (cheap when unchanged).
  if (processed.canvas.width !== width) processed.canvas.width = width;
  if (processed.canvas.height !== height) processed.canvas.height = height;
  if (original.canvas.width !== width) original.canvas.width = width;
  if (original.canvas.height !== height) original.canvas.height = height;

  // Two independent renders with IDENTICAL geometry — renderOptions carries the
  // sourceView/zoom crop, and renderOriginal() maps it the same way render() does,
  // so the two halves align pixel-for-pixel even when zoomed/panned.
  const opts = renderOptions || {};
  renderer.render(processed.ctx, width, height, elapsed, params, frame, fps, opts);
  renderer.renderOriginal(original.ctx, width, height, opts);

  const splitX = computeSplitX(width, ratio);

  // Assemble: original LEFT [0..splitX), processed RIGHT [splitX..width).
  outCtx.clearRect(0, 0, width, height);
  if (splitX > 0) {
    outCtx.drawImage(
      original.canvas as CanvasImageSource,
      0, 0, splitX, height,
      0, 0, splitX, height,
    );
  }
  if (splitX < width) {
    const rw = width - splitX;
    outCtx.drawImage(
      processed.canvas as CanvasImageSource,
      splitX, 0, rw, height,
      splitX, 0, rw, height,
    );
  }

  drawDivider(outCtx, splitX, width, height, dividerColor);
}
