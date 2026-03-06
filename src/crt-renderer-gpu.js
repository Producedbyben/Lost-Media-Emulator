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

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = v_uv;
  vec2 n = uv * 2.0 - 1.0;
  float r2 = dot(n, n);
  float barrel = clamp(u_barrel, -0.3, 0.3);
  float warp = max(0.35, 1.0 + barrel * (0.22 + 0.78 * r2));
  float cornerWarp = max(0.35, 1.0 + barrel * (0.22 + 0.78 * 2.0));
  float overscan = (barrel < 0.0) ? cornerWarp : 1.0;
  vec2 suv = (n / warp) * overscan;
  uv = clamp(suv * 0.5 + 0.5, 0.0, 1.0);

  float jitter = (noise(vec2(floor(gl_FragCoord.y), u_time)) - 0.5) * u_lineJitter * 0.008;
  jitter += sin(u_time * 17.0 + gl_FragCoord.y * 0.06) * u_timeWobble * 0.004;
  uv.x += jitter;

  float psize = max(1.0, u_pixelSize);
  vec2 q = floor((uv * u_resolution) / psize) * psize + psize * 0.5;
  vec2 quv = clamp(q / u_resolution, 0.0, 1.0);

  float edgeShift = u_ca * (0.0012 + r2 * 0.0045) * (0.8 + (psize - 1.0) * 0.22);
  vec2 ruv = vec2(clamp(quv.x + edgeShift * (0.7 + abs(n.x)), 0.0, 1.0), quv.y);
  vec2 guv = quv;
  vec2 buv = vec2(clamp(quv.x - edgeShift * (0.7 + abs(n.x)), 0.0, 1.0), quv.y);

  vec3 c;
  c.r = texture(u_tex, ruv).r;
  c.g = texture(u_tex, guv).g;
  c.b = texture(u_tex, buv).b;

  float scanPhase = sin((gl_FragCoord.y + 0.5) * 3.1415926);
  float scanlineGain = 1.0 - u_scan * (0.35 + 0.65 * (0.5 + 0.5 * scanPhase));
  c *= scanlineGain;

  float triad = mod(gl_FragCoord.x, 3.0);
  float boost = 1.0 + u_mask * 0.52;
  float dim = 1.0 - u_mask * 0.32;
  c.r *= (triad < 0.5) ? boost : dim;
  c.g *= (triad >= 0.5 && triad < 1.5) ? boost : dim;
  c.b *= (triad >= 1.5 && triad < 2.5) ? boost : dim;

  float n1 = noise(gl_FragCoord.xy + u_time * 53.0) - 0.5;
  c += n1 * (0.008 + u_noise * 0.018);

  vec3 bloomTap = texture(u_tex, uv + vec2(1.0 / u_resolution.x, 0.0)).rgb;
  bloomTap += texture(u_tex, uv - vec2(1.0 / u_resolution.x, 0.0)).rgb;
  c += bloomTap * (u_bloom * 0.08);

  if (u_ghosting > 0.0) {
    vec3 ghost = texture(u_tex, uv + vec2((2.0 + u_ghosting * 6.0) / u_resolution.x, 0.0)).rgb;
    c = mix(c, ghost, min(0.22, u_ghosting * 0.2));
  }

  float flicker = (0.4 + 0.6 * (0.65 * (sin(u_time * 12.2) * 0.5 + 0.5) + 0.35 * (sin(u_time * 3.8 + 1.7) * 0.5 + 0.5))) * u_flicker;
  c += flicker * 0.2;

  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

export class CRTRendererGPU {
  static isSupported() {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
    return !!gl;
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
  }

  setImage(img, sourceScale = 1) {
    const inputWidth = img.naturalWidth || img.videoWidth || img.width;
    const inputHeight = img.naturalHeight || img.videoHeight || img.height;
    const scale = Math.max(0.1, Math.min(1, sourceScale || 1));
    this.sourceCanvas.width = Math.max(1, Math.round(inputWidth * scale));
    this.sourceCanvas.height = Math.max(1, Math.round(inputHeight * scale));
    const ctx = this.sourceCanvas.getContext("2d");
    ctx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    ctx.drawImage(img, 0, 0, inputWidth, inputHeight, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    this.hasImage = true;
  }

  render(outCtx, width, height, seconds, params) {
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.sourceCanvas);

    const setUniform = (name, value, type = "1f") => {
      const location = gl.getUniformLocation(this.program, name);
      if (!location) return;
      if (type === "2f") gl.uniform2f(location, value[0], value[1]);
      else gl.uniform1f(location, value);
    };

    setUniform("u_time", seconds);
    setUniform("u_scan", params.scanlineStrength || 0);
    setUniform("u_mask", params.phosphorMask || 0);
    setUniform("u_barrel", params.barrelDistortion || 0);
    setUniform("u_bloom", params.bloom || 0);
    setUniform("u_flicker", params.flicker || 0);
    setUniform("u_ca", params.chromaticAberration || 0);
    setUniform("u_noise", params.noise || 0);
    setUniform("u_pixelSize", params.pixelSize || 1);
    setUniform("u_lineJitter", params.advancedLineJitter || 0);
    setUniform("u_timeWobble", params.advancedTimebaseWobble || 0);
    setUniform("u_ghosting", params.advancedGhosting || 0);
    setUniform("u_resolution", [width, height], "2f");

    const posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    outCtx.drawImage(this.canvas, 0, 0, width, height);
  }
}
