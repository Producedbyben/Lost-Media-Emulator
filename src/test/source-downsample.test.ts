import { describe, it, expect } from "vitest";
import { computeDownsampleDims } from "@/lib/source-downsample";
import { computeExportSize } from "@/lib/export-size";

// Ingest downsample (Task 2): downsize a too-large source ONCE at import so the whole
// pipeline runs smaller. Short-edge convention matches export-size.ts. Never upscales.

describe("computeDownsampleDims — aspect-correct, never upscales", () => {
  it("off (target 0) keeps native dims, not scaled", () => {
    const d = computeDownsampleDims(3840, 2160, 0);
    expect(d).toEqual({ width: 3840, height: 2160, scaled: false });
  });

  it("4K 16:9 → 480p short edge is 853×480 (aspect preserved)", () => {
    const d = computeDownsampleDims(3840, 2160, 480);
    expect(d.scaled).toBe(true);
    expect(d.height).toBe(480); // short edge hits the target exactly
    expect(d.width).toBe(853); // 3840 * (480/2160) = 853.33 → 853
    // aspect ratio preserved within a rounding pixel
    expect(Math.abs(d.width / d.height - 3840 / 2160)).toBeLessThan(0.01);
  });

  it("4K 4:3 (4000×3000) → 480p is 640×480", () => {
    const d = computeDownsampleDims(4000, 3000, 480);
    expect(d).toEqual({ width: 640, height: 480, scaled: true });
  });

  it("portrait 1080×1920 → 480p short edge is the WIDTH: 480×853", () => {
    const d = computeDownsampleDims(1080, 1920, 480);
    expect(d.scaled).toBe(true);
    expect(d.width).toBe(480);
    expect(d.height).toBe(853);
  });

  it("NEVER upscales: a 300p-short source at target 480 stays native", () => {
    const d = computeDownsampleDims(640, 300, 480);
    expect(d).toEqual({ width: 640, height: 300, scaled: false });
  });

  it("source exactly at the target is left untouched (no needless recanvas)", () => {
    const d = computeDownsampleDims(854, 480, 480);
    expect(d.scaled).toBe(false);
  });

  it("guards against degenerate dims", () => {
    expect(computeDownsampleDims(0, 0, 480).scaled).toBe(false);
    expect(computeDownsampleDims(1920, 1080, NaN).scaled).toBe(false);
  });
});

describe("working dims flow through to export sizing", () => {
  it("a 4K still downsampled to 480p exports at 480p (Source), not 4K", () => {
    // At ingest the working source becomes the downsampled size; sourceDimsRef holds it.
    const work = computeDownsampleDims(3840, 2160, 480);
    expect(work.scaled).toBe(true);

    // Export "Source" (resolution 0) derives purely from the working dims.
    const out = computeExportSize({
      sourceW: work.width,
      sourceH: work.height,
      resolution: 0,
      aspectRatio: "original",
    });
    expect(out.height).toBe(480);
    expect(out.width).toBe(854); // toEven(853)

    // Contrast: without the downsample the same export would be full 4K.
    const native = computeExportSize({ sourceW: 3840, sourceH: 2160, resolution: 0, aspectRatio: "original" });
    expect(native).toEqual({ width: 3840, height: 2160 });
  });

  it("downsample off leaves the export at the native source size (no behaviour change)", () => {
    const work = computeDownsampleDims(1920, 1080, 0); // off
    const out = computeExportSize({
      sourceW: work.width,
      sourceH: work.height,
      resolution: 0,
      aspectRatio: "original",
    });
    expect(out).toEqual({ width: 1920, height: 1080 });
  });

  it("a fixed export resolution still overrides the working size", () => {
    const work = computeDownsampleDims(3840, 2160, 480); // working 853×480
    // Asking for 720p export upsizes the target box regardless of the working dims.
    const out = computeExportSize({
      sourceW: work.width,
      sourceH: work.height,
      resolution: 720,
      aspectRatio: "16:9",
    });
    expect(out).toEqual({ width: 1280, height: 720 });
  });
});
