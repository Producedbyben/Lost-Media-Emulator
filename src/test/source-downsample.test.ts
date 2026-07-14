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

// ── 1.2.0: video parity — computeIngestScale drives per-frame scaled ingest ──
// A video can't be pre-baked into a proxy raster, so its working resolution is a
// SCALE fed to setImage each frame. Same short-edge convention, same never-upscale.
import { computeIngestScale } from "@/lib/source-downsample";

describe("computeIngestScale — video working resolution", () => {
  it("off (target 0) → scale 1, native dims", () => {
    const s = computeIngestScale(3840, 2160, 0);
    expect(s).toEqual({ width: 3840, height: 2160, scaled: false, scale: 1 });
  });

  it("4K 16:9 → 480p: scale shrinks the short edge to exactly 480", () => {
    const s = computeIngestScale(3840, 2160, 480);
    expect(s.scaled).toBe(true);
    expect(s.height).toBe(480);
    expect(s.width).toBe(853);
    // the scale reproduces the working width from the native width
    expect(Math.round(3840 * s.scale)).toBe(853);
  });

  it("portrait 9:16 phone video → 480p scales the WIDTH edge", () => {
    const s = computeIngestScale(1080, 1920, 480);
    expect(s.width).toBe(480);
    expect(s.height).toBe(853);
    expect(s.scale).toBeCloseTo(480 / 1080, 5);
  });

  it("never upscales: 640×360 at target 480 → scale 1", () => {
    const s = computeIngestScale(640, 360, 480);
    expect(s).toEqual({ width: 640, height: 360, scaled: false, scale: 1 });
  });

  it("1080p source at 1080 target is exactly at-target → untouched", () => {
    const s = computeIngestScale(1920, 1080, 1080);
    expect(s.scaled).toBe(false);
    expect(s.scale).toBe(1);
  });

  it("WYSIWYG invariant: export sizing from ingest dims matches preview working dims", () => {
    // preview holds sourceDims = ingest dims; export computes from the same dims —
    // so a 4K video in a 480 workflow previews AND exports at 853×480.
    const ingest = computeIngestScale(3840, 2160, 480);
    const exp = computeExportSize({ sourceW: ingest.width, sourceH: ingest.height, resolution: 0 });
    // encoder even-size rule may shift each edge by at most one pixel
    expect(Math.abs(exp.width - ingest.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(exp.height - ingest.height)).toBeLessThanOrEqual(1);
  });
});
