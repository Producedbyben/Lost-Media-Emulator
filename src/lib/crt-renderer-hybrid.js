// Hybrid renderer: CPU (Canvas2D) is the authoritative, complete pipeline.
// The GPU (WebGL2) path is an opt-in accelerator used ONLY when every active
// effect is fully supported by the shader — otherwise we transparently fall
// back to the CPU pipeline so results never regress.
import { CRTRendererGPU } from "./crt-renderer-gpu.js";
import { CRTRendererFull } from "./crt-renderer-full.js";

// Params the GPU fragment shader reproduces faithfully.
const GPU_SUPPORTED = new Set([
  "scanlineStrength", "phosphorMask", "barrelDistortion", "bloom", "flicker",
  "chromaticAberration", "noise", "pixelSize", "advancedLineJitter",
  "advancedTimebaseWobble", "advancedGhosting", "imageBrightness", "imageContrast",
  "advancedSaturation", "imageGamma", "imageTemperature", "imageTint",
  "advancedInterlacing", "advancedFilmGrain", "advancedQuantization",
  "advancedRfInterference",
]);

// Params whose neutral (no-op) value is 1 rather than 0.
const NEUTRAL_ONE = new Set([
  "pixelSize", "imageBrightness", "imageContrast", "advancedSaturation",
  "imageGamma", "maskScale",
]);

export class CRTRendererHybrid {
  constructor(preferGPU = false) {
    this.gpuAvailable = false;
    this.gpuRenderer = null;
    this.cpuRenderer = new CRTRendererFull();
    this.renderer = this.cpuRenderer;
    this.mode = "cpu";
    this.preferGPU = false;
    this.activeMode = "cpu"; // mode actually used for the most recent frame

    // Check GPU support eagerly
    try {
      this.gpuAvailable = CRTRendererGPU.isSupported();
    } catch {
      this.gpuAvailable = false;
    }

    this.hasImage = false;
    this._lastImg = null;
    this._lastSourceScale = 1;

    if (preferGPU && this.gpuAvailable) {
      this.setPreferGPU(true);
    }
  }

  _enableGPU() {
    if (this.gpuRenderer) {
      this.mode = "gpu";
      return true;
    }
    try {
      this.gpuRenderer = new CRTRendererGPU();
      this.mode = "gpu";
      if (this._lastImg) {
        this.gpuRenderer.setImage(this._lastImg, this._lastSourceScale);
      }
      console.log("[CRT] GPU renderer initialised (WebGL2)");
      return true;
    } catch (e) {
      console.warn("[CRT] GPU init failed:", e.message);
      this.gpuRenderer = null;
      this.mode = "cpu";
      return false;
    }
  }

  // Opt into GPU acceleration. Returns whether GPU is now usable.
  setPreferGPU(enabled) {
    if (enabled && this.gpuAvailable) {
      const ok = this._enableGPU();
      this.preferGPU = ok;
      return ok;
    }
    this.preferGPU = false;
    this.mode = "cpu";
    return false;
  }

  // Backwards-compatible alias.
  toggleGPU(enabled) {
    return this.setPreferGPU(enabled);
  }

  get isGPU() {
    return this.activeMode === "gpu";
  }

  // Can the GPU shader reproduce this exact look? Conservative: any non-neutral
  // parameter the shader doesn't implement (including all v2 effects), OSD
  // overlays, zoom/pan or exotic mask types force the CPU path.
  _gpuCanHandle(params, renderOptions) {
    if (!params) return true;
    if ((Number(params.advancedTimestampOSD) || 0) > 0.01) return false;
    if (renderOptions && renderOptions.sourceView) return false;
    // Format authenticity pipeline (resolution reduction + composite colour) is
    // CPU-only; route to CPU whenever an active profile is attached.
    if (renderOptions && renderOptions.formatProfile) {
      const fp = renderOptions.formatProfile;
      const needsRes = (fp.resScaleX ?? 1) < 0.995 || (fp.resScaleY ?? 1) < 0.995;
      const needsComposite = (fp.system === "NTSC" || fp.system === "PAL") && (fp.composite ?? 0) > 0.001;
      if (needsRes || needsComposite) return false;
    }
    const maskType = typeof params.maskType === "string" ? params.maskType : "phosphor";
    if (maskType !== "phosphor" && maskType !== "none") return false;
    // Categorical v2 effects the shader doesn't implement — any non-neutral value
    // (chroma subsampling, scanline profile, subpixel layout) is CPU-only.
    if (params.chromaSubsamplingMode && params.chromaSubsamplingMode !== "444") return false;
    if (params.scanlineProfile && params.scanlineProfile !== "off") return false;
    if (params.subpixelLayoutOverride && params.subpixelLayoutOverride !== "none") return false;
    // Datamosh / digital-decay stages are inter-frame and CPU-only.
    if ((Number(params.datamoshBloom) || 0) > 1e-4) return false;
    if ((Number(params.datamoshDisplacement) || 0) > 1e-4) return false;
    if ((Number(params.pixelSort) || 0) > 1e-4) return false;
    if ((Number(params.bitrotCorruption) || 0) > 1e-4) return false;
    // CPU disables the phosphor triad entirely when maskType is "none"; keep parity.
    if (maskType === "none" && Math.abs(Number(params.phosphorMask) || 0) > 1e-4) return false;
    // CPU scales the mask grid by maskScale, which the shader doesn't implement.
    if (Math.abs((Number(params.maskScale) || 1) - 1) > 1e-4) return false;
    for (const key in params) {
      if (key === "maskType") continue;
      const val = params[key];
      if (typeof val !== "number" || !Number.isFinite(val)) continue;
      if (GPU_SUPPORTED.has(key)) continue;
      const neutral = NEUTRAL_ONE.has(key) ? 1 : 0;
      if (Math.abs(val - neutral) > 1e-4) return false;
    }
    return true;
  }

  setImage(img, sourceScale = 1) {
    this._lastImg = img;
    this._lastSourceScale = sourceScale;
    this.cpuRenderer.setImage(img, sourceScale);
    if (this.gpuRenderer) {
      this.gpuRenderer.setImage(img, sourceScale);
    }
    this.hasImage = this.cpuRenderer.hasImage;
  }

  reset() {
    if (this.cpuRenderer?.reset) this.cpuRenderer.reset();
  }

  renderOriginal(outCtx, width, height) {
    // Always use CPU for original (no effects needed)
    return this.cpuRenderer.renderOriginal(outCtx, width, height);
  }

  render(outCtx, width, height, seconds, params, frameIndex, fps, renderOptions) {
    if (this.preferGPU && this.gpuRenderer && this._gpuCanHandle(params, renderOptions)) {
      try {
        this.gpuRenderer.render(outCtx, width, height, seconds, params, frameIndex, fps, renderOptions);
        this.activeMode = "gpu";
        return;
      } catch (e) {
        console.warn("[CRT] GPU render failed, falling back to CPU:", e.message);
      }
    }
    this.activeMode = "cpu";
    this.cpuRenderer.render(outCtx, width, height, seconds, params, frameIndex, fps, renderOptions);
  }

  destroy() {
    if (this.gpuRenderer?.destroy) {
      this.gpuRenderer.destroy();
    }
  }
}
