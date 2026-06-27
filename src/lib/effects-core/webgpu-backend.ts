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
import { CRT_DISPLAY_UNIFORMS, buildUniforms } from "./param-map";

// Uniform buffer rounded up to a 16-byte multiple (WGSL uniform layout); the packed
// Float32Array (21 f32 = 84 bytes) writes into the first part.
const UNIFORM_BYTES = Math.ceil((CRT_DISPLAY_UNIFORMS.length * 4) / 16) * 16;
const INTERMEDIATE_FORMAT: GPUTextureFormat = "rgba8unorm";

export class WebGPUBackend {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private canvas: HTMLCanvasElement;
  private format: GPUTextureFormat;
  private sampler: GPUSampler;
  private uniformBuf: GPUBuffer;

  private opticsPipeline: GPURenderPipeline;
  private blurHPipeline: GPURenderPipeline;
  private compositePipeline: GPURenderPipeline;
  private layout3: GPUBindGroupLayout;
  private layoutComposite: GPUBindGroupLayout;

  // Per-size resources.
  private srcTex: GPUTexture | null = null;
  private tOptics: GPUTexture | null = null;
  private tH: GPUTexture | null = null;
  private bgOptics: GPUBindGroup | null = null;
  private bgBlurH: GPUBindGroup | null = null;
  private bgComposite: GPUBindGroup | null = null;
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
    opticsPipeline: GPURenderPipeline;
    blurHPipeline: GPURenderPipeline;
    compositePipeline: GPURenderPipeline;
    layout3: GPUBindGroupLayout;
    layoutComposite: GPUBindGroupLayout;
  }) {
    this.device = parts.device;
    this.context = parts.context;
    this.canvas = parts.canvas;
    this.format = parts.format;
    this.sampler = parts.sampler;
    this.uniformBuf = parts.uniformBuf;
    this.opticsPipeline = parts.opticsPipeline;
    this.blurHPipeline = parts.blurHPipeline;
    this.compositePipeline = parts.compositePipeline;
    this.layout3 = parts.layout3;
    this.layoutComposite = parts.layoutComposite;

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
      const pl3 = device.createPipelineLayout({ bindGroupLayouts: [layout3] });
      const plComposite = device.createPipelineLayout({ bindGroupLayouts: [layoutComposite] });

      device.pushErrorScope("validation");
      const opticsPipeline = await device.createRenderPipelineAsync({
        layout: pl3,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_optics", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const blurHPipeline = await device.createRenderPipelineAsync({
        layout: pl3,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_blurH", targets: [{ format: INTERMEDIATE_FORMAT }] },
        primitive: { topology: "triangle-list" },
      });
      const compositePipeline = await device.createRenderPipelineAsync({
        layout: plComposite,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_composite", targets: [{ format }] },
        primitive: { topology: "triangle-list" },
      });
      const err = await device.popErrorScope();
      if (err) return null;

      const uniformBuf = device.createBuffer({
        size: UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const sampler = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });

      return new WebGPUBackend({
        device, context, canvas, format, sampler, uniformBuf,
        opticsPipeline, blurHPipeline, compositePipeline, layout3, layoutComposite,
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
    this.tOptics?.destroy();
    this.tH?.destroy();
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
    this.tOptics = intermediate();
    this.tH = intermediate();

    this.bgOptics = this.device.createBindGroup({
      layout: this.layout3,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.srcTex.createView() },
      ],
    });
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
        { binding: 3, resource: this.tOptics.createView() },
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

    const u = buildUniforms(params, { width, height, seconds, frameIndex, fps });
    this.device.queue.writeBuffer(this.uniformBuf, 0, u.buffer, u.byteOffset, u.byteLength);

    const encoder = this.device.createCommandEncoder();
    const opticsPass = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tOptics!.createView(), loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
    });
    opticsPass.setPipeline(this.opticsPipeline);
    opticsPass.setBindGroup(0, this.bgOptics!);
    opticsPass.draw(3);
    opticsPass.end();

    const blurPass = encoder.beginRenderPass({
      colorAttachments: [{ view: this.tH!.createView(), loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
    });
    blurPass.setPipeline(this.blurHPipeline);
    blurPass.setBindGroup(0, this.bgBlurH!);
    blurPass.draw(3);
    blurPass.end();

    const view = this.context.getCurrentTexture().createView();
    const composite = encoder.beginRenderPass({
      colorAttachments: [{ view, loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
    });
    composite.setPipeline(this.compositePipeline);
    composite.setBindGroup(0, this.bgComposite!);
    composite.draw(3);
    composite.end();

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
    this.tOptics?.destroy();
    this.tH?.destroy();
    this.uniformBuf?.destroy();
    this.device?.destroy();
  }
}
