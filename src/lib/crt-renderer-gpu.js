// WebGL2 CRT Renderer — GPU-accelerated fragment shader pipeline
// Covers: barrel distortion, scanlines, phosphor mask, bloom, flicker,
// chromatic aberration, noise, pixel size, line jitter, time wobble,
// ghosting, brightness/contrast/saturation/gamma/temperature/tint,
// interlacing, vignette, film grain, quantization, RF interference

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${log}`);
  }
  return shader;
}

function createProgram(gl, vsSource, fsSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${log}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

const VS = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
uniform sampler2D u_tex;
uniform float u_time;
uniform float u_scan;
uniform float u_mask;
uniform float u_barrel;
uniform float u_bloom;
uniform float u_flicker;
uniform float u_ca;
uniform float u_noise;
uniform float u_pixelSize;
uniform vec2 u_resolution;
uniform float u_lineJitter;
uniform float u_timeWobble;
uniform float u_ghosting;

// Grading uniforms
uniform float u_brightness;
uniform float u_contrast;
uniform float u_saturation;
uniform float u_gamma;
uniform float u_temperature;
uniform float u_tint;

// Extra effects
uniform float u_interlacing;
uniform float u_filmGrain;
uniform float u_quantization;
uniform float u_rfInterference;
uniform float u_vignette;
uniform float u_frameIndex;

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float filmGrainNoise(vec2 p, float t) {
  return fract(sin(dot(p + t * 0.7, vec2(17.0, 41.0))) * 43758.5453);
}

vec3 applyGrading(vec3 c) {
  // Brightness
  c *= u_brightness;
  
  // Contrast
  c = (c - 0.5) * u_contrast + 0.5;
  
  // Saturation
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(luma), c, u_saturation);
  
  // Gamma
  float invGamma = 1.0 / max(0.1, u_gamma);
  c = pow(max(c, vec3(0.0)), vec3(invGamma));
  
  // Temperature (warm/cool shift)
  c.r += u_temperature * 0.05;
  c.b -= u_temperature * 0.05;
  
  // Tint (green/magenta shift)
  c.g += u_tint * 0.04;
  
  return c;
}

void main() {
  vec2 uv = v_uv;
  vec2 n = uv * 2.0 - 1.0;
  float r2 = dot(n, n);
  
  // Barrel distortion
  float barrel = clamp(u_barrel, -0.3, 0.3);
  float warp = max(0.35, 1.0 + barrel * (0.22 + 0.78 * r2));
  float cornerWarp = max(0.35, 1.0 + barrel * (0.22 + 0.78 * 2.0));
  float overscan = (barrel < 0.0) ? cornerWarp : 1.0;
  vec2 suv = (n / warp) * overscan;
  uv = clamp(suv * 0.5 + 0.5, 0.0, 1.0);

  // Line jitter + time wobble
  float jitter = (noise(vec2(floor(gl_FragCoord.y), u_time)) - 0.5) * u_lineJitter * 0.008;
  jitter += sin(u_time * 17.0 + gl_FragCoord.y * 0.06) * u_timeWobble * 0.004;
  uv.x += jitter;

  // RF interference bands
  if (u_rfInterference > 0.0) {
    float band = sin(gl_FragCoord.y * 0.02 + u_time * 8.0) * sin(gl_FragCoord.y * 0.07 - u_time * 3.0);
    uv.x += band * u_rfInterference * 0.003;
  }

  // Pixel grid quantization
  float psize = max(1.0, u_pixelSize);
  vec2 q = floor((uv * u_resolution) / psize) * psize + psize * 0.5;
  vec2 quv = clamp(q / u_resolution, 0.0, 1.0);

  // Chromatic aberration
  float edgeShift = u_ca * (0.0012 + r2 * 0.0045) * (0.8 + (psize - 1.0) * 0.22);
  vec2 ruv = vec2(clamp(quv.x + edgeShift * (0.7 + abs(n.x)), 0.0, 1.0), quv.y);
  vec2 guv = quv;
  vec2 buv = vec2(clamp(quv.x - edgeShift * (0.7 + abs(n.x)), 0.0, 1.0), quv.y);

  vec3 c;
  c.r = texture(u_tex, ruv).r;
  c.g = texture(u_tex, guv).g;
  c.b = texture(u_tex, buv).b;

  // Interlacing
  if (u_interlacing > 0.0) {
    float line = mod(gl_FragCoord.y + u_frameIndex, 2.0);
    float interlaceDim = 1.0 - u_interlacing * 0.4 * step(1.0, line);
    c *= interlaceDim;
  }

  // Scanlines
  float scanPhase = sin((gl_FragCoord.y + 0.5) * 3.1415926);
  float scanlineGain = 1.0 - u_scan * (0.35 + 0.65 * (0.5 + 0.5 * scanPhase));
  c *= scanlineGain;

  // Phosphor mask (RGB triad)
  float triad = mod(gl_FragCoord.x, 3.0);
  float boost = 1.0 + u_mask * 0.52;
  float dim = 1.0 - u_mask * 0.32;
  c.r *= (triad < 0.5) ? boost : dim;
  c.g *= (triad >= 0.5 && triad < 1.5) ? boost : dim;
  c.b *= (triad >= 1.5 && triad < 2.5) ? boost : dim;

  // Noise (no baseline — only when requested)
  float n1 = noise(gl_FragCoord.xy + u_time * 53.0) - 0.5;
  c += n1 * (u_noise * 0.026);

  // Film grain
  if (u_filmGrain > 0.0) {
    float grain = (filmGrainNoise(gl_FragCoord.xy * 0.5, u_time) - 0.5) * u_filmGrain * 0.12;
    c += grain;
  }

  // Bloom (horizontal blur tap)
  vec3 bloomTap = texture(u_tex, uv + vec2(1.0 / u_resolution.x, 0.0)).rgb;
  bloomTap += texture(u_tex, uv - vec2(1.0 / u_resolution.x, 0.0)).rgb;
  bloomTap += texture(u_tex, uv + vec2(2.0 / u_resolution.x, 0.0)).rgb;
  bloomTap += texture(u_tex, uv - vec2(2.0 / u_resolution.x, 0.0)).rgb;
  c += bloomTap * (u_bloom * 0.05);

  // Ghosting
  if (u_ghosting > 0.0) {
    vec3 ghost = texture(u_tex, uv + vec2((2.0 + u_ghosting * 6.0) / u_resolution.x, 0.0)).rgb;
    c = mix(c, ghost, min(0.22, u_ghosting * 0.2));
  }

  // Flicker
  float flicker = (0.4 + 0.6 * (0.65 * (sin(u_time * 12.2) * 0.5 + 0.5) + 0.35 * (sin(u_time * 3.8 + 1.7) * 0.5 + 0.5))) * u_flicker;
  c += flicker * 0.2;

  // Color quantization
  if (u_quantization > 0.0) {
    float levels = max(4.0, 256.0 - u_quantization * 240.0);
    c = floor(c * levels + 0.5) / levels;
  }

  // Apply grading
  c = applyGrading(c);

  // Vignette
  float vigDist = length(n) * 0.707;
  float vig = 1.0 - u_vignette * vigDist * vigDist;
  c *= vig;

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

// Cache uniform locations for perf
const UNIFORM_NAMES = [
  "u_time", "u_scan", "u_mask", "u_barrel", "u_bloom", "u_flicker",
  "u_ca", "u_noise", "u_pixelSize", "u_resolution", "u_lineJitter",
  "u_timeWobble", "u_ghosting", "u_brightness", "u_contrast",
  "u_saturation", "u_gamma", "u_temperature", "u_tint",
  "u_interlacing", "u_filmGrain", "u_quantization", "u_rfInterference",
  "u_vignette", "u_frameIndex",
];

export class CRTRendererGPU {
  static isSupported() {
    try {
      const c = document.createElement("canvas");
      const gl = c.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
      return !!gl;
    } catch {
      return false;
    }
  }

  constructor() {
    this.canvas = document.createElement("canvas");
    this.gl = this.canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    if (!this.gl) throw new Error("WebGL2 unavailable");

    this.program = createProgram(this.gl, VS, FS);
    this.positionBuffer = this.gl.createBuffer();
    this.texture = this.gl.createTexture();
    this.sourceCanvas = document.createElement("canvas");
    this.hasImage = false;

    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);

    // Cache uniform locations
    this.uniforms = {};
    for (const name of UNIFORM_NAMES) {
      this.uniforms[name] = this.gl.getUniformLocation(this.program, name);
    }
    this.posLoc = this.gl.getAttribLocation(this.program, "a_position");
  }

  setImage(img, sourceScale = 1) {
    const inputWidth = img.naturalWidth || img.videoWidth || img.width;
    const inputHeight = img.naturalHeight || img.videoHeight || img.height;
    const scale = Math.max(0.1, Math.min(1, sourceScale || 1));
    // Unified-memory fast path (Apple Silicon): when no downscale is requested,
    // hand the decoded frame straight to GL — texImage2D samples the element's
    // backing surface directly. This skips a full-frame CPU copy into an
    // intermediate 2D canvas every frame, which is the bulk of the per-frame
    // cost during video playback on shared-memory GPUs.
    if (scale >= 0.999) {
      this.directSource = img;
      this.hasImage = true;
      return;
    }
    // Downscale path keeps the intermediate canvas for the resampled copy.
    this.directSource = null;
    this.sourceCanvas.width = Math.max(1, Math.round(inputWidth * scale));
    this.sourceCanvas.height = Math.max(1, Math.round(inputHeight * scale));
    const ctx = this.sourceCanvas.getContext("2d");
    ctx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    ctx.drawImage(img, 0, 0, inputWidth, inputHeight, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    this.hasImage = true;
  }

  renderOriginal(outCtx, width, height) {
    outCtx.clearRect(0, 0, width, height);
    outCtx.fillStyle = "black";
    outCtx.fillRect(0, 0, width, height);
    if (!this.hasImage) return false;
    const src = this.directSource || this.sourceCanvas;
    const sw = src.naturalWidth || src.videoWidth || src.width;
    const sh = src.naturalHeight || src.videoHeight || src.height;
    const srcAspect = sw / sh;
    const dstAspect = width / height;
    let dw, dh, dx, dy;
    if (srcAspect > dstAspect) {
      dw = width; dh = width / srcAspect;
      dx = 0; dy = (height - dh) / 2;
    } else {
      dh = height; dw = height * srcAspect;
      dy = 0; dx = (width - dw) / 2;
    }
    outCtx.drawImage(src, 0, 0, sw, sh, dx, dy, dw, dh);
    return true;
  }

  render(outCtx, width, height, seconds, params, frameIndex, fps, renderOptions) {
    outCtx.clearRect(0, 0, width, height);
    outCtx.fillStyle = "black";
    outCtx.fillRect(0, 0, width, height);
    if (!this.hasImage) return;

    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;

    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // Upload the decoded frame directly (unified-memory zero-copy) when no
    // downscale was needed; otherwise upload the resampled intermediate canvas.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.directSource || this.sourceCanvas);

    const u = this.uniforms;
    const set1f = (loc, val) => { if (loc) gl.uniform1f(loc, val); };
    
    set1f(u.u_time, seconds);
    set1f(u.u_scan, params.scanlineStrength || 0);
    set1f(u.u_mask, params.phosphorMask || 0);
    set1f(u.u_barrel, params.barrelDistortion || 0);
    set1f(u.u_bloom, params.bloom || 0);
    set1f(u.u_flicker, params.flicker || 0);
    set1f(u.u_ca, params.chromaticAberration || 0);
    set1f(u.u_noise, params.noise || 0);
    set1f(u.u_pixelSize, params.pixelSize || 1);
    set1f(u.u_lineJitter, params.advancedLineJitter || 0);
    set1f(u.u_timeWobble, params.advancedTimebaseWobble || 0);
    set1f(u.u_ghosting, params.advancedGhosting || 0);
    
    // Grading
    set1f(u.u_brightness, params.imageBrightness ?? 1);
    set1f(u.u_contrast, params.imageContrast ?? 1);
    set1f(u.u_saturation, params.advancedSaturation ?? 1);
    set1f(u.u_gamma, params.imageGamma ?? 1);
    set1f(u.u_temperature, params.imageTemperature ?? 0);
    set1f(u.u_tint, params.imageTint ?? 0);
    
    // Extra effects
    set1f(u.u_interlacing, params.advancedInterlacing || 0);
    set1f(u.u_filmGrain, params.advancedFilmGrain || 0);
    set1f(u.u_quantization, params.advancedQuantization || 0);
    set1f(u.u_rfInterference, params.advancedRfInterference || 0);
    set1f(u.u_vignette, Math.min(0.35, Math.abs(params.barrelDistortion || 0) * 0.48)); // Vignette from tube curvature
    set1f(u.u_frameIndex, frameIndex || 0);
    
    if (u.u_resolution) gl.uniform2f(u.u_resolution, width, height);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.posLoc);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    outCtx.drawImage(this.canvas, 0, 0, width, height);
  }

  destroy() {
    const gl = this.gl;
    if (gl) {
      gl.deleteProgram(this.program);
      gl.deleteBuffer(this.positionBuffer);
      gl.deleteTexture(this.texture);
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    }
  }
}
