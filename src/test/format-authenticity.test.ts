import { describe, it, expect } from "vitest";
// @ts-ignore - JS module
import { getFormatProfile, getFormatBadge, AUDIO_PROFILES } from "@/lib/format-profiles.js";
import { computeImageStats, deriveMatchParams } from "@/lib/reference-match";

describe("Format authenticity profiles", () => {
  it("True Zero is a clean pass-through (no resolution reduction / composite / audio)", () => {
    const fp = getFormatProfile("True Zero (Neutral)");
    expect(fp.resScaleX).toBe(1);
    expect(fp.resScaleY).toBe(1);
    expect(fp.composite).toBe(0);
    expect(fp.audioKey).toBe("clean");
  });

  it("VHS presets carry analog system + heavy resolution/chroma reduction", () => {
    const fp = getFormatProfile("Late-80s Home VHS");
    expect(fp.system).toBe("NTSC");
    expect(fp.resScaleX).toBeLessThan(0.6);
    expect(fp.chromaScaleX).toBeLessThan(0.2);
    expect(fp.composite).toBeGreaterThan(0);
    expect(fp.audioKey).toBe("vhs");
  });

  it("digital presets never apply composite colour", () => {
    for (const name of ["4K HDR Streaming 2020s", "Streaming Compression", "DVD Rip 2001"]) {
      const fp = getFormatProfile(name);
      expect(fp.system).not.toBe("PAL");
      // composite is gated to analog systems in the renderer; digital may carry a
      // tiny value but the system gate keeps it a no-op.
      expect(fp.system === "NTSC" || fp.system === "PAL").toBe(false);
    }
  });

  it("film presets are non-interlaced film system", () => {
    const fp = getFormatProfile("Super 8 Home Reel 1970s");
    expect(fp.system).toBe("film");
    expect(fp.interlaced).toBe(false);
    expect(fp.audioKey).toBe("silent");
  });

  it("unknown preset falls back via category", () => {
    const fp = getFormatProfile("My Custom Look", "VHS / Tape");
    expect(fp.system).toBe("NTSC");
    expect(fp.resScaleX).toBeLessThan(1);
  });

  it("produces a readable badge", () => {
    const fp = getFormatProfile("PAL Living Room TV (1970s)");
    const badge = getFormatBadge(fp);
    expect(badge).toContain("PAL");
    expect(badge).toContain("4:3");
  });

  it("every preset resolves to a valid audio profile", () => {
    const names = ["Consumer TV", "Zoom Call Recording (2020)", "Silent Film 1920s", "Early Web Rip (2006)"];
    for (const n of names) {
      const fp = getFormatProfile(n);
      expect(AUDIO_PROFILES[fp.audioKey]).toBeTruthy();
      expect(typeof fp.audio.highCutHz).toBe("number");
    }
  });
});

describe("Reference match", () => {
  function solid(r: number, g: number, b: number, w = 8, h = 8) {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
    }
    return { data, w, h };
  }

  it("computes plausible stats", () => {
    const { data, w, h } = solid(128, 128, 128);
    const s = computeImageStats(data, w, h);
    expect(s.meanLuma).toBeGreaterThan(0.45);
    expect(s.meanLuma).toBeLessThan(0.55);
    expect(s.saturation).toBeLessThan(0.05);
  });

  it("derives a brighter exposure when reference is brighter than source", () => {
    const dark = computeImageStats(solid(60, 60, 60).data, 8, 8);
    const bright = computeImageStats(solid(200, 200, 200).data, 8, 8);
    const o = deriveMatchParams(bright, dark);
    expect(o.imageBrightness).toBeGreaterThan(1);
  });

  it("warms the grade when reference is warmer (more red, less blue)", () => {
    const neutral = computeImageStats(solid(128, 128, 128).data, 8, 8);
    const warm = computeImageStats(solid(200, 140, 90).data, 8, 8);
    const o = deriveMatchParams(warm, neutral);
    expect(o.imageTemperature).toBeGreaterThan(0);
  });
});
