// WebGPU backend for the portable WGSL effects-core. Owns the GPUDevice / pipeline /
// bind-group lifecycle and renders the CRT/display shader into a caller-supplied 2D
// canvas context (the same render-to-2D-ctx contract the WebGL2 renderer uses, so the
// hybrid can swap it in transparently).
//
// Three render passes (matching crt-display.wgsl): optics → T_optics, a separable
// Gaussian (blurH → T_h, vertical blur folded into the composite), then the bloom
// composite + grade + vignette + flicker to the canvas. A real separable blur is needed
// because the CPU bloom is a true canvas blur() — anything cheaper diverges badly.
//
// `create()` resolves to null whenever WebGPU is unavailable or the pipeline fails to
// build, so callers fall back to WebGL2/CPU without a broken frame. Export is never
// routed here — this accelerates PREVIEW only.
import shaderCode from "./crt-display.wgsl?raw";
import { CRT_SIGNAL_UNIFORMS, buildSignalUniforms } from "./param-map";

// Uniform buffer rounded up to a 16-byte multiple (WGSL uniform layout); the packed
// Float32Array writes into the first part.
const UNIFORM_BYTES = Math.ceil((CRT_SIGNAL_UNIFORMS.length * 4) / 16) * 16;
const INTERMEDIATE_FORMAT: GPUTextureFormat = "rgba8unorm";

// Iterative dub chain (generationLoss / copyGen): each sub-draw is a ping-pong pass that reads
// its own {shiftSigned, sat, con, sigma, alpha} from a dynamic-offset slice of one uniform
// buffer. genLoss is ≤ 4 iterations × 2 sub-draws, copyGen ≤ 6 × 2 → 20 passes worst case.
const DUB_PARAM_FLOATS = 5;
const DUB_STRIDE = 256; // ≥ minUniformBufferOffsetAlignment (spec default 256).
const MAX_DUB_PASSES = 20;

// Indices of the resolution-reduction low-res dims in the packed uniform array (used to set the
// downscale-pass viewports without recomputing the block math the param-map already did).
const I_MB_LOWW = CRT_SIGNAL_UNIFORMS.indexOf("u_mbLowW");
const I_MB_LOWH = CRT_SIGNAL_UNIFORMS.indexOf("u_mbLowH");
const I_Q_LOWW = CRT_SIGNAL_UNIFORMS.indexOf("u_qLowW");
const I_Q_LOWH = CRT_SIGNAL_UNIFORMS.indexOf("u_qLowH");

export class WebGPUBackend {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private canvas: HTMLCanvasElement;
  private format: GPUTextureFormat;
  private sampler: GPUSampler;
  private uniformBuf: GPUBuffer;

  private gradePipeline: GPURenderPipeline;
  private opticsPipeline: GPURenderPipeline;
  private ghostPipeline: GPURenderPipeline;
  private burnInPipeline: GPURenderPipeline;
  private focusPipeline: GPURenderPipeline;
  private dubPipeline: GPURenderPipeline;
  private mediaAgePipeline: GPURenderPipeline;
  private restorePipeline: GPURenderPipeline;
  private blurHPipeline: GPURenderPipeline;
  private compositePipeline: GPURenderPipeline;
  private mbDownPipeline: GPURenderPipeline;
  private mbUpPipeline: GPURenderPipeline;
  private qDownPipeline: GPURenderPipeline;
  private qUpPipeline: GPURenderPipeline;
  private layout3: GPUBindGroupLayout;
  private layoutComposite: GPUBindGroupLayout;
  private layoutDub: GPUBindGroupLayout;
  private dubBuf: GPUBuffer;

  // Per-size resources.
  private srcTex: GPUTexture | null = null;
  private tGraded: GPUTexture | null = null;
  private tOptics: GPUTexture | null = null;
  private tPpA: GPUTexture | null = null;   // post-process ping-pong A
  private tPpB: GPUTexture | null = null;   // post-process ping-pong B (= T_filtered)
  private tH: GPUTexture | null = null;
  // Resolution-reduction tail textures: composite → tFinal, macroBlocking → tMacro, with the
  // two low-res box-downscale targets (rendered into a low-res viewport on a full-size texture).
  private tFinal: GPUTexture | null = null;
  private tMacro: GPUTexture | null = null;
  private tLowMB: GPUTexture | null = null;
  private tLowQ: GPUTexture | null = null;
  private bgGrade: GPUBindGroup | null = null;
  private bgOptics: GPUBindGroup | null = null;
  private bgGhost: GPUBindGroup | null = null;
  private bgBurnIn: GPUBindGroup | null = null;
  private bgFocus: GPUBindGroup | null = null;
  // Single-input ping-pong bind groups (read tPpA / tPpB) for the variable-length tail chain.
  private bgReadA: GPUBindGroup | null = null;
  private bgReadB: GPUBindGroup | null = null;
  // Dub passes additionally bind the dynamic-offset DubParams buffer (binding 4).
  private bgDubReadA: GPUBindGroup | null = null;
  private bgDubReadB: GPUBindGroup | null = null;
  private bgBlurH: GPUBindGroup | null = null;
  private bgComposite: GPUBindGroup | null = null;
  private bgMbDown: GPUBindGroup | null = null;
  private bgMbUp: GPUBindGroup | null = null;
  private bgQDown: GPUBindGroup | null = null;
  private bgQUp: GPUBindGroup | null = null;
  private texW = 0;
  private texH = 0;

  // Source cover-fit scratch canvas (matches CPU render() fitCanvas).
  private fitCanvas: HTMLCanvasElement;
  private fitCtx: CanvasRenderingContext2D;

  private dead = false;

  private constructor(parts: {
    device: GPUDevice;
    context: GPUCanvasContext;
    canvas: HTMLCanvasElement;
    format: GPUTextureFormat;
    sampler: GPUSampler;
    uniformBuf: GPUBuffer;
    gradePipeline: GPURenderPipeline;
    opticsPipeline: GPURenderPipeline;
    ghostPipeline: GPURenderPipeline;
    burnInPipeline: GPURenderPipeline;
    focusPipeline: GPURenderPipeline;
    dubPipeline: GPURenderPipeline;
    mediaAgePipeline: GPURenderPipeline;
    restorePipeline: GPURenderPipeline;
    blurHPipeline: GPURenderPipeline;
    compositePipeline: GPURenderPipeline;
    mbDownPipeline: GPURenderPipeline;
    mbUpPipeline: GPURenderPipeline;
    qDownPipeline: GPURenderPipeline;
    qUpPipeline: GPURenderPipeline;
    layout3: GPUBindGroupLayout;
    layoutComposite: GPUBindGroupLayout;
    layoutDub: GPUBindGroupLayout;
    dubBuf: GPUBuffer;
  }) {
    this.device = parts.device;
    this.context = parts.context;
    this.canvas = parts.canvas;
    this.format = parts.format;
    this.sampler = parts.sampler;
    this.uniformBuf = parts.uniformBuf;
    this.gradePipeline = parts.gradePipeline;
    this.opticsPipeline = parts.opticsPipeline;
    this.ghostPipeline = parts.ghostPipeline;
    this.burnInPipeline = parts.burnInPipeline;
    this.focusPipeline = parts.focusPipeline;
    this.dubPipeline = parts.dubPipeline;
    this.mediaAgePipeline = parts.mediaAgePipeline;
    this.restorePipeline = parts.restorePipeline;
    this.blurHPipeline = parts.blurHPipeline;
    this.compositePipeline = parts.compositePipeline;
    this.mbDownPipeline = parts.mbDownPipeline;
    this.mbUpPipeline = parts.mbUpPipeline;
    this.qDownPipeline = parts.qDownPipeline;
    this.qUpPipeline = parts.qUpPipeline;
    this.layout3 = parts.layout3;
    this.layoutComposite = parts.layoutComposite;
    this.layoutDub = parts.layoutDub;
    this.dubBuf = parts.dubBuf;

    this.fitCanvas = document.createElement("canvas");
    const fc = this.fitCanvas.getContext("2d", { alpha: false });
    if (!fc) throw new Error("2d context unavailable");
    this.fitCtx = fc;

    this.device.lost.then(() => { this.dead = true; }).catch(() => { this.dead = true; });
  }

  static async create(): Promise<WebGPUBackend | null> {
    try {
      if (typeof navigator === "undefined" || !navigator.gpu) return null;
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      if (!device) return null;

      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("webgpu");
      if (!context) return null;
      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: "opaque" });

      const module = device.createShaderModule({ code: shaderCode });
      const info = await module.getCompilationInfo();
      if (info.messages.some((m) => m.type === "error")) return null;

      const tex = (): GPUBindGroupLayoutEntry["texture"] => ({ sampleType: "float", viewDimension: "2d" });
      const layout3 = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: tex() },
        ],
      });
      const layoutComposite = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: tex() },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: tex() },
        ],
      });
      // Dub passes read one input texture (binding 2) + a dynamic-offset DubParams slice (binding 4).
      const layoutDub = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: tex() },
          { binding: 4, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform", hasDynamicOffset: true } },
        ],
      });
      const pl3 = device.createPipelineLayout({ bindGroupLayouts: [layout3] });
      const plComposite = device.createPipelineLayout({ bindGroupLayouts: [layoutComposite] });
      const plDub = device.createPipelineLayout({ bindGroupLayouts: [layoutDub] });

      device.pushErrorScope("validation");
      const gradePipeline = await device.createRenderPipelineAsync({
        layout: pl3,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_grade", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const opticsPipeline = await device.createRenderPipelineAsync({
        layout: pl3,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_optics", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const ghostPipeline = await device.createRenderPipelineAsync({
        layout: plComposite,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_ghost", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const burnInPipeline = await device.createRenderPipelineAsync({
        layout: plComposite,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_burnIn", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const focusPipeline = await device.createRenderPipelineAsync({
        layout: pl3,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_focus", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const dubPipeline = await device.createRenderPipelineAsync({
        layout: plDub,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_dub", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const mediaAgePipeline = await device.createRenderPipelineAsync({
        layout: pl3,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_mediaAge", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const restorePipeline = await device.createRenderPipelineAsync({
        layout: pl3,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_restore", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const blurHPipeline = await device.createRenderPipelineAsync({
        layout: pl3,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_blurH", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      // Composite now writes the intermediate T_final; the resolution-reduction tail presents
      // it to the canvas (fs_qUp), so the composite target is INTERMEDIATE_FORMAT.
      const compositePipeline = await device.createRenderPipelineAsync({
        layout: plComposite,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_composite", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const mbDownPipeline = await device.createRenderPipelineAsync({
        layout: pl3,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_mbDown", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const mbUpPipeline = await device.createRenderPipelineAsync({
        layout: plComposite,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_mbUp", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const qDownPipeline = await device.createRenderPipelineAsync({
        layout: pl3,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_qDown", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      // The final present: nearest-upscale quant + DCT grid → the swapchain canvas (its format).
      const qUpPipeline = await device.createRenderPipelineAsync({
        layout: plComposite,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_qUp", targets: [{ format }] },
        primitive: { topology: "triangle-list" },
      });
      const err = await device.popErrorScope();
      if (err) return null;

      const uniformBuf = device.createBuffer({
        size: UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const dubBuf = device.createBuffer({
        size: MAX_DUB_PASSES * DUB_STRIDE,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      return new WebGPUBackend({
        device, context, canvas, format, sampler, uniformBuf, dubBuf,
        gradePipeline, opticsPipeline, ghostPipeline, burnInPipeline, focusPipeline,
        dubPipeline, mediaAgePipeline, restorePipeline, blurHPipeline, compositePipeline,
        mbDownPipeline, mbUpPipeline, qDownPipeline, qUpPipeline,
        layout3, layoutComposite, layoutDub,
      });
    } catch {
      return null;
    }
  }

  private ensureSize(width: number, height: number): void {
    if (this.texW === width && this.texH === height && this.srcTex) return;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.context.configure({ device: this.device, format: this.format, alphaMode: "opaque" });

    this.srcTex?.destroy();
    this.tGraded?.destroy();
    this.tOptics?.destroy();
    this.tPpA?.destroy();
    this.tPpB?.destroy();
    this.tH?.destroy();
    this.tFinal?.destroy();
    this.tMacro?.destroy();
    this.tLowMB?.destroy();
    this.tLowQ?.destroy();
    this.srcTex = this.device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    const intermediate = () => this.device.createTexture({
      size: [width, height],
      format: INTERMEDIATE_FORMAT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.tGraded = intermediate();
    this.tOptics = intermediate();
    this.tPpA = intermediate();
    this.tPpB = intermediate();
    this.tH = intermediate();
    this.tFinal = intermediate();
    this.tMacro = intermediate();
    this.tLowMB = intermediate();
    this.tLowQ = intermediate();

    // Grade pass samples the raw source; optics then samples the graded texture.
    this.bgGrade = this.device.createBindGroup({
      layout: this.layout3,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.srcTex.createView() },
      ],
    });
    this.bgOptics = this.device.createBindGroup({
      layout: this.layout3,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tGraded.createView() },
      ],
    });
    // Post-process chain (ping-pong, passthrough in-shader when inactive):
    //   ghost(T_optics→tPpA, sharp=T_optics) → burnIn(tPpA→tPpB, sharp=T_optics) →
    //   focus(tPpB→tPpA = T_filtered).
    this.bgGhost = this.device.createBindGroup({
      layout: this.layoutComposite,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tOptics.createView() },
        { binding: 3, resource: this.tOptics.createView() },
      ],
    });
    this.bgBurnIn = this.device.createBindGroup({
      layout: this.layoutComposite,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tPpA.createView() },
        { binding: 3, resource: this.tOptics.createView() },
      ],
    });
    this.bgFocus = this.device.createBindGroup({
      layout: this.layout3,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tPpB.createView() },
      ],
    });
    // Variable-length tail chain (dub iterations → mediaAge → restoration). Single-input
    // ping-pong: bgRead{A,B} read tPp{A,B}; the dub variants also bind the dynamic DubParams.
    this.bgReadA = this.device.createBindGroup({
      layout: this.layout3,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tPpA.createView() },
      ],
    });
    this.bgReadB = this.device.createBindGroup({
      layout: this.layout3,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tPpB.createView() },
      ],
    });
    const dubEntry = { binding: 4, resource: { buffer: this.dubBuf, offset: 0, size: DUB_PARAM_FLOATS * 4 } };
    this.bgDubReadA = this.device.createBindGroup({
      layout: this.layoutDub,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tPpA.createView() },
        dubEntry,
      ],
    });
    this.bgDubReadB = this.device.createBindGroup({
      layout: this.layoutDub,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tPpB.createView() },
        dubEntry,
      ],
    });
    // Bloom GLOW comes from T_optics (the CPU blurs the pre-chain workCanvas), while the
    // composite BASE is T_filtered (= tPpB, the post-process chain output). So blurH blurs
    // T_optics; the composite samples T_h (blurred T_optics) over tPpB.
    this.bgBlurH = this.device.createBindGroup({
      layout: this.layout3,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tOptics.createView() },
      ],
    });
    this.bgComposite = this.device.createBindGroup({
      layout: this.layoutComposite,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tH.createView() },
        { binding: 3, resource: this.tPpA.createView() },   // T_filtered = final chain texture (tPpA)
      ],
    });
    // Resolution-reduction tail: composite → tFinal, mbDown(tFinal) → tLowMB, mbUp(tLowMB,
    // tFinal) → tMacro, qDown(tMacro) → tLowQ, qUp(tLowQ, tMacro) → canvas.
    this.bgMbDown = this.device.createBindGroup({
      layout: this.layout3,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tFinal.createView() },
      ],
    });
    this.bgMbUp = this.device.createBindGroup({
      layout: this.layoutComposite,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tLowMB.createView() },
        { binding: 3, resource: this.tFinal.createView() },
      ],
    });
    this.bgQDown = this.device.createBindGroup({
      layout: this.layout3,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tMacro.createView() },
      ],
    });
    this.bgQUp = this.device.createBindGroup({
      layout: this.layoutComposite,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.tLowQ.createView() },
        { binding: 3, resource: this.tMacro.createView() },
      ],
    });
    this.texW = width;
    this.texH = height;
  }

  // Cover-fit the source into a width×height canvas, matching CPU render()'s fitCanvas
  // (centre-crop the overflowing axis), then return it for upload.
  private coverFit(source: CanvasImageSource, width: number, height: number): HTMLCanvasElement {
    const anySrc = source as { naturalWidth?: number; videoWidth?: number; width?: number; naturalHeight?: number; videoHeight?: number; height?: number };
    const iw = anySrc.naturalWidth || anySrc.videoWidth || anySrc.width || width;
    const ih = anySrc.naturalHeight || anySrc.videoHeight || anySrc.height || height;
    if (this.fitCanvas.width !== width) this.fitCanvas.width = width;
    if (this.fitCanvas.height !== height) this.fitCanvas.height = height;
    const ctx = this.fitCtx;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    let sw = iw, sh = ih, sx = 0, sy = 0;
    const srcAspect = iw / ih;
    const dstAspect = width / height;
    if (srcAspect > dstAspect) {
      sw = ih * dstAspect;
      sx = (iw - sw) / 2;
    } else {
      sh = iw / dstAspect;
      sy = (ih - sh) / 2;
    }
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height);
    return this.fitCanvas;
  }

  // Per-sub-draw dub schedule, matching the CPU loops exactly (crt-renderer-full.js ~927-957).
  // Each entry is [shiftSigned, saturate, contrast, blurSigma, alpha]; generationLoss rounds its
  // shift to an integer, copyGen keeps it fractional (sub-pixel). Each iteration emits a +shift
  // and a −shift sub-draw (so the count is always even). Capped at MAX_DUB_PASSES.
  private buildDubSchedule(genLoss: number, copyGen: number): number[][] {
    const out: number[][] = [];
    if (genLoss > 0) {
      const dubPasses = Math.max(1, Math.floor(1 + genLoss * 3));
      const alpha = Math.min(0.34, 0.11 + genLoss * 0.2);
      for (let i = 0; i < dubPasses; i++) {
        const shift = Math.round((i + 1) * (0.5 + genLoss * 1.8));
        const sat = Math.max(0.25, 1 - genLoss * (0.26 + i * 0.07));
        const con = Math.max(0.65, 1 - genLoss * (0.12 + i * 0.04));
        const sigma = genLoss * (0.9 + i * 0.45);
        out.push([shift, sat, con, sigma, alpha], [-shift, sat, con, sigma, alpha]);
      }
    }
    if (copyGen > 0) {
      const passes = Math.min(6, copyGen);
      const alpha = Math.min(0.32, 0.08 + copyGen * 0.02);
      for (let i = 0; i < passes; i++) {
        const g = (i + 1) / Math.max(passes, copyGen);
        const shift = 0.6 + g * 1.6 + copyGen * 0.06;
        const sat = Math.max(0.2, 1 - copyGen * 0.05 - i * 0.015);
        const con = Math.max(0.6, 1 - copyGen * 0.018 - i * 0.01);
        const sigma = copyGen * 0.12 + i * 0.18;
        out.push([shift, sat, con, sigma, alpha], [-shift, sat, con, sigma, alpha]);
      }
    }
    return out.slice(0, MAX_DUB_PASSES);
  }

  render(
    outCtx: CanvasRenderingContext2D,
    source: CanvasImageSource,
    width: number,
    height: number,
    seconds: number,
    params: Record<string, number | string>,
    frameIndex: number,
    fps: number,
  ): void {
    if (this.dead) throw new Error("WebGPU device lost");
    this.ensureSize(width, height);

    const fitted = this.coverFit(source, width, height);
    this.device.queue.copyExternalImageToTexture(
      { source: fitted, flipY: false },
      { texture: this.srcTex! },
      [width, height],
    );

    const u = buildSignalUniforms(params, { width, height, seconds, frameIndex, fps });
    this.device.queue.writeBuffer(this.uniformBuf, 0, u.buffer, u.byteOffset, u.byteLength);

    // Iterative dub schedule (generationLoss / copyGen) — one entry per ping-pong sub-draw,
    // uploaded into the strided DubParams buffer the dub passes index by dynamic offset.
    const dub = this.buildDubSchedule(
      Math.max(0, Math.min(1, Number(params.advancedGenerationLoss) || 0)),
      Math.max(0, Math.min(20, Math.round(Number(params.copyGenerationCount) || 0))),
    );
    if (dub.length > 0) {
      const floatsPerSlot = DUB_STRIDE / 4;
      const strided = new Float32Array(dub.length * floatsPerSlot);
      for (let k = 0; k < dub.length; k++) strided.set(dub[k], k * floatsPerSlot);
      this.device.queue.writeBuffer(this.dubBuf, 0, strided.buffer, strided.byteOffset, dub.length * DUB_STRIDE);
    }

    const encoder = this.device.createCommandEncoder();
    const gradePass = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tGraded!.createView(), loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
    });
    gradePass.setPipeline(this.gradePipeline);
    gradePass.setBindGroup(0, this.bgGrade!);
    gradePass.draw(3);
    gradePass.end();

    const opticsPass = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tOptics!.createView(), loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
    });
    opticsPass.setPipeline(this.opticsPipeline);
    opticsPass.setBindGroup(0, this.bgOptics!);
    opticsPass.draw(3);
    opticsPass.end();

    // Post-process chain (passthrough in-shader when the filters are off): T_optics → ghost
    // → tPpA → burnIn → tPpB → focus → tPpA (= T_filtered, fed to bloom below).
    const ghostPass = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tPpA!.createView(), loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
    });
    ghostPass.setPipeline(this.ghostPipeline);
    ghostPass.setBindGroup(0, this.bgGhost!);
    ghostPass.draw(3);
    ghostPass.end();

    const burnInPass = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tPpB!.createView(), loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
    });
    burnInPass.setPipeline(this.burnInPipeline);
    burnInPass.setBindGroup(0, this.bgBurnIn!);
    burnInPass.draw(3);
    burnInPass.end();

    const focusPass = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tPpA!.createView(), loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
    });
    focusPass.setPipeline(this.focusPipeline);
    focusPass.setBindGroup(0, this.bgFocus!);
    focusPass.draw(3);
    focusPass.end();

    // Variable-length tail chain (cur starts at tPpA after focus): the iterative dub sub-draws,
    // then the always-run (passthrough when off) mediaAge + restoration passes. Each reads the
    // running texture and writes the other ping-pong texture; the pass count is always even so
    // the final result lands back on tPpA (= the bloom composite's sharp base).
    let cur = this.tPpA!;
    const runTail = (pipeline: GPURenderPipeline, dubOffset: number | null) => {
      const onA = cur === this.tPpA;
      const out = onA ? this.tPpB! : this.tPpA!;
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: out.createView(), loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
      });
      pass.setPipeline(pipeline);
      if (dubOffset !== null) {
        pass.setBindGroup(0, onA ? this.bgDubReadA! : this.bgDubReadB!, [dubOffset]);
      } else {
        pass.setBindGroup(0, onA ? this.bgReadA! : this.bgReadB!);
      }
      pass.draw(3);
      pass.end();
      cur = out;
    };
    for (let k = 0; k < dub.length; k++) runTail(this.dubPipeline, k * DUB_STRIDE);
    runTail(this.mediaAgePipeline, null);
    runTail(this.restorePipeline, null);
    // cur === tPpA here (even tail pass count); bgComposite binds tPpA as the sharp base.

    const blurPass = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tH!.createView(), loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
    });
    blurPass.setPipeline(this.blurHPipeline);
    blurPass.setBindGroup(0, this.bgBlurH!);
    blurPass.draw(3);
    blurPass.end();

    // Composite → tFinal (intermediate). The resolution-reduction tail then presents it.
    const clear = { r: 0, g: 0, b: 0, a: 1 };
    const composite = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tFinal!.createView(), loadOp: "clear", clearValue: clear, storeOp: "store" }],
    });
    composite.setPipeline(this.compositePipeline);
    composite.setBindGroup(0, this.bgComposite!);
    composite.draw(3);
    composite.end();

    // macroBlocking: box-downscale tFinal into the tLowMB low-res region (viewport), then
    // nearest-upscale composite → tMacro (passthrough-copies tFinal when off).
    const mbDown = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tLowMB!.createView(), loadOp: "clear", clearValue: clear, storeOp: "store" }],
    });
    mbDown.setViewport(0, 0, u[I_MB_LOWW], u[I_MB_LOWH], 0, 1);
    mbDown.setPipeline(this.mbDownPipeline);
    mbDown.setBindGroup(0, this.bgMbDown!);
    mbDown.draw(3);
    mbDown.end();

    const mbUp = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tMacro!.createView(), loadOp: "clear", clearValue: clear, storeOp: "store" }],
    });
    mbUp.setPipeline(this.mbUpPipeline);
    mbUp.setBindGroup(0, this.bgMbUp!);
    mbUp.draw(3);
    mbUp.end();

    // quantization: box-downscale + level-quantize tMacro → tLowQ (viewport), then nearest-
    // upscale composite + DCT block grid → canvas (passthrough-copies tMacro when off).
    const qDown = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tLowQ!.createView(), loadOp: "clear", clearValue: clear, storeOp: "store" }],
    });
    qDown.setViewport(0, 0, u[I_Q_LOWW], u[I_Q_LOWH], 0, 1);
    qDown.setPipeline(this.qDownPipeline);
    qDown.setBindGroup(0, this.bgQDown!);
    qDown.draw(3);
    qDown.end();

    const view = this.context.getCurrentTexture().createView();
    const qUp = encoder.beginRenderPass({
      colorAttachments: [{ view, loadOp: "clear", clearValue: clear, storeOp: "store" }],
    });
    qUp.setPipeline(this.qUpPipeline);
    qUp.setBindGroup(0, this.bgQUp!);
    qUp.draw(3);
    qUp.end();

    this.device.queue.submit([encoder.finish()]);

    outCtx.clearRect(0, 0, width, height);
    outCtx.drawImage(this.canvas, 0, 0, width, height);
  }

  // The internal canvas the GPU renders into (the fidelity sweep reads it back after
  // flush(); the live path uses the drawImage inside render()).
  get outputCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  // Await GPU completion — used by the offline fidelity sweep so a pixel readback can't
  // race the submitted frame. Not needed on the RAF preview path.
  async flush(): Promise<void> {
    await this.device.queue.onSubmittedWorkDone();
  }

  dispose(): void {
    this.dead = true;
    this.srcTex?.destroy();
    this.tGraded?.destroy();
    this.tOptics?.destroy();
    this.tPpA?.destroy();
    this.tPpB?.destroy();
    this.tH?.destroy();
    this.tFinal?.destroy();
    this.tMacro?.destroy();
    this.tLowMB?.destroy();
    this.tLowQ?.destroy();
    this.uniformBuf?.destroy();
    this.dubBuf?.destroy();
    this.device?.destroy();
  }
}
