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
// (CRT_DISPLAY_UNIFORMS) — keep this struct field-for-field aligned with it and with the
// buffer write in webgpu-backend.ts.
//   maskType codes: none 0 / dot 1 / aperture 2 / slot 3 / shadowMask 4 / phosphor 5
//   monoTint codes: none 0 / green 1 / amber 2 / blue 3

struct Uniforms {
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
};

@group(0) @binding(0) var<uniform> U: Uniforms;
@group(0) @binding(1) var u_samp: sampler;
@group(0) @binding(2) var u_tex: texture_2d<f32>;
// Composite pass only: the sharp optics texture (T_optics) alongside the blurred input.
@group(0) @binding(3) var u_tex_sharp: texture_2d<f32>;

const PI: f32 = 3.14159265358979;
const BLUR_RADIUS: i32 = 18;

// Twin of CPU seededNoise (crt-renderer-full.js) + noise.wgsl. Kept here verbatim
// because WGSL has no #include; if you change one, change all three.
fn seededNoise(x: f32, y: f32, frame: f32) -> f32 {
  let v: f32 = sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - floor(v);
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

// Colour grade — identity for the display family (params default to neutral). Kept so
// the shader is a complete CRT/display shader; gpuFamilyOK guarantees neutral grade on
// the GPU path so this never diverges from the CPU render() reference.
fn applyGrade(c0: vec3<f32>) -> vec3<f32> {
  var c = c0 * U.u_brightness;
  c = (c - vec3<f32>(0.5)) * U.u_contrast + vec3<f32>(0.5);
  let luma = dot(c, vec3<f32>(0.2126, 0.7152, 0.0722));
  c = mix(vec3<f32>(luma), c, U.u_saturation);
  let invGamma = 1.0 / max(0.1, U.u_gamma);
  c = pow(max(c, vec3<f32>(0.0)), vec3<f32>(invGamma));
  c.r = c.r + U.u_temperature * 0.05;
  c.b = c.b - U.u_temperature * 0.05;
  c.g = c.g + U.u_tint * 0.04;
  return c;
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

  // Grade + monoTint (identity for the display family).
  col = applyGrade(col);
  if (U.u_monoTint > 0.5) {
    let lm = dot(col, vec3<f32>(0.2126, 0.7152, 0.0722));
    var tcol = vec3<f32>(0.42, 1.0, 0.30);
    if (U.u_monoTint > 2.5) { tcol = vec3<f32>(0.38, 0.6, 1.0); }
    else if (U.u_monoTint > 1.5) { tcol = vec3<f32>(1.0, 0.72, 0.16); }
    col = lm * tcol;
  }

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
