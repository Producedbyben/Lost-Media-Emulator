// WebGPU backend for the portable WGSL effects-core. Owns the GPUDevice / pipeline /
// bind-group lifecycle and renders the CRT/display shader into a caller-supplied 2D
// canvas context (the same render-to-2D-ctx contract the WebGL2 renderer uses, so the
// hybrid can swap it in transparently).
//
// `create()` resolves to null whenever WebGPU is unavailable or the pipeline fails to
// build, so callers fall back to WebGL2/CPU without a broken frame. Export is never
// routed here — this accelerates PREVIEW only.
import shaderCode from "./crt-display.wgsl?raw";
import { CRT_DISPLAY_UNIFORMS, buildUniforms } from "./param-map";

// Uniform buffer rounded up to a 16-byte multiple (WGSL uniform layout); the packed
// Float32Array (21 f32 = 84 bytes) writes into the first part.
const UNIFORM_BYTES = Math.ceil((CRT_DISPLAY_UNIFORMS.length * 4) / 16) * 16;

export class WebGPUBackend {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private canvas: HTMLCanvasElement;
  private pipeline: GPURenderPipeline;
  private bindGroupLayout: GPUBindGroupLayout;
  private uniformBuf: GPUBuffer;
  private sampler: GPUSampler;
  private format: GPUTextureFormat;

  private texture: GPUTexture | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private texW = 0;
  private texH = 0;

  // Source cover-fit scratch canvas (matches CPU render() fitCanvas).
  private fitCanvas: HTMLCanvasElement;
  private fitCtx: CanvasRenderingContext2D;

  private dead = false;

  private constructor(
    device: GPUDevice,
    context: GPUCanvasContext,
    canvas: HTMLCanvasElement,
    pipeline: GPURenderPipeline,
    bindGroupLayout: GPUBindGroupLayout,
    uniformBuf: GPUBuffer,
    sampler: GPUSampler,
    format: GPUTextureFormat,
  ) {
    this.device = device;
    this.context = context;
    this.canvas = canvas;
    this.pipeline = pipeline;
    this.bindGroupLayout = bindGroupLayout;
    this.uniformBuf = uniformBuf;
    this.sampler = sampler;
    this.format = format;

    this.fitCanvas = document.createElement("canvas");
    const fc = this.fitCanvas.getContext("2d", { alpha: false });
    if (!fc) throw new Error("2d context unavailable");
    this.fitCtx = fc;

    // Device loss → mark dead so the hybrid falls back on the next frame.
    device.lost.then(() => { this.dead = true; }).catch(() => { this.dead = true; });
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
      // Surface WGSL compile errors as a failed create() (→ fallback).
      const info = await module.getCompilationInfo();
      if (info.messages.some((m) => m.type === "error")) return null;

      const bindGroupLayout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float", viewDimension: "2d" } },
        ],
      });
      const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });

      device.pushErrorScope("validation");
      const pipeline = await device.createRenderPipelineAsync({
        layout: pipelineLayout,
        vertex: { module, entryPoint: "vs_main" },
        fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
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

      return new WebGPUBackend(device, context, canvas, pipeline, bindGroupLayout, uniformBuf, sampler, format);
    } catch {
      return null;
    }
  }

  private ensureSize(width: number, height: number): void {
    if (this.texW === width && this.texH === height && this.texture) return;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.context.configure({ device: this.device, format: this.format, alphaMode: "opaque" });

    this.texture?.destroy();
    this.texture = this.device.createTexture({
      size: [width, height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuf } },
        { binding: 1, resource: this.sampler },
        { binding: 2, resource: this.texture.createView() },
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
      { texture: this.texture! },
      [width, height],
    );

    const u = buildUniforms(params, { width, height, seconds, frameIndex, fps });
    this.device.queue.writeBuffer(this.uniformBuf, 0, u.buffer, u.byteOffset, u.byteLength);

    const encoder = this.device.createCommandEncoder();
    const view = this.context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view, loadOp: "clear", clearValue: { r: 0, g: 0, b: 0, a: 1 }, storeOp: "store" }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup!);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);

    outCtx.clearRect(0, 0, width, height);
    outCtx.drawImage(this.canvas, 0, 0, width, height);
  }

  dispose(): void {
    this.dead = true;
    this.texture?.destroy();
    this.uniformBuf?.destroy();
    this.device?.destroy();
  }
}
