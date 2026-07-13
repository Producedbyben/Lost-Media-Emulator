import { describe, it, expect, vi } from "vitest";
import { computeSplitX, renderCompareSplit, type SplitOffscreen } from "@/lib/compare-split";

// The A/B split fix: with compareSplit ON, the preview must composite a CLEAN
// original on one side of the split ratio and the PROCESSED look on the other,
// aligned pixel-for-pixel — previously nothing drew the two halves so the split
// "did nothing". These tests pin the composite path down without a real canvas.

describe("computeSplitX — divider column from a 0..1 ratio", () => {
  it("maps the centre ratio to the middle column", () => {
    expect(computeSplitX(200, 0.5)).toBe(100);
  });
  it("rounds to the nearest whole column", () => {
    expect(computeSplitX(101, 0.5)).toBe(51);
  });
  it("clamps out-of-range ratios to the edges", () => {
    expect(computeSplitX(200, -0.5)).toBe(0);
    expect(computeSplitX(200, 2)).toBe(200);
  });
  it("falls back to centre for a non-finite ratio", () => {
    expect(computeSplitX(200, NaN)).toBe(100);
  });
  it("edges map exactly to 0 and width", () => {
    expect(computeSplitX(200, 0)).toBe(0);
    expect(computeSplitX(200, 1)).toBe(200);
  });
});

// A minimal mock 2D context: records drawImage calls and swallows the divider ops.
function mockCtx() {
  return {
    fillStyle: "",
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
  };
}

function makeOffscreen(): SplitOffscreen {
  return {
    processed: { canvas: { width: 0, height: 0 }, ctx: mockCtx() },
    original: { canvas: { width: 0, height: 0 }, ctx: mockCtx() },
  };
}

describe("renderCompareSplit — composites original (left) + processed (right)", () => {
  const baseArgs = () => {
    const renderer = {
      render: vi.fn(),
      renderOriginal: vi.fn(),
    };
    const offscreen = makeOffscreen();
    const outCtx = mockCtx();
    const renderOptions = { sourceView: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 }, formatProfile: null };
    return {
      renderer,
      offscreen,
      outCtx,
      renderOptions,
      args: {
        outCtx: outCtx as unknown as CanvasRenderingContext2D,
        renderer,
        offscreen,
        width: 200,
        height: 100,
        ratio: 0.5,
        elapsed: 1.5,
        params: { scanlineStrength: 0.4 },
        frame: 45,
        fps: 30,
        renderOptions,
      },
    };
  };

  it("renders BOTH the processed frame and the clean original for a split frame", () => {
    const t = baseArgs();
    renderCompareSplit(t.args);

    expect(t.renderer.render).toHaveBeenCalledTimes(1);
    expect(t.renderer.renderOriginal).toHaveBeenCalledTimes(1);

    // Processed renders into the processed offscreen ctx with the frame's params.
    const rArgs = t.renderer.render.mock.calls[0];
    expect(rArgs[0]).toBe(t.offscreen.processed.ctx);
    expect(rArgs[1]).toBe(200); // width
    expect(rArgs[2]).toBe(100); // height
    expect(rArgs[3]).toBe(1.5); // elapsed
    expect(rArgs[4]).toEqual({ scanlineStrength: 0.4 });
    expect(rArgs[5]).toBe(45); // frame
    expect(rArgs[6]).toBe(30); // fps

    // Original renders into the original offscreen ctx.
    const oArgs = t.renderer.renderOriginal.mock.calls[0];
    expect(oArgs[0]).toBe(t.offscreen.original.ctx);
    expect(oArgs[1]).toBe(200);
    expect(oArgs[2]).toBe(100);
  });

  it("hands the SAME renderOptions (sourceView/zoom) to both sides so they align", () => {
    const t = baseArgs();
    renderCompareSplit(t.args);
    const passedToProcessed = t.renderer.render.mock.calls[0][7];
    const passedToOriginal = t.renderer.renderOriginal.mock.calls[0][3];
    expect(passedToProcessed).toBe(t.renderOptions);
    expect(passedToOriginal).toBe(t.renderOptions);
    expect(passedToOriginal).toHaveProperty("sourceView");
  });

  it("copies the ORIGINAL into the left region and the PROCESSED into the right", () => {
    const t = baseArgs();
    renderCompareSplit(t.args);

    // splitX = 100. Left [0..100) from original, right [100..200) from processed.
    const draws = t.outCtx.drawImage.mock.calls;
    const left = draws.find((c) => c[0] === t.offscreen.original.canvas);
    const right = draws.find((c) => c[0] === t.offscreen.processed.canvas);
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    // Left source+dest rect: [0,0,100,100] → [0,0,100,100]
    expect(left!.slice(1)).toEqual([0, 0, 100, 100, 0, 0, 100, 100]);
    // Right source+dest rect: [100,0,100,100] → [100,0,100,100]
    expect(right!.slice(1)).toEqual([100, 0, 100, 100, 100, 0, 100, 100]);
  });

  it("resizes the offscreen buffers to match the output", () => {
    const t = baseArgs();
    renderCompareSplit(t.args);
    expect(t.offscreen.processed.canvas.width).toBe(200);
    expect(t.offscreen.processed.canvas.height).toBe(100);
    expect(t.offscreen.original.canvas.width).toBe(200);
    expect(t.offscreen.original.canvas.height).toBe(100);
  });

  it("draws the divider when the split is between the edges", () => {
    const t = baseArgs();
    renderCompareSplit(t.args);
    // drawDivider saves/restores and paints the handle columns.
    expect(t.outCtx.save).toHaveBeenCalled();
    expect(t.outCtx.restore).toHaveBeenCalled();
    expect(t.outCtx.fillRect).toHaveBeenCalled();
  });

  it("ratio 0 shows only the processed look (no original, no divider)", () => {
    const t = baseArgs();
    t.args.ratio = 0;
    renderCompareSplit(t.args);
    const draws = t.outCtx.drawImage.mock.calls;
    expect(draws.some((c) => c[0] === t.offscreen.original.canvas)).toBe(false);
    const right = draws.find((c) => c[0] === t.offscreen.processed.canvas);
    expect(right!.slice(1)).toEqual([0, 0, 200, 100, 0, 0, 200, 100]);
    expect(t.outCtx.fillRect).not.toHaveBeenCalled(); // no divider at the edge
  });

  it("ratio 1 shows only the clean original (no processed half, no divider)", () => {
    const t = baseArgs();
    t.args.ratio = 1;
    renderCompareSplit(t.args);
    const draws = t.outCtx.drawImage.mock.calls;
    expect(draws.some((c) => c[0] === t.offscreen.processed.canvas)).toBe(false);
    const left = draws.find((c) => c[0] === t.offscreen.original.canvas);
    expect(left!.slice(1)).toEqual([0, 0, 200, 100, 0, 0, 200, 100]);
    expect(t.outCtx.fillRect).not.toHaveBeenCalled();
  });
});
