// Pure CRTParams → uniform Float32Array for the CRT/display WGSL shader. The order
// here is the single source of truth shared with crt-display.wgsl's uniform struct
// and webgpu-backend.ts's uniform-buffer write.
export const CRT_DISPLAY_UNIFORMS = [
  "u_scan", "u_mask", "u_maskType", "u_maskScale", "u_barrel", "u_vignette",
  "u_bloom", "u_ca", "u_flicker", "u_brightness", "u_contrast", "u_saturation",
  "u_gamma", "u_temperature", "u_tint", "u_monoTint",
  "u_time", "u_frameIndex", "u_fps", "u_resolutionX", "u_resolutionY",
] as const;

const MASK_CODES: Record<string, number> = { none: 0, dot: 1, aperture: 2, slot: 3, shadowMask: 4 };
const MONO_CODES: Record<string, number> = { none: 0, green: 1, amber: 2, blue: 3 };
const n = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function buildUniforms(
  params: Record<string, number | string>,
  ctx: { width: number; height: number; seconds: number; frameIndex: number; fps: number },
): Float32Array {
  const out = new Float32Array(CRT_DISPLAY_UNIFORMS.length);
  const set = (k: string, v: number) => { out[CRT_DISPLAY_UNIFORMS.indexOf(k)] = v; };
  set("u_scan", n(params.scanlineStrength));
  set("u_mask", n(params.phosphorMask));
  set("u_maskType", MASK_CODES[String(params.maskType ?? "none")] ?? 0);
  set("u_maskScale", n(params.maskScale, 1));
  set("u_barrel", n(params.barrelDistortion));
  set("u_vignette", n(params.vignette));
  set("u_bloom", n(params.bloom));
  set("u_ca", n(params.chromaticAberration));
  set("u_flicker", n(params.flicker));
  set("u_brightness", n(params.imageBrightness, 1));
  set("u_contrast", n(params.imageContrast, 1));
  set("u_saturation", n(params.advancedSaturation, 1));
  set("u_gamma", n(params.imageGamma, 1));
  set("u_temperature", n(params.imageTemperature));
  set("u_tint", n(params.imageTint));
  set("u_monoTint", MONO_CODES[String(params.monochromeTint ?? "none")] ?? 0);
  set("u_time", ctx.seconds);
  set("u_frameIndex", ctx.frameIndex);
  set("u_fps", ctx.fps);
  set("u_resolutionX", ctx.width);
  set("u_resolutionY", ctx.height);
  return out;
}
