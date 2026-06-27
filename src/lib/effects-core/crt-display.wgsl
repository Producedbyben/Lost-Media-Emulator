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
// Scope: the CRT/display family (display-axis params only). The hybrid's gpuFamilyOK
// gate routes any advanced/capture/inter-frame/grade/OSD look to CPU, so those are
// intentionally NOT implemented here. The source texture is pre-cover-fitted by the
// backend, so uv 0..1 maps 1:1 to the framed picture (matches CPU fitCanvas).
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
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var u_samp: sampler;
@group(0) @binding(2) var u_tex: texture_2d<f32>;
// Composite pass only: the sharp optics texture (T_optics) alongside the blurred input.
@group(0) @binding(3) var u_tex_sharp: texture_2d<f32>;

const PI: f32 = 3.14159265358979;
const BLUR_RADIUS: i32 = 18;

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
  let p = a * b;
  let SPLIT: f32 = 4097.0;
  let ca = SPLIT * a;
  let cb = SPLIT * b;
  let ah = ca - (ca - a);
  let al = a - ah;
  let bh = cb - (cb - b);
  let bl = b - bh;
  let err = ((ah * bh - p) + ah * bl + al * bh) + al * bl;
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
fn seededNoise(x: f32, y: f32, frame: f32) -> f32 {
  var acc = addDD(termDD(x, C0_HI, C0_LO), termDD(y, C1_HI, C1_LO));
  acc = addDD(acc, termDD(frame, C2_HI, C2_LO));
  let k = round(acc.x / TWO_PI_HI);
  let kp = twoProd(k, TWO_PI_HI);
  acc = addDD(acc, vec2<f32>(-kp.x, -kp.y));
  acc = addDD(acc, vec2<f32>(-(k * TWO_PI_LO), 0.0));
  let reduced = acc.x + acc.y;
  let s = sin(reduced) * 43758.5453;
  return s - floor(s);
}

// CPU sampleBilinear maps u in [0,1] to source x = u*(W-1) and interpolates between
// integer pixels. A GPU linear sampler interpolates around tc*W-0.5, so this half-texel
// correction makes the two agree.
fn tcx(u: f32) -> f32 { return (u * (U.u_resolutionX - 1.0) + 0.5) / U.u_resolutionX; }
fn tcy(v: f32) -> f32 { return (v * (U.u_resolutionY - 1.0) + 0.5) / U.u_resolutionY; }

fn samp(u: f32, v: f32) -> vec3<f32> {
  return textureSampleLevel(u_tex, u_samp, vec2<f32>(tcx(u), tcy(v)), 0.0).rgb;
}

// The full per-pixel display-optics chain (barrel resample, pixel quant, chroma
// aberration, soft-tap bleed, phosphor mask, scanlines), matching crt-renderer-full.js
// render() for display-axis params. Returns the "workCanvas" colour in 0..1.
fn optics(px: f32, py: f32) -> vec3<f32> {
  let W = U.u_resolutionX;
  let H = U.u_resolutionY;

  let nx = (px / (W - 1.0)) * 2.0 - 1.0;
  let ny = (py / (H - 1.0)) * 2.0 - 1.0;
  let r2 = nx * nx + ny * ny;

  let barrel = clamp(U.u_barrel, -0.3, 0.3);
  let warpCurve = 0.22 + 0.78 * r2;
  let warp = max(0.35, 1.0 + barrel * warpCurve);
  let cornerWarp = max(0.35, 1.0 + barrel * (0.22 + 0.78 * 2.0));
  let overscan = select(1.0, cornerWarp, barrel < 0.0);
  let srcNx = (nx / warp) * overscan;
  let srcNy = (ny / warp) * overscan;
  let u = clamp(srcNx * 0.5 + 0.5, 0.0, 1.0);
  let v = clamp(srcNy * 0.5 + 0.5, 0.0, 1.0);

  // pixelSize is fixed at 1 for the CRT/display family this increment.
  let ca = U.u_ca;
  let edgeShift = ca * (0.0012 + r2 * 0.0045) * 0.8;
  let qx = floor(u * W) + 0.5;
  let qy = floor(v * H) + 0.5;
  let qu = clamp(qx / W, 0.0, 1.0);
  let qv = clamp(qy / H, 0.0, 1.0);
  let ru = qu + edgeShift * (0.7 + abs(nx));
  let bu = qu - edgeShift * (0.7 + abs(nx));

  let red = samp(ru, qv).r;
  let green = samp(qu, qv).g;
  let blue = samp(bu, qv).b;

  let mask = U.u_mask;
  let bloomAmt = U.u_bloom;
  let maskScale = max(0.25, U.u_maskScale);
  let maskActive = mask > 0.0 && U.u_maskType > 0.5;

  var redSoft = red;
  var greenSoft = green;
  var blueSoft = blue;
  if (bloomAmt > 0.0 || maskActive) {
    let stepX = 1.0 / (W - 1.0);
    let stepY = 1.0 / (H - 1.0);
    let redH = samp(ru - stepX, qv).r * 0.5 + samp(ru + stepX, qv).r * 0.5;
    let greenH = samp(qu - stepX, qv).g * 0.5 + samp(qu + stepX, qv).g * 0.5;
    let blueH = samp(bu - stepX, qv).b * 0.5 + samp(bu + stepX, qv).b * 0.5;
    let redV = samp(ru, qv - stepY).r * 0.5 + samp(ru, qv + stepY).r * 0.5;
    let greenV = samp(qu, qv - stepY).g * 0.5 + samp(qu, qv + stepY).g * 0.5;
    let blueV = samp(bu, qv - stepY).b * 0.5 + samp(bu, qv + stepY).b * 0.5;
    let luminance = max(max(red, green), blue);
    let bleed = (bloomAmt * 0.26 + mask * 0.08) * pow(luminance, 0.75);
    let blend = min(0.45, bleed);
    redSoft = red * (1.0 - blend) + (redH * 0.62 + redV * 0.38) * blend;
    greenSoft = green * (1.0 - blend) + (greenH * 0.62 + greenV * 0.38) * blend;
    blueSoft = blue * (1.0 - blend) + (blueH * 0.62 + blueV * 0.38) * blend;
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
    if (mt > 4.5) {                       // phosphor (5): vertical RGB triad
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
    }
  }

  // Scanlines — phase from maskY (= floor(py/maskScale)), matching the CPU.
  let scanPhase = sin((floor(py / maskScale) + 0.5) * PI);
  let scanlineGain = 1.0 - U.u_scan * (0.35 + 0.65 * (0.5 + 0.5 * scanPhase));

  return clamp(
    vec3<f32>(redSoft * scanlineGain * rMask,
              greenSoft * scanlineGain * gMask,
              blueSoft * scanlineGain * bMask),
    vec3<f32>(0.0), vec3<f32>(1.0));
}

const LUMA: vec3<f32> = vec3<f32>(0.2126, 0.7152, 0.0722);

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

  return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
