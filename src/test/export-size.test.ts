import { describe, it, expect } from "vitest";
import { computeExportSize, computeContentRect } from "@/lib/export-size";

describe("computeExportSize", () => {
  describe("Resolution = Source (0)", () => {
    it("returns the exact source dims for a 1080p source", () => {
      expect(computeExportSize({ sourceW: 1920, sourceH: 1080, resolution: 0, aspectRatio: "original" }))
        .toEqual({ width: 1920, height: 1080 });
    });

    it("returns full 4K for a 4K source (the core bug: must NOT shrink to preview size)", () => {
      expect(computeExportSize({ sourceW: 3840, sourceH: 2160, resolution: 0, aspectRatio: "original" }))
        .toEqual({ width: 3840, height: 2160 });
    });

    it("evens odd source dimensions (H.264 4:2:0 needs even W/H)", () => {
      expect(computeExportSize({ sourceW: 1921, sourceH: 1081, resolution: 0, aspectRatio: "original" }))
        .toEqual({ width: 1922, height: 1082 });
    });

    it("crops 16:9 source to 9:16 at source res (largest 9:16 box inside source)", () => {
      // 1080 tall × (1080 * 9/16 = 607.5 -> 608) wide
      expect(computeExportSize({ sourceW: 1920, sourceH: 1080, resolution: 0, aspectRatio: "9:16" }))
        .toEqual({ width: 608, height: 1080 });
    });

    it("crops a portrait source to 16:9 at source res (keeps full width)", () => {
      // width 1080, height 1080/(16/9)=607.5 -> 608
      expect(computeExportSize({ sourceW: 1080, sourceH: 1920, resolution: 0, aspectRatio: "16:9" }))
        .toEqual({ width: 1080, height: 608 });
    });
  });

  describe("Resolution targets (short edge = the number)", () => {
    it("1080p original from a 1080p source is unchanged", () => {
      expect(computeExportSize({ sourceW: 1920, sourceH: 1080, resolution: 1080, aspectRatio: "original" }))
        .toEqual({ width: 1920, height: 1080 });
    });

    it("1080p downscales a 4K source to 1920x1080", () => {
      expect(computeExportSize({ sourceW: 3840, sourceH: 2160, resolution: 1080, aspectRatio: "original" }))
        .toEqual({ width: 1920, height: 1080 });
    });

    it("720p downscales a 4K source to 1280x720", () => {
      expect(computeExportSize({ sourceW: 3840, sourceH: 2160, resolution: 720, aspectRatio: "original" }))
        .toEqual({ width: 1280, height: 720 });
    });

    it("1080p + 9:16 gives the standard vertical 1080x1920", () => {
      expect(computeExportSize({ sourceW: 1920, sourceH: 1080, resolution: 1080, aspectRatio: "9:16" }))
        .toEqual({ width: 1080, height: 1920 });
    });

    it("1080p + 1:1 gives 1080x1080", () => {
      expect(computeExportSize({ sourceW: 1920, sourceH: 1080, resolution: 1080, aspectRatio: "1:1" }))
        .toEqual({ width: 1080, height: 1080 });
    });

    it("1080p original from a portrait source anchors the short edge (1080x1920)", () => {
      expect(computeExportSize({ sourceW: 1080, sourceH: 1920, resolution: 1080, aspectRatio: "original" }))
        .toEqual({ width: 1080, height: 1920 });
    });

    it("720p + 16:9 gives 1280x720 regardless of source ratio", () => {
      expect(computeExportSize({ sourceW: 640, sourceH: 480, resolution: 720, aspectRatio: "16:9" }))
        .toEqual({ width: 1280, height: 720 });
    });
  });

  describe("computeContentRect (letterbox / pillarbox padding)", () => {
    it("letterboxes a 16:9 source into a 1:1 box (bars top/bottom)", () => {
      // 1080x1080 box, source wider → full width, centered vertically.
      expect(computeContentRect({ sourceW: 1920, sourceH: 1080, targetW: 1080, targetH: 1080 }))
        .toEqual({ width: 1080, height: 608, x: 0, y: 236 });
    });

    it("pillarboxes a 16:9 source into a 9:16 box (bars left/right)", () => {
      // 1080x1920 box, source wider than box → full width, centered vertically.
      expect(computeContentRect({ sourceW: 1920, sourceH: 1080, targetW: 1080, targetH: 1920 }))
        .toEqual({ width: 1080, height: 608, x: 0, y: 656 });
    });

    it("content never exceeds the target box", () => {
      const r = computeContentRect({ sourceW: 1080, sourceH: 1920, targetW: 1920, targetH: 1080 });
      expect(r.width).toBeLessThanOrEqual(1920);
      expect(r.height).toBeLessThanOrEqual(1080);
    });
  });

  describe("guards", () => {
    it("falls back to a safe minimum when source dims are invalid", () => {
      expect(computeExportSize({ sourceW: 0, sourceH: 0, resolution: 0, aspectRatio: "original" }))
        .toEqual({ width: 2, height: 2 });
    });

    it("treats an unparseable aspect ratio as original", () => {
      expect(computeExportSize({ sourceW: 1920, sourceH: 1080, resolution: 0, aspectRatio: "garbage" }))
        .toEqual({ width: 1920, height: 1080 });
    });
  });
});
