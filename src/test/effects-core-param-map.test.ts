import { describe, it, expect } from "vitest";
import { CRT_DISPLAY_UNIFORMS, buildUniforms, CRT_SIGNAL_UNIFORMS, buildSignalUniforms } from "@/lib/effects-core/param-map";

describe("buildUniforms", () => {
  const ctx = { width: 640, height: 480, seconds: 1, frameIndex: 30, fps: 30 };
  it("packs values in the declared uniform order", () => {
    const u = buildUniforms({ scanlineStrength: 0.5, barrelDistortion: 0.2 }, ctx);
    expect(u).toBeInstanceOf(Float32Array);
    expect(u.length).toBe(CRT_DISPLAY_UNIFORMS.length);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_scan")]).toBeCloseTo(0.5, 5);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_barrel")]).toBeCloseTo(0.2, 5);
  });
  it("maps maskType string to its numeric code", () => {
    const u = buildUniforms({ maskType: "aperture" }, ctx);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_maskType")]).toBe(2); // none0 dot1 aperture2 slot3 shadow4
  });
  it("maps phosphor (the CPU triad) to its own code, distinct from dot", () => {
    const u = buildUniforms({ maskType: "phosphor" }, ctx);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_maskType")]).toBe(5); // phosphor 5, NOT dot 1
  });
  it("carries frame context", () => {
    const u = buildUniforms({}, ctx);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_frameIndex")]).toBe(30);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_resolutionX")]).toBe(640);
  });
});

describe("buildSignalUniforms", () => {
  const ctx = { width: 640, height: 480, seconds: 1, frameIndex: 30, fps: 30 };
  const idx = (k: string) => CRT_SIGNAL_UNIFORMS.indexOf(k);
  it("keeps the 6.1 display fields at the front in their original order", () => {
    expect(idx("u_scan")).toBe(0);
    expect(idx("u_resolutionY")).toBe(20);
  });
  it("packs new per-pixel + grade params", () => {
    const u = buildSignalUniforms({ advancedFilmGrain: 0.3, imageGamma: 1.2, haze: 0.4 }, ctx);
    expect(u.length).toBe(CRT_SIGNAL_UNIFORMS.length);
    expect(u[idx("u_filmGrain")]).toBeCloseTo(0.3, 5);
    expect(u[idx("u_gamma")]).toBeCloseTo(1.2, 5);
    expect(u[idx("u_haze")]).toBeCloseTo(0.4, 5);
  });
  it("maps categorical params to numeric codes", () => {
    const u = buildSignalUniforms(
      { maskType: "aperture", monochromeTint: "amber", scanlineProfile: "hard", subpixelLayoutOverride: "RGB" }, ctx);
    expect(u[idx("u_maskType")]).toBe(2);            // none0 dot1 aperture2 slot3 shadow4 phosphor5
    expect(u[idx("u_monoTint")]).toBe(2);            // none0 green1 amber2 blue3 (white4)
    expect(u[idx("u_scanlineProfile")]).toBe(2);     // off0 soft1 hard2 triadAware3
    expect(u[idx("u_subpixelLayout")]).toBe(1);      // none0 RGB1 BGR2 PenTile3
  });
  it("uses neutral defaults (gamma/contrast/sat/brightness/pixelSize/maskScale = 1)", () => {
    const u = buildSignalUniforms({}, ctx);
    for (const k of ["u_gamma", "u_contrast", "u_saturation", "u_brightness", "u_pixelSize", "u_maskScale"]) {
      expect(u[idx(k)]).toBeCloseTo(1, 5);
    }
    expect(u[idx("u_monoTintStrength")]).toBeCloseTo(1, 5); // CPU defaults strength to 1
  });
});
