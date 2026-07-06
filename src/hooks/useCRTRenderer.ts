import { useRef, useCallback, useEffect, useState } from "react";
// @ts-ignore
import { CRTRendererHybrid } from "@/lib/crt-renderer-hybrid.js";
// @ts-ignore
import { exportMp4, exportWebm, getVideoExportCapabilities } from "@/lib/exporter.js";
// @ts-ignore
import { exportGif } from "@/lib/gif-exporter.js";
import { toast } from "sonner";
import { saveBlob, ensureFilename } from "@/lib/save-file.js";
import { exportViaFfmpeg, isFfmpegExportAvailable } from "@/lib/ffmpeg-export";
import { computeExportSize } from "@/lib/export-size";
// @ts-ignore
import { validateExportAgainstPreview } from "@/lib/export-validator.js";
import { buildOSDRenderOptions } from "@/lib/osd-render-options";
import { loadOSDFonts } from "@/lib/osd-fonts";
import { useAudioPreview, DEFAULT_AUDIO_PROFILE } from "@/hooks/useAudioPreview";
import { degradeAudioBuffer, type AudioProfile } from "@/lib/audio-degrade";
import { audioBufferToWav } from "@/lib/audio-wav";
import type { OSDOptions } from "@/components/OSDControls";
import type { PreviewSettings } from "@/components/PreviewControls";

export interface CRTParams {
  scanlineStrength: number;
  phosphorMask: number;
  barrelDistortion: number;
  bloom: number;
  flicker: number;
  chromaticAberration: number;
  noise: number;
  pixelSize: number;
  maskType: string;
  maskScale: number;
  // Phosphor monochrome tint: "none" | "green" | "amber" | "blue" | "white".
  // Maps luma onto a single-colour ramp (night-vision green, amber terminal).
  monochromeTint: string;
  monochromeTintStrength: number;
  imageBrightness: number;
  imageContrast: number;
  advancedSaturation: number;
  imageGamma: number;
  imageTemperature: number;
  imageTint: number;
  advancedLineJitter: number;
  advancedTimebaseWobble: number;
  advancedHeadSwitching: number;
  advancedChromaDelay: number;
  advancedCrossColor: number;
  advancedDropouts: number;
  advancedGhosting: number;
  advancedInterlacing: number;
  advancedFrameStutter: number;
  advancedRfInterference: number;
  advancedExposurePump: number;
  advancedWhiteBalanceDrift: number;
  advancedFocusBreathing: number;
  advancedTapeCrease: number;
  advancedTimestampOSD: number;
  advancedOSDStyle: number;
  advancedCctvMonochrome: number;
  advancedQuantization: number;
  advancedGenerationLoss: number;
  advancedMacroBlocking: number;
  // Datamosh / true digital decay
  datamoshBloom: number;
  datamoshDisplacement: number;
  pixelSort: number;
  bitrotCorruption: number;
  advancedFilmGrain: number;
  advancedFilmDust: number;
  advancedFilmScratches: number;
  advancedFilmGateWeave: number;
  advancedFilmHalation: number;
  advancedNeonPhosphorBleed: number;
  // V2: Color & Signal
  lumaNoise: number;
  chromaNoise: number;
  chromaBleedHorizontal: number;
  chromaBleedVertical: number;
  chromaPhaseError: number;
  blackLevelCrush: number;
  highlightRollOff: number;
  gammaCurve: number;
  // V2: Temporal Instability
  dropoutFrequency: number;
  dropoutLength: number;
  jitterSpeed: number;
  jitterRandomness: number;
  wowFlutterSlow: number;
  wowFlutterFast: number;
  flickerFrequencyHz: number;
  flickerDepth: number;
  autoExposureHunt: number;
  // V2: Tape-specific
  headClogEvents: number;
  trackingError: number;
  tapeSkew: number;
  chromaNoiseStreaking: number;
  // V2: Film-specific
  grainSize: number;
  grainChromaticity: number;
  gateJitterX: number;
  gateJitterY: number;
  gateRotation: number;
  shutterJudder: number;
  printFadeCyan: number;
  printFadeMagenta: number;
  printFadeYellow: number;
  spliceFlash: number;
  cueMarks: number;
  // V2: Digital Compression
  gopLength: number;
  deblockingStrength: number;
  ringingStrength: number;
  chromaSubsamplingMode: string;
  packetLossBurst: number;
  upscaleSharpenHalos: number;
  // V2: Sensor/Lens/Device
  rollingShutterSkew: number;
  fixedPatternNoise: number;
  hotPixels: number;
  lensSmear: number;
  haze: number;
  flareGhosts: number;
  vignette: number;
  // Aerochrome IR false-colour, 2" Quadruplex banding, PAL Hanover bars.
  infraredFalseColor: number;
  bandingHorizontal: number;
  hanoverBars: number;
  cornerSharpnessFalloff: number;
  // V2: Display/Panel
  scanlineProfile: string;
  phosphorPersistence: number;
  beamSpotSizeX: number;
  beamSpotSizeY: number;
  subpixelLayoutOverride: string;
  pixelResponseTime: number;
  // V2: Meta-aging
  mediaAgeYears: number;
  storageCondition: string;
  copyGenerationCount: number;
  restorationPassLevel: number;
  // Display retention — phosphor / plasma burn-in ghost layer.
  burnInGhost: number;
  // Sync-suppression cable scrambling (horizontal tearing + rolling + luma inversion).
  syncSuppression: number;
  // DV/MiniDV block-error concealment (sharp rectangular macroblock errors, not analog streaks).
  dvBlockError: number;
  // Epic 3 LOW film/sensor effects.
  nitrateDecay: number;        // chemical blotches + edge fog + mottled emulsion damage
  technicolorFringe: number;   // 3-strip R/G/B mis-registration coloured edges
  irHotspot: number;           // IR illuminator near-field central bloom
  polaroidCrossover: number;   // SX-70 colour crossover (green/yellow shadows, warm highlights)
  [key: string]: number | string;
}

// TRUE PASSTHROUGH (Ben-11 #4): a new clip must enter unedited — every effect param ships
// neutral; looks come only from an explicit preset/param choice. Presets that relied on the
// old baked-in CRT baseline (scanlines/mask/bloom/flicker/chromAb/noise) carry those values
// explicitly (byte-identity guard: src/test/default-passthrough.test.ts).
export const DEFAULT_PARAMS: CRTParams = {
  scanlineStrength: 0,
  phosphorMask: 0,
  barrelDistortion: 0,
  bloom: 0,
  flicker: 0,
  chromaticAberration: 0,
  noise: 0,
  pixelSize: 1,
  maskType: "none",
  maskScale: 1,
  monochromeTint: "none",
  monochromeTintStrength: 1,
  imageBrightness: 1,
  imageContrast: 1,
  advancedSaturation: 1,
  imageGamma: 1,
  imageTemperature: 0,
  imageTint: 0,
  advancedLineJitter: 0,
  advancedTimebaseWobble: 0,
  advancedHeadSwitching: 0,
  advancedChromaDelay: 0,
  advancedCrossColor: 0,
  advancedDropouts: 0,
  advancedGhosting: 0,
  advancedInterlacing: 0,
  advancedFrameStutter: 0,
  advancedRfInterference: 0,
  advancedExposurePump: 0,
  advancedWhiteBalanceDrift: 0,
  advancedFocusBreathing: 0,
  advancedTapeCrease: 0,
  advancedTimestampOSD: 0,
  advancedOSDStyle: 0,
  advancedCctvMonochrome: 0,
  advancedQuantization: 0,
  advancedGenerationLoss: 0,
  advancedMacroBlocking: 0,
  // Datamosh / true digital decay — neutral by default
  datamoshBloom: 0,
  datamoshDisplacement: 0,
  pixelSort: 0,
  bitrotCorruption: 0,
  advancedFilmGrain: 0,
  advancedFilmDust: 0,
  advancedFilmScratches: 0,
  advancedFilmGateWeave: 0,
  advancedFilmHalation: 0,
  advancedNeonPhosphorBleed: 0,
  // V2: Color & Signal — all neutral
  lumaNoise: 0,
  chromaNoise: 0,
  chromaBleedHorizontal: 0,
  chromaBleedVertical: 0,
  chromaPhaseError: 0,
  blackLevelCrush: 0,
  highlightRollOff: 0,
  gammaCurve: 1,
  // V2: Temporal Instability
  dropoutFrequency: 0,
  dropoutLength: 0,
  jitterSpeed: 0,
  jitterRandomness: 0,
  wowFlutterSlow: 0,
  wowFlutterFast: 0,
  flickerFrequencyHz: 0,
  flickerDepth: 0,
  autoExposureHunt: 0,
  // V2: Tape-specific
  headClogEvents: 0,
  trackingError: 0,
  tapeSkew: 0,
  chromaNoiseStreaking: 0,
  // V2: Film-specific
  grainSize: 0,
  grainChromaticity: 0,
  gateJitterX: 0,
  gateJitterY: 0,
  gateRotation: 0,
  shutterJudder: 0,
  printFadeCyan: 0,
  printFadeMagenta: 0,
  printFadeYellow: 0,
  spliceFlash: 0,
  cueMarks: 0,
  // V2: Digital Compression
  gopLength: 0,
  deblockingStrength: 0,
  ringingStrength: 0,
  chromaSubsamplingMode: "444",
  packetLossBurst: 0,
  upscaleSharpenHalos: 0,
  // V2: Sensor/Lens/Device
  rollingShutterSkew: 0,
  fixedPatternNoise: 0,
  hotPixels: 0,
  lensSmear: 0,
  haze: 0,
  flareGhosts: 0,
  vignette: 0,
  infraredFalseColor: 0,
  bandingHorizontal: 0,
  hanoverBars: 0,
  cornerSharpnessFalloff: 0,
  // V2: Display/Panel
  scanlineProfile: "off",
  phosphorPersistence: 0,
  beamSpotSizeX: 0,
  beamSpotSizeY: 0,
  subpixelLayoutOverride: "none",
  pixelResponseTime: 0,
  // V2: Meta-aging
  mediaAgeYears: 0,
  storageCondition: "ideal",
  copyGenerationCount: 0,
  restorationPassLevel: 0,
  burnInGhost: 0,
  syncSuppression: 0,
  dvBlockError: 0,
  nitrateDecay: 0,
  technicolorFringe: 0,
  irHotspot: 0,
  polaroidCrossover: 0,
};

/** Fit dimensions to maxPixels constraint, preserving aspect ratio */
function fitToMaxPixels(width: number, height: number, maxPixels: number): { width: number; height: number } {
  if (maxPixels <= 0 || width * height <= maxPixels) return { width, height };
  const scale = Math.sqrt(maxPixels / (width * height));
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}

/** Estimate video FPS from metadata or default to 30 */
function estimateVideoFPS(video: HTMLVideoElement): number {
  // Try to get FPS from video track metadata (WebCodecs API)
  try {
    const track = (video as any).captureStream?.()?.getVideoTracks?.()?.[0];
    if (track) {
      const settings = track.getSettings?.();
      if (settings?.frameRate && settings.frameRate > 0) {
        track.stop?.();
        return Math.round(settings.frameRate * 100) / 100;
      }
      track.stop?.();
    }
  } catch { /* ignore */ }
  return 30; // sensible default
}

/**
 * Largest working dimension (long edge) the tool keeps for live editing. Source
 * stills bigger than this are downsampled once into an optimised working bitmap —
 * the version the renderer actually processes. This keeps preview scrubbing,
 * per-frame getImageData passes and memory bounded regardless of how huge the
 * dropped file is (an 8000px DSLR photo would otherwise stall the whole pipeline),
 * while staying well above any preview/export raster size so quality is unaffected.
 */
const WORKING_MAX_DIM = 2560;

export interface SourceInfo {
  type: "image" | "video";
  /** Native dimensions of the file the user dropped. */
  sourceW: number;
  sourceH: number;
  /** Dimensions of the optimised copy actually fed to the renderer. */
  workingW: number;
  workingH: number;
  /** True when an optimised proxy was generated (working < source). */
  optimized: boolean;
}

/**
 * Build the optimised working source for a still. Returns the original element
 * untouched when it's already within budget, otherwise a downscaled canvas.
 */
function buildWorkingProxy(img: HTMLImageElement): {
  source: HTMLImageElement | HTMLCanvasElement;
  optimized: boolean;
  workingW: number;
  workingH: number;
} {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const longEdge = Math.max(w, h);
  if (longEdge <= WORKING_MAX_DIM || longEdge === 0) {
    return { source: img, optimized: false, workingW: w, workingH: h };
  }
  const scale = WORKING_MAX_DIM / longEdge;
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, cw, ch);
  }
  return { source: canvas, optimized: true, workingW: cw, workingH: ch };
}

export function useCRTRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(performance.now());
  const paramsRef = useRef<CRTParams>(DEFAULT_PARAMS);
  const osdOptionsRef = useRef<OSDOptions | null>(null);
  const previewSettingsRef = useRef<PreviewSettings>({
    sourceScale: 1,
    maxPixels: 2073600,
    fpsLimit: 30,
    animationEnabled: false,
    previewScale: 1,
    compareMode: "off",
    compareSplit: false,
    compareSplitRatio: 0.5,
    gpuAcceleration: false,
    adaptiveQuality: true,
  });
  const lastFrameTimeRef = useRef<number>(0);
  const previewDirtyRef = useRef<boolean>(true);
  const isVideoRef = useRef<boolean>(false);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const originalImageRef = useRef<any>(null);
  // Tracks the currently held object URL so we can revoke it when a new file is
  // loaded (prevents a blob-URL memory leak across many imports).
  const objectUrlRef = useRef<string | null>(null);
  // Real on-disk path of the loaded source (desktop only), so ffmpeg can mux the
  // original audio track directly. Null for the web build or pasted/sample input.
  const sourcePathRef = useRef<string | null>(null);
  const exportControllerRef = useRef<AbortController | null>(null);
  const panCenterRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const sourceDimsRef = useRef<{ w: number; h: number } | null>(null);
  // Adaptive quality: dynamic render-scale multiplier governed by frame timing.
  const adaptiveScaleRef = useRef<number>(1);
  const frameTimeAvgRef = useRef<number>(16);
  const lastRenderMsRef = useRef<number>(0); // cost of the most recent frame
  const adaptiveCooldownRef = useRef<number>(0);
  const activeRenderModeRef = useRef<string>("cpu");
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  // Format authenticity pipeline (native resolution + composite colour).
  const formatProfileRef = useRef<any>(null);
  const formatPipelineRef = useRef<boolean>(true);

  // RAM Preview (After Effects style frame precache for smooth video playback).
  const ramCacheRef = useRef<{ ready: boolean; fps: number; frames: ImageBitmap[] } | null>(null);
  const ramStatusRef = useRef<"idle" | "building" | "ready">("idle");
  const ramProgressRef = useRef<number>(0);
  const ramBuildingRef = useRef<boolean>(false);

  // Video playback state
  const videoPlayingRef = useRef<boolean>(false);
  const videoSpeedRef = useRef<number>(1);
  const videoLoopRef = useRef<boolean>(true);

  const [hasImage, setHasImage] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [videoLoop, setVideoLoop] = useState(true);
  const [videoFPS, setVideoFPS] = useState(30);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [rendererMode, setRendererMode] = useState<"gpu" | "cpu" | "gpu-ready" | "hybrid">("cpu");
  const [ramPreview, setRamPreview] = useState<{ status: "idle" | "building" | "ready"; progress: number; frames: number }>({ status: "idle", progress: 0, frames: 0 });
  const [validation, setValidation] = useState<any>(null);
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  // Honest audio availability for the loaded source: true only on desktop when
  // ffprobe confirms the source file actually carries an audio track.
  const [sourceHasAudio, setSourceHasAudio] = useState(false);

  // Epic 4 audio panel: per-clip degrade/level/fade profile, the current video
  // element (as state so the audio monitor reacts to it), and a load counter.
  const [audioProfile, setAudioProfile] = useState<AudioProfile>(DEFAULT_AUDIO_PROFILE);
  const [audioVideoEl, setAudioVideoEl] = useState<HTMLVideoElement | null>(null);
  const [sourceLoadId, setSourceLoadId] = useState(0);
  const audioPreview = useAudioPreview({ videoEl: audioVideoEl, sourceKey: sourceLoadId, hasAudio: sourceHasAudio, profile: audioProfile });
  // Refs so the (memoised) export handlers see the latest decoded audio + profile.
  const audioDecodedRef = useRef<AudioBuffer | null>(null);
  const audioProfileRef = useRef<AudioProfile>(audioProfile);
  useEffect(() => { audioDecodedRef.current = audioPreview.decodedBuffer; }, [audioPreview.decodedBuffer]);
  useEffect(() => { audioProfileRef.current = audioProfile; }, [audioProfile]);

  // Create renderer ONCE as a stable ref
  const rendererRef = useRef<any>(null);
  if (!rendererRef.current) {
    rendererRef.current = new CRTRendererHybrid(false);
    (window as any).__lme_renderer = rendererRef.current;
  }

  const markDirty = useCallback(() => {
    previewDirtyRef.current = true;
  }, []);

  // Preview OSD options: clock driven by the preview `elapsed`.
  const buildOSDOpts = useCallback((elapsed: number, _params: CRTParams) => {
    return buildOSDRenderOptions(osdOptionsRef.current, { elapsed });
  }, []);

  // Preview zoom/pan are a pure viewport transform applied in CSS by
  // PreviewCanvas (instant, GPU-composited, magnifies the rendered output). The
  // render pipeline intentionally ignores zoom/pan: it always renders the full
  // frame at its natural resolution and the GPU shader path stays engaged (a
  // crop here would force the slow CPU fallback and re-render on every pan).
  const buildRenderOpts = useCallback((elapsed: number, params: CRTParams) => {
    const osdOpts = buildOSDOpts(elapsed, params) || {};
    const formatProfile = formatPipelineRef.current ? formatProfileRef.current : null;
    return { ...osdOpts, formatProfile };
  }, [buildOSDOpts]);

  // Export/offscreen render options: identical to preview EXCEPT the OSD clock is
  // left to the renderer to derive per-frame from frameIndex/fps (so the burned
  // timecode advances correctly and respects the trim in-point). This is what makes
  // the exported OSD match the preview — historically exports passed formatProfile
  // only, so the OSD silently fell back to defaults.
  const buildExportRenderOpts = useCallback(() => {
    const osdOpts = buildOSDRenderOptions(osdOptionsRef.current, { forExport: true });
    const formatProfile = formatPipelineRef.current ? formatProfileRef.current : null;
    return { ...osdOpts, formatProfile };
  }, []);
  const buildExportRenderOptsRef = useRef(buildExportRenderOpts);
  buildExportRenderOptsRef.current = buildExportRenderOpts;

  const setFormatProfile = useCallback((profile: any) => {
    formatProfileRef.current = profile || null;
    previewDirtyRef.current = true;
  }, []);

  const setFormatPipelineEnabled = useCallback((enabled: boolean) => {
    formatPipelineRef.current = !!enabled;
    previewDirtyRef.current = true;
  }, []);

  const buildRenderOptsRef = useRef(buildRenderOpts);
  buildRenderOptsRef.current = buildRenderOpts;

  // Apply device-pixel-ratio sharpening and the adaptive performance multiplier,
  // then clamp to the user's max-pixel budget.
  const applyQualityScale = useCallback((w: number, h: number, settings: PreviewSettings) => {
    let mult = 1;
    if (settings.adaptiveQuality) {
      const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
      mult = dpr * adaptiveScaleRef.current;
    }
    const sw = Math.max(1, Math.round(w * mult));
    const sh = Math.max(1, Math.round(h * mult));
    return fitToMaxPixels(sw, sh, settings.maxPixels);
  }, []);

  const computeRenderSize = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { width: 960, height: 540 };
    const rect = container.getBoundingClientRect();
    const settings = previewSettingsRef.current;
    const zoom = settings.previewScale;
    const cw = Math.round(rect.width);
    const ch = Math.round(rect.height);
    if (cw < 10 || ch < 10) return { width: 960, height: 540 };

    const src = sourceDimsRef.current;
    let w: number, h: number;
    if (src && src.w > 0 && src.h > 0) {
      const srcAR = src.w / src.h;
      const containerAR = cw / ch;
      if (srcAR > containerAR) {
        w = cw;
        h = Math.round(cw / srcAR);
      } else {
        h = ch;
        w = Math.round(ch * srcAR);
      }
      // (zoom is applied as a CSS viewport transform, not by inflating the render)
    } else {
      w = cw;
      h = ch;
      // (zoom is applied as a CSS viewport transform, not by inflating the render)
    }

    return applyQualityScale(w, h, settings);
  }, [applyQualityScale]);

  // Seek a video to a time and resolve once the frame is presented. Every wait
  // path is raced against a watchdog timeout: requestVideoFrameCallback does NOT
  // fire on a paused element when no new frame is presented (e.g. seeking to the
  // time it already sits at — exactly the first frame of a RAM-preview build),
  // which would otherwise hang the build forever.
  const seekVideoExact = useCallback((video: HTMLVideoElement, time: number) => {
    return new Promise<void>((resolve) => {
      const hasRVFC = typeof (video as any).requestVideoFrameCallback === "function";
      let settled = false;
      let watchdog = 0;
      const onSeeked = () => presentThenFinish();
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(watchdog);
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      // Once the seek target frame is decoded ('seeked'), one animation frame is
      // enough for it to be drawable. We deliberately use rAF rather than
      // requestVideoFrameCallback here: rVFC does NOT fire on a paused element,
      // which both stalled RAM-preview builds and made each seek wait out the
      // watchdog. rAF ticks regardless of playback state (~16 ms).
      const presentThenFinish = () => requestAnimationFrame(() => finish());
      // Ultimate safety net so a missing event can never stall the pipeline.
      watchdog = window.setTimeout(finish, 400);
      if (Math.abs(video.currentTime - time) < 0.0005 && video.readyState >= 2) {
        presentThenFinish();
        return;
      }
      video.addEventListener("seeked", onSeeked);
      video.currentTime = time;
    });
  }, []);

  // Drop the RAM-preview cache (called whenever the look or source changes).
  const invalidateRamCache = useCallback(() => {
    const c = ramCacheRef.current;
    if (!c && ramStatusRef.current === "idle") return;
    if (c) {
      for (const f of c.frames) { try { f.close?.(); } catch { /* ignore */ } }
    }
    ramCacheRef.current = null;
    ramStatusRef.current = "idle";
    setRamPreview({ status: "idle", progress: 0, frames: 0 });
  }, []);

  // Build an After-Effects-style RAM preview: render every frame of the loaded
  // video once on the deterministic CPU pipeline and keep them as ImageBitmaps
  // for jank-free, real-time playback.
  const buildRamPreview = useCallback(async () => {
    const video = videoElementRef.current;
    const renderer = rendererRef.current;
    if (!video || !isVideoRef.current || !renderer || ramBuildingRef.current) return;
    const duration = video.duration || 0;
    if (!duration) return;

    ramBuildingRef.current = true;
    invalidateRamCache();

    const fps = previewSettingsRef.current.fpsLimit || 30;
    // RAM preview is the full-quality path: render at native resolution, not the
    // reduced scale the playback governor may have left behind.
    adaptiveScaleRef.current = 1;
    const { width, height } = computeRenderSize();
    // Cap total memory to ~1GB worth of decoded frames.
    const bytesPerFrame = width * height * 4;
    const maxByMemory = Math.max(30, Math.floor(1_000_000_000 / Math.max(1, bytesPerFrame)));
    const frameCount = Math.min(maxByMemory, Math.max(1, Math.floor(duration * fps)));

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const offCtx = off.getContext("2d", { alpha: false });
    if (!offCtx) { ramBuildingRef.current = false; return; }

    const prevPreferGPU = renderer.preferGPU;
    if (prevPreferGPU && renderer.setPreferGPU) renderer.setPreferGPU(false);
    const wasPlaying = !video.paused;
    video.pause();
    renderer.reset?.();

    ramStatusRef.current = "building";
    setRamPreview({ status: "building", progress: 0, frames: 0 });

    const frames: ImageBitmap[] = [];
    try {
      for (let i = 0; i < frameCount; i++) {
        const t = Math.min(duration - 0.001, i / fps);
        await seekVideoExact(video, t);
        renderer.setImage(video, previewSettingsRef.current.sourceScale);
        offCtx.fillStyle = "#000";
        offCtx.fillRect(0, 0, width, height);
        const renderOpts = buildRenderOptsRef.current(t, paramsRef.current);
        renderer.render(offCtx, width, height, t, paramsRef.current, Math.floor(t * fps), fps, renderOpts);
        frames.push(await createImageBitmap(off));
        ramProgressRef.current = (i + 1) / frameCount;
        if (i % 3 === 0 || i === frameCount - 1) {
          setRamPreview({ status: "building", progress: (i + 1) / frameCount, frames: frames.length });
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      ramCacheRef.current = { ready: true, fps, frames };
      ramStatusRef.current = "ready";
      setRamPreview({ status: "ready", progress: 1, frames: frames.length });
    } catch (err) {
      console.error("[RAM Preview] build failed:", err);
      for (const f of frames) { try { f.close?.(); } catch { /* ignore */ } }
      ramCacheRef.current = null;
      ramStatusRef.current = "idle";
      setRamPreview({ status: "idle", progress: 0, frames: 0 });
    } finally {
      if (prevPreferGPU && renderer.setPreferGPU) renderer.setPreferGPU(true);
      if (wasPlaying) video.play().catch(() => {});
      ramBuildingRef.current = false;
      previewDirtyRef.current = true;
    }
  }, [computeRenderSize, invalidateRamCache, seekVideoExact]);




  // Set renderer mode on mount
  useEffect(() => {
    const r = rendererRef.current;
    if (r) {
      setRendererMode(r.gpuAvailable ? "gpu-ready" : "cpu");
    }
  }, []);

  // Lightweight diagnostics accessor for verification harnesses. Reads internal
  // governor/playback refs without affecting behavior. Safe to leave in.
  useEffect(() => {
    (window as unknown as { __btDebug?: () => unknown }).__btDebug = () => {
      const ram = ramCacheRef.current;
      return {
        adaptiveScale: adaptiveScaleRef.current,
        isVideoPlaying: videoPlayingRef.current && isVideoRef.current,
        activeMode: activeRenderModeRef.current,
        avgFrameMs: +frameTimeAvgRef.current.toFixed(2),
        preferGPU: rendererRef.current?.preferGPU || false,
        ramStatus: ramStatusRef.current,
        ramProgress: +ramProgressRef.current.toFixed(2),
        ramFrames: ram?.frames.length || 0,
        ramFrameW: ram?.frames[0]?.width || 0,
        ramFrameH: ram?.frames[0]?.height || 0,
      };
    };
  }, []);

  // Track pending resize from ResizeObserver
  const pendingResizeRef = useRef(false);

  // Main render loop
  useEffect(() => {
    let rafId = 0;
    const animate = () => {
      const now = performance.now();
      const settings = previewSettingsRef.current;
      const canvas = canvasRef.current;
      const renderer = rendererRef.current;

      // While a RAM preview is being built, the renderer is busy seeking and
      // rendering frames offscreen — don't drive it from the main loop too.
      if (ramBuildingRef.current) {
        rafId = requestAnimationFrame(animate);
        return;
      }



      if (canvas && renderer) {
        // Handle resize
        const container = containerRef.current;
        if (container && (pendingResizeRef.current || canvas.width < 10 || canvas.height < 10)) {
          const rect = container.getBoundingClientRect();
          const cw = Math.round(rect.width);
          const ch = Math.round(rect.height);
          if (cw >= 10 && ch >= 10) {
            const zoom = settings.previewScale;
            const src = sourceDimsRef.current;
            let w: number, h: number;
            if (src && src.w > 0 && src.h > 0) {
              const srcAR = src.w / src.h;
              const containerAR = cw / ch;
              if (srcAR > containerAR) { w = cw; h = Math.round(cw / srcAR); }
              else { h = ch; w = Math.round(ch * srcAR); }
              // (zoom is applied as a CSS viewport transform, not by inflating the render)
            } else {
              w = cw; h = ch;
            }
            const dpr = settings.adaptiveQuality ? Math.min(window.devicePixelRatio || 1, 2) : 1;
            const mult = settings.adaptiveQuality ? dpr * adaptiveScaleRef.current : 1;
            const fitted = fitToMaxPixels(Math.max(1, Math.round(w * mult)), Math.max(1, Math.round(h * mult)), settings.maxPixels);
            if (canvas.width !== fitted.width || canvas.height !== fitted.height) {
              canvas.width = fitted.width;
              canvas.height = fitted.height;
              previewDirtyRef.current = true;
            }
          }
          pendingResizeRef.current = false;
        }

        // Cache a low-latency, opaque 2D context for sharper, faster blits.
        let ctx = ctxRef.current;
        if (!ctx || ctx.canvas !== canvas) {
          ctx = canvas.getContext("2d", { alpha: false, desynchronized: true }) as CanvasRenderingContext2D | null;
          if (ctx) ctx.imageSmoothingQuality = "high";
          ctxRef.current = ctx;
        }
        const hasImg = renderer.hasImage || renderer.cpuRenderer?.hasImage || false;

        if (ctx && hasImg && canvas.width > 0 && canvas.height > 0) {
          const shouldAnimate = settings.animationEnabled;
          const isVideoPlaying = videoPlayingRef.current && isVideoRef.current;
          const minInterval = 1000 / settings.fpsLimit;
          const timeSinceLastFrame = now - lastFrameTimeRef.current;

          // RAM Preview: when a cache is ready, play it back directly for the
          // active video frame instead of re-rendering — buttery, jank-free.
          const ram = ramCacheRef.current;
          const useRam = !!(ram && ram.ready && isVideoRef.current && videoElementRef.current
            && (isVideoPlaying || shouldAnimate) && settings.compareMode === "off");

          // For video playback: always render at FPS rate when video is playing
          // For animation: render at FPS interval
          // For a static still: render when something changed. A slow heartbeat
          // keeps subtle time-based effects (grain, flicker) alive — but ONLY
          // for cheap looks. A heavy CPU look would otherwise re-render full-res
          // every 250 ms and saturate the main thread, making the idle UI lag;
          // for those we render strictly on change.
          const staticHeartbeat = lastRenderMsRef.current < 16;
          const shouldRender = isVideoPlaying
            ? timeSinceLastFrame >= minInterval
            : shouldAnimate
              ? timeSinceLastFrame >= minInterval
              : (previewDirtyRef.current || (staticHeartbeat && timeSinceLastFrame >= 250));

          if (useRam && shouldRender) {
            const vt = videoElementRef.current!.currentTime;
            const idx = Math.max(0, Math.min(ram.frames.length - 1, Math.round(vt * ram.fps)));
            const bmp = ram.frames[idx];
            if (bmp) {
              ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
            }
            previewDirtyRef.current = false;
            lastFrameTimeRef.current = now;
            rafId = requestAnimationFrame(animate);
            return;
          }

          if (shouldRender) {
            // Feed current video frame to renderer when video is playing
            if (isVideoPlaying && videoElementRef.current) {
              renderer.setImage(videoElementRef.current, settings.sourceScale);
            } else if (shouldAnimate && isVideoRef.current && videoElementRef.current) {
              // Animation mode without video playback - still feed current frame
              renderer.setImage(videoElementRef.current, settings.sourceScale);
            }

            // Drive time-based effects from the video's own clock so the preview
            // matches the export frame-for-frame (export uses t = frame / fps).
            let elapsed: number;
            const fps = settings.fpsLimit;
            if (isVideoRef.current && videoElementRef.current) {
              elapsed = videoElementRef.current.currentTime;
            } else {
              elapsed = (now - startTimeRef.current) / 1000;
            }
            const frame = Math.floor(elapsed * fps);
            const renderOpts = buildRenderOptsRef.current(elapsed, paramsRef.current);

            const renderStart = performance.now();
            try {
              if (settings.compareMode !== "off" && !settings.compareSplit) {
                if (renderer.renderOriginal) {
                  renderer.renderOriginal(ctx, canvas.width, canvas.height);
                } else {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                }
              } else {
                renderer.render(ctx, canvas.width, canvas.height, elapsed, paramsRef.current, frame, fps, renderOpts);
              }
            } catch (e) {
              console.error("[CRT] Render error:", e);
            }
            const renderDuration = performance.now() - renderStart;
            lastRenderMsRef.current = renderDuration;

            // Reflect which renderer actually produced the frame. "hybrid" means
            // GPU is preferred but this frame fell back to CPU for fidelity.
            const am = renderer.activeMode || "cpu";
            if (am !== activeRenderModeRef.current) {
              activeRenderModeRef.current = am;
              const preferring = renderer.preferGPU && renderer.gpuAvailable;
              const display = preferring
                ? (am === "gpu" ? "gpu" : "hybrid")
                : (renderer.gpuAvailable ? "gpu-ready" : "cpu");
              setRendererMode(display);
            }

            // Adaptive quality governor — fast proportional controller. The old
            // incremental version reacted far too slowly: a heavy CPU look at
            // ~500 ms/frame would freeze the UI for seconds before nudging the
            // scale down one notch. Here we drive the resolution scale directly
            // from the measured frame cost so playback recovers within a frame
            // or two. GPU-accelerated looks (~0.3 ms) naturally pull scale to 1.
            if (settings.adaptiveQuality && (isVideoPlaying || shouldAnimate)) {
              frameTimeAvgRef.current = frameTimeAvgRef.current * 0.7 + renderDuration * 0.3;
              const budget = 1000 / settings.fpsLimit;
              // Aggressive floor during ANY continuous render (playback or
              // effect animation): both re-run the full pipeline every frame, so
              // a heavy CPU look must be allowed to drop resolution enough to
              // stay responsive. Softness while moving is fine; full resolution
              // is restored the moment rendering goes idle (the else branch).
              const floor = 0.2;
              const cur = adaptiveScaleRef.current;
              // React instantly to a big overrun using the just-measured frame;
              // otherwise track the smoothed average for stable recovery.
              const measured = renderDuration > budget * 2 ? renderDuration : frameTimeAvgRef.current;
              if (adaptiveCooldownRef.current > 0) adaptiveCooldownRef.current -= 1;
              if (measured > budget * 1.1) {
                // Over budget: drop proportionally (scale ∝ sqrt of pixel ratio).
                const target = Math.max(floor, cur * Math.sqrt((budget * 0.9) / measured));
                if (target < cur - 0.01) {
                  adaptiveScaleRef.current = target;
                  pendingResizeRef.current = true;
                  adaptiveCooldownRef.current = 6;
                }
              } else if (adaptiveCooldownRef.current === 0 && measured < budget * 0.6 && cur < 1) {
                // Comfortably under budget: ease resolution back up gently.
                adaptiveScaleRef.current = Math.min(1, cur + 0.12);
                pendingResizeRef.current = true;
                adaptiveCooldownRef.current = 12;
              }
            } else if (adaptiveScaleRef.current < 1) {
              // Paused / still: restore full resolution for a crisp frame.
              adaptiveScaleRef.current = 1;
              pendingResizeRef.current = true;
              previewDirtyRef.current = true;
            }

            previewDirtyRef.current = false;
            lastFrameTimeRef.current = now;
          }
        }
      }


      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(rafId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Video time update polling — update React state from video element
  useEffect(() => {
    let rafId = 0;
    const poll = () => {
      const video = videoElementRef.current;
      if (video && isVideoRef.current && videoPlayingRef.current && !video.paused) {
        setVideoCurrentTime(video.currentTime);
        // Check for loop
        if (video.ended && videoLoopRef.current) {
          video.currentTime = 0;
          video.play().catch(() => {});
        }
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Observe container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      pendingResizeRef.current = true;
      previewDirtyRef.current = true;
    });
    ro.observe(container);
    pendingResizeRef.current = true;
    previewDirtyRef.current = true;
    return () => ro.disconnect();
  }, []);

  const setParams = useCallback((params: CRTParams) => {
    paramsRef.current = params;
    invalidateRamCache();
    markDirty();
  }, [markDirty, invalidateRamCache]);

  const setOSDOptions = useCallback((options: OSDOptions) => {
    osdOptionsRef.current = options;
    invalidateRamCache();
    markDirty();
  }, [markDirty, invalidateRamCache]);

  const setPreviewSettings = useCallback((settings: PreviewSettings) => {
    const prev = previewSettingsRef.current;
    previewSettingsRef.current = settings;

    if (settings.sourceScale !== prev.sourceScale && rendererRef.current) {
      if (isVideoRef.current && videoElementRef.current) {
        rendererRef.current.setImage(videoElementRef.current, settings.sourceScale);
      } else if (originalImageRef.current) {
        rendererRef.current.setImage(originalImageRef.current, settings.sourceScale);
      }
    }

    // previewScale (zoom) is a CSS viewport transform now, so it no longer
    // affects the render resolution or invalidates caches.
    if (settings.maxPixels !== prev.maxPixels) {
      adaptiveScaleRef.current = 1;
      pendingResizeRef.current = true;
      invalidateRamCache();
    }
    if (settings.sourceScale !== prev.sourceScale) {
      invalidateRamCache();
    }

    if (settings.gpuAcceleration !== prev.gpuAcceleration && rendererRef.current?.setPreferGPU) {
      const on = rendererRef.current.setPreferGPU(settings.gpuAcceleration);
      setRendererMode(on ? "gpu" : rendererRef.current.gpuAvailable ? "gpu-ready" : "cpu");
    }

    if (!settings.adaptiveQuality && prev.adaptiveQuality) {
      adaptiveScaleRef.current = 1;
      pendingResizeRef.current = true;
    }

    markDirty();
  }, [markDirty, invalidateRamCache]);


  const loadImage = useCallback(async (file: File): Promise<SourceInfo | null> => {
    try {
      const isVid = file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(file.name);
      const isImg = file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(file.name);
      if (!isVid && !isImg) {
        throw new Error(`Unsupported file type: ${file.type || file.name}`);
      }
      const sourceScale = previewSettingsRef.current.sourceScale;
      invalidateRamCache();

      // Capture the real file path (desktop) so the ffmpeg exporter can mux the
      // source's original audio. Falls back to null on web / non-File inputs.
      const desktopApi = (window as unknown as {
        desktop?: {
          getPathForFile?: (f: File) => string | null;
          probeAudio?: (o: { sourcePath: string }) => Promise<{ hasAudio: boolean }>;
        };
      }).desktop;
      sourcePathRef.current = (isVid && desktopApi?.getPathForFile) ? (desktopApi.getPathForFile(file) || null) : null;
      // Probe whether the source carries an audio track so the export UI can show
      // an honest "Original audio" state instead of silently producing silence.
      setSourceHasAudio(false);
      if (sourcePathRef.current && desktopApi?.probeAudio) {
        const sp = sourcePathRef.current;
        desktopApi.probeAudio({ sourcePath: sp })
          .then((r) => setSourceHasAudio(!!r?.hasAudio))
          .catch(() => setSourceHasAudio(false));
      }

      // Cleanup previous video + release any held object URL (avoids leaks).
      if (videoElementRef.current) {
        videoElementRef.current.pause();
        videoElementRef.current.removeAttribute("src");
        videoElementRef.current.load();
        videoElementRef.current = null;
        setAudioVideoEl(null);
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }

      if (isVid) {
        const video = document.createElement("video");
        video.muted = true;
        video.loop = false; // we handle loop ourselves
        video.playsInline = true;
        video.crossOrigin = "anonymous";
        video.preload = "auto";
        const url = URL.createObjectURL(file);
        objectUrlRef.current = url;
        video.src = url;
        video.load();

        await new Promise<void>((resolve, reject) => {
          video.addEventListener("loadedmetadata", () => resolve(), { once: true });
          video.addEventListener("error", () => reject(new Error("Video load failed")), { once: true });
        });

        // Wait for first frame to be decoded
        await new Promise<void>((resolve) => {
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) { resolve(); return; }
          video.addEventListener("canplay", () => resolve(), { once: true });
          setTimeout(() => resolve(), 2000);
        });

        // Pause at first frame
        video.pause();
        video.currentTime = 0;

        // Estimate FPS
        const detectedFPS = estimateVideoFPS(video);

        videoElementRef.current = video;
        setAudioVideoEl(video);
        setSourceLoadId((n) => n + 1);
        isVideoRef.current = true;
        videoPlayingRef.current = false;
        originalImageRef.current = null;

        setIsVideo(true);
        setVideoPlaying(false);
        setVideoDuration(video.duration || 0);
        setVideoCurrentTime(0);
        setVideoFPS(detectedFPS);
        setVideoWidth(video.videoWidth);
        setVideoHeight(video.videoHeight);
        setVideoSpeed(1);
        setVideoLoop(true);
        videoSpeedRef.current = 1;
        videoLoopRef.current = true;

        sourceDimsRef.current = { w: video.videoWidth, h: video.videoHeight };

        rendererRef.current?.reset?.();
        adaptiveScaleRef.current = 1;
        rendererRef.current?.setImage(video, sourceScale);
        pendingResizeRef.current = true;
        startTimeRef.current = performance.now();

        // Enable animation for continuous rendering when video plays
        previewSettingsRef.current = { ...previewSettingsRef.current, animationEnabled: true };

        markDirty();
        setHasImage(true);
        const info: SourceInfo = {
          type: "video",
          sourceW: video.videoWidth,
          sourceH: video.videoHeight,
          workingW: Math.round(video.videoWidth * sourceScale),
          workingH: Math.round(video.videoHeight * sourceScale),
          optimized: sourceScale < 0.999,
        };
        setSourceInfo(info);
        return info;
      }

      // Static image — decode then build an optimised working copy if oversized.
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Image load failed"));
      });
      if (typeof img.decode === "function") {
        try { await img.decode(); } catch { /* decode hint only */ }
      }

      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;
      const proxy = buildWorkingProxy(img);

      isVideoRef.current = false;
      videoPlayingRef.current = false;
      setIsVideo(false);
      setVideoPlaying(false);
      setVideoCurrentTime(0);
      setVideoWidth(0);
      setVideoHeight(0);
      // The renderer works from the optimised copy; the source raster is no
      // longer referenced, so its blob URL can be released immediately when a
      // proxy was generated (frees the large decoded original from memory).
      originalImageRef.current = proxy.source;
      if (proxy.optimized) {
        URL.revokeObjectURL(url);
        objectUrlRef.current = null;
      } else {
        objectUrlRef.current = url;
      }
      sourceDimsRef.current = { w: srcW, h: srcH };

      rendererRef.current?.reset?.();
      adaptiveScaleRef.current = 1;
      rendererRef.current?.setImage(proxy.source, sourceScale);
      pendingResizeRef.current = true;
      startTimeRef.current = performance.now();
      markDirty();
      setHasImage(true);
      const info: SourceInfo = {
        type: "image",
        sourceW: srcW,
        sourceH: srcH,
        workingW: proxy.workingW,
        workingH: proxy.workingH,
        optimized: proxy.optimized,
      };
      setSourceInfo(info);
      return info;
    } catch (err) {
      console.error("Failed to load media:", err);
      throw err;
    }
  }, [markDirty, invalidateRamCache]);

  // Video playback controls
  const playVideo = useCallback(() => {
    const video = videoElementRef.current;
    if (!video || !isVideoRef.current) return;
    video.playbackRate = videoSpeedRef.current;
    video.play().then(() => {
      videoPlayingRef.current = true;
      setVideoPlaying(true);
      // Ensure animation is enabled for continuous rendering
      previewSettingsRef.current = { ...previewSettingsRef.current, animationEnabled: true };
      markDirty();
    }).catch(err => {
      console.error("Video play failed:", err);
    });
  }, [markDirty]);

  const pauseVideo = useCallback(() => {
    const video = videoElementRef.current;
    if (!video) return;
    video.pause();
    videoPlayingRef.current = false;
    setVideoPlaying(false);
    // Feed the paused frame to renderer
    if (rendererRef.current) {
      rendererRef.current.setImage(video, previewSettingsRef.current.sourceScale);
    }
    setVideoCurrentTime(video.currentTime);
    markDirty();
  }, [markDirty]);

  const seekVideo = useCallback((time: number) => {
    const video = videoElementRef.current;
    if (!video) return;
    const clampedTime = Math.max(0, Math.min(video.duration || 0, time));
    const wasPlaying = videoPlayingRef.current;

    const handler = () => {
      rendererRef.current?.setImage(video, previewSettingsRef.current.sourceScale);
      setVideoCurrentTime(video.currentTime);
      markDirty();
      // Resume if was playing
      if (wasPlaying && !video.paused) {
        // already playing
      } else if (wasPlaying) {
        video.play().catch(() => {});
      }
    };
    video.addEventListener("seeked", handler, { once: true });
    video.currentTime = clampedTime;
  }, [markDirty]);

  const frameStepVideo = useCallback((direction: 1 | -1) => {
    const video = videoElementRef.current;
    if (!video) return;
    // Pause first
    if (videoPlayingRef.current) {
      video.pause();
      videoPlayingRef.current = false;
      setVideoPlaying(false);
    }
    const frameDuration = 1 / (videoFPS || 30);
    const newTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + direction * frameDuration));
    const handler = () => {
      rendererRef.current?.setImage(video, previewSettingsRef.current.sourceScale);
      setVideoCurrentTime(video.currentTime);
      markDirty();
    };
    video.addEventListener("seeked", handler, { once: true });
    video.currentTime = newTime;
  }, [markDirty, videoFPS]);

  const setVideoPlaybackSpeed = useCallback((speed: number) => {
    videoSpeedRef.current = speed;
    setVideoSpeed(speed);
    const video = videoElementRef.current;
    if (video) {
      video.playbackRate = speed;
    }
  }, []);

  const toggleVideoLoop = useCallback(() => {
    const newLoop = !videoLoopRef.current;
    videoLoopRef.current = newLoop;
    setVideoLoop(newLoop);
  }, []);

  const goToVideoStart = useCallback(() => {
    seekVideo(0);
  }, [seekVideo]);

  const goToVideoEnd = useCallback(() => {
    const video = videoElementRef.current;
    if (video) seekVideo(video.duration || 0);
  }, [seekVideo]);

  // Handle video ended event
  useEffect(() => {
    const video = videoElementRef.current;
    if (!video || !isVideo) return;

    const onEnded = () => {
      if (videoLoopRef.current) {
        video.currentTime = 0;
        video.play().catch(() => {});
      } else {
        videoPlayingRef.current = false;
        setVideoPlaying(false);
        setVideoCurrentTime(video.duration);
      }
    };

    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [isVideo]);

  const handleExportMp4 = useCallback(async (fps: number, duration: number, options?: {
    resolution?: number;
    quality?: number;
    includeAudio?: boolean;
    degradeAudio?: boolean;
    aspectRatio?: string;
    frameMode?: string;
    format?: "mp4" | "webm";
    fileName?: string;
    audioMode?: "off" | "original" | "degrade";
    codec?: "h264" | "hevc" | "prores422" | "prores4444";
    // Trim window in source seconds (ffmpeg path only). Omitted = full clip.
    inSec?: number;
    outSec?: number;
  }) => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    const controller = new AbortController();
    exportControllerRef.current = controller;
    setIsExporting(true);
    setExportProgress(0);

    // Force the full CPU pipeline during export for deterministic, accurate output.
    const prevPreferGPU = rendererRef.current.preferGPU;
    if (prevPreferGPU && rendererRef.current.setPreferGPU) rendererRef.current.setPreferGPU(false);

    // Ensure the bundled digital-era OSD fonts are resident before any frame is
    // rendered — canvas fillText() won't wait for fonts, so an export started
    // before the face loaded would burn in the fallback font.
    await loadOSDFonts();

    try {
      // Desktop native ffmpeg pipeline (H.264) — the primary path. ffmpeg writes
      // the file itself, so a native Save panel resolves the destination first.
      // WebM and the web/dev build (no bridge) fall through to WebCodecs below.
      const ffmpegReady = options?.format !== "webm" && await isFfmpegExportAvailable();
      if (ffmpegReady) {
        const desktopApi = (window as unknown as { desktop?: { saveDialog?: (o: { defaultName: string }) => Promise<string | null> } }).desktop;
        const outPath = await desktopApi?.saveDialog?.({ defaultName: options?.fileName || "export.mp4" });
        if (outPath) {
          // Mux the source's original audio when the user kept audio on and the
          // source is a video with a real path.
          const wantsAudio = options?.audioMode !== "off";
          let audioSourcePath = (wantsAudio && isVideoRef.current && sourcePathRef.current)
            ? sourcePathRef.current : undefined;
          // Degrade-to-match: render the source audio through the SAME degrade DSP
          // the preview uses, write the result as a temp WAV, and mux THAT so the
          // exported audio matches what was heard (one DSP = preview == export).
          if (wantsAudio && options?.audioMode === "degrade" && audioDecodedRef.current) {
            try {
              const degraded = await degradeAudioBuffer(audioDecodedRef.current, audioProfileRef.current);
              const wav = audioBufferToWav(degraded);
              const dapi = (window as unknown as { desktop?: { writeTempAudio?: (b: ArrayBuffer) => Promise<{ path: string } | null> } }).desktop;
              const res = await dapi?.writeTempAudio?.(wav);
              if (res?.path) audioSourcePath = res.path;
            } catch { /* fall back to muxing the original track */ }
          }
          // Trim window: clamp in/out to the clip and forward only when a real
          // sub-range was requested (full clip → in/out omitted, byte-identical).
          const full = Math.max(0.5, duration);
          const trimIn = Math.max(0, Math.min(options?.inSec ?? 0, full));
          const trimOut = Math.max(trimIn + 1 / Math.max(1, fps), Math.min(options?.outSec ?? full, full));
          const isTrimmed = options?.inSec != null || options?.outSec != null;
          // Size the export from the SOURCE dims + chosen resolution/aspect — never
          // from the preview canvas (which is fit-to-container, DPR-capped and
          // adaptively downscaled). Falls back to the canvas only if source dims
          // are somehow unknown.
          const srcDims = sourceDimsRef.current;
          const sourceW = srcDims?.w && srcDims.w > 0 ? srcDims.w : canvas.width;
          const sourceH = srcDims?.h && srcDims.h > 0 ? srcDims.h : canvas.height;
          const { width: targetWidth, height: targetHeight } = computeExportSize({
            sourceW, sourceH,
            resolution: options?.resolution ?? 0,
            aspectRatio: options?.aspectRatio,
          });
          await exportViaFfmpeg({
            canvas, renderer: rendererRef.current,
            params: paramsRef.current, fps: Math.max(1, fps), duration: full,
            ...(isTrimmed ? { inSec: trimIn, outSec: trimOut } : {}),
            codec: options?.codec || "h264", outPath, audioSourcePath,
            videoElement: isVideoRef.current ? videoElementRef.current : undefined,
            targetWidth, targetHeight,
            frameMode: options?.aspectRatio && options.aspectRatio !== "original" ? options?.frameMode : undefined,
            renderOptions: buildExportRenderOptsRef.current(),
            onProgress: (r) => setExportProgress(r),
            signal: controller.signal,
          });
        }
        // Whether encoded or cancelled, the ffmpeg path is done — don't also
        // run WebCodecs.
        return;
      }

      const caps = getVideoExportCapabilities();
      const videoExportArgs = {
        canvas,
        renderer: rendererRef.current,
        params: paramsRef.current,
        fps: Math.max(1, fps),
        duration: Math.max(0.5, duration),
        onProgress: (value: number) => setExportProgress(value),
        signal: controller.signal,
        videoElement: isVideoRef.current ? videoElementRef.current : undefined,
        // Full-res source for export — never the preview proxy — and size from
        // the chosen resolution/aspect (computeExportSize, shared with ffmpeg).
        sourceScale: 1,
        resolution: options?.resolution ?? 0,
        aspectRatio: options?.aspectRatio,
        bitrate: (options?.quality || 1) * 8_000_000,
        renderOptions: buildExportRenderOptsRef.current(),
        fileName: options?.fileName,
      };
      const wantsWebm = options?.format === "webm";
      if (!wantsWebm && caps.mp4) {
        await exportMp4({
          ...videoExportArgs,
          includeAudio: options?.includeAudio || false,
          degradeAudio: options?.degradeAudio || false,
          audioProfile: formatProfileRef.current?.audio || null,
        });
      } else if (caps.webm) {
        if (!wantsWebm) console.warn("[export] MP4 encoder unavailable — falling back to WebM");
        await exportWebm(videoExportArgs);
      } else {
        console.warn("[export] No video encoder available — falling back to GIF");
        await exportGif({
          canvas,
          renderer: rendererRef.current,
          params: paramsRef.current,
          fps: Math.max(1, Math.min(15, fps)),
          duration: Math.max(0.5, duration),
          onProgress: (value: number) => setExportProgress(value),
          maxWidth: 480,
          videoElement: isVideoRef.current ? videoElementRef.current : undefined,
          sourceScale: previewSettingsRef.current.sourceScale,
          renderOptions: buildExportRenderOptsRef.current(),
          signal: controller.signal,
        });
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        toast.info("Export cancelled");
      } else {
        console.error("Export failed:", err);
        toast.error("Export failed", { description: err?.message || String(err) });
      }
    } finally {
      if (prevPreferGPU && rendererRef.current?.setPreferGPU) rendererRef.current.setPreferGPU(true);
      setIsExporting(false);
      setExportProgress(0);
      exportControllerRef.current = null;
      // Restore video frame in preview after export
      if (isVideoRef.current && videoElementRef.current && rendererRef.current) {
        rendererRef.current.setImage(videoElementRef.current, previewSettingsRef.current.sourceScale);
        markDirty();
      }
    }
  }, [markDirty]);


  const handleCancelExport = useCallback(() => {
    exportControllerRef.current?.abort();
  }, []);

  const handleExportStill = useCallback((options?: { aspectRatio?: string; fileName?: string }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Honour the chosen aspect ratio by centre-cropping the frame to it (the
    // still previously ignored it and always exported the source ratio).
    let target: HTMLCanvasElement = canvas;
    const ar = options?.aspectRatio;
    if (ar && ar !== "original" && /^\d+:\d+$/.test(ar)) {
      const [aw, ah] = ar.split(":").map(Number);
      const wantAR = aw / ah;
      const sw = canvas.width, sh = canvas.height;
      let cw = sw, ch = sh;
      if (sw / sh > wantAR) cw = Math.round(sh * wantAR); // too wide → trim sides
      else ch = Math.round(sw / wantAR);                  // too tall → trim top/bottom
      const sx = Math.round((sw - cw) / 2), sy = Math.round((sh - ch) / 2);
      const cropped = document.createElement("canvas");
      cropped.width = cw; cropped.height = ch;
      cropped.getContext("2d")!.drawImage(canvas, sx, sy, cw, ch, 0, 0, cw, ch);
      target = cropped;
    }

    // Route through the same Save dialog as video/GIF so a still also gets a
    // chosen name + destination (and reveals in Finder on desktop), instead of
    // a silent data-URL download to ~/Downloads.
    target.toBlob((blob) => {
      if (!blob) return;
      void saveBlob(blob, options?.fileName || `crt-still-${Date.now()}.png`, {
        mimeType: "image/png", extension: "png", description: "PNG image",
      });
    }, "image/png");
  }, []);

  const handleExportGif = useCallback(async (fps: number, duration: number, fileName?: string, evaluateParams?: (t: number, p: any) => any) => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    setIsExporting(true);
    setExportProgress(0);
    const controller = new AbortController();
    exportControllerRef.current = controller; // so the Cancel button actually aborts a GIF (audit)
    const prevPreferGPU = rendererRef.current.preferGPU;
    if (prevPreferGPU && rendererRef.current.setPreferGPU) rendererRef.current.setPreferGPU(false);
    try {
      await exportGif({
        canvas,
        renderer: rendererRef.current,
        params: paramsRef.current,
        fps: Math.max(1, Math.min(15, fps)),
        duration: Math.max(0.5, duration),
        onProgress: (value: number) => setExportProgress(value),
        maxWidth: 480,
        evaluateParams,
        videoElement: isVideoRef.current ? videoElementRef.current : undefined,
        sourceScale: previewSettingsRef.current.sourceScale,
        renderOptions: buildExportRenderOptsRef.current(),
        signal: controller.signal,
        fileName,
      });
    } catch (err: any) {
      if (err?.name === "AbortError" || /abort/i.test(err?.message || "")) {
        toast.info("GIF export cancelled");
      } else {
        console.error("GIF export failed:", err);
        toast.error("GIF export failed", { description: err?.message || String(err) });
      }
    } finally {
      exportControllerRef.current = null;
      if (prevPreferGPU && rendererRef.current?.setPreferGPU) rendererRef.current.setPreferGPU(true);
      setIsExporting(false);
      setExportProgress(0);
      // Restore video frame in preview
      if (isVideoRef.current && videoElementRef.current && rendererRef.current) {
        rendererRef.current.setImage(videoElementRef.current, previewSettingsRef.current.sourceScale);
        markDirty();
      }
    }
  }, [markDirty]);

  /**
   * Run a single queued export job. Unlike handleExportMp4/handleExportGif this
   * accepts a params snapshot (so the job renders the look it was queued with), a
   * per-job progress callback, and an external AbortSignal for cancellation.
   * It shares the global isExporting gate so the queue and one-off exports never
   * run concurrently.
   */
  const runExportJob = useCallback(async (
    job: {
      name?: string;
      fileName?: string;
      format: "mp4" | "webm" | "gif";
      fps: number;
      duration: number;
      params: CRTParams;
      options?: { resolution?: number; quality?: number; aspectRatio?: string; includeAudio?: boolean; degradeAudio?: boolean;
        codec?: "h264" | "hevc" | "prores422" | "prores4444"; frameMode?: string; audioMode?: "off" | "original" | "degrade"; inSec?: number; outSec?: number };
    },
    onProgress: (ratio: number, frame: number, total: number, status?: string) => void,
    signal: AbortSignal,
  ) => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) throw new Error("Renderer not ready");

    setIsExporting(true);
    setExportProgress(0);
    const prevPreferGPU = renderer.preferGPU;
    if (prevPreferGPU && renderer.setPreferGPU) renderer.setPreferGPU(false);

    const progress = (ratio: number, frame: number, total: number, status?: string) => {
      setExportProgress(ratio);
      onProgress(ratio, frame, total, status);
    };

    // Bundled digital-era OSD fonts must be resident before rendering frames.
    await loadOSDFonts();

    try {
      const renderOptions = buildExportRenderOptsRef.current();
      if (job.format === "gif") {
        await exportGif({
          canvas, renderer,
          params: job.params,
          fps: Math.max(1, Math.min(15, job.fps)),
          duration: Math.max(0.5, job.duration),
          onProgress: progress,
          maxWidth: 480,
          videoElement: isVideoRef.current ? videoElementRef.current : undefined,
          sourceScale: previewSettingsRef.current.sourceScale,
          renderOptions,
          signal,
          fileName: ensureFilename(job.fileName || job.name || "", "gif", "lme-export"),
        });
      } else {
        // Prefer the native ffmpeg pipeline on desktop (same as handleExportMp4).
        // Opens a Save dialog per job to let the user pick the destination — if
        // the user cancels the dialog the job is marked cancelled (AbortError).
        const ffmpegReady = job.format !== "webm" && await isFfmpegExportAvailable();
        if (ffmpegReady) {
          if (signal.aborted) throw new DOMException("aborted", "AbortError");
          const defaultName = ensureFilename(job.fileName || job.name || "", "mp4", "lme-export");
          const desktopApi = (window as unknown as { desktop?: { saveDialog?: (o: { defaultName: string }) => Promise<string | null> } }).desktop;
          const outPath = await desktopApi?.saveDialog?.({ defaultName });
          if (!outPath) throw new DOMException("aborted", "AbortError");
          if (signal.aborted) throw new DOMException("aborted", "AbortError");

          // Mirror handleExportMp4: compute true export dims from source + options.
          const srcDims = sourceDimsRef.current;
          const sourceW = srcDims?.w && srcDims.w > 0 ? srcDims.w : canvas.width;
          const sourceH = srcDims?.h && srcDims.h > 0 ? srcDims.h : canvas.height;
          const { width: targetWidth, height: targetHeight } = computeExportSize({
            sourceW, sourceH,
            resolution: job.options?.resolution ?? 0,
            aspectRatio: job.options?.aspectRatio,
          });

          const wantsAudio = job.options?.includeAudio !== false && job.options?.audioMode !== "off";
          let audioSourcePath = (wantsAudio && isVideoRef.current && sourcePathRef.current)
            ? sourcePathRef.current : undefined;
          // Degrade-to-match — same one DSP as the single export (degraded buffer → temp WAV → mux),
          // so queued exports sound like the preview too.
          if (wantsAudio && job.options?.audioMode === "degrade" && audioDecodedRef.current) {
            try {
              const degraded = await degradeAudioBuffer(audioDecodedRef.current, audioProfileRef.current);
              const wav = audioBufferToWav(degraded);
              const dapi = (window as unknown as { desktop?: { writeTempAudio?: (b: ArrayBuffer) => Promise<{ path: string } | null> } }).desktop;
              const res = await dapi?.writeTempAudio?.(wav);
              if (res?.path) audioSourcePath = res.path;
            } catch { /* fall back to muxing the original track */ }
          }

          const jobFull = Math.max(0.5, job.duration);
          const jobTrimmed = job.options?.inSec != null || job.options?.outSec != null;
          const jobIn = Math.max(0, Math.min(job.options?.inSec ?? 0, jobFull));
          const jobOut = Math.max(jobIn + 1 / Math.max(1, job.fps), Math.min(job.options?.outSec ?? jobFull, jobFull));
          await exportViaFfmpeg({
            canvas, renderer,
            params: job.params,
            fps: Math.max(1, job.fps),
            duration: jobFull,
            ...(jobTrimmed ? { inSec: jobIn, outSec: jobOut } : {}),
            codec: job.options?.codec || "h264",
            outPath,
            audioSourcePath,
            videoElement: isVideoRef.current ? videoElementRef.current : undefined,
            targetWidth,
            targetHeight,
            // Honour the chosen reframe mode (crop/pad) instead of always cropping (audit).
            frameMode: job.options?.aspectRatio && job.options.aspectRatio !== "original"
              ? (job.options?.frameMode || "crop") : undefined,
            renderOptions,
            onProgress: (r) => progress(r, Math.round(r * Math.max(1, Math.floor(job.fps * job.duration))), Math.max(1, Math.floor(job.fps * job.duration))),
            signal,
          });
          return;
        }

        // Web / WebM fallback — same as before.
        const caps = getVideoExportCapabilities();
        const videoArgs = {
          canvas, renderer,
          params: job.params,
          fps: Math.max(1, job.fps),
          duration: Math.max(0.5, job.duration),
          onProgress: progress,
          signal,
          videoElement: isVideoRef.current ? videoElementRef.current : undefined,
          sourceScale: previewSettingsRef.current.sourceScale,
          bitrate: (job.options?.quality || 1) * 8_000_000,
          renderOptions,
        };
        const wantsMp4 = job.format === "mp4";
        if (wantsMp4 && caps.mp4) {
          await exportMp4({
            ...videoArgs,
            includeAudio: job.options?.includeAudio || false,
            degradeAudio: job.options?.degradeAudio || false,
            audioProfile: formatProfileRef.current?.audio || null,
            fileName: ensureFilename(job.fileName || job.name || "", "mp4", "lme-export"),
          });
        } else if (caps.webm) {
          if (wantsMp4) progress(0, 0, 0, "MP4 encoder unavailable — exporting WebM…");
          await exportWebm({ ...videoArgs, fileName: ensureFilename(job.fileName || job.name || "", "webm", "lme-export") });
        } else {
          progress(0, 0, 0, "No video encoder — exporting GIF…");
          await exportGif({
            canvas, renderer,
            params: job.params,
            fps: Math.max(1, Math.min(15, job.fps)),
            duration: Math.max(0.5, job.duration),
            onProgress: progress,
            maxWidth: 480,
            videoElement: isVideoRef.current ? videoElementRef.current : undefined,
            sourceScale: previewSettingsRef.current.sourceScale,
            renderOptions,
            signal,
            fileName: ensureFilename(job.fileName || job.name || "", "gif", "lme-export"),
          });
        }
      }
    } finally {
      if (prevPreferGPU && renderer.setPreferGPU) renderer.setPreferGPU(true);
      setIsExporting(false);
      setExportProgress(0);
      if (isVideoRef.current && videoElementRef.current && rendererRef.current) {
        rendererRef.current.setImage(videoElementRef.current, previewSettingsRef.current.sourceScale);
        markDirty();
      }
    }
  }, [markDirty]);




  /** Expose current source element for navigator thumbnail */
  const getSourceElement = useCallback((): HTMLImageElement | HTMLVideoElement | null => {
    if (isVideoRef.current && videoElementRef.current) return videoElementRef.current;
    if (originalImageRef.current) return originalImageRef.current;
    return null;
  }, []);

  const setPanCenter = useCallback((x: number, y: number) => {
    panCenterRef.current = { x, y };
    markDirty();
  }, [markDirty]);

  /**
   * Seek the video to a specific time and update the renderer with that frame.
   * Legacy — prefer seekVideo for new code.
   */
  const seekVideoFrame = useCallback((time: number, onSeeked?: () => void) => {
    const video = videoElementRef.current;
    if (!video) return;
    const clampedTime = Math.max(0, Math.min(video.duration || 0, time));
    const handler = () => {
      rendererRef.current?.setImage(video, previewSettingsRef.current.sourceScale);
      setVideoCurrentTime(video.currentTime);
      markDirty();
      onSeeked?.();
    };
    video.addEventListener("seeked", handler, { once: true });
    video.currentTime = clampedTime;
  }, [markDirty]);

  /**
   * Validate that the export pipeline is deterministic (CPU-only) and matches
   * the current preview frame. Returns a report and stores it in `validation`.
   */
  const validateExport = useCallback(async () => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    if (!canvas || !renderer) return null;
    const fps = previewSettingsRef.current.fpsLimit || 30;
    const elapsed = isVideoRef.current && videoElementRef.current
      ? videoElementRef.current.currentTime
      : (performance.now() - startTimeRef.current) / 1000;
    const frame = Math.floor(elapsed * fps);
    const renderOpts = buildRenderOptsRef.current(elapsed, paramsRef.current);
    let report: any;
    try {
      report = await validateExportAgainstPreview({
        renderer,
        previewCanvas: canvas,
        params: paramsRef.current,
        seconds: elapsed,
        frameIndex: frame,
        fps,
        renderOptions: renderOpts,
      });
    } catch (err: any) {
      report = { ok: false, error: err?.message || String(err) };
    }
    setValidation(report);
    markDirty();
    return report;
  }, [markDirty]);

  return {
    canvasRef,
    containerRef,
    hasImage,
    isVideo,
    sourceHasAudio,
    audioProfile,
    setAudioProfile,
    audioDecodedBuffer: audioPreview.decodedBuffer,
    videoDuration,
    videoCurrentTime,
    videoPlaying,
    videoSpeed,
    videoLoop,
    videoFPS,
    videoWidth,
    videoHeight,
    loadImage,
    sourceInfo,
    setParams,
    setOSDOptions,
    setPreviewSettings,
    isExporting,
    exportProgress,
    handleExportMp4,
    handleExportStill,
    handleExportGif,
    handleCancelExport,
    runExportJob,
    markDirty,
    getSourceElement,
    setPanCenter,
    seekVideoFrame,
    // Format authenticity pipeline
    setFormatProfile,
    setFormatPipelineEnabled,
    rendererMode,
    gpuAvailable: rendererRef.current?.gpuAvailable ?? false,
    // RAM preview (precache)
    ramPreview,
    buildRamPreview,
    clearRamPreview: invalidateRamCache,
    // Export validation
    validation,
    validateExport,
    // New video controls
    playVideo,
    pauseVideo,
    seekVideo,
    frameStepVideo,
    setVideoPlaybackSpeed,
    toggleVideoLoop,
    goToVideoStart,
    goToVideoEnd,
  };
}
