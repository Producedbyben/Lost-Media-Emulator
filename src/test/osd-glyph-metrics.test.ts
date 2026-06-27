import { describe, it, expect, vi } from "vitest";

// jsdom has no canvas 2D backend; the renderer constructor calls getContext for
// its scratch canvases. We only test the pure glyph-metric math, so stub it with a
// no-op 2D context stand-in to avoid the "Not implemented" jsdom noise.
vi.stubGlobal("HTMLCanvasElement", HTMLCanvasElement);
HTMLCanvasElement.prototype.getContext = (() => ({})) as unknown as HTMLCanvasElement["getContext"];

// @ts-ignore - JS module, no types
import { CRTRendererFull } from "@/lib/crt-renderer-full.js";

// These exercise the PURE glyph-metric helpers of the procedural OSD font system
// (HYBRID font plan). They need no real canvas 2D context — only the metric math,
// which must stay consistent with what drawPixelOSDText / drawSevenSegmentOSDText
// actually advance, so right/centre-aligned OSD lines land correctly.

const r = new CRTRendererFull();

describe("procedural OSD pixel-font presets", () => {
  it("defines the analog-era presets (vhs, camcorder, cctv) + hdzero set", () => {
    const presets = r.osdPixelFontPresets;
    for (const name of ["vhs", "camcorder", "cctv", "hdzeroDefault"]) {
      expect(presets[name]).toBeTruthy();
      expect(presets[name].heightCells).toBe(7);
      expect(presets[name].widthCells).toBe(5);
    }
  });

  it("getOSDPixelGlyph returns a 7-row 5-col bitmap for A-Z 0-9", () => {
    for (const ch of ["A", "Z", "0", "9", ":", "/", " "]) {
      const glyph = r.getOSDPixelGlyph(ch);
      expect(glyph).toHaveLength(7);
      for (const row of glyph) expect(row).toHaveLength(5);
    }
  });

  it("getOSDPixelGlyph is case-insensitive and falls back gracefully", () => {
    expect(r.getOSDPixelGlyph("a")).toEqual(r.getOSDPixelGlyph("A"));
    // Unknown char falls back to "?" or space — never throws / returns undefined.
    const fallback = r.getOSDPixelGlyph("©");
    expect(Array.isArray(fallback)).toBe(true);
    expect(fallback).toHaveLength(7);
  });
});

describe("getPixelOSDWidth (matches drawPixelOSDText advance)", () => {
  it("is zero for empty text and positive for non-empty", () => {
    expect(r.getPixelOSDWidth("", 32, "vhs")).toBe(0);
    expect(r.getPixelOSDWidth("A", 32, "vhs")).toBeGreaterThan(0);
  });

  it("grows monotonically with string length", () => {
    const w1 = r.getPixelOSDWidth("0", 32, "vhs");
    const w5 = r.getPixelOSDWidth("00000", 32, "vhs");
    const w10 = r.getPixelOSDWidth("0000000000", 32, "vhs");
    expect(w5).toBeGreaterThan(w1);
    expect(w10).toBeGreaterThan(w5);
  });

  it("scales with size", () => {
    const small = r.getPixelOSDWidth("12:00:00", 16, "cctv");
    const large = r.getPixelOSDWidth("12:00:00", 48, "cctv");
    expect(large).toBeGreaterThan(small * 2.5);
  });

  it("wider tracking presets are wider for the same text/size", () => {
    // cctv has the widest spacing (1.8), vhs the tightest (1.0).
    const text = "CAM 01";
    const size = 40;
    expect(r.getPixelOSDWidth(text, size, "cctv")).toBeGreaterThan(
      r.getPixelOSDWidth(text, size, "vhs"),
    );
  });

  it("returns 0 for an unknown preset (no pixel font)", () => {
    expect(r.getPixelOSDWidth("ABC", 32, "broadcast")).toBe(0);
  });
});

describe("getSevenSegmentOSDWidth (LED / film counter)", () => {
  it("is zero for empty and positive otherwise", () => {
    expect(r.getSevenSegmentOSDWidth("", 32)).toBe(0);
    expect(r.getSevenSegmentOSDWidth("8", 32)).toBeGreaterThan(0);
  });

  it("grows with length and size", () => {
    expect(r.getSevenSegmentOSDWidth("88", 32)).toBeGreaterThan(r.getSevenSegmentOSDWidth("8", 32));
    expect(r.getSevenSegmentOSDWidth("88", 64)).toBeGreaterThan(r.getSevenSegmentOSDWidth("88", 32));
  });
});
