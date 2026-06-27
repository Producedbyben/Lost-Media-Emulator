// Hybrid renderer: CPU (Canvas2D) is the authoritative, complete pipeline.
// The GPU (WebGL2) path is an opt-in accelerator used ONLY when every active
// effect is fully supported by the shader — otherwise we transparently fall
// back to the CPU pipeline so results never regress.
import { CRTRendererGPU } from "./crt-renderer-gpu.js";
import { CRTRendererFull } from "./crt-renderer-full.js";
import { WebGPUBackend } from "./effects-core/webgpu-backend";

// Mask geometries the WGSL CRT/display shader implements (crt-display.wgsl).
const WEBGPU_SUPPORTED_MASKS = new Set(["none", "phosphor", "dot", "aperture", "slot", "shadowMask"]);

// Display-axis params the WGSL CRT/display shader reproduces at fidelity (< 6 mean-err
// vs CPU on the sweep). maskScale is supported (mask + scanline scale by it); the three
// phosphorPersistence/beamSpot/pixelResponseTime keys are display no-ops the CPU
// renderer ignores, so they are safe at any value. Everything else must be neutral.
const WEBGPU_DISPLAY_SUPPORTED = new Set([
  "scanlineStrength", "phosphorMask", "maskScale", "barrelDistortion",
  "chromaticAberration", "bloom", "flicker",
  "phosphorPersistence", "beamSpotSizeX", "beamSpotSizeY", "pixelResponseTime",
]);

// Epic 6.2: the per-pixel signal core the WGSL shader reproduces at fidelity (verified by
// the full-catalogue sweep, docs/gpu/SIGNAL-FIDELITY.md). Allowed at any value. NOT here
// (→ CPU): advancedFilmGrain/grainSize/grainChromaticity (grain's large-magnitude per-pixel
// noise arg can't reach bit-parity on GPU float behaviour), advancedQuantization (multi-pass
// DCT/resolution on CPU), and every multi-pass / inter-frame effect (handled by the catch-all).
const WEBGPU_SIGNAL_SUPPORTED = new Set([
  ...WEBGPU_DISPLAY_SUPPORTED,
  "pixelSize",
  // grade stage
  "imageBrightness", "imageContrast", "advancedSaturation", "imageGamma",
  "imageTemperature", "imageTint", "infraredFalseColor", "printFadeCyan",
  "printFadeMagenta", "printFadeYellow", "blackLevelCrush", "highlightRollOff",
  "haze", "polaroidCrossover", "monochromeTintStrength", "irHotspot",
  // per-pixel geometric / chroma / level
  "advancedLineJitter", "advancedTimebaseWobble", "advancedHeadSwitching",
  "advancedChromaDelay", "advancedCrossColor", "advancedDropouts", "advancedInterlacing",
  "advancedTapeCrease", "advancedFilmGateWeave", "gateJitterX", "gateJitterY",
  "gateRotation", "shutterJudder", "advancedRfInterference",
  // per-pixel colour
  "advancedFilmDust", "advancedFilmScratches", "advancedFilmHalation", "noise",
  // pointwise post-passes
  "advancedCctvMonochrome",
]);

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
  "imageGamma", "maskScale", "monochromeTintStrength",
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

    // WebGPU is the PREFERRED backend (WebGPU → WebGL2 → CPU) when available and the
    // look is in a fidelity-passed family. Created async; null until ready / on any
    // failure (incl. non-WebGPU runtimes), so callers fall back transparently.
    this.webgpuRenderer = null;
    try {
      WebGPUBackend.create()
        .then((backend) => { this.webgpuRenderer = backend; })
        .catch(() => { this.webgpuRenderer = null; });
    } catch {
      this.webgpuRenderer = null;
    }

    if (preferGPU && this.gpuAvailable) {
      this.setPreferGPU(true);
    }
  }

  // Can the WGSL signal shader reproduce this look at fidelity (mean-err < 6 vs the CPU
  // render)? True for the per-pixel signal core (Epic 6.2): a supported mask geometry, an
  // active supported effect, and NO multi-pass (format composite/resolution, quantization
  // DCT, ghosting/persistence, generation loss, media aging, macroblocking, nitrate/
  // technicolor, neon wide-bleed), inter-frame (datamosh, pixel-sort) or grain param (the
  // catch-all enforces this). gpuSignalOK must allow EXACTLY the < 6 set — the sweep
  // verifies allowedFailing === [] (docs/gpu/SIGNAL-FIDELITY.md).
  gpuSignalOK(params, renderOptions) {
    if (!params) return false;
    const maskType = typeof params.maskType === "string" ? params.maskType : "phosphor";
    if (!WEBGPU_SUPPORTED_MASKS.has(maskType)) return false;

    // OSD / source view / format authenticity → CPU.
    if ((Number(params.advancedTimestampOSD) || 0) > 0.01) return false;
    if (renderOptions && renderOptions.sourceView) return false;
    if (renderOptions && renderOptions.formatProfile) {
      const fp = renderOptions.formatProfile;
      const needsRes = (fp.resScaleX ?? 1) < 0.995 || (fp.resScaleY ?? 1) < 0.995;
      const needsComposite = (fp.system === "NTSC" || fp.system === "PAL") && (fp.composite ?? 0) > 0.001;
      if (needsRes || needsComposite) return false;
    }

    // String effects: scanlineProfile / subpixelLayoutOverride / monochromeTint are now
    // implemented; chroma subsampling + non-ideal storage are multi-pass → CPU.
    if (params.chromaSubsamplingMode && params.chromaSubsamplingMode !== "444") return false;
    if (params.storageCondition && params.storageCondition !== "ideal") return false;

    // Every numeric param not in the supported set must be neutral — this routes grain,
    // quantization, and all multi-pass / inter-frame effects to CPU.
    for (const key in params) {
      if (key === "maskType" || key === "schemaVersion" || key === "__category") continue;
      const val = params[key];
      if (typeof val !== "number" || !Number.isFinite(val)) continue;
      if (WEBGPU_SIGNAL_SUPPORTED.has(key)) continue;
      const neutral = NEUTRAL_ONE.has(key) ? 1 : 0;
      if (Math.abs(val - neutral) > 1e-4) return false;
    }

    // Require at least one active supported effect — otherwise there's nothing to
    // accelerate (the CPU per-pixel loop is skipped anyway), so let it fall through.
    for (const key of WEBGPU_SIGNAL_SUPPORTED) {
      if (!(key in params)) continue;
      const val = Number(params[key]);
      if (!Number.isFinite(val)) continue;
      const neutral = NEUTRAL_ONE.has(key) ? 1 : 0;
      if (Math.abs(val - neutral) > 1e-4) return true;
    }
    // A non-"none" categorical look also counts as active.
    return (
      (typeof params.maskType === "string" && params.maskType !== "none" && (Number(params.phosphorMask) || 0) > 1e-4) ||
      (params.scanlineProfile && params.scanlineProfile !== "off") ||
      (params.subpixelLayoutOverride && params.subpixelLayoutOverride !== "none") ||
      (params.monochromeTint && params.monochromeTint !== "none")
    );
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
    // Preferred path: WebGPU for fidelity-passed CRT/display looks. Any failure
    // (device lost, unsupported) falls through to WebGL2 → CPU below.
    if (this.preferGPU && this.webgpuRenderer && this._lastImg && this.gpuSignalOK(params, renderOptions)) {
      try {
        this.webgpuRenderer.render(outCtx, this._lastImg, width, height, seconds, params, frameIndex, fps);
        this.activeMode = "webgpu";
        return;
      } catch (e) {
        console.warn("[CRT] WebGPU render failed, falling back:", e.message);
      }
    }
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
    if (this.webgpuRenderer?.dispose) {
      this.webgpuRenderer.dispose();
      this.webgpuRenderer = null;
    }
  }
}
