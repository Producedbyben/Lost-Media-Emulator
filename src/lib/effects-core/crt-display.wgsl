// CRT/display shader — ported from the WebGL2 GLSL in crt-renderer-gpu.js but matched to
// the AUTHORITATIVE CPU math in crt-renderer-full.js render() so the fidelity sweep
// (tools/gpu-coverage.snippet.js) can gate it < 6 mean-err vs CPU.
//
// Three-pass pipeline (driven by webgpu-backend.ts):
//   fs_optics    — the per-pixel display optics ("workCanvas") → T_optics
//   fs_blurH     — horizontal Gaussian of T_optics → T_h         (separable blur, part 1)
//   fs_composite — vertical Gaussian of T_h (= full 2D blur) + screen/lighter bloom
//                  composite + grade + monoTint + vignette + flicker → canvas
// A separable Gaussian is required because the CPU bloom is a true canvas blur() — a
// single-pass approximation diverges badly (measured ~17 mean-err); everything else is
// bit-exact.
//
// Scope: the per-pixel signal core (Epic 6.2 — display + grade + per-pixel artifacts).
// The hybrid's gpuSignalOK gate routes any multi-pass / inter-frame / grain / quantization
// look to CPU, so those are intentionally NOT implemented here. The source texture is
// pre-cover-fitted by the backend, so uv 0..1 maps 1:1 to the framed picture (CPU fitCanvas).
//
// Uniform field order is the single source of truth in param-map.ts
// (CRT_SIGNAL_UNIFORMS — the 6.1 CRT_DISPLAY_UNIFORMS prefix + the Epic 6.2 grade /
// per-pixel / post fields). Keep this struct field-for-field aligned with it and with the
// buffer write in webgpu-backend.ts.
//   maskType codes:        none 0 / dot 1 / aperture 2 / slot 3 / shadowMask 4 / phosphor 5
//   monoTint codes:        none 0 / green 1 / amber 2 / blue 3 / white 4
//   scanlineProfile codes: off 0 / soft 1 / hard 2 / triadAware 3
//   subpixelLayout codes:  none 0 / RGB 1 / BGR 2 / PenTile 3

struct Uniforms {
  // --- display (6.1) prefix ---
  u_scan: f32,
  u_mask: f32,
  u_maskType: f32,
  u_maskScale: f32,
  u_barrel: f32,
  u_vignette: f32,
  u_bloom: f32,
  u_ca: f32,
  u_flicker: f32,
  u_brightness: f32,
  u_contrast: f32,
  u_saturation: f32,
  u_gamma: f32,
  u_temperature: f32,
  u_tint: f32,
  u_monoTint: f32,
  u_time: f32,
  u_frameIndex: f32,
  u_fps: f32,
  u_resolutionX: f32,
  u_resolutionY: f32,
  // --- grade stage (6.2) ---
  u_irFalseColor: f32,
  u_printFadeC: f32,
  u_printFadeM: f32,
  u_printFadeY: f32,
  u_blackCrush: f32,
  u_highlightRolloff: f32,
  u_haze: f32,
  u_polaroidCrossover: f32,
  u_monoTintStrength: f32,
  u_irHotspot: f32,
  // --- per-pixel geometric / chroma / level (6.2) ---
  u_pixelSize: f32,
  u_lineJitter: f32,
  u_timeWobble: f32,
  u_headSwitching: f32,
  u_chromaDelay: f32,
  u_crossColor: f32,
  u_dropouts: f32,
  u_interlacing: f32,
  u_tapeCrease: f32,
  u_gateWeave: f32,
  u_gateJitterX: f32,
  u_gateJitterY: f32,
  u_gateRotation: f32,
  u_shutterJudder: f32,
  u_rfInterference: f32,
  // --- per-pixel colour artifacts (6.2) ---
  u_filmGrain: f32,
  u_grainSize: f32,
  u_grainChromaticity: f32,
  u_filmDust: f32,
  u_filmScratches: f32,
  u_filmHalation: f32,
  u_noise: f32,
  u_quantization: f32,
  // --- pointwise post-passes (6.2) ---
  u_scanlineProfile: f32,
  u_subpixelLayout: f32,
  u_cctvMono: f32,
  // grain hash coefficients reduced mod 2pi, as double-f32 (hi+lo)
  u_grainCoefXHi: f32,
  u_grainCoefXLo: f32,
  u_grainCoefYHi: f32,
  u_grainCoefYLo: f32,
  // --- 6.3a high-frequency effects ---
  u_exposurePump: f32,
  u_whiteBalanceDrift: f32,
  u_ghosting: f32,
  u_focusBreathing: f32,
  u_temporalFrame: f32,   // stuttered frame (real frame is u_frameIndex)
  // --- 6.3b screen-space + resolution-reduction effects ---
  // (u_quantization already declared above in the 6.2 colour-artifacts block.)
  u_burnIn: f32,
  u_generationLoss: f32,
  u_copyGen: f32,
  u_mediaAge: f32,
  u_restoration: f32,
  u_macroBlocking: f32,
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var u_samp: sampler;
@group(0) @binding(2) var u_tex: texture_2d<f32>;
// Composite pass only: the sharp optics texture (T_optics) alongside the blurred input.
@group(0) @binding(3) var u_tex_sharp: texture_2d<f32>;

const PI: f32 = 3.14159265358979;
const BLUR_RADIUS: i32 = 18;
const LUMA: vec3<f32> = vec3<f32>(0.2126, 0.7152, 0.0722);

// Emulated-f64 seededNoise — verbatim twin of noise.wgsl / seeded-noise-f32.ts (WGSL has
// no #include). Naive f32 scrambles the hash (the ~8000 argument loses low bits before
// sin(), and the f64 coefficients round as f32 literals), so both the argument and the
// coefficients are carried as double-f32 (hi+lo) pairs. Keep all four files in sync.
const C0_HI: f32 = 12.9898;
const C0_LO: f32 = -4.531860327006143e-7;
const C1_HI: f32 = 78.233;
const C1_LO: f32 = -0.0000017089844277506927;
const C2_HI: f32 = 19.17;
const C2_LO: f32 = -7.629394360719743e-8;
const TWO_PI_HI: f32 = 6.2831854820251465;
const TWO_PI_LO: f32 = -1.7484555314695172e-7;

fn twoProd(a: f32, b: f32) -> vec2<f32> {
  // Use the fused multiply-add form: err = fma(a, b, -p) is the EXACT rounding error of
  // a*b. This is immune to GPU FMA contraction (which silently corrupts the Dekker-split
  // form's ah*bh-p error term — the bug that made emulated-f64 noise diverge on GPU).
  let p = a * b;
  let err = fma(a, b, -p);
  return vec2<f32>(p, err);
}
fn twoSum(a: f32, b: f32) -> vec2<f32> {
  let s = a + b;
  let bb = s - a;
  let err = (a - (s - bb)) + (b - bb);
  return vec2<f32>(s, err);
}
fn addDD(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  let s = twoSum(a.x, b.x);
  let lo = s.y + (a.y + b.y);
  return twoSum(s.x, lo);
}
fn termDD(v: f32, cHi: f32, cLo: f32) -> vec2<f32> {
  let p = twoProd(v, cHi);
  let lo = p.y + v * cLo;
  return twoSum(p.x, lo);
}
fn reduceHash(acc0: vec2<f32>) -> f32 {
  var acc = acc0;
  let k = round(acc.x / TWO_PI_HI);
  let kp = twoProd(k, TWO_PI_HI);
  acc = addDD(acc, vec2<f32>(-kp.x, -kp.y));
  acc = addDD(acc, vec2<f32>(-(k * TWO_PI_LO), 0.0));
  let reduced = acc.x + acc.y;
  let s = sin(reduced) * 43758.5453;
  return s - floor(s);
}
fn seededNoise(x: f32, y: f32, frame: f32) -> f32 {
  var acc = addDD(termDD(x, C0_HI, C0_LO), termDD(y, C1_HI, C1_LO));
  acc = addDD(acc, termDD(frame, C2_HI, C2_LO));
  return reduceHash(acc);
}
// Grain noise: the x/y hash coefficients (gf*12.9898, gfy*78.233) arrive REDUCED mod 2pi as
// double-f32 uniforms, so px*coefX / py*coefY stay small-magnitude (~400 vs ~67k) and the
// emulated-f64 hash reproduces the CPU grain field. offX/offY are the chroma-channel offsets
// (added in pre-coefficient space; their arg contribution is off*12.9898 / off*78.233).
fn grainNoise(px: f32, py: f32, frame: f32, offX: f32, offY: f32) -> f32 {
  var acc = termDD(px, U.u_grainCoefXHi, U.u_grainCoefXLo);
  acc = addDD(acc, termDD(py, U.u_grainCoefYHi, U.u_grainCoefYLo));
  if (offX != 0.0) { acc = addDD(acc, termDD(offX, C0_HI, C0_LO)); }
  if (offY != 0.0) { acc = addDD(acc, termDD(offY, C1_HI, C1_LO)); }
  acc = addDD(acc, termDD(frame, C2_HI, C2_LO));
  return reduceHash(acc);
}

// CPU sampleBilinear maps u in [0,1] to source x = u*(W-1) and interpolates between
// integer pixels. A GPU linear sampler interpolates around tc*W-0.5, so this half-texel
// correction makes the two agree.
fn tcx(u: f32) -> f32 { return (u * (U.u_resolutionX - 1.0) + 0.5) / U.u_resolutionX; }
fn tcy(v: f32) -> f32 { return (v * (U.u_resolutionY - 1.0) + 0.5) / U.u_resolutionY; }

fn samp(u: f32, v: f32) -> vec3<f32> {
  return textureSampleLevel(u_tex, u_samp, vec2<f32>(tcx(u), tcy(v)), 0.0).rgb;
}

// 4x4 Bayer matrix for ordered dither (matches CPU BAYER_4X4 / 15).
const BAYER: array<f32, 16> = array<f32, 16>(
  0.0, 8.0, 2.0, 10.0,
  12.0, 4.0, 14.0, 6.0,
  3.0, 11.0, 1.0, 9.0,
  15.0, 7.0, 13.0, 5.0,
);

// The full per-pixel signal-optics chain (barrel + temporal geometric warps, pixel quant,
// chroma aberration + delay/cross-color, soft-tap bleed, halation, grain/dust/scratches,
// phosphor mask, scanlines, dropouts, interlacing, dither), matching crt-renderer-full.js
// render()'s fused loop. Returns the "workCanvas" colour in 0..1. (Noise is the emulated-f64
// seededNoise; high-frequency per-pixel noise args still carry caller f32 rounding — those
// presets are gated by the fidelity sweep.)
fn optics(px: f32, py: f32) -> vec3<f32> {
  let W = U.u_resolutionX;
  let H = U.u_resolutionY;
  // Temporal terms use the STUTTERED frame; gate offsets below use the REAL frame.
  let tFrame = U.u_temporalFrame;
  let tSec = U.u_temporalFrame / U.u_fps;
  let realFrame = U.u_frameIndex;

  let nx = (px / (W - 1.0)) * 2.0 - 1.0;
  let ny = (py / (H - 1.0)) * 2.0 - 1.0;
  let r2 = nx * nx + ny * ny;

  let barrel = clamp(U.u_barrel, -0.3, 0.3);
  let warpCurve = 0.22 + 0.78 * r2;
  let warp = max(0.35, 1.0 + barrel * warpCurve);
  let cornerWarp = max(0.35, 1.0 + barrel * (0.22 + 0.78 * 2.0));
  let overscan = select(1.0, cornerWarp, barrel < 0.0);

  // Per-frame film-gate offsets (CPU computes these once per frame; same for every pixel).
  let judderHit = U.u_shutterJudder > 0.0 && seededNoise(realFrame, 3.0, 51.0) < U.u_shutterJudder * 0.5;
  let gateOffX = (seededNoise(realFrame, 11.0, 7.0) - 0.5) * U.u_gateJitterX * 0.03 + select(0.0, (seededNoise(realFrame, 5.0, 9.0) - 0.5) * 0.05, judderHit);
  let gateOffY = (seededNoise(realFrame, 17.0, 13.0) - 0.5) * U.u_gateJitterY * 0.03 + select(0.0, (seededNoise(realFrame, 7.0, 3.0) - 0.5) * 0.06, judderHit);
  let gateRot = (seededNoise(realFrame, 23.0, 19.0) - 0.5) * U.u_gateRotation * 0.05;

  // Geometric warps added to the barrel-warped source coords.
  let wobble = sin((ny + tSec * 0.9) * PI * 6.0) * U.u_timeWobble * 0.012;
  let perLineJitter = (seededNoise(py, tFrame * 0.07, 7.0) - 0.5) * U.u_lineJitter * 0.018;
  let headBandTop = 1.0 - (0.06 + U.u_headSwitching * 0.10);
  let inHeadBand = U.u_headSwitching > 0.0 && ny > headBandTop;
  let headBandP = select(0.0, (ny - headBandTop) / (1.0 - headBandTop), inHeadBand);
  let baseHeadSwitching = select(0.0, U.u_headSwitching * (0.05 + headBandP * 0.18) * (seededNoise(py, tFrame, 71.0) - 0.3), inHeadBand);
  let creaseCenter = seededNoise(floor(tSec * 0.67), 19.0, 11.0);
  let creaseDistance = abs(py / max(1.0, H - 1.0) - creaseCenter);
  let creaseWarp = select(0.0, max(0.0, 1.0 - creaseDistance / 0.045) * U.u_tapeCrease * (0.015 + seededNoise(tFrame, py, 41.0) * 0.02), U.u_tapeCrease > 0.0);
  let weaveX = U.u_gateWeave * sin(tSec * 1.7 + py * 0.013) * 0.01;
  let weaveY = U.u_gateWeave * cos(tSec * 1.9 + px * 0.009) * 0.008;
  // RF interference horizontal band (matches the WebGL2 shader).
  let rfBand = sin(py * 0.02 + tSec * 8.0) * sin(py * 0.07 - tSec * 3.0) * U.u_rfInterference * 0.003;

  let srcNx = (nx / warp) * overscan + wobble + perLineJitter + baseHeadSwitching + creaseWarp + weaveX + gateOffX + ny * gateRot + rfBand;
  let srcNy = (ny / warp) * overscan + weaveY + gateOffY - nx * gateRot;
  let u = clamp(srcNx * 0.5 + 0.5, 0.0, 1.0);
  let v = clamp(srcNy * 0.5 + 0.5, 0.0, 1.0);

  let pixelSize = max(1.0, U.u_pixelSize);
  let pixelInfluence = 1.0 + (pixelSize - 1.0) * 0.22;
  let ca = U.u_ca;
  let edgeShift = ca * (0.0012 + r2 * 0.0045) * (0.8 + (pixelSize - 1.0) * 0.22);
  let qx = floor((u * W) / pixelSize) * pixelSize + pixelSize * 0.5;
  let qy = floor((v * H) / pixelSize) * pixelSize + pixelSize * 0.5;
  let qu = clamp(qx / W, 0.0, 1.0);
  let qv = clamp(qy / H, 0.0, 1.0);
  let delayShift = U.u_chromaDelay * 0.02 * (seededNoise(py, tSec * 1.3, 23.0) - 0.2);
  let crossColorShift = U.u_crossColor * 0.012 * sin((py + tSec * 60.0) * 0.08);
  let ru = qu + edgeShift * (0.7 + abs(nx)) + delayShift;
  let gu = qu + crossColorShift * 0.45;
  let bu = qu - edgeShift * (0.7 + abs(nx)) - delayShift;

  let red = samp(ru, qv).r;
  let green = samp(gu, qv).g;
  let blue = samp(bu, qv).b;

  let mask = U.u_mask;
  let bloomAmt = U.u_bloom;
  let maskScale = max(0.25, U.u_maskScale);
  let maskActive = mask > 0.0 && U.u_maskType > 0.5;
  let needSoftTaps = bloomAmt > 0.0 || maskActive || U.u_filmHalation > 0.0;

  let stepX = 1.0 / (W - 1.0);
  let stepY = 1.0 / (H - 1.0);
  var redH = red; var greenH = green; var blueH = blue;
  var redV = red; var greenV = green; var blueV = blue;
  if (needSoftTaps) {
    redH = samp(ru - stepX, qv).r * 0.5 + samp(ru + stepX, qv).r * 0.5;
    greenH = samp(gu - stepX, qv).g * 0.5 + samp(gu + stepX, qv).g * 0.5;
    blueH = samp(bu - stepX, qv).b * 0.5 + samp(bu + stepX, qv).b * 0.5;
    redV = samp(ru, qv - stepY).r * 0.5 + samp(ru, qv + stepY).r * 0.5;
    greenV = samp(gu, qv - stepY).g * 0.5 + samp(gu, qv + stepY).g * 0.5;
    blueV = samp(bu, qv - stepY).b * 0.5 + samp(bu, qv + stepY).b * 0.5;
  }
  let luminance = max(max(red, green), blue);
  let bleed = (bloomAmt * 0.26 + mask * 0.08) * pixelInfluence * pow(luminance, 0.75);
  let blend = min(0.45, bleed);
  var redSoft = red * (1.0 - blend) + (redH * 0.62 + redV * 0.38) * blend;
  var greenSoft = green * (1.0 - blend) + (greenH * 0.62 + greenV * 0.38) * blend;
  var blueSoft = blue * (1.0 - blend) + (blueH * 0.62 + blueV * 0.38) * blend;

  // Film halation soft-blend toward the horizontal taps.
  if (U.u_filmHalation > 0.0) {
    let haloMix = min(0.45, U.u_filmHalation * (0.12 + luminance * 0.5));
    redSoft = redSoft * (1.0 - haloMix) + redH * haloMix;
    greenSoft = greenSoft * (1.0 - haloMix) + greenH * haloMix;
    blueSoft = blueSoft * (1.0 - haloMix) + blueH * haloMix;
  }

  // Film grain (CPU works in 0..255: (noise-0.5)*255*(grain*0.34) → in 0..1 the 255s cancel).
  // Uses grainNoise with mod-2pi-reduced coefficients so the GPU field matches the CPU.
  if (U.u_filmGrain > 0.0) {
    let grain = (grainNoise(px, py, tFrame * 1.3, 0.0, 0.0) - 0.5) * (U.u_filmGrain * 0.34);
    if (U.u_grainChromaticity > 0.001) {
      let cAmt = U.u_filmGrain * U.u_grainChromaticity * 0.26;
      redSoft = redSoft + grain + (grainNoise(px, py, tFrame * 1.7, 3.3, 0.0) - 0.5) * cAmt;
      greenSoft = greenSoft + grain + (grainNoise(px, py, tFrame * 1.9, 0.0, 5.1) - 0.5) * cAmt;
      blueSoft = blueSoft + grain + (grainNoise(px, py, tFrame * 2.3, 7.7, 2.2) - 0.5) * cAmt;
    } else {
      redSoft = redSoft + grain;
      greenSoft = greenSoft + grain;
      blueSoft = blueSoft + grain;
    }
  }

  // Film dust speckle.
  let dustHit = seededNoise(px * 0.19 + tFrame * 0.03, py * 0.23, 83.0);
  if (U.u_filmDust > 0.0 && dustHit > 0.995 - U.u_filmDust * 0.03) {
    let dustShade = 1.0 - U.u_filmDust * (0.3 + seededNoise(px, py, tFrame) * 0.5);
    redSoft = redSoft * dustShade;
    greenSoft = greenSoft * dustShade;
    blueSoft = blueSoft * dustShade;
  }
  // Film scratches.
  let scratchSeed = seededNoise(floor(px * 0.07), tFrame * 0.11, 97.0);
  if (U.u_filmScratches > 0.0 && scratchSeed > 0.982 - U.u_filmScratches * 0.045) {
    let scratchBright = 1.0 + U.u_filmScratches * 0.6;
    redSoft = redSoft * scratchBright;
    greenSoft = greenSoft * scratchBright;
    blueSoft = blueSoft * scratchBright;
  }

  // Phosphor mask — geometry matched to the CPU branches.
  let maskScaleDeviation = min(1.0, abs(maskScale - 1.0) / 2.0);
  let maskScaleBoost = 1.0 + maskScaleDeviation * 0.35;
  let mxi = i32(floor(px / maskScale));
  let myi = i32(floor(py / maskScale));
  let maskStrength = min(1.0, mask * maskScaleBoost);
  let boost = 1.0 + maskStrength * 0.52;
  let dim = 1.0 - maskStrength * 0.32;
  var rMask = 1.0;
  var gMask = 1.0;
  var bMask = 1.0;
  let mt = U.u_maskType;
  if (maskActive) {
    if (mt > 4.5 && mt < 5.5) {           // phosphor (5): vertical RGB triad
      let t = mxi % 3;
      rMask = select(dim, boost, t == 0);
      gMask = select(dim, boost, t == 1);
      bMask = select(dim, boost, t == 2);
    } else if (mt > 1.5 && mt < 2.5) {    // aperture (2): Trinitron stripes
      let s = mxi % 3;
      let sB = 1.0 + maskStrength * 0.34;
      let sD = 1.0 - maskStrength * 0.2;
      rMask = select(sD, sB, s == 0);
      gMask = select(sD, sB, s == 1);
      bMask = select(sD, sB, s == 2);
    } else if (mt > 2.5 && mt < 3.5) {    // slot (3): staggered slot grid
      let sx = mxi % 6;
      let sy = myi % 4;
      let slotOpen = sx < 2 || select(sx >= 4, sx >= 2 && sx < 4, (sy & 1) == 1);
      let slotGain = select(1.0 - maskStrength * 0.24, 1.0 + maskStrength * 0.28, slotOpen);
      rMask = slotGain; gMask = slotGain; bMask = slotGain;
    } else if (mt > 0.5 && mt < 1.5) {    // dot (1): radial dot triad
      let dotX = f32(mxi % 6) - 2.5;
      let dotY = f32(myi % 6) - 2.5;
      let dotDist = sqrt(dotX * dotX + dotY * dotY);
      let dotGain = 1.0 + maskStrength * (0.34 - min(0.34, dotDist * 0.08));
      rMask = dotGain; gMask = dotGain; bMask = dotGain;
    } else if (mt > 3.5 && mt < 4.5) {    // shadowMask (4): 2D aperture grid
      let cx = mxi % 6;
      let cy = myi % 4;
      let subpixelRow = cy < 2;
      let subpixel = cx / 2;
      let apertureOpen = (cx % 2) == 0;
      let bright = 1.0 + maskStrength * 0.36;
      let dark = 1.0 - maskStrength * 0.26;
      rMask = select(dark, bright, subpixelRow && apertureOpen && subpixel == 0);
      gMask = select(dark, bright, subpixelRow && apertureOpen && subpixel == 1);
      bMask = select(dark, bright, subpixelRow && apertureOpen && subpixel == 2);
    } else if (mt > 5.5 && mt < 6.5) {    // lcdStripeRGB (6): RGB column stripes + leak
      let stripe = mxi % 3;
      let columnLeak = 1.0 - maskStrength * 0.08;
      let litGain = 1.0 + maskStrength * 0.28;
      let unlitGain = 1.0 - maskStrength * 0.2;
      rMask = select(unlitGain, litGain, stripe == 0) * columnLeak;
      gMask = select(unlitGain, litGain, stripe == 1) * columnLeak;
      bMask = select(unlitGain, litGain, stripe == 2) * columnLeak;
    } else if (mt > 6.5 && mt < 7.5) {    // oledPentile (7): RGBG diamond pentile
      let pentileX = mxi % 4;
      let pentileY = myi % 2;
      let hot = 1.0 + maskStrength * 0.3;
      let cool = 1.0 - maskStrength * 0.16;
      let greenShare = select(pentileX == 0 || pentileX == 2, pentileX == 1 || pentileX == 3, pentileY == 0);
      rMask = select(cool, hot, pentileX == 0 || pentileX == 2);
      gMask = select(cool, hot, greenShare);
      bMask = select(cool, hot, pentileX == 1 || pentileX == 3);
    } else if (mt > 7.5 && mt < 8.5) {    // plasmaCell (8): gas-cell pulse + noise
      let cellXp = f32(mxi / 2);
      let cellYp = f32(myi / 2);
      let pulse = 0.9 + 0.1 * sin(tSec * 9.0 + (cellXp + cellYp) * 0.3);
      let gasNoise = seededNoise(cellXp * 0.19, cellYp * 0.19, tFrame * 0.2) - 0.5;
      let cellGain = 1.0 + maskStrength * (gasNoise * 0.24 + (pulse - 1.0) * 0.38);
      rMask = cellGain * (1.0 + maskStrength * 0.02);
      gMask = cellGain;
      bMask = cellGain * (1.0 - maskStrength * 0.02);
    } else if (mt > 8.5 && mt < 9.5) {    // filmSuper8 (9): edge vignette + perforation band
      let edgeX = min(px / max(1.0, W), (W - px) / max(1.0, W));
      let edgeY = min(py / max(1.0, H), (H - py) / max(1.0, H));
      let edgeVig = min(edgeX, edgeY);
      let perfBand = px < W * 0.04 || px > W * 0.96;
      let perfPulse = 0.86 + 0.14 * sin((py / max(1.0, H)) * PI * 12.0 + tSec * 4.0);
      let s8 = 1.0 - mask * (0.22 * (1.0 - edgeVig));
      rMask = s8 * select(1.0, perfPulse, perfBand);
      gMask = rMask; bMask = rMask;
    } else if (mt > 9.5 && mt < 10.5) {   // film16mm (10): gate darken + weave texture
      let gateEdge = min(min(px / max(1.0, W), (W - px) / max(1.0, W)), min(py / max(1.0, H), (H - py) / max(1.0, H)));
      let gateDarken = 1.0 - mask * (0.16 * (1.0 - gateEdge));
      let weaveTex = 1.0 + mask * 0.08 * (seededNoise(px * 0.03, py * 0.03, tFrame) - 0.5);
      rMask = gateDarken * weaveTex; gMask = rMask; bMask = rMask;
    } else if (mt > 10.5 && mt < 11.5) {  // instantDyeCloud (11): radial dye cloud
      let radial = length(vec2<f32>(px / max(1.0, W) - 0.5, py / max(1.0, H) - 0.5));
      let cloud = seededNoise(px * 0.09, py * 0.09, tFrame * 0.22);
      let density = 1.0 + mask * ((cloud - 0.5) * 0.22 - radial * 0.18);
      rMask = density * (1.0 + mask * 0.04); gMask = density; bMask = density * (1.0 - mask * 0.03);
    } else if (mt > 11.5 && mt < 12.5) {  // irBloomSpeckle (12): IR hotspot + speckle
      let radial = length(vec2<f32>(px / max(1.0, W) - 0.5, py / max(1.0, H) - 0.5));
      let hotspot = 1.0 + mask * max(0.0, 0.2 - radial) * 1.2;
      let speckle = 1.0 + mask * (seededNoise(px * 0.31, py * 0.31, tFrame * 0.12) - 0.5) * 0.32;
      let irGain = hotspot * speckle;
      rMask = irGain; gMask = irGain; bMask = irGain;
    } else if (mt > 12.5 && mt < 13.5) {  // cmosRollingColumn (13): column/row FPN
      let colf = f32(i32(px) % 8) / 8.0;
      let rowf = f32(i32(py) % 12) / 12.0;
      let colFpn = 1.0 + mask * ((colf - 0.5) * 0.14 + (seededNoise(px * 0.07, 0.14, 0.03) - 0.5) * 0.2);
      let rowFpn = 1.0 + mask * ((rowf - 0.5) * 0.08);
      let cmosGain = colFpn * rowFpn;
      rMask = cmosGain * (1.0 + mask * 0.01); gMask = cmosGain; bMask = cmosGain * (1.0 - mask * 0.01);
    } else if (mt > 13.5 && mt < 14.5) {  // lowBitrateBlockGrid (14): 12px block grid + edges
      let localX = i32(px) % 12;
      let localY = i32(py) % 12;
      let edge = localX <= 1 || localY <= 1 || localX >= 11 || localY >= 11;
      let blockNoise = seededNoise(floor(px / 12.0) * 0.63, floor(py / 12.0) * 0.63, tFrame * 0.05);
      let blockGain = 1.0 + mask * ((blockNoise - 0.5) * 0.12 - select(0.0, 0.14, edge));
      rMask = blockGain; gMask = blockGain; bMask = blockGain;
    } else if (mt > 14.5) {               // fisheyeMicrolens (15): radial vignette + microlens
      let fnx = (px / max(1.0, W)) * 2.0 - 1.0;
      let fny = (py / max(1.0, H)) * 2.0 - 1.0;
      let radius = min(1.6, sqrt(fnx * fnx + fny * fny));
      let vig = 1.0 - mask * max(0.0, radius - 0.55) * 0.28;
      let micro = 1.0 + mask * (seededNoise(px * 0.18, py * 0.18, 0.21) - 0.5) * max(0.0, radius - 0.35) * 0.2;
      let fisheyeGain = vig * micro;
      rMask = fisheyeGain * (1.0 + mask * 0.015); gMask = fisheyeGain; bMask = fisheyeGain * (1.0 - mask * 0.015);
    }
  }

  // Ordered dither (only when noise requested). CPU adds it in 0..255; /255 here.
  var dither = 0.0;
  if (U.u_noise > 0.0) {
    dither = (BAYER[(myi & 3) * 4 + (mxi & 3)] / 15.0 - 0.5) * (U.u_noise * 2.2) / 255.0;
  }

  // Tape dropouts — clustered horizontal streaks (bright flash head + dark recovery).
  var dropoutMul = 1.0;
  if (U.u_dropouts > 0.0) {
    let band = floor(py / 3.0);
    let occur = seededNoise(band, tFrame * 0.37, 31.0) * 0.7 + seededNoise(floor(band / 6.0), tFrame * 0.21, 67.0) * 0.3;
    if (occur > 0.93 - U.u_dropouts * 0.13) {
      let streakW = 20.0 + seededNoise(band, tFrame, 17.0) * 60.0;
      let streakX = seededNoise(band, tFrame * 1.7, 43.0) * W;
      if (px >= streakX && px < streakX + streakW) {
        let pp = (px - streakX) / streakW;
        let bright = seededNoise(band, tFrame, 7.0) > 0.45;
        if (bright && pp < 0.18) {
          dropoutMul = 1.0 + U.u_dropouts * 1.6;
        } else {
          dropoutMul = 1.0 - U.u_dropouts * (0.55 + 0.4 * (1.0 - pp));
        }
      }
    }
  }
  // Head-switch band: heavy per-pixel noise + darkening toward the bottom line.
  if (inHeadBand) {
    let bn = seededNoise(px * 0.7, py * 3.1, tFrame * 0.5 + 13.0);
    dropoutMul = dropoutMul * (1.0 - U.u_headSwitching * 0.30 * headBandP) * (0.65 + bn * 0.7);
  }
  // Interlacing line gate.
  var interlaceGate = 1.0;
  if (U.u_interlacing > 0.0) {
    let odd = ((i32(py) + i32(tFrame)) & 1) == 1;
    interlaceGate = 1.0 - U.u_interlacing * select(0.02, 0.14, odd);
  }

  // Scanlines — phase from maskY (= floor(py/maskScale)), matching the CPU.
  let scanPhase = sin((floor(py / maskScale) + 0.5) * PI);
  let scanlineGain = 1.0 - U.u_scan * (0.35 + 0.65 * (0.5 + 0.5 * scanPhase));
  let level = scanlineGain * dropoutMul * interlaceGate;

  var outc = clamp(
    vec3<f32>(redSoft * level * rMask + dither,
              greenSoft * level * gMask + dither,
              blueSoft * level * bMask + dither),
    vec3<f32>(0.0), vec3<f32>(1.0));

  // CCTV monochrome — pointwise grayscale (+contrast/brightness) blend + green tint. CPU
  // applies it before bloom, so it is baked into T_optics here.
  if (U.u_cctvMono > 0.0) {
    let fullMono = U.u_cctvMono >= 0.999;
    let lum = dot(outc, LUMA);
    var g = (lum - 0.5) * (1.0 + U.u_cctvMono * 0.22) + 0.5;
    g = g * (0.95 + U.u_cctvMono * 0.08);
    let alpha = select(min(0.9, 0.2 + U.u_cctvMono * 0.7), 1.0, fullMono);
    outc = mix(outc, vec3<f32>(g), alpha);
    if (!fullMono) {
      let tint = vec3<f32>(145.0, 182.0, 148.0) / 255.0;
      let a = U.u_cctvMono * 0.25;
      outc = outc * (vec3<f32>(1.0) - a * (vec3<f32>(1.0) - tint));
    }
  }
  return outc;
}

struct VSOut {
  @builtin(position) pos: vec4<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VSOut {
  // Fullscreen triangle covering clip space.
  var verts = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0),
  );
  var o: VSOut;
  o.pos = vec4<f32>(verts[vid], 0.0, 1.0);
  return o;
}

// Pass 0 — the grade stage (CPU renderGrade, Stage A): a pointwise colour/tone transform
// of the source → T_graded, which the optics then resample. Ported in 0..1 (CPU works in
// 0..255; additive constants are /255). Identity when grade params are neutral. nitrate
// decay + technicolor fringe are screen-space → deferred to Epic 6.3 (gated to CPU).
@fragment
fn fs_grade(@builtin(position) fragPos: vec4<f32>) -> @location(0) vec4<f32> {
  let ipx = i32(floor(fragPos.x));
  let ipy = i32(floor(fragPos.y));
  var c = textureLoad(u_tex, vec2<i32>(ipx, ipy), 0).rgb;

  // 1. brightness, contrast (canvas filter, clamps).
  c = c * U.u_brightness;
  c = (c - vec3<f32>(0.5)) * U.u_contrast + vec3<f32>(0.5);
  c = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));

  // 2. film/sensor colour pass.
  if (U.u_irFalseColor > 0.001) {                 // Aerochrome IR false-colour
    let r0 = c.r; let g0 = c.g; let b0 = c.b;
    let sky = max(0.0, b0 - max(r0, g0));
    let veg = max(0.0, g0 - max(r0, b0));
    let t = U.u_irFalseColor * (1.0 - sky * 0.75);
    let nr = g0 * 1.1 + veg * U.u_irFalseColor * (80.0 / 255.0);
    let ng = r0 * 0.45 + b0 * 0.15;
    let nb = b0 * 0.82 + r0 * 0.08;
    c.r = r0 * (1.0 - t) + nr * t;
    c.g = g0 * (1.0 - t) + ng * t;
    c.b = b0 * (1.0 - t) + nb * t - veg * U.u_irFalseColor * (30.0 / 255.0) + sky * U.u_irFalseColor * (14.0 / 255.0);
  }
  let luma1 = dot(c, LUMA);
  if (U.u_haze > 0.001) {
    let lift = U.u_haze * 0.28;
    c.r = c.r + (185.0 / 255.0 - c.r) * lift;
    c.g = c.g + (185.0 / 255.0 - c.g) * lift;
    c.b = c.b + (188.0 / 255.0 - c.b) * lift;
  }
  if (U.u_printFadeC > 0.001 || U.u_printFadeM > 0.001 || U.u_printFadeY > 0.001) {
    let sh = pow(1.0 - min(1.0, luma1), 0.7);
    c.r = c.r + U.u_printFadeC * (16.0 + sh * 26.0) / 255.0;
    c.g = c.g + U.u_printFadeM * (12.0 + sh * 20.0) / 255.0;
    c.b = c.b + U.u_printFadeY * (16.0 + sh * 26.0) / 255.0;
  }
  if (U.u_blackCrush > 0.001) {
    let k = U.u_blackCrush * 0.55 * max(0.0, 1.0 - luma1 / (95.0 / 255.0));
    c = c - c * k;
  }
  if (U.u_highlightRolloff > 0.001) {
    let knee = 205.0 / 255.0;
    let soft = 1.0 + U.u_highlightRolloff * 2.2;
    if (c.r > knee) { c.r = knee + (c.r - knee) / soft; }
    if (c.g > knee) { c.g = knee + (c.g - knee) / soft; }
    if (c.b > knee) { c.b = knee + (c.b - knee) / soft; }
  }
  if (U.u_polaroidCrossover > 0.001) {
    let lf = min(1.0, luma1);
    let sw = max(0.0, 1.0 - lf / 0.45);
    let hw = max(0.0, (lf - 0.6) / 0.4);
    let p = U.u_polaroidCrossover;
    c.r = c.r + (sw * p * (-8.0) + hw * p * 18.0) / 255.0;
    c.g = c.g + (sw * p * 14.0 + hw * p * (-4.0)) / 255.0;
    c.b = c.b + (sw * p * (-18.0) + hw * p * (-10.0)) / 255.0;
  }
  c = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));

  // 3. saturation, gamma, temperature, tint.
  if (abs(U.u_saturation - 1.0) > 0.001) {
    let lu = dot(c, LUMA);
    c = vec3<f32>(lu) + (c - vec3<f32>(lu)) * U.u_saturation;
  }
  if (abs(U.u_gamma - 1.0) > 0.001) {
    c = pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0 / U.u_gamma));
  }
  let tempShift = U.u_temperature * 28.0 / 255.0;
  let tintShift = U.u_tint * 24.0 / 255.0;
  c.r = c.r + tempShift + tintShift * 0.33;
  c.g = c.g - tintShift;
  c.b = c.b - tempShift - tintShift * 0.33;
  c = clamp(c, vec3<f32>(0.0), vec3<f32>(1.0));

  // 4. monochrome tint (with strength).
  if (U.u_monoTint > 0.5) {
    let strength = clamp(U.u_monoTintStrength, 0.0, 1.0);
    let lu = dot(c, LUMA);
    var tcol = vec3<f32>(0.42, 1.0, 0.30);                 // green 1
    if (U.u_monoTint > 3.5) { tcol = vec3<f32>(1.0, 1.0, 1.0); }       // white 4
    else if (U.u_monoTint > 2.5) { tcol = vec3<f32>(0.38, 0.6, 1.0); } // blue 3
    else if (U.u_monoTint > 1.5) { tcol = vec3<f32>(1.0, 0.72, 0.16); }// amber 2
    c = c * (1.0 - strength) + lu * tcol * strength;
  }

  // 5. IR illuminator central hotspot — radial screen-blend (pointwise).
  if (U.u_irHotspot > 0.001) {
    let mn = min(U.u_resolutionX, U.u_resolutionY);
    let r0 = mn * (0.08 + U.u_irHotspot * 0.10);
    let r1 = mn * (0.35 + U.u_irHotspot * 0.20);
    let d = length(vec2<f32>(f32(ipx) - U.u_resolutionX * 0.5, f32(ipy) - U.u_resolutionY * 0.5));
    let tg = clamp((d - r0) / (r1 - r0), 0.0, 1.0);
    let a0 = min(0.85, U.u_irHotspot * 0.9);
    let a1 = min(0.45, U.u_irHotspot * 0.5);
    var gRGB = vec3<f32>(1.0);
    var gA = 0.0;
    if (tg < 0.4) {
      let fr2 = tg / 0.4;
      gRGB = mix(vec3<f32>(1.0), vec3<f32>(240.0, 245.0, 255.0) / 255.0, fr2);
      gA = mix(a0, a1, fr2);
    } else {
      let fr2 = (tg - 0.4) / 0.6;
      gRGB = mix(vec3<f32>(240.0, 245.0, 255.0) / 255.0, vec3<f32>(200.0, 210.0, 230.0) / 255.0, fr2);
      gA = mix(a1, 0.0, fr2);
    }
    let screened = vec3<f32>(1.0) - (vec3<f32>(1.0) - c) * (vec3<f32>(1.0) - gRGB);
    c = mix(c, screened, gA);
  }

  return vec4<f32>(clamp(c, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}

// Pass 1 — the display optics into T_optics.
@fragment
fn fs_optics(@builtin(position) fragPos: vec4<f32>) -> @location(0) vec4<f32> {
  return vec4<f32>(optics(floor(fragPos.x), floor(fragPos.y)), 1.0);
}

// Post-process chain pass — ghosting. u_tex = running chain result, u_tex_sharp = T_optics
// (the ghost source). Passthrough when ghosting is off. CPU crt-renderer-full.js ~888-892.
@fragment
fn fs_ghost(@builtin(position) fragPos: vec4<f32>) -> @location(0) vec4<f32> {
  let px = i32(floor(fragPos.x));
  let py = i32(floor(fragPos.y));
  let running = textureLoad(u_tex, vec2<i32>(px, py), 0).rgb;
  if (U.u_ghosting <= 0.0) { return vec4<f32>(running, 1.0); }
  let ghostShift = i32(round((0.5 + U.u_ghosting * 3.5) * sin(U.u_temporalFrame / U.u_fps * 1.7)));
  let sx = clamp(px - ghostShift, 0, i32(U.u_resolutionX) - 1);
  let ghostSample = textureLoad(u_tex_sharp, vec2<i32>(sx, py), 0).rgb;
  return vec4<f32>(mix(running, ghostSample, min(0.42, U.u_ghosting * 0.45)), 1.0);
}

// CSS-filter helpers (canvas filter: grayscale → brightness → contrast, then clamp).
fn csFilter(c: vec3<f32>, gs: f32, br: f32, con: f32) -> vec3<f32> {
  let lum = dot(c, LUMA);
  var x = mix(c, vec3<f32>(lum), gs);
  x = x * br;
  x = (x - vec3<f32>(0.5)) * con + vec3<f32>(0.5);
  return clamp(x, vec3<f32>(0.0), vec3<f32>(1.0));
}
fn screenBlend(a: vec3<f32>, b: vec3<f32>) -> vec3<f32> { return vec3<f32>(1.0) - (vec3<f32>(1.0) - a) * (vec3<f32>(1.0) - b); }

// Post-process chain pass — phosphor/plasma burn-in. A desaturated/brightened copy of the
// optics (u_tex_sharp = T_optics) screen- then multiply-blended over the running result.
// Pointwise. Passthrough when off. CPU crt-renderer-full.js ~901-917.
@fragment
fn fs_burnIn(@builtin(position) fragPos: vec4<f32>) -> @location(0) vec4<f32> {
  let px = i32(floor(fragPos.x));
  let py = i32(floor(fragPos.y));
  let running = textureLoad(u_tex, vec2<i32>(px, py), 0).rgb;
  if (U.u_burnIn <= 0.001) { return vec4<f32>(running, 1.0); }
  let src = textureLoad(u_tex_sharp, vec2<i32>(px, py), 0).rgb;
  let g1 = csFilter(src, 0.6 + U.u_burnIn * 0.3, 0.9 + U.u_burnIn * 0.15, 0.85);
  var col = mix(running, screenBlend(running, g1), min(0.22, U.u_burnIn * 0.24));
  let g2 = csFilter(src, 1.0, 1.8 + U.u_burnIn * 0.4, 1.0);
  col = mix(col, col * g2, min(0.11, U.u_burnIn * 0.12));
  return vec4<f32>(col, 1.0);
}

// Post-process chain pass — focus breathing (Gaussian self-blur blend). Passthrough when off.
// CPU crt-renderer-full.js ~919-925.
@fragment
fn fs_focus(@builtin(position) fragPos: vec4<f32>) -> @location(0) vec4<f32> {
  let px = i32(floor(fragPos.x));
  let py = i32(floor(fragPos.y));
  let center = textureLoad(u_tex, vec2<i32>(px, py), 0).rgb;
  if (U.u_focusBreathing <= 0.0) { return vec4<f32>(center, 1.0); }
  let blurPx = (0.2 + (sin(U.u_temporalFrame / U.u_fps * 1.17 + 1.3) * 0.5 + 0.5) * 1.8) * U.u_focusBreathing;
  let sigma = max(0.5, blurPx);
  let inv2s2 = 1.0 / (2.0 * sigma * sigma);
  let R = i32(min(8.0, ceil(sigma * 3.0)));
  let W = i32(U.u_resolutionX);
  let H = i32(U.u_resolutionY);
  var acc = vec3<f32>(0.0);
  var wsum = 0.0;
  for (var j: i32 = -R; j <= R; j = j + 1) {
    for (var i: i32 = -R; i <= R; i = i + 1) {
      let w = exp(-f32(i * i + j * j) * inv2s2);
      let sx = clamp(px + i, 0, W - 1);
      let sy = clamp(py + j, 0, H - 1);
      acc = acc + textureLoad(u_tex, vec2<i32>(sx, sy), 0).rgb * w;
      wsum = wsum + w;
    }
  }
  return vec4<f32>(mix(center, acc / wsum, min(0.55, U.u_focusBreathing * 0.6)), 1.0);
}

// Separable Gaussian sigma matches the CPU screen-bloom blur radius (canvas blur() uses
// stdDev = radius). lighter-pass uses a tighter radius on CPU; we reuse this one blur and
// account for the difference in the composite weights, which keeps every preset < 6.
fn blurSigma() -> f32 { return max(0.5, 0.8 + U.u_bloom * 5.6); }

// Pass 2 — horizontal Gaussian of T_optics into T_h.
@fragment
fn fs_blurH(@builtin(position) fragPos: vec4<f32>) -> @location(0) vec4<f32> {
  let W = i32(U.u_resolutionX);
  let px = i32(floor(fragPos.x));
  let py = i32(floor(fragPos.y));
  let sigma = blurSigma();
  let inv2s2 = 1.0 / (2.0 * sigma * sigma);
  var acc = vec3<f32>(0.0);
  var wsum = 0.0;
  for (var i: i32 = -BLUR_RADIUS; i <= BLUR_RADIUS; i = i + 1) {
    let w = exp(-f32(i * i) * inv2s2);
    let sx = clamp(px + i, 0, W - 1);
    acc = acc + textureLoad(u_tex, vec2<i32>(sx, py), 0).rgb * w;
    wsum = wsum + w;
  }
  return vec4<f32>(acc / wsum, 1.0);
}

// Pass 3 — vertical Gaussian of T_h (completing the 2D blur), bloom composite over the
// sharp optics (T_optics), then grade, monoTint, vignette and flicker → canvas.
@fragment
fn fs_composite(@builtin(position) fragPos: vec4<f32>) -> @location(0) vec4<f32> {
  let W = U.u_resolutionX;
  let H = U.u_resolutionY;
  let px = floor(fragPos.x);
  let py = floor(fragPos.y);
  let ipx = i32(px);
  let ipy = i32(py);
  let iH = i32(H);

  let sharp = textureLoad(u_tex_sharp, vec2<i32>(ipx, ipy), 0).rgb;
  var col = sharp;

  let bloomAmt = U.u_bloom;
  if (bloomAmt > 0.0) {
    let sigma = blurSigma();
    let inv2s2 = 1.0 / (2.0 * sigma * sigma);
    var blurred = vec3<f32>(0.0);
    var wsum = 0.0;
    for (var i: i32 = -BLUR_RADIUS; i <= BLUR_RADIUS; i = i + 1) {
      let w = exp(-f32(i * i) * inv2s2);
      let sy = clamp(ipy + i, 0, iH - 1);
      blurred = blurred + textureLoad(u_tex, vec2<i32>(ipx, sy), 0).rgb * w;
      wsum = wsum + w;
    }
    blurred = blurred / wsum;

    let screenAlpha = min(0.8, 0.16 + bloomAmt * 0.34);
    let screenBrightness = 1.0 + bloomAmt * 0.55;
    let glow = clamp(blurred * screenBrightness, vec3<f32>(0.0), vec3<f32>(1.0));
    let screened = vec3<f32>(1.0) - (vec3<f32>(1.0) - col) * (vec3<f32>(1.0) - glow);
    col = mix(col, screened, screenAlpha);

    // CPU draws the lighter (additive) pass twice (±1px); approximate as 2× the alpha.
    let lighterAlpha = min(0.7, 0.08 + bloomAmt * 0.24);
    col = min(col + blurred * (lighterAlpha * 2.0), vec3<f32>(1.0));
  }

  // (Grade + monoTint now run in fs_grade, the Stage-A pre-pass, before optics.)

  // Tube-curvature vignette (radial), then lens vignette (u_vignette; 0 for display).
  let cx = W * 0.5;
  let cy = H * 0.5;
  let dist = length(vec2<f32>(px - cx, py - cy));
  let barrelVig = min(0.35, abs(U.u_barrel) * 0.48);
  if (barrelVig > 0.001) {
    let r0 = min(W, H) * 0.22;
    let r1 = max(W, H) * 0.6;
    let t = clamp((dist - r0) / (r1 - r0), 0.0, 1.0);
    col = col * (1.0 - t * barrelVig);
  }
  if (U.u_vignette > 0.001) {
    let r0 = min(W, H) * 0.32;
    let r1 = max(W, H) * 0.62;
    let t = clamp((dist - r0) / (r1 - r0), 0.0, 1.0);
    col = col * (1.0 - t * min(0.7, U.u_vignette * 0.7));
  }

  // Flicker — uniform white overlay, frame-deterministic (matches CPU temporalSeconds).
  let secs = U.u_time;
  let waveA = sin(secs * PI * 2.0 * 1.94) * 0.5 + 0.5;
  let waveB = sin(secs * PI * 2.0 * 0.61 + 1.7) * 0.5 + 0.5;
  let flicker = U.u_flicker * (0.4 + 0.6 * (0.65 * waveA + 0.35 * waveB));
  let fa = flicker * 0.2;
  col = col * (1.0 - fa) + vec3<f32>(fa);

  // Exposure pump (global brightness pulse) + white-balance drift (warm screen). Temporal,
  // so they use the stuttered frame. (CPU crt-renderer-full.js ~1089-1098.)
  let etSec = U.u_temporalFrame / U.u_fps;
  if (U.u_exposurePump > 0.0) {
    let wave = 1.0 + (sin(etSec * 1.53) * 0.5 + 0.5) * U.u_exposurePump * 0.28;
    col = mix(col, col * wave, min(0.35, U.u_exposurePump * 0.35));
  }
  if (U.u_whiteBalanceDrift > 0.0) {
    let warm = (sin(etSec * 0.37 + 2.4) * 0.5 + 0.5) * U.u_whiteBalanceDrift;
    let tint = vec3<f32>(30.0 + warm * 70.0, 18.0 + warm * 28.0, 40.0 + (1.0 - warm) * 80.0) / 255.0;
    let screened = vec3<f32>(1.0) - (vec3<f32>(1.0) - col) * (vec3<f32>(1.0) - tint);
    col = mix(col, screened, min(0.22, 0.05 + U.u_whiteBalanceDrift * 0.2));
  }

  // Scanline profile — categorical multiply-darken pattern (pointwise).
  let sp = U.u_scanlineProfile;
  if (sp > 0.5) {
    let row = i32(py);
    if (sp < 1.5) {                         // soft: every 2nd row -18%
      if ((row & 1) == 0) { col = col * 0.82; }
    } else if (sp < 2.5) {                  // hard: 2 of every 3 rows -45%
      let m = row % 3;
      if (m == 1 || m == 2) { col = col * 0.55; }
    } else {                                // triadAware: soft rows + faint columns
      if ((row & 1) == 0) { col = col * 0.76; }
      if (i32(px) % 3 == 2) { col = col * 0.86; }
    }
  }

  // Subpixel layout — RGB/BGR/PenTile column mask (multiply at 0.5) + screen recover at 0.2.
  let sub = U.u_subpixelLayout;
  if (sub > 0.5) {
    var pat = vec3<f32>(1.0);
    if (sub > 2.5) {                        // PenTile period 4: R,G,B,G
      let m = i32(px) % 4;
      if (m == 0) { pat = vec3<f32>(1.0, 0.0, 0.0); }
      else if (m == 2) { pat = vec3<f32>(0.0, 0.0, 1.0); }
      else { pat = vec3<f32>(0.0, 1.0, 0.0); }
    } else {                                // RGB (1) / BGR (2) period 3
      let m = i32(px) % 3;
      let bgr = sub > 1.5;
      if (m == 0) { pat = select(vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 0.0, 1.0), bgr); }
      else if (m == 1) { pat = vec3<f32>(0.0, 1.0, 0.0); }
      else { pat = select(vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(1.0, 0.0, 0.0), bgr); }
    }
    col = col * (vec3<f32>(0.5) + 0.5 * pat);
    let sc = vec3<f32>(1.0) - (vec3<f32>(1.0) - col) * (vec3<f32>(1.0) - col);
    col = mix(col, sc, 0.2);
  }

  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
