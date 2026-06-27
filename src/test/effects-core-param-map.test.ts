import { describe, it, expect } from "vitest";
import { CRT_DISPLAY_UNIFORMS, buildUniforms } from "@/lib/effects-core/param-map";

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
  it("carries frame context", () => {
    const u = buildUniforms({}, ctx);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_frameIndex")]).toBe(30);
    expect(u[CRT_DISPLAY_UNIFORMS.indexOf("u_resolutionX")]).toBe(640);
  });
});
