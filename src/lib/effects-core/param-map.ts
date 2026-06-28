// Pure CRTParams → uniform Float32Array for the CRT/display WGSL shader. The order
// here is the single source of truth shared with crt-display.wgsl's uniform struct
// and webgpu-backend.ts's uniform-buffer write.
export const CRT_DISPLAY_UNIFORMS = [
  "u_scan", "u_mask", "u_maskType", "u_maskScale", "u_barrel", "u_vignette",
  "u_bloom", "u_ca", "u_flicker", "u_brightness", "u_contrast", "u_saturation",
  "u_gamma", "u_temperature", "u_tint", "u_monoTint",
  "u_time", "u_frameIndex", "u_fps", "u_resolutionX", "u_resolutionY",
] as const;

// Mask codes match crt-display.wgsl's maskType switch. `phosphor` (the CPU default /
// vertical RGB triad) is distinct from `dot` (the radial dot grid), so it gets its own
// code rather than collapsing onto dot the way the legacy WebGL2 shader did.
const MASK_CODES: Record<string, number> = {
  none: 0, dot: 1, aperture: 2, slot: 3, shadowMask: 4, phosphor: 5,
  lcdStripeRGB: 6, oledPentile: 7, plasmaCell: 8,
  // Epic 6.3a exotic capture masks.
  filmSuper8: 9, film16mm: 10, instantDyeCloud: 11, irBloomSpeckle: 12,
  cmosRollingColumn: 13, lowBitrateBlockGrid: 14, fisheyeMicrolens: 15,
};
const MONO_CODES: Record<string, number> = { none: 0, green: 1, amber: 2, blue: 3, white: 4 };
const SCANLINE_PROFILE_CODES: Record<string, number> = { off: 0, soft: 1, hard: 2, triadAware: 3 };
const SUBPIXEL_CODES: Record<string, number> = { none: 0, RGB: 1, BGR: 2, PenTile: 3 };
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

// Epic 6.2: the full per-pixel signal core. The 6.1 display fields stay a stable prefix
// (same order/indices) so the display path is unaffected; the capture/grade per-pixel
// fields are appended. This is the single source of truth shared with crt-display.wgsl's
// Uniforms struct and webgpu-backend.ts's buffer write.
export const CRT_SIGNAL_UNIFORMS = [
  ...CRT_DISPLAY_UNIFORMS,
  // grade stage
  "u_irFalseColor", "u_printFadeC", "u_printFadeM", "u_printFadeY", "u_blackCrush",
  "u_highlightRolloff", "u_haze", "u_polaroidCrossover", "u_monoTintStrength", "u_irHotspot",
  // per-pixel geometric / chroma / level
  "u_pixelSize", "u_lineJitter", "u_timeWobble", "u_headSwitching", "u_chromaDelay",
  "u_crossColor", "u_dropouts", "u_interlacing", "u_tapeCrease", "u_gateWeave",
  "u_gateJitterX", "u_gateJitterY", "u_gateRotation", "u_shutterJudder", "u_rfInterference",
  // per-pixel colour artifacts
  "u_filmGrain", "u_grainSize", "u_grainChromaticity", "u_filmDust", "u_filmScratches",
  "u_filmHalation", "u_noise", "u_quantization",
  // pointwise post-passes
  "u_scanlineProfile", "u_subpixelLayout", "u_cctvMono",
  // grain hash coefficients (gf*12.9898, gfy*78.233) REDUCED mod 2pi (exact for integer
  // pixel coords by sine periodicity) and carried as double-f32 (hi+lo). The reduction
  // shrinks the GPU argument magnitude ~67k → ~400 so the emulated-f64 hash reproduces the
  // CPU grain field (the large magnitude was what broke it on GPU float behaviour).
  "u_grainCoefXHi", "u_grainCoefXLo", "u_grainCoefYHi", "u_grainCoefYLo",
  // Epic 6.3a: high-frequency post-process effects + the stuttered temporal frame (NOT the
  // real frame — u_frameIndex stays the real one for gate offsets).
  "u_exposurePump", "u_whiteBalanceDrift", "u_ghosting", "u_focusBreathing", "u_temporalFrame",
  // Epic 6.3b: screen-space self-composite filters + resolution-reduction effects.
  // (u_quantization already exists from 6.2 — deferred there, implemented in 6.3b.)
  "u_burnIn", "u_generationLoss", "u_copyGen", "u_mediaAge", "u_restoration",
  "u_macroBlocking",
  // Resolution-reduction derived params (width-dependent block math, mirrors the CPU).
  "u_mbLowW", "u_mbLowH", "u_mbAlpha", "u_qLowW", "u_qLowH", "u_qLevels", "u_qAlpha",
  // Epic 6.3c: OSD overlay active flag (set by the backend from the supplied osdSource — the
  // CPU-rendered OSD is composited over T_graded by fs_osd between grade and optics).
  "u_osdActive",
  // Epic 6.3d: NTSC/PAL format pre-pass (resolution reduction + composite encode/decode),
  // applied to the source before grade. Set by the backend from the supplied formatProfile
  // (renderOptions); 0/inactive by default so non-format looks are unchanged.
  "u_fmtActive", "u_fmtLowW", "u_fmtLowH", "u_fmtComposite", "u_fmtSystem",
  "u_fmtChromaRadius", "u_fmtDotAmt",
] as const;

// Storage-condition severity factor (CPU crt-renderer-full.js ~535).
const STORAGE_SEVERITY: Record<string, number> = { ideal: 0.45, dry: 0.55, humid: 0.95, hot: 1.1, moldRisk: 1.45 };

const TWO_PI = 2 * Math.PI;
const reduceMod2Pi = (v: number) => v - TWO_PI * Math.round(v / TWO_PI);

// Pure params → uniform Float32Array for the signal shader (display + grade + per-pixel
// artifacts). The shader clamps ranges; this only packs and maps categoricals to codes.
export function buildSignalUniforms(
  params: Record<string, number | string>,
  ctx: { width: number; height: number; seconds: number; frameIndex: number; fps: number },
): Float32Array {
  const out = new Float32Array(CRT_SIGNAL_UNIFORMS.length);
  const set = (k: string, v: number) => { out[CRT_SIGNAL_UNIFORMS.indexOf(k)] = v; };
  // Display block (mirror buildUniforms).
  set("u_scan", n(params.scanlineStrength));
  set("u_mask", n(params.phosphorMask));
  // CPU defaults an UNSET maskType to "phosphor" (crt-renderer-full.js ~491), so match that
  // (a string maskType uses its own code). gpuSignalOK defaults the same way.
  set("u_maskType", MASK_CODES[typeof params.maskType === "string" ? params.maskType : "phosphor"] ?? 0);
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
  // Grade stage.
  set("u_irFalseColor", n(params.infraredFalseColor));
  set("u_printFadeC", n(params.printFadeCyan));
  set("u_printFadeM", n(params.printFadeMagenta));
  set("u_printFadeY", n(params.printFadeYellow));
  set("u_blackCrush", n(params.blackLevelCrush));
  set("u_highlightRolloff", n(params.highlightRollOff));
  set("u_haze", n(params.haze));
  set("u_polaroidCrossover", n(params.polaroidCrossover));
  set("u_monoTintStrength", n(params.monochromeTintStrength, 1));
  set("u_irHotspot", n(params.irHotspot));
  // Per-pixel geometric / chroma / level.
  set("u_pixelSize", n(params.pixelSize, 1));
  set("u_lineJitter", n(params.advancedLineJitter));
  set("u_timeWobble", n(params.advancedTimebaseWobble));
  set("u_headSwitching", n(params.advancedHeadSwitching));
  set("u_chromaDelay", n(params.advancedChromaDelay));
  set("u_crossColor", n(params.advancedCrossColor));
  set("u_dropouts", n(params.advancedDropouts));
  set("u_interlacing", n(params.advancedInterlacing));
  set("u_tapeCrease", n(params.advancedTapeCrease));
  set("u_gateWeave", n(params.advancedFilmGateWeave));
  set("u_gateJitterX", n(params.gateJitterX));
  set("u_gateJitterY", n(params.gateJitterY));
  set("u_gateRotation", n(params.gateRotation));
  set("u_shutterJudder", n(params.shutterJudder));
  set("u_rfInterference", n(params.advancedRfInterference));
  // Per-pixel colour artifacts.
  set("u_filmGrain", n(params.advancedFilmGrain));
  set("u_grainSize", n(params.grainSize));
  set("u_grainChromaticity", n(params.grainChromaticity));
  set("u_filmDust", n(params.advancedFilmDust));
  set("u_filmScratches", n(params.advancedFilmScratches));
  set("u_filmHalation", n(params.advancedFilmHalation));
  set("u_noise", n(params.noise));
  set("u_quantization", n(params.advancedQuantization));
  // Pointwise post-passes.
  set("u_scanlineProfile", SCANLINE_PROFILE_CODES[String(params.scanlineProfile ?? "off")] ?? 0);
  set("u_subpixelLayout", SUBPIXEL_CODES[String(params.subpixelLayoutOverride ?? "none")] ?? 0);
  set("u_cctvMono", n(params.advancedCctvMonochrome));
  // Grain coefficients: gf = 1.91/(1+grainSize*2.2), gfy = 1.37/(1+grainSize*2.2). Fold the
  // hash coefficient in (gf*12.9898, gfy*78.233), reduce mod 2pi (f64), split to double-f32.
  const denom = 1 + n(params.grainSize) * 2.2;
  const coefX = reduceMod2Pi((1.91 / denom) * 12.9898);
  const coefY = reduceMod2Pi((1.37 / denom) * 78.233);
  set("u_grainCoefXHi", coefX);
  set("u_grainCoefXLo", coefX - Math.fround(coefX));
  set("u_grainCoefYHi", coefY);
  set("u_grainCoefYLo", coefY - Math.fround(coefY));
  // Epic 6.3a high-frequency effects.
  set("u_exposurePump", n(params.advancedExposurePump));
  set("u_whiteBalanceDrift", n(params.advancedWhiteBalanceDrift));
  set("u_ghosting", n(params.advancedGhosting));
  set("u_focusBreathing", n(params.advancedFocusBreathing));
  // Stuttered temporal frame (CPU crt-renderer-full.js ~574-576): holds frames so temporal
  // noise repeats. u_frameIndex stays the REAL frame (gate offsets use it).
  const fs = Math.max(0, Math.min(1, n(params.advancedFrameStutter)));
  const hold = Math.floor(fs * fs * 6);
  set("u_temporalFrame", hold > 0 ? ctx.frameIndex - (ctx.frameIndex % (hold + 1)) : ctx.frameIndex);
  // Epic 6.3b.
  set("u_burnIn", n(params.burnInGhost));
  set("u_generationLoss", n(params.advancedGenerationLoss));
  set("u_copyGen", Math.max(0, Math.min(20, Math.round(n(params.copyGenerationCount)))));
  set("u_restoration", n(params.restorationPassLevel));
  set("u_macroBlocking", n(params.advancedMacroBlocking));
  // u_quantization is already set above (6.2 colour-artifacts block).
  // mediaAge folds the storage severity into the CPU's ageNorm = mediaAgeYears/100 * severity.
  const severity = STORAGE_SEVERITY[String(params.storageCondition ?? "ideal")] ?? 0.45;
  set("u_mediaAge", (Math.max(0, Math.min(100, n(params.mediaAgeYears))) / 100) * severity);

  // Resolution-reduction block math (CPU crt-renderer-full.js ~1115-1142). Width-dependent, so
  // it is derived here; the shader's down/up passes consume the low-res dims directly.
  const pixelCount = Math.max(1, ctx.width * ctx.height);
  const perfBudget = Math.min(1, 921600 / pixelCount);
  const resolutionPenalty = Math.min(1, 2073600 / pixelCount);
  const mb = Math.max(0, Math.min(1, n(params.advancedMacroBlocking)));
  const effectiveMacro = mb * (0.3 + perfBudget * 0.45 + resolutionPenalty * 0.25);
  const blockSize = Math.max(6, Math.round(6 + effectiveMacro * 22 + (1 - resolutionPenalty) * 14));
  set("u_mbLowW", Math.max(1, Math.floor(ctx.width / blockSize)));
  set("u_mbLowH", Math.max(1, Math.floor(ctx.height / blockSize)));
  set("u_mbAlpha", Math.min(0.72, 0.12 + effectiveMacro * 0.44));
  const q = Math.max(0, Math.min(1, n(params.advancedQuantization)));
  const sampleScale = Math.max(1, Math.round(1 + q * (2 + (1 - perfBudget) * 4)));
  set("u_qLowW", Math.max(1, Math.floor(ctx.width / sampleScale)));
  set("u_qLowH", Math.max(1, Math.floor(ctx.height / sampleScale)));
  set("u_qLevels", Math.max(6, Math.round(72 - q * 60)));
  set("u_qAlpha", Math.min(0.92, 0.35 + q * 0.55));
  // Format pre-pass (6.3d) defaults to inactive identity (low dims = full size); the backend
  // overrides these from the formatProfile in render(). lowW/lowH must be non-zero (fmtSample
  // divides by them) even on the inactive path.
  set("u_fmtLowW", ctx.width);
  set("u_fmtLowH", ctx.height);
  return out;
}
