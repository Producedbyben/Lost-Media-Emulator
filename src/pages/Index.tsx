import { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from "react";
import { Monitor, Tv, Settings2, Download, Layers, Undo2, Redo2, Command, Keyboard, SplitSquareHorizontal, Eye, EyeOff, HelpCircle, Video, Circle, Square, Play, Zap, Cpu, Music, Activity, Hash, Clock, Film, Maximize, Gauge, Pin, GripVertical, RotateCcw, Sparkles, Repeat } from "lucide-react";
import { toast } from "sonner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PreviewCanvas from "@/components/PreviewCanvas";
import PreviewControls, { PreviewSettings, DEFAULT_PREVIEW_SETTINGS } from "@/components/PreviewControls";
import PreviewNavigator from "@/components/PreviewNavigator";
import PresetSelector from "@/components/PresetSelector";
import ExportPanel from "@/components/ExportPanel";
import CollapsiblePanel from "@/components/CollapsiblePanel";
import MaskSelector from "@/components/MaskSelector";
import SensorLensPanel from "@/components/SensorLensPanel";
import MetaAgingPanel from "@/components/MetaAgingPanel";
// Streamlined merged effect panels (each combines several former v1/v2 panels).
import ColorGradePanel from "@/components/ColorGradePanel";
import DisplayPanel from "@/components/DisplayPanel";
import TapePanel from "@/components/TapePanel";
import FilmPanel from "@/components/FilmPanel";
import DigitalPanel from "@/components/DigitalPanel";
import OSDControls, { OSDOptions, DEFAULT_OSD_OPTIONS } from "@/components/OSDControls";
import MacroControls from "@/components/MacroControls";
import ThemeSelector from "@/components/ThemeSelector";
import WorkflowNav from "@/components/WorkflowNav";
import CommandPalette from "@/components/CommandPalette";
import HistogramScope from "@/components/HistogramScope";
import KeyboardShortcutsOverlay from "@/components/KeyboardShortcutsOverlay";
import MiniTimeline from "@/components/MiniTimeline";
import EffectStack, { EFFECT_STAGES } from "@/components/EffectStack";
import BatchProcessor from "@/components/BatchProcessor";
import AudioReactivePanel from "@/components/AudioReactivePanel";
import AudioPanel from "@/components/AudioPanel";
import PresetMorphPad from "@/components/PresetMorphPad";
import OSDTemplateEditor from "@/components/OSDTemplateEditor";
import MaskPainter from "@/components/MaskPainter";
import TutorialOverlay, { useTutorial } from "@/components/TutorialOverlay";
import EffectTour, { useEffectTour } from "@/components/EffectTour";
import VideoTransport from "@/components/VideoTransport";
import { useCRTRenderer, CRTParams, DEFAULT_PARAMS } from "@/hooks/useCRTRenderer";
import { useLookHistory } from "@/hooks/useLookHistory";
import { useExportQueue } from "@/hooks/useExportQueue";
import { usePresetFavorites } from "@/hooks/usePresetFavorites";
import { useTheme } from "@/hooks/useTheme";
import { generateOSDProfile } from "@/lib/osd-profile";
import { mod, shiftKey, combo } from "@/lib/platform";
import { decodeParamsFromURL } from "@/lib/preset-storage";
import { clampParam, validateEnum } from "@/lib/preset-migration";
import { KeyframeState, evaluateAllTracks } from "@/lib/keyframe-engine";
import { AudioAnalyzerState, DEFAULT_AUDIO_ANALYZER_STATE } from "@/lib/audio-analyzer";
import { DEFAULT_AUDIO_PROFILE } from "@/hooks/useAudioPreview";
import { downloadCubeLUT } from "@/lib/lut-exporter";
// @ts-ignore
import { getFormatProfile, getFormatBadge } from "@/lib/format-profiles.js";
import { statsFromFile, statsFromCanvas, deriveMatchParams } from "@/lib/reference-match";
// @ts-ignore
import { PRESETS, CAPTURE_PRESETS, DISPLAY_PRESETS, NEUTRAL_CAPTURE, NEUTRAL_DISPLAY } from "@/lib/presets.js";

/**
 * Build a full param set from a preset, always starting from defaults so that any
 * effect the preset does NOT define is reset to its neutral value (no cross-preset
 * contamination). Numeric params are intensity-blended toward the default; string /
 * enum params (maskType, storageCondition, chromaSubsamplingMode, scanlineProfile,
 * subpixelLayoutOverride) are categorical and applied directly, then validated.
 * All numeric results are clamped to their documented ranges for accurate emulation.
 */
function blendParams(defaults: CRTParams, preset: Record<string, number | string>, intensity: number): CRTParams {
  const result = { ...defaults };
  for (const [k, v] of Object.entries(preset)) {
    if (!(k in result)) continue;
    if (typeof v === "number") {
      const base = typeof (defaults as any)[k] === "number" ? (defaults as any)[k] : 0;
      (result as any)[k] = clampParam(k, base + (v - base) * intensity);
    } else if (typeof v === "string") {
      (result as any)[k] = validateEnum(k, v);
    }
  }
  return result;
}


/** Animated transition: interpolate between two param sets */
function lerpParams(from: CRTParams, to: CRTParams, t: number): CRTParams {
  const result = { ...to };
  for (const key of Object.keys(from)) {
    const a = (from as any)[key];
    const b = (to as any)[key];
    if (typeof a === "number" && typeof b === "number") {
      (result as any)[key] = a + (b - a) * t;
    }
  }
  return result;
}

/** Apply solo/mute to params — zero out muted stages, or only keep solo stage */
function applyEffectStack(
  params: CRTParams,
  mutedStages: Set<string>,
  soloStage: string | null
): CRTParams {
  if (mutedStages.size === 0 && !soloStage) return params;
  const result = { ...params };
  for (const stage of EFFECT_STAGES) {
    const shouldMute = soloStage
      ? stage.id !== soloStage
      : mutedStages.has(stage.id);
    if (shouldMute) {
      for (const key of stage.paramKeys) {
        const def = (DEFAULT_PARAMS as any)[key];
        if (typeof def === "number") {
          (result as any)[key] = def;
        }
      }
    }
  }
  return result;
}

const PANEL_IDS: Record<string, string> = {
  presets: "panel-presets",
  grading: "panel-grading",
  masks: "panel-masks",
  display: "panel-display",
  digital: "panel-digital",
  film: "panel-film",
  tape: "panel-tape",
  sensorLens: "panel-sensorLens",
  metaAging: "panel-metaAging",
  osd: "panel-osd",
  preview: "panel-preview",
};

/**
 * Maps each effect panel to the param keys it controls. Module-level so the same
 * source of truth drives both disabled-panel param enforcement and the
 * auto-disable-on-preset logic (a panel a preset doesn't touch is switched off).
 */
const PANEL_CONTROL_IDS: Record<string, string[]> = {
  // Color & Grade (primary grade + analog colour-signal degradation).
  grading: [
    "imageBrightness", "imageContrast", "advancedSaturation", "imageGamma", "imageTemperature", "imageTint",
    "lumaNoise", "chromaNoise", "chromaBleedHorizontal", "chromaBleedVertical", "chromaPhaseError", "blackLevelCrush", "highlightRollOff", "gammaCurve",
  ],
  masks: ["phosphorMask", "maskScale"],
  // Display & CRT (CRT optics + v2 panel physics).
  display: [
    "scanlineStrength", "barrelDistortion", "chromaticAberration", "bloom", "advancedNeonPhosphorBleed", "flicker",
    "phosphorPersistence", "beamSpotSizeX", "beamSpotSizeY", "pixelResponseTime", "scanlineProfile", "subpixelLayoutOverride",
  ],
  // Digital & Compression (digital noise + codec compression + datamosh decay).
  digital: [
    "noise", "advancedFrameStutter", "advancedRfInterference", "advancedCctvMonochrome", "advancedQuantization", "advancedGenerationLoss", "advancedMacroBlocking",
    "gopLength", "deblockingStrength", "ringingStrength", "packetLossBurst", "upscaleSharpenHalos", "chromaSubsamplingMode",
    "datamoshBloom", "datamoshDisplacement", "pixelSort", "bitrotCorruption",
  ],
  // Film (core film emulation + advanced stock/gate/print controls).
  film: [
    "advancedFilmGrain", "advancedFilmDust", "advancedFilmScratches", "advancedFilmGateWeave", "advancedFilmHalation", "advancedExposurePump", "advancedWhiteBalanceDrift", "advancedFocusBreathing",
    "grainSize", "grainChromaticity", "gateJitterX", "gateJitterY", "gateRotation", "shutterJudder", "printFadeCyan", "printFadeMagenta", "printFadeYellow", "spliceFlash", "cueMarks",
  ],
  // Tape & Dropouts (video artifacts + temporal instability + tape mechanics).
  tape: [
    "pixelSize", "advancedLineJitter", "advancedTimebaseWobble", "advancedHeadSwitching", "advancedChromaDelay", "advancedCrossColor", "advancedDropouts", "advancedGhosting", "advancedInterlacing", "advancedTapeCrease",
    "dropoutFrequency", "dropoutLength", "jitterSpeed", "jitterRandomness", "wowFlutterSlow", "wowFlutterFast", "flickerFrequencyHz", "flickerDepth", "autoExposureHunt",
    "headClogEvents", "trackingError", "tapeSkew", "chromaNoiseStreaking",
  ],
  sensorLens: ["rollingShutterSkew", "fixedPatternNoise", "hotPixels", "lensSmear", "haze", "flareGhosts", "vignette", "cornerSharpnessFalloff"],
  metaAging: ["mediaAgeYears", "copyGenerationCount", "restorationPassLevel", "storageCondition"],
  // OSD only owns the burned-in timestamp/style overlay. (Neon bleed belongs to
  // the Display panel — listing it here wrongly kept OSD "in use" for display
  // presets, so it never turned off when switching away.)
  osd: ["advancedTimestampOSD", "advancedOSDStyle"],
};

type PanelSection = "capture" | "display";

/**
 * Default top-to-bottom signal order of the effect panels within each macro
 * section. Drag-and-drop reordering rewrites a user-specific order on top of this;
 * any panels added in future builds fall back to this canonical position.
 */
const DEFAULT_PANEL_ORDER: Record<PanelSection, string[]> = {
  capture: [
    "grading", "tape", "film", "digital", "sensorLens", "metaAging",
    "osd", "osdTemplate", "audioReactive", "batch",
  ],
  display: ["display", "masks", "maskPainter"],
};

/**
 * Panels (with adjustable params) belonging to each macro signal-chain slot. Drives
 * the per-slot "Reset slot" button, which clears every controlled param in the slot
 * back to its clean default. Tool-only panels (mask painter, batch, etc.) are
 * excluded because they don't own renderer params.
 */
const SECTION_PANELS: Record<PanelSection, string[]> = {
  capture: ["grading", "tape", "film", "digital", "sensorLens", "metaAging", "osd"],
  display: ["display", "masks"],
};

/** Merge a saved order with the canonical default, dropping stale keys. */
function mergePanelOrder(section: PanelSection, saved: string[] | undefined): string[] {
  const def = DEFAULT_PANEL_ORDER[section];
  const clean = (saved || []).filter((k) => def.includes(k));
  return [...clean, ...def.filter((k) => !clean.includes(k))];
}



/**
 * Decide which panels a target param set actually uses: a panel is "used" when at
 * least one of its controls differs from the neutral default (numeric epsilon, or
 * an enum that isn't the default string).
 */
// Params whose "no effect" (neutral) value is 1 rather than 0 (multiplicative).
const NEUTRAL_ONE = new Set([
  "imageBrightness", "imageContrast", "advancedSaturation", "imageGamma",
  "maskScale", "pixelSize", "gammaCurve",
]);

// A panel is "used" by a look when any of its params produces an effect — i.e.
// differs from that param's NEUTRAL value. Comparing against DEFAULT_PARAMS was a
// bug: the defaults are themselves a non-neutral CRT look (e.g. scanline 0.5), so
// a preset matching the default read as "unused", disabled the panel, and the
// disabled panel then zeroed its params — making a CRT preset render with no CRT.
function computeUsedPanels(target: Record<string, number | string>): Record<string, boolean> {
  const used: Record<string, boolean> = {};
  for (const [panel, ids] of Object.entries(PANEL_CONTROL_IDS)) {
    used[panel] = ids.some((id) => {
      const cur = (target as any)[id];
      if (typeof cur === "number") {
        const neutral = NEUTRAL_ONE.has(id) ? 1 : 0;
        return Math.abs(cur - neutral) > 1e-4;
      }
      // Categorical: used when set to anything other than its default/neutral value.
      const def = (DEFAULT_PARAMS as any)[id];
      return cur !== undefined && cur !== def;
    });
  }
  return used;
}



function getRandomPreset(): { name: string; values: Record<string, number> } {
  const names = Object.keys(PRESETS);
  const name = names[Math.floor(Math.random() * names.length)];
  return { name, values: PRESETS[name] };
}

const TRANSITION_DURATION = 400; // ms

const Index = () => {
  const {
    canvasRef, containerRef, hasImage, isVideo, sourceHasAudio, audioProfile, setAudioProfile, audioDecodedBuffer, videoDuration, videoCurrentTime,
    videoPlaying, videoSpeed, videoLoop, videoFPS, videoWidth, videoHeight,
    loadImage, sourceInfo, setParams, setOSDOptions, setPreviewSettings,
    isExporting, exportProgress, handleExportMp4, handleExportStill, handleExportGif, handleCancelExport, runExportJob,
    getSourceElement, setPanCenter: setRendererPanCenter, seekVideoFrame, rendererMode, gpuAvailable,
    ramPreview, buildRamPreview, clearRamPreview, validation, validateExport,
    playVideo, pauseVideo, seekVideo, frameStepVideo, setVideoPlaybackSpeed, toggleVideoLoop,
    goToVideoStart, goToVideoEnd,
    setFormatProfile, setFormatPipelineEnabled,
  } = useCRTRenderer();

  // Export queue — sequential, unattended long-run rendering with progress + ETA + cancel.
  const exportQueue = useExportQueue(runExportJob, isExporting);



  // Desktop (Electron) build on macOS uses a hidden-inset titlebar, so the app
  // header must clear the traffic lights and act as the native drag region.
  const isDesktopMac = typeof window !== 'undefined' && (window as any).desktop?.platform === 'darwin';

  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const { theme, setTheme, density, setDensity } = useTheme();
  const { startTutorial, TutorialComponent } = useTutorial();
  // Help-menu entry point (menu -> executeJavaScript dispatches this event).
  useEffect(() => {
    const open = () => startTutorial();
    window.addEventListener("tutorial:open", open);
    return () => window.removeEventListener("tutorial:open", open);
  }, [startTutorial]);
  const { showTour, setShowTour, startEffectTour } = useEffectTour();
  const [params, setLocalParams] = useState<CRTParams>(DEFAULT_PARAMS);
  const [osdOptions, setLocalOSDOptions] = useState<OSDOptions>(DEFAULT_OSD_OPTIONS);
  const [previewSettings, setLocalPreviewSettings] = useState<PreviewSettings>(DEFAULT_PREVIEW_SETTINGS);
  const [activePreset, setActivePreset] = useState("True Zero (Neutral)"); // Ben-11 #4: new sessions start as true passthrough (digitalClean format profile, no look)
  const [presetIntensity, setPresetIntensity] = useState(1);
  const [lastPresetValues, setLastPresetValues] = useState<Record<string, number> | null>(null);
  // Two-axis signal chain: a Capture/Format layer × a Display device layer.
  const [captureSlot, setCaptureSlot] = useState<string | null>(null);
  const [displaySlot, setDisplaySlot] = useState<string | null>(null);
  const [captureIntensity, setCaptureIntensity] = useState(1);
  const [displayIntensity, setDisplayIntensity] = useState(1);
  const [captureLocked, setCaptureLocked] = useState(false);
  const [displayLocked, setDisplayLocked] = useState(false);
  const [mobileTab, setMobileTab] = useState<"preview" | "presets" | "effects" | "export">("preview");
  const [panCenter, setPanCenter] = useState({ x: 0.5, y: 0.5 });
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  // Format authenticity pipeline (native resolution + composite colour + audio)
  const [formatPipelineEnabled, setFormatPipelineEnabledState] = useState(true);
  const activeFormatProfile = useMemo(() => getFormatProfile(activePreset, undefined), [activePreset]);
  const formatBadge = useMemo(() => getFormatBadge(activeFormatProfile), [activeFormatProfile]);
  useEffect(() => {
    setFormatProfile(activeFormatProfile);
  }, [activeFormatProfile, setFormatProfile]);
  useEffect(() => {
    setFormatPipelineEnabled(formatPipelineEnabled);
  }, [formatPipelineEnabled, setFormatPipelineEnabled]);

  // Effect stack solo/mute
  const [mutedStages, setMutedStages] = useState<Set<string>>(new Set());
  const [soloStage, setSoloStage] = useState<string | null>(null);

  // A/B split comparison
  const [abSplitEnabled, setAbSplitEnabled] = useState(false);

  // Animated preset transitions
  const transitionRef = useRef<number>(0);
  const transitionFromRef = useRef<CRTParams | null>(null);

  // Favorites & recently used
  const { favorites, recentlyUsed, toggleFavorite, addRecent, isFavorite } = usePresetFavorites();

  // Keyframe timeline state
  const [keyframeState, setKeyframeState] = useState<KeyframeState>({ tracks: [], duration: 4 });
  const [timelineTime, setTimelineTime] = useState(0);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [thumbnailVersion, setThumbnailVersion] = useState(0);
  const timelineAnimRef = useRef<number>(0);
  const timelineStartRef = useRef<number>(0);
  const timelineOffsetRef = useRef<number>(0);

  // Audio reactive state
  const [audioReactiveState, setAudioReactiveState] = useState<AudioAnalyzerState>(DEFAULT_AUDIO_ANALYZER_STATE);

  // Panel enable toggles — lifted from individual panels for central enforcement.
  // Streamlined: one flag per merged panel.
  const [gradingEnabled, setGradingEnabled] = useState(true);   // Color & Grade
  const [masksEnabled, setMasksEnabled] = useState(true);       // Masks & Geometry
  const [displayEnabled, setDisplayEnabled] = useState(true);   // Display & CRT
  const [digitalEnabled, setDigitalEnabled] = useState(true);   // Digital & Compression
  const [filmEnabled, setFilmEnabled] = useState(true);         // Film
  const [tapeEnabled, setTapeEnabled] = useState(true);         // Tape & Dropouts
  const [sensorLensEnabled, setSensorLensEnabled] = useState(true); // Lens & Sensor
  const [metaAgingEnabled, setMetaAgingEnabled] = useState(true);   // Media Aging
  const [osdEnabled, setOsdEnabled] = useState(true);           // On-Screen Display
  // Optional tool panels.
  const [maskPainterEnabled, setMaskPainterEnabled] = useState(false);
  const [previewFitScale, setPreviewFitScale] = useState(0); // source-px->CSS-px at fit (from PreviewCanvas, Ben-11 #5)
  const [osdTemplateEnabled, setOsdTemplateEnabled] = useState(false);
  const [audioReactiveEnabled, setAudioReactiveEnabled] = useState(false);
  const [batchEnabled, setBatchEnabled] = useState(false);


  // Master bypass
  const [masterBypass, setMasterBypass] = useState(false);
  const savedPanelStatesRef = useRef<Record<string, boolean> | null>(null);

  const handleMasterBypass = useCallback(() => {
    if (!masterBypass) {
      savedPanelStatesRef.current = {
        grading: gradingEnabled, masks: masksEnabled, display: displayEnabled,
        digital: digitalEnabled, film: filmEnabled, tape: tapeEnabled, osd: osdEnabled,
        sensorLens: sensorLensEnabled, metaAging: metaAgingEnabled,
      };
      setGradingEnabled(false); setMasksEnabled(false); setDisplayEnabled(false);
      setDigitalEnabled(false); setFilmEnabled(false); setTapeEnabled(false); setOsdEnabled(false);
      setSensorLensEnabled(false); setMetaAgingEnabled(false);
      setMasterBypass(true);
    } else {
      const saved = savedPanelStatesRef.current;
      if (saved) {
        setGradingEnabled(saved.grading ?? true); setMasksEnabled(saved.masks ?? true); setDisplayEnabled(saved.display ?? true);
        setDigitalEnabled(saved.digital ?? true); setFilmEnabled(saved.film ?? true); setTapeEnabled(saved.tape ?? true);
        setOsdEnabled(saved.osd ?? true); setSensorLensEnabled(saved.sensorLens ?? true); setMetaAgingEnabled(saved.metaAging ?? true);
      } else {
        setGradingEnabled(true); setMasksEnabled(true); setDisplayEnabled(true);
        setDigitalEnabled(true); setFilmEnabled(true); setTapeEnabled(true); setOsdEnabled(true);
        setSensorLensEnabled(true); setMetaAgingEnabled(true);
      }
      savedPanelStatesRef.current = null;
      setMasterBypass(false);
    }
  }, [masterBypass, gradingEnabled, masksEnabled, displayEnabled, digitalEnabled, filmEnabled, tapeEnabled, osdEnabled,
      sensorLensEnabled, metaAgingEnabled]);

  // Save/restore param values when toggling panels
  const savedParamsRef = useRef<Record<string, Record<string, number>>>({});
  const commitRef = useRef<((p: CRTParams) => void) | null>(null);

  // Panel enabled flags, keyed to match PANEL_CONTROL_IDS (single source of truth).
  const panelEnabledMap: Record<string, boolean> = {
    grading: gradingEnabled, masks: masksEnabled, display: displayEnabled, digital: digitalEnabled,
    film: filmEnabled, tape: tapeEnabled, osd: osdEnabled,
    sensorLens: sensorLensEnabled, metaAging: metaAgingEnabled,
  };

  // Panel configs matching original: when disabled, these param keys are zeroed.
  const PANEL_EFFECT_CONFIGS: Record<string, { enabled: boolean; controlIds: string[] }> = useMemo(() => {
    const out: Record<string, { enabled: boolean; controlIds: string[] }> = {};
    for (const [panel, ids] of Object.entries(PANEL_CONTROL_IDS)) {
      out[panel] = { enabled: panelEnabledMap[panel] ?? true, controlIds: ids };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, Object.values(panelEnabledMap));



  // Create save/restore toggle wrappers for each panel
  const makePanelToggle = useCallback((panelKey: string, setter: (v: boolean) => void) => {
    return (enabled: boolean) => {
      if (!enabled) {
        // Save current values before disabling
        const config = PANEL_EFFECT_CONFIGS[panelKey];
        if (config) {
          const saved: Record<string, number> = {};
          for (const key of config.controlIds) {
            saved[key] = typeof (params as any)[key] === "number" ? (params as any)[key] : 0;
          }
          savedParamsRef.current[panelKey] = saved;
        }
      } else {
        // Restore saved values on re-enable
        const saved = savedParamsRef.current[panelKey];
        if (saved) {
          setLocalParams(prev => {
            const next = { ...prev };
            for (const [k, v] of Object.entries(saved)) {
              (next as any)[k] = v;
            }
            return next;
          });
          delete savedParamsRef.current[panelKey];
        }
      }
      setter(enabled);
      // Record panel toggle to undo history — use deferred commit via timeout
      setTimeout(() => {
        if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
        commitTimeoutRef.current = setTimeout(() => {
          // commit will be available by the time this runs
          setLocalParams(prev => { commitRef.current?.(prev); return prev; });
        }, 500);
      }, 0);
    };
  }, [params]);

  const toggleGrading = useMemo(() => makePanelToggle("grading", setGradingEnabled), [makePanelToggle]);
  const toggleMasks = useMemo(() => makePanelToggle("masks", setMasksEnabled), [makePanelToggle]);
  const toggleDisplay = useMemo(() => makePanelToggle("display", setDisplayEnabled), [makePanelToggle]);
  const toggleDigital = useMemo(() => makePanelToggle("digital", setDigitalEnabled), [makePanelToggle]);
  const toggleFilm = useMemo(() => makePanelToggle("film", setFilmEnabled), [makePanelToggle]);
  const toggleTape = useMemo(() => makePanelToggle("tape", setTapeEnabled), [makePanelToggle]);
  const toggleSensorLens = useMemo(() => makePanelToggle("sensorLens", setSensorLensEnabled), [makePanelToggle]);
  const toggleMetaAging = useMemo(() => makePanelToggle("metaAging", setMetaAgingEnabled), [makePanelToggle]);
  const toggleOsd = useMemo(() => makePanelToggle("osd", setOsdEnabled), [makePanelToggle]);

  // Raw setters keyed by panel — used to auto-enable/disable panels on preset
  // switch without the save/restore churn of the manual toggle wrappers.
  const panelRawSetters = useMemo<Record<string, (v: boolean) => void>>(() => ({
    grading: setGradingEnabled, masks: setMasksEnabled, display: setDisplayEnabled, digital: setDigitalEnabled,
    film: setFilmEnabled, tape: setTapeEnabled, osd: setOsdEnabled,
    sensorLens: setSensorLensEnabled, metaAging: setMetaAgingEnabled,
  }), []);

  // Pinned panels: user-locked stages that the preset auto-disable logic must
  // never switch off. Persisted across sessions for QoL.
  const [pinnedPanels, setPinnedPanels] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem("lme:pinnedPanels");
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
    return new Set();
  });
  useEffect(() => {
    try { localStorage.setItem("lme:pinnedPanels", JSON.stringify([...pinnedPanels])); } catch { /* ignore */ }
  }, [pinnedPanels]);
  const pinnedRef = useRef(pinnedPanels);
  pinnedRef.current = pinnedPanels;

  const togglePin = useCallback((panelKey: string) => {
    setPinnedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panelKey)) next.delete(panelKey);
      else next.add(panelKey);
      return next;
    });
  }, []);
  const clearPins = useCallback(() => setPinnedPanels(new Set()), []);

  // Per-section custom signal order: drag-and-drop reordering of effect panels
  // inside each chain slot. Persisted across sessions.
  const [panelOrder, setPanelOrder] = useState<Record<PanelSection, string[]>>(() => {
    try {
      const raw = localStorage.getItem("lme:panelOrder");
      if (raw) {
        const p = JSON.parse(raw);
        return { capture: Array.isArray(p.capture) ? p.capture : [], display: Array.isArray(p.display) ? p.display : [] };
      }
    } catch { /* ignore */ }
    return { capture: [], display: [] };
  });
  useEffect(() => {
    try { localStorage.setItem("lme:panelOrder", JSON.stringify(panelOrder)); } catch { /* ignore */ }
  }, [panelOrder]);
  const [dragPanel, setDragPanel] = useState<{ key: string; section: PanelSection } | null>(null);
  const [dragOverPanel, setDragOverPanel] = useState<string | null>(null);
  const hasCustomPanelOrder = panelOrder.capture.length > 0 || panelOrder.display.length > 0;

  const movePanel = useCallback((section: PanelSection, fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    setPanelOrder((prev) => {
      const cur = mergePanelOrder(section, prev[section]);
      const arr = [...cur];
      const from = arr.indexOf(fromKey);
      if (from < 0) return prev;
      arr.splice(from, 1);
      const to = arr.indexOf(toKey);
      arr.splice(to < 0 ? arr.length : to, 0, fromKey);
      return { ...prev, [section]: arr };
    });
  }, []);

  const resetPanelOrder = useCallback(() => {
    setPanelOrder({ capture: [], display: [] });
    toast.success("Signal order reset to defaults");
  }, []);

  // Switch panels on/off to mirror exactly what the chosen preset uses, but keep
  // any user-pinned panels enabled so manual adjustments survive preset switches.
  const syncPanelsToParams = useCallback((target: Record<string, number | string>) => {
    const used = computeUsedPanels(target);
    const pinned = pinnedRef.current;
    for (const [panel, setter] of Object.entries(panelRawSetters)) {
      setter(!!used[panel] || pinned.has(panel));
    }
  }, [panelRawSetters]);



  // Mask painter
  const [effectMask, setEffectMask] = useState<ImageData | null>(null);
  const handleMaskChange = useCallback((mask: ImageData | null) => {
    if (!maskPainterEnabled) { setEffectMask(null); return; }
    setEffectMask(mask);
  }, [maskPainterEnabled]);

  const handlePanChange = useCallback((x: number, y: number) => {
    setPanCenter({ x, y });
    setRendererPanCenter(x, y);
  }, [setRendererPanCenter]);
  const commitTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const sourceElement = getSourceElement();

  const { commit, undo, redo, canUndo, canRedo } = useLookHistory(DEFAULT_PARAMS);
  commitRef.current = commit;
  const [isDirty, setIsDirty] = useState(false);

  // Load look from URL on mount, otherwise restore the last working session (QoL).
  const sessionRestoredRef = useRef(false);
  useEffect(() => {
    const url = new URL(window.location.href);
    const lookParam = url.searchParams.get("look");
    if (lookParam) {
      const decoded = decodeParamsFromURL(lookParam);
      if (decoded) {
        setLocalParams(prev => {
          const next = { ...prev, ...decoded };
          commit(next as CRTParams);
          return next as CRTParams;
        });
        setActivePreset("Shared Look");
        url.searchParams.delete("look");
        window.history.replaceState({}, "", url.toString());
        sessionRestoredRef.current = true;
        return;
      }
    }
    // QoL: restore the previous session so a reload doesn't wipe a work-in-progress look.
    try {
      const raw = localStorage.getItem("lme:lastSession");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && saved.params) {
          setLocalParams(prev => {
            const next = { ...prev, ...saved.params };
            commit(next as CRTParams);
            return next as CRTParams;
          });
          if (saved.osdOptions) setLocalOSDOptions(prev => ({ ...prev, ...saved.osdOptions }));
          if (saved.previewSettings) setLocalPreviewSettings(prev => ({ ...prev, ...saved.previewSettings }));
          if (typeof saved.activePreset === "string") setActivePreset(saved.activePreset);
          if (typeof saved.presetIntensity === "number") setPresetIntensity(saved.presetIntensity);
          if (saved.lastPresetValues) setLastPresetValues(saved.lastPresetValues);
          if (typeof saved.captureSlot === "string" || saved.captureSlot === null) setCaptureSlot(saved.captureSlot);
          if (typeof saved.displaySlot === "string" || saved.displaySlot === null) setDisplaySlot(saved.displaySlot);
          if (typeof saved.captureIntensity === "number") setCaptureIntensity(saved.captureIntensity);
          if (typeof saved.displayIntensity === "number") setDisplayIntensity(saved.displayIntensity);
          if (typeof saved.captureLocked === "boolean") setCaptureLocked(saved.captureLocked);
          if (typeof saved.displayLocked === "boolean") setDisplayLocked(saved.displayLocked);
        }
      }
    } catch { /* ignore corrupt session */ }
    sessionRestoredRef.current = true;
  }, [commit]);

  // QoL: persist the current session (debounced) for restore on next visit.
  useEffect(() => {
    if (!sessionRestoredRef.current) return;
    const id = setTimeout(() => {
      try {
        localStorage.setItem("lme:lastSession", JSON.stringify({
          params, osdOptions, previewSettings, activePreset, presetIntensity, lastPresetValues,
          captureSlot, displaySlot, captureIntensity, displayIntensity, captureLocked, displayLocked,
        }));
      } catch { /* storage full / unavailable */ }
    }, 600);
    return () => clearTimeout(id);
  }, [params, osdOptions, previewSettings, activePreset, presetIntensity, lastPresetValues,
      captureSlot, displaySlot, captureIntensity, displayIntensity, captureLocked, displayLocked]);



  // Default values for params when panels are disabled — grading uses 1 for multiplicative params, not 0
  const GRADING_DEFAULTS: Record<string, number> = {
    imageBrightness: 1, imageContrast: 1, advancedSaturation: 1, imageGamma: 1, imageTemperature: 0, imageTint: 0,
    gammaCurve: 1,
  };

  // Apply params with effect stack solo/mute AND disabled panel enforcement
  useEffect(() => {
    let effective = applyEffectStack(params, mutedStages, soloStage);
    // Enforce disabled panels: zero out their params (matching original behavior)
    const result = { ...effective };
    for (const [panelKey, config] of Object.entries(PANEL_EFFECT_CONFIGS)) {
      if (config.enabled) continue;
      for (const id of config.controlIds) {
        // Use proper defaults: grading multiplicative params default to 1, not 0
        const defaultVal = panelKey === "grading" && id in GRADING_DEFAULTS
          ? GRADING_DEFAULTS[id]
          : 0;
        (result as any)[id] = defaultVal;
      }
    }
    setParams(result);
  }, [params, mutedStages, soloStage, setParams, gradingEnabled, masksEnabled, displayEnabled, digitalEnabled, filmEnabled, tapeEnabled, osdEnabled,
      sensorLensEnabled, metaAgingEnabled]);

  useEffect(() => { setOSDOptions(osdOptions); }, [osdOptions, setOSDOptions]);
  useEffect(() => { setPreviewSettings(previewSettings); }, [previewSettings, setPreviewSettings]);

  // A/B split: toggle compare mode
  useEffect(() => {
    if (abSplitEnabled) {
      setLocalPreviewSettings(s => ({ ...s, compareMode: "lock", compareSplit: true }));
    } else {
      setLocalPreviewSettings(s => ({ ...s, compareMode: "off", compareSplit: false }));
    }
  }, [abSplitEnabled]);

  useEffect(() => {
    if (isVideo && videoDuration > 0) {
      setKeyframeState(prev => ({ ...prev, duration: Math.min(300, videoDuration) }));
    }
  }, [isVideo, videoDuration]);

  const scheduleCommit = useCallback((p: CRTParams) => {
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = setTimeout(() => commit(p), 500);
  }, [commit]);

  const handleParamChange = useCallback((key: string, value: number) => {
    setLocalParams((prev) => {
      const next = { ...prev, [key]: value };
      scheduleCommit(next);
      setIsDirty(true);
      return next;
    });
  }, [scheduleCommit]);

  const handleStringParamChange = useCallback((key: string, value: string) => {
    setLocalParams((prev) => {
      const next = { ...prev, [key]: value };
      setIsDirty(true);
      return next;
    });
  }, []);

  // Reference match: tune grade toward a dropped reference image.
  const handleMatchReferenceFile = useCallback(async (file: File) => {
    try {
      const src = getSourceElement();
      if (!src) {
        toast.error("Load source media first");
        return;
      }
      const srcW = (src as HTMLVideoElement).videoWidth || (src as HTMLImageElement).naturalWidth || 480;
      const srcH = (src as HTMLVideoElement).videoHeight || (src as HTMLImageElement).naturalHeight || 360;
      const scale = Math.min(1, 480 / Math.max(srcW, srcH));
      const tmp = document.createElement("canvas");
      tmp.width = Math.max(1, Math.round(srcW * scale));
      tmp.height = Math.max(1, Math.round(srcH * scale));
      const tctx = tmp.getContext("2d", { willReadFrequently: true })!;
      tctx.drawImage(src as CanvasImageSource, 0, 0, tmp.width, tmp.height);
      const srcStats = statsFromCanvas(tmp);
      const refStats = await statsFromFile(file);
      if (!srcStats || !refStats) {
        toast.error("Could not analyze images");
        return;
      }
      const overrides = deriveMatchParams(refStats, srcStats, {
        imageBrightness: params.imageBrightness,
        imageContrast: params.imageContrast,
        imageTemperature: params.imageTemperature,
        imageTint: params.imageTint,
        advancedSaturation: params.advancedSaturation,
        imageGamma: params.imageGamma,
        noise: params.noise,
        bloom: params.bloom,
      });
      setLocalParams((prev) => {
        const next = { ...prev, ...overrides } as CRTParams;
        commit(next);
        return next;
      });
      setIsDirty(true);
      toast.success("Matched grade to reference", { description: "Editable — fine-tune any slider" });
    } catch (err: any) {
      toast.error("Reference match failed", { description: err?.message || String(err) });
    }
  }, [getSourceElement, params, commit]);


  // Animated preset transition
  const animateToPreset = useCallback((targetParams: CRTParams) => {
    if (transitionRef.current) cancelAnimationFrame(transitionRef.current);
    transitionFromRef.current = { ...params };
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / TRANSITION_DURATION);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const interpolated = lerpParams(transitionFromRef.current!, targetParams, eased);
      setLocalParams(interpolated);
      if (t < 1) {
        transitionRef.current = requestAnimationFrame(tick);
      } else {
        transitionFromRef.current = null;
        commit(targetParams);
      }
    };
    transitionRef.current = requestAnimationFrame(tick);
  }, [params, commit]);

  // Shared OSD-profile application used by both Classics and the signal chain.
  const applyOsdProfile = useCallback((name: string, values: Record<string, number>) => {
    const osdProfile = generateOSDProfile(name, values);
    setLocalOSDOptions((prev) => ({
      ...prev,
      osdStyle: osdProfile.style,
      osdStartDateTime: osdProfile.startDateTime,
      osdFontPreset: osdProfile.fontPreset,
      osdPrimaryColor: osdProfile.primaryColor,
      osdAccentColor: osdProfile.accentColor,
      osdCountWithExport: osdProfile.countWithExport,
      // Per-look corner labels (kills the garbled "CAM2"/"CTFID CHANNEL3" default); merge so any
      // other configured corners survive. Same map the headless/CLI path consumes.
      osdCornerConfig: { ...prev.osdCornerConfig, ...osdProfile.cornerConfig },
    }));
    if ("advancedOSDStyle" in values) {
      setLocalOSDOptions((prev) => ({ ...prev, osdStyle: values.advancedOSDStyle }));
    }
  }, []);

  const handleSelectPreset = useCallback((name: string, values: Record<string, number>) => {
    setActivePreset(name);
    setLastPresetValues(values);
    setIsDirty(false);
    addRecent(name);

    // Start from defaults + preset (numeric + categorical), so unused effects reset.
    let targetParams = blendParams(DEFAULT_PARAMS, values, presetIntensity);

    // Honor locked chain layers — overlay them on top of the classic; clear any
    // unlocked slots so the Classic is shown faithfully.
    if (captureLocked && captureSlot) {
      targetParams = blendParams(targetParams, CAPTURE_PRESETS[captureSlot], captureIntensity);
    } else {
      setCaptureSlot(null);
    }
    if (displayLocked && displaySlot) {
      targetParams = blendParams(targetParams, DISPLAY_PRESETS[displaySlot], displayIntensity);
    } else {
      setDisplaySlot(null);
    }

    // Auto switch panels on/off to match exactly what this preset uses, so the
    // sidebar only shows the stages that actually shape this look.
    syncPanelsToParams(targetParams);

    // Animate transition
    animateToPreset(targetParams);

    applyOsdProfile(name, values);
  }, [presetIntensity, animateToPreset, addRecent, syncPanelsToParams, applyOsdProfile,
      captureLocked, captureSlot, displayLocked, displaySlot, captureIntensity, displayIntensity]);

  const handleIntensityChange = useCallback((intensity: number) => {
    setPresetIntensity(intensity);
    if (lastPresetValues) {
      // Re-derive from defaults + preset at the new intensity (categorical params
      // like maskType come straight from the preset, not the previous look).
      setLocalParams(blendParams(DEFAULT_PARAMS, lastPresetValues, intensity));
    }
  }, [lastPresetValues]);

  // ---- Two-axis signal chain --------------------------------------------------
  // Compose a final look by stacking a Capture/Format layer (source media) and a
  // Display device layer (the screen). The key sets are disjoint, so each layer is
  // blended on top of the other with its own intensity.
  const applyChain = useCallback((
    capName: string | null, dispName: string | null,
    capInt: number, dispInt: number,
  ) => {
    const capVals = (capName ? CAPTURE_PRESETS[capName] : NEUTRAL_CAPTURE) as Record<string, number>;
    const dispVals = (dispName ? DISPLAY_PRESETS[dispName] : NEUTRAL_DISPLAY) as Record<string, number>;
    let target = blendParams(DEFAULT_PARAMS, capVals, capInt);
    target = blendParams(target, dispVals, dispInt);

    setActivePreset(capName || dispName ? `${capName || "Direct"} → ${dispName || "Direct"}` : "");
    setLastPresetValues(null);
    setIsDirty(false);
    syncPanelsToParams(target);
    animateToPreset(target);
    // OSD belongs to the captured source, not the display.
    applyOsdProfile(capName || "", capVals);
  }, [animateToPreset, syncPanelsToParams, applyOsdProfile]);

  const handleSelectCapture = useCallback((name: string) => {
    setCaptureSlot(name);
    applyChain(name, displaySlot, captureIntensity, displayIntensity);
  }, [applyChain, displaySlot, captureIntensity, displayIntensity]);

  const handleSelectDisplay = useCallback((name: string) => {
    setDisplaySlot(name);
    applyChain(captureSlot, name, captureIntensity, displayIntensity);
  }, [applyChain, captureSlot, captureIntensity, displayIntensity]);

  const handleCaptureIntensity = useCallback((v: number) => {
    setCaptureIntensity(v);
    applyChain(captureSlot, displaySlot, v, displayIntensity);
  }, [applyChain, captureSlot, displaySlot, displayIntensity]);

  const handleDisplayIntensity = useCallback((v: number) => {
    setDisplayIntensity(v);
    applyChain(captureSlot, displaySlot, captureIntensity, v);
  }, [applyChain, captureSlot, displaySlot, captureIntensity]);

  const handleClearCapture = useCallback(() => {
    setCaptureSlot(null);
    applyChain(null, displaySlot, captureIntensity, displayIntensity);
  }, [applyChain, displaySlot, captureIntensity, displayIntensity]);

  const handleClearDisplay = useCallback(() => {
    setDisplaySlot(null);
    applyChain(captureSlot, null, captureIntensity, displayIntensity);
  }, [applyChain, captureSlot, captureIntensity, displayIntensity]);



  const handleResetParams = useCallback(() => {
    // QoL: non-blocking, undoable reset instead of a hard confirm dialog.
    // Ben-11 #3: "Reset all" must return to TRUE ZERO — params (DEFAULT_PARAMS is now
    // genuinely neutral), plus every effect-adjacent state that used to survive: signal-chain
    // slots/locks/intensities (a locked layer silently re-blended onto the next preset),
    // stage mutes/solo, keyframe tracks, the mask painter, and the audio profile (which
    // persisted into exports). All captured in the undo closure.
    const prevParams = params;
    const prevOSD = osdOptions;
    const prevPreset = activePreset;
    const prevIntensity = presetIntensity;
    const prevLastValues = lastPresetValues;
    const prevChain = { captureSlot, displaySlot, captureIntensity, displayIntensity, captureLocked, displayLocked };
    const prevMuted = mutedStages;
    const prevSolo = soloStage;
    const prevKeyframes = keyframeState;
    const prevMaskPainter = maskPainterEnabled;
    const prevAudioProfile = audioProfile;
    setLocalParams(DEFAULT_PARAMS);
    setLocalOSDOptions(DEFAULT_OSD_OPTIONS);
    setActivePreset("");
    setPresetIntensity(1);
    setLastPresetValues(null);
    setCaptureSlot(null);
    setDisplaySlot(null);
    setCaptureIntensity(1);
    setDisplayIntensity(1);
    setCaptureLocked(false);
    setDisplayLocked(false);
    setMutedStages(new Set());
    setSoloStage(null);
    setKeyframeState({ tracks: [], duration: 4 });
    setMaskPainterEnabled(false);
    setAudioProfile(DEFAULT_AUDIO_PROFILE);
    setIsDirty(false);
    commit(DEFAULT_PARAMS);
    toast.success("Everything reset — true zero state", {
      action: {
        label: "Undo",
        onClick: () => {
          setLocalParams(prevParams);
          setLocalOSDOptions(prevOSD);
          setActivePreset(prevPreset);
          setPresetIntensity(prevIntensity);
          setLastPresetValues(prevLastValues);
          setCaptureSlot(prevChain.captureSlot);
          setDisplaySlot(prevChain.displaySlot);
          setCaptureIntensity(prevChain.captureIntensity);
          setDisplayIntensity(prevChain.displayIntensity);
          setCaptureLocked(prevChain.captureLocked);
          setDisplayLocked(prevChain.displayLocked);
          setMutedStages(prevMuted);
          setSoloStage(prevSolo);
          setKeyframeState(prevKeyframes);
          setMaskPainterEnabled(prevMaskPainter);
          setAudioProfile(prevAudioProfile);
          setIsDirty(true);
          commit(prevParams);
        },
      },
    });
  }, [commit, params, osdOptions, activePreset, presetIntensity, lastPresetValues,
      captureSlot, displaySlot, captureIntensity, displayIntensity, captureLocked, displayLocked,
      mutedStages, soloStage, keyframeState, maskPainterEnabled, audioProfile, setAudioProfile]);

  /**
   * Reset every effect in one signal-chain slot (Capture/Format or Display/Output)
   * back to its clean default, leaving the other slot untouched. Undoable.
   */
  const handleResetSection = useCallback((section: PanelSection, label: string) => {
    const keys = SECTION_PANELS[section].flatMap((k) => PANEL_CONTROL_IDS[k] || []);
    if (keys.length === 0) return;
    const prevParams = params;
    setLocalParams((prev) => {
      const next = { ...prev } as CRTParams;
      for (const k of keys) {
        if (k in DEFAULT_PARAMS) (next as any)[k] = (DEFAULT_PARAMS as any)[k];
      }
      commit(next);
      return next;
    });
    setIsDirty(true);
    toast.success(`${label} effects reset to defaults`, {
      action: {
        label: "Undo",
        onClick: () => { setLocalParams(prevParams); commit(prevParams); setIsDirty(true); },
      },
    });
  }, [params, commit]);

  const handleOSDChange = useCallback((options: OSDOptions) => { setLocalOSDOptions(options); }, []);
  const handlePreviewSettingsChange = useCallback((settings: PreviewSettings) => { setLocalPreviewSettings(settings); }, []);

  const handleUndo = useCallback(() => {
    const snapshot = undo();
    if (snapshot) { setLocalParams(snapshot); setIsDirty(true); }
  }, [undo]);

  const handleRedo = useCallback(() => {
    const snapshot = redo();
    if (snapshot) { setLocalParams(snapshot); setIsDirty(true); }
  }, [redo]);

  const handleJump = useCallback((panelId: string) => {
    window.dispatchEvent(new CustomEvent(`panel-focus:${panelId}`));
    if (panelId === "presets") setMobileTab("presets");
    else if (panelId === "preview") setMobileTab("preview");
    else setMobileTab("effects");

    const domId = PANEL_IDS[panelId];
    if (!domId) return;
    setTimeout(() => {
      const el = document.getElementById(domId);
      if (!el) return;
      const sidebar = el.closest("[data-sidebar]");
      if (sidebar) {
        const top = el.getBoundingClientRect().top - sidebar.getBoundingClientRect().top + sidebar.scrollTop - 8;
        sidebar.scrollTo({ top, behavior: "smooth" });
      } else {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      el.classList.add("ring-2", "ring-primary/50");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary/50"), 900);
    }, 60);
  }, []);

  const handleImport = useCallback(() => { fileInputRef.current?.click(); }, []);

  // Centralised file loader: validates, surfaces clear errors, and tells the user
  // when an optimised working copy was generated (AE-style proxy workflow).
  const handleLoadFile = useCallback(async (file: File) => {
    const loadingId = toast.loading(`Loading ${file.name}…`);
    try {
      const info = await loadImage(file);
      toast.dismiss(loadingId);
      // Desktop: record successfully-opened on-disk files for File ▸ Open Recent.
      // Only real picked/dropped files carry a path (pasted images and files
      // rebuilt from a data URL don't — the guard skips those).
      try {
        const desktopApi = (window as any).desktop;
        const realPath: string | null | undefined =
          desktopApi?.getPathForFile?.(file) || (file as any).path;
        if (realPath && desktopApi?.recentFiles?.add) desktopApi.recentFiles.add(realPath);
      } catch { /* recent-files bookkeeping must never break an import */ }
      if (info?.optimized) {
        toast.success("Optimised working copy created", {
          description: `Source ${info.sourceW}×${info.sourceH} → working ${info.workingW}×${info.workingH} for faster, smoother editing. Exports stay sharp.`,
        });
      } else if (info) {
        toast.success(`Loaded ${info.sourceW}×${info.sourceH} ${info.type}`);
      }
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error("Couldn't load file", { description: err?.message || String(err) });
    }
  }, [loadImage]);

  // Native File-menu entry points (menu → executeJavaScript dispatches these,
  // same pattern as the Help menu's "tutorial:open"). Each one reuses the
  // existing handler rather than duplicating logic.
  useEffect(() => {
    const openMedia = () => handleImport(); // File ▸ Open Media… (⌘O) — same as import button / ⌘I
    const openExport = () => { if (hasImage) setExportDialogOpen(true); }; // File ▸ Export… (⌘E) — same gate as the disabled Export button
    const openRecent = (e: Event) => {
      // File ▸ Open Recent ▸ …: main read the file and shipped it as a data URL;
      // rebuild a File and run the exact same import path as a picked file.
      const detail = (e as CustomEvent<{ dataURL?: string; name?: string }>).detail;
      if (!detail?.dataURL) return;
      (async () => {
        try {
          const blob = await (await fetch(detail.dataURL!)).blob();
          const file = new File([blob], detail.name || "recent-media", { type: blob.type });
          handleLoadFile(file);
        } catch (err: any) {
          toast.error("Couldn't open recent file", { description: err?.message || String(err) });
        }
      })();
    };
    window.addEventListener("menu:open-media", openMedia);
    window.addEventListener("menu:export", openExport);
    window.addEventListener("menu:open-recent", openRecent as EventListener);
    return () => {
      window.removeEventListener("menu:open-media", openMedia);
      window.removeEventListener("menu:export", openExport);
      window.removeEventListener("menu:open-recent", openRecent as EventListener);
    };
  }, [handleImport, handleLoadFile, hasImage]);



  const handleRandomize = useCallback(() => {
    // QoL: capture the prior look so a surprise randomize is one click to undo.
    const prevParams = params;
    const prevPreset = activePreset;
    const prevIntensity = presetIntensity;
    const prevLastValues = lastPresetValues;
    const { name, values } = getRandomPreset();
    handleSelectPreset(name, values);
    toast.info(`Random look: ${name}`, {
      action: {
        label: "Undo",
        onClick: () => {
          setLocalParams(prevParams);
          setActivePreset(prevPreset);
          setPresetIntensity(prevIntensity);
          setLastPresetValues(prevLastValues);
          setIsDirty(true);
          commit(prevParams);
        },
      },
    });
  }, [handleSelectPreset, params, activePreset, presetIntensity, lastPresetValues, commit]);

  const handleToggleMute = useCallback((stageId: string) => {
    setMutedStages(prev => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }, []);

  const handleToggleSolo = useCallback((stageId: string) => {
    setSoloStage(prev => prev === stageId ? null : stageId);
  }, []);

  const getRenderer = useCallback(() => {
    return (window as any).__lme_renderer;
  }, []);

  // Timeline playback loop
  useEffect(() => {
    if (!timelinePlaying) return;
    timelineStartRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = (now - timelineStartRef.current) / 1000 + timelineOffsetRef.current;
      if (elapsed >= keyframeState.duration) {
        setTimelineTime(keyframeState.duration);
        setTimelinePlaying(false);
        timelineOffsetRef.current = 0;
        return;
      }
      setTimelineTime(elapsed);
      if (keyframeState.tracks.length > 0) {
        const evaluated = evaluateAllTracks(keyframeState.tracks, elapsed, params as Record<string, number | string>);
        setLocalParams(evaluated as CRTParams);
      }
      timelineAnimRef.current = requestAnimationFrame(tick);
    };
    timelineAnimRef.current = requestAnimationFrame(tick);
    return () => { if (timelineAnimRef.current) cancelAnimationFrame(timelineAnimRef.current); };
  }, [timelinePlaying, keyframeState]);

  const handleTimelinePlayPause = useCallback(() => {
    if (timelinePlaying) {
      timelineOffsetRef.current = timelineTime;
      setTimelinePlaying(false);
    } else {
      if (timelineTime >= keyframeState.duration) {
        timelineOffsetRef.current = 0;
        setTimelineTime(0);
      } else {
        timelineOffsetRef.current = timelineTime;
      }
      setLocalPreviewSettings(s => ({ ...s, animationEnabled: true }));
      setTimelinePlaying(true);
    }
  }, [timelinePlaying, timelineTime, keyframeState.duration]);

  const handleTimelineSeek = useCallback((t: number) => {
    setTimelineTime(t);
    timelineOffsetRef.current = t;
    if (isVideo && seekVideoFrame) {
      seekVideoFrame(t, () => setThumbnailVersion(v => v + 1));
    }
    if (keyframeState.tracks.length > 0) {
      const evaluated = evaluateAllTracks(keyframeState.tracks, t, params as Record<string, number | string>);
      setLocalParams(evaluated as CRTParams);
    }
  }, [isVideo, seekVideoFrame, keyframeState, params]);

  const handleLoadAudio = useCallback(async (file: File) => {
    try {
      const audioCtx = new AudioContext();
      const arrayBuf = await file.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrayBuf);
      setAudioBuffer(decoded);
      setKeyframeState(prev => ({ ...prev, duration: Math.min(60, decoded.duration) }));
    } catch (err) {
      console.error("Failed to decode audio:", err);
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isTyping = (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement);
      if (isTyping) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault(); handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) {
        e.preventDefault(); handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault(); handleImport();
      }
      if (e.key.toLowerCase() === "b" && !e.ctrlKey && !e.metaKey && !e.repeat) {
        e.preventDefault(); handleMasterBypass();
      }
      if (e.key.toLowerCase() === "b" && !e.ctrlKey && !e.metaKey && !e.repeat) {
        e.preventDefault(); handleMasterBypass();
      }
      if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
        e.preventDefault(); handleRandomize();
      }
      if (e.code === "Space" && !e.repeat && previewSettings.compareMode !== "lock") {
        e.preventDefault();
        setLocalPreviewSettings(s => ({ ...s, compareMode: "hold" }));
      }
    };
    const upHandler = (e: KeyboardEvent) => {
      if (e.code === "Space" && previewSettings.compareMode === "hold") {
        e.preventDefault();
        setLocalPreviewSettings(s => ({ ...s, compareMode: "off" }));
      }
    };
    window.addEventListener("keydown", handler);
    window.addEventListener("keyup", upHandler);
    return () => { window.removeEventListener("keydown", handler); window.removeEventListener("keyup", upHandler); };
  }, [handleUndo, handleRedo, handleImport, handleMasterBypass, handleRandomize, previewSettings.compareMode]);


  const isCompact = density === "compact";
  const panelSpacing = isCompact ? "space-y-1.5" : "space-y-2";
  const panelPadding = isCompact ? "p-2" : "p-3";

  // Count active (non-default) params for status bar
  const activeParamCount = useMemo(() => {
    let count = 0;
    for (const key of Object.keys(DEFAULT_PARAMS)) {
      const cur = (params as any)[key];
      const def = (DEFAULT_PARAMS as any)[key];
      if (typeof cur === "number" && typeof def === "number" && Math.abs(cur - def) > 0.001) count++;
    }
    return count;
  }, [params]);

  // Handle morphed params from PresetMorphPad
  const [morphPadEnabled, setMorphPadEnabled] = useState(false);
  const handleMorphedParams = useCallback((morphed: CRTParams) => {
    if (!morphPadEnabled) return;
    setLocalParams(morphed);
    setIsDirty(true);
  }, [morphPadEnabled]);

  // "Active only" focuses the sidebar on the stages actually shaping the look —
  // an AE-style declutter that pairs with auto-disabled panels on preset switch.
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const activePanelCount = Object.values(panelEnabledMap).filter(Boolean).length;
  const totalPanelCount = Object.keys(panelEnabledMap).length;


  const panelControls = (
    <div className="flex items-center gap-1 mb-1.5">
      <button
        onClick={() => setShowActiveOnly((v) => !v)}
        title="Show only the panels currently affecting the look"
        className={`flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded border transition-colors ${
          showActiveOnly
            ? "bg-primary/20 text-primary border-primary/40"
            : "bg-secondary text-muted-foreground hover:text-foreground border-border"
        }`}
      >
        {showActiveOnly ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
        Active only
      </button>
      <span className="text-[12px] font-mono text-muted-foreground tabular-nums">
        {activePanelCount}/{totalPanelCount}
      </span>
      {pinnedPanels.size > 0 && (
        <button
          onClick={clearPins}
          title="Unpin all panels — preset switches can disable them again"
          className="flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded border bg-primary/15 text-primary border-primary/40 hover:bg-primary/25 transition-colors"
        >
          <Pin className="w-3 h-3" fill="currentColor" />
          {pinnedPanels.size} pinned
        </button>
      )}
      {hasCustomPanelOrder && (
        <button
          onClick={resetPanelOrder}
          title="Reset the custom drag order back to the default signal chain order"
          className="flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded border bg-secondary text-muted-foreground hover:text-foreground border-border transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Reset order
        </button>
      )}
      <div className="flex-1" />
      <button
        onClick={() => window.dispatchEvent(new Event("panels:expand-all"))}
        className="px-2 py-0.5 text-[12px] font-medium text-muted-foreground hover:text-foreground bg-secondary border border-border rounded transition-colors"
      >
        Expand all
      </button>
      <button
        onClick={() => window.dispatchEvent(new Event("panels:collapse-all"))}
        className="px-2 py-0.5 text-[12px] font-medium text-muted-foreground hover:text-foreground bg-secondary border border-border rounded transition-colors"
      >
        Collapse all
      </button>
    </div>
  );


  // Panels organised into two macro-sections that mirror the signal chain —
  // CAPTURE / FORMAT (source media) flows into DISPLAY / OUTPUT (the screen) — so
  // an AE user can scan top-to-bottom in the same order the effects are applied.
  // `enabled` drives the "Active only" filter; `tool` items are optional utilities.
  type PanelEntry = { key: string; enabled: boolean; tool?: boolean; node: ReactNode };
  const panelGroups: { title: string; section: PanelSection; items: PanelEntry[] }[] = [
    { title: "Color & Grade", section: "capture", items: [
      { key: "grading", enabled: gradingEnabled, node: (
        <div id="panel-grading"><ColorGradePanel params={params as any} onChange={handleParamChange} enabled={gradingEnabled} onToggleEnabled={toggleGrading} /></div>
      ) },
    ] },
    { title: "Display & CRT", section: "display", items: [
      { key: "display", enabled: displayEnabled, node: (
        <div id="panel-display"><DisplayPanel params={params as any} onChange={handleParamChange} onStringChange={handleStringParamChange} enabled={displayEnabled} onToggleEnabled={toggleDisplay} /></div>
      ) },
    ] },
    { title: "Masks & Geometry", section: "display", items: [
      { key: "masks", enabled: masksEnabled, node: (
        <div id="panel-masks">
          <MaskSelector maskType={String(params.maskType)} maskStrength={params.phosphorMask} maskScale={params.maskScale}
            onMaskTypeChange={(type) => handleStringParamChange("maskType", type)}
            onMaskStrengthChange={(v) => handleParamChange("phosphorMask", v)}
            onMaskScaleChange={(v) => handleParamChange("maskScale", v)}
            enabled={masksEnabled} onToggleEnabled={toggleMasks} />
        </div>
      ) },
      { key: "maskPainter", enabled: maskPainterEnabled, tool: true, node: (
        <CollapsiblePanel title="Mask Painter" defaultOpen={false} enabled={maskPainterEnabled} onToggleEnabled={setMaskPainterEnabled}>
          <div className="pt-2">
            <MaskPainter width={320} height={240} onMaskChange={handleMaskChange} sourceElement={sourceElement} />
          </div>
        </CollapsiblePanel>
      ) },
    ] },
    { title: "Tape & Dropouts", section: "capture", items: [
      { key: "tape", enabled: tapeEnabled, node: (
        <div id="panel-tape"><TapePanel params={params as any} onChange={handleParamChange} enabled={tapeEnabled} onToggleEnabled={toggleTape} /></div>
      ) },
    ] },
    { title: "Audio", section: "capture", items: [
      { key: "audio", enabled: true, node: (
        <div id="panel-audio"><AudioPanel profile={audioProfile} onChange={(patch) => setAudioProfile((p) => ({ ...p, ...patch }))} decodedBuffer={audioDecodedBuffer} hasAudio={sourceHasAudio} /></div>
      ) },
    ] },
    { title: "Film", section: "capture", items: [
      { key: "film", enabled: filmEnabled, node: (
        <div id="panel-film"><FilmPanel params={params as any} onChange={handleParamChange} enabled={filmEnabled} onToggleEnabled={toggleFilm} /></div>
      ) },
    ] },
    { title: "Digital & Compression", section: "capture", items: [
      { key: "digital", enabled: digitalEnabled, node: (
        <div id="panel-digital"><DigitalPanel params={params as any} onChange={handleParamChange} onStringChange={handleStringParamChange} enabled={digitalEnabled} onToggleEnabled={toggleDigital} /></div>
      ) },
    ] },
    { title: "Lens & Sensor", section: "capture", items: [
      { key: "sensorLens", enabled: sensorLensEnabled, node: (
        <div id="panel-sensorLens"><SensorLensPanel params={params as any} onChange={handleParamChange} enabled={sensorLensEnabled} onToggleEnabled={toggleSensorLens} /></div>
      ) },
    ] },
    { title: "Media Aging", section: "capture", items: [
      { key: "metaAging", enabled: metaAgingEnabled, node: (
        <div id="panel-metaAging"><MetaAgingPanel params={params as any} onChange={handleParamChange} onStringChange={handleStringParamChange} enabled={metaAgingEnabled} onToggleEnabled={toggleMetaAging} /></div>
      ) },
    ] },
    { title: "Overlays & Tools", section: "capture", items: [
      { key: "osd", enabled: osdEnabled, node: (
        <div id="panel-osd">
          <OSDControls options={osdOptions} onChange={handleOSDChange}
            onParamChange={handleParamChange} timestampValue={params.advancedTimestampOSD}
            enabled={osdEnabled} onToggleEnabled={toggleOsd} />
        </div>
      ) },
      { key: "osdTemplate", enabled: osdTemplateEnabled, tool: true, node: (
        <CollapsiblePanel title="OSD Template Editor" defaultOpen={false} enabled={osdTemplateEnabled} onToggleEnabled={setOsdTemplateEnabled}>
          <div className="pt-2">
            <OSDTemplateEditor options={osdOptions} onChange={handleOSDChange} previewWidth={320} previewHeight={240} />
          </div>
        </CollapsiblePanel>
      ) },
      { key: "audioReactive", enabled: audioReactiveEnabled, tool: true, node: (
        <CollapsiblePanel title="Audio Reactive" defaultOpen={false} enabled={audioReactiveEnabled} onToggleEnabled={setAudioReactiveEnabled}>
          <div className="pt-2">
            <AudioReactivePanel state={audioReactiveState} onChange={setAudioReactiveState} hasAudio={!!audioBuffer} />
          </div>
        </CollapsiblePanel>
      ) },
      { key: "batch", enabled: batchEnabled, tool: true, node: (
        <CollapsiblePanel title="Batch Processing" defaultOpen={false} enabled={batchEnabled} onToggleEnabled={setBatchEnabled}>
          <div className="pt-2">
            <BatchProcessor hasImage={hasImage} currentParams={params} getRenderer={getRenderer} />
          </div>
        </CollapsiblePanel>
      ) },
    ] },
  ];

  const effectStack = (
    <>
      {panelControls}
      <div className="mb-2">
        <EffectStack
          mutedStages={mutedStages}
          soloStage={soloStage}
          onToggleMute={handleToggleMute}
          onToggleSolo={handleToggleSolo}
          currentParams={params as Record<string, number | string>}
          onJump={handleJump}
        />
      </div>
      {([
        { id: "display", label: "Display / Output", hint: "The screen it's shown on" },
        { id: "capture", label: "Capture / Format", hint: "Source media — what recorded it" },
      ] as const).map((macro) => {
        // Flatten the section's panels (keeping each one's stage label), then apply
        // the user's custom drag order so the sidebar reads top-to-bottom in the
        // exact order the signal is processed.
        const sectionItems = panelGroups
          .filter((g) => g.section === macro.id)
          .flatMap((g) => g.items.map((it) => ({ ...it, groupTitle: g.title })));
        const byKey = new Map(sectionItems.map((it) => [it.key, it]));
        const ordered = mergePanelOrder(macro.id, panelOrder[macro.id])
          .map((k) => byKey.get(k))
          .filter((it): it is (typeof sectionItems)[number] => !!it);
        const visible = ordered.filter((it) => !showActiveOnly || it.enabled);
        if (visible.length === 0) return null;
        return (
          <div key={macro.id} className="space-y-1.5">
            <div className="flex items-center gap-2 px-0.5 pt-2 pb-0.5">
              <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-primary">{macro.label}</span>
              <div className="flex-1 h-px bg-primary/30" />
              <span className="text-[11px] text-muted-foreground italic hidden sm:inline">{macro.hint}</span>
              <button
                type="button"
                onClick={() => handleResetSection(macro.id, macro.label)}
                aria-label={`Reset all ${macro.label} effects to defaults`}
                title={`Reset all ${macro.label} effects back to a clean default`}
                className="flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border border-border bg-secondary text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors shrink-0"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                Reset slot
              </button>
            </div>
            {visible.map((it) => {
              const pinnable = !it.tool && !!PANEL_CONTROL_IDS[it.key];
              const isPinned = pinnedPanels.has(it.key);
              const isDragging = dragPanel?.key === it.key;
              const isDragOver = dragOverPanel === it.key && dragPanel?.key !== it.key && dragPanel?.section === macro.id;
              return (
                <div
                  key={it.key}
                  draggable={isDragging}
                  onDragOver={(e) => {
                    if (dragPanel?.section === macro.id) { e.preventDefault(); setDragOverPanel(it.key); }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragPanel && dragPanel.section === macro.id) movePanel(macro.id, dragPanel.key, it.key);
                    setDragPanel(null); setDragOverPanel(null);
                  }}
                  onDragEnd={() => { setDragPanel(null); setDragOverPanel(null); }}
                  className={`relative group/pin rounded-md transition-all ${
                    isDragging ? "opacity-40" : ""
                  } ${isDragOver ? "ring-1 ring-primary/60 ring-offset-1 ring-offset-background" : ""}`}
                >
                  <div className="flex items-center gap-1 px-0.5 mb-0.5">
                    <button
                      type="button"
                      title="Drag to reorder this stage in the signal chain"
                      onMouseDown={() => setDragPanel({ key: it.key, section: macro.id })}
                      onMouseUp={() => setDragPanel((d) => (d?.key === it.key ? null : d))}
                      className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      <GripVertical className="w-3 h-3" />
                    </button>
                  </div>
                  {it.node}
                  {pinnable && (
                    <button
                      type="button"
                      onClick={() => togglePin(it.key)}
                      aria-pressed={isPinned}
                      title={isPinned
                        ? "Pinned — switching presets won't disable this panel. Click to unpin."
                        : "Pin panel — keep it active when switching presets"}
                      className={`absolute top-7 right-[68px] z-10 p-1 rounded-md bg-card/90 backdrop-blur-sm transition-all ${
                        isPinned
                          ? "text-primary opacity-100"
                          : "text-muted-foreground/50 opacity-0 group-hover/pin:opacity-100 hover:text-foreground"
                      }`}
                    >
                      <Pin className="w-3 h-3" fill={isPinned ? "currentColor" : "none"} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      {showActiveOnly && activePanelCount === 0 && (
        <p className="text-[12px] text-muted-foreground text-center py-4">
          No active panels. Pick a preset or turn one on to start shaping the look.
        </p>
      )}
    </>
  );


  const leftSidebar = (
    <>
      {panelControls}
      <CollapsiblePanel title="Settings" defaultOpen={false}>
        <div className="pt-2">
          <ThemeSelector theme={theme} density={density} onThemeChange={setTheme} onDensityChange={setDensity} />
        </div>
      </CollapsiblePanel>
      <div id="panel-presets">
        <CollapsiblePanel title="Presets" defaultOpen={true} panelId="presets">
          <div className="pt-2">
            <PresetSelector
              activePreset={activePreset}
              onSelectPreset={handleSelectPreset}
              presetIntensity={presetIntensity}
              onIntensityChange={handleIntensityChange}
              isDirty={isDirty}
              currentParams={params}
              onRandomize={handleRandomize}
              favorites={favorites}
              recentlyUsed={recentlyUsed}
              onToggleFavorite={toggleFavorite}
              isFavorite={isFavorite}
              chain={{
                captureSlot, displaySlot, captureIntensity, displayIntensity,
                captureLocked, displayLocked,
                onSelectCapture: (name) => handleSelectCapture(name),
                onSelectDisplay: (name) => handleSelectDisplay(name),
                onCaptureIntensity: handleCaptureIntensity,
                onDisplayIntensity: handleDisplayIntensity,
                onToggleCaptureLock: () => setCaptureLocked((v) => !v),
                onToggleDisplayLock: () => setDisplayLocked((v) => !v),
                onClearCapture: handleClearCapture,
                onClearDisplay: handleClearDisplay,
              }}
            />
          </div>
        </CollapsiblePanel>
      </div>
      <CollapsiblePanel title="Format & Authenticity" defaultOpen={false}>
        <div className="pt-2 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-foreground/90 flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-primary" /> {formatBadge}
            </span>
            <button
              onClick={() => setFormatPipelineEnabledState((v) => !v)}
              className={`px-2 py-0.5 rounded text-[12px] font-medium border transition-colors ${
                formatPipelineEnabled
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "bg-secondary text-muted-foreground border-border"
              }`}
            >
              {formatPipelineEnabled ? "Pipeline On" : "Pipeline Off"}
            </button>
          </div>
          {activeFormatProfile?.dossier && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
              <dt className="text-foreground/60">Medium</dt><dd>{activeFormatProfile.dossier.medium}</dd>
              <dt className="text-foreground/60">Era</dt><dd>{activeFormatProfile.dossier.years}</dd>
              <dt className="text-foreground/60">Resolution</dt><dd>{activeFormatProfile.dossier.res}</dd>
              <dt className="text-foreground/60">Audio</dt><dd>{activeFormatProfile.audio?.label}</dd>
              <dt className="text-foreground/60">Artifacts</dt><dd>{activeFormatProfile.dossier.artifacts}</dd>
            </dl>
          )}
          <div className="pt-1 border-t border-border/60">
            <button
              onClick={() => referenceInputRef.current?.click()}
              disabled={!hasImage}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-secondary text-secondary-foreground text-[12px] font-medium hover:bg-secondary/80 disabled:opacity-40 transition-colors border border-border"
            >
              <Eye className="w-3.5 h-3.5" /> Match grade to reference image…
            </button>
            <p className="mt-1 text-[12px] text-muted-foreground/70 leading-snug">
              Drop a screenshot of the look you want — the grade auto-tunes toward it. Fully editable afterward.
            </p>
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Preset Morph Pad" defaultOpen={false} enabled={morphPadEnabled} onToggleEnabled={setMorphPadEnabled}>
        <div className="pt-2">
          <PresetMorphPad
            onParamsChange={handleMorphedParams}
            currentParams={params}
          />
        </div>
      </CollapsiblePanel>
      <MacroControls params={params as unknown as Record<string, number>} onChange={handleParamChange} />
      <CollapsiblePanel title="Scope" defaultOpen={false}>
        <div className="pt-2">
          <HistogramScope canvasRef={canvasRef} hasImage={hasImage} mode="histogram" />
        </div>
      </CollapsiblePanel>
      <CollapsiblePanel title="Navigator" defaultOpen={true}>
        <div className="pt-2">
          <PreviewNavigator sourceElement={sourceElement} fitScale={previewFitScale} zoom={previewSettings.previewScale}
            panX={panCenter.x} panY={panCenter.y} onPanChange={handlePanChange} hasImage={hasImage}
            thumbnailVersion={thumbnailVersion} />
        </div>
      </CollapsiblePanel>
    </>
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <input ref={fileInputRef} type="file" accept="image/*,video/*,.mov,.webm,.mp4" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLoadFile(file); }} />
      <input ref={referenceInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleMatchReferenceFile(file); e.target.value = ""; }} />


      <CommandPalette
        onSelectPreset={handleSelectPreset} onJump={handleJump} onReset={handleResetParams}
        onUndo={handleUndo} onRedo={handleRedo} onImport={handleImport} onExportStill={handleExportStill}
        onParamChange={handleParamChange}
        currentParams={params as Record<string, number | string>}
      />

      <KeyboardShortcutsOverlay />

      <TutorialOverlay />
      <TutorialComponent />
      <EffectTour forceShow={showTour} onShowStep={handleJump} onComplete={() => setShowTour(false)} />

      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Export Settings</DialogTitle>
          </DialogHeader>
          <ExportPanel hasImage={hasImage} isVideo={isVideo} sourceHasAudio={sourceHasAudio}
            onExportMp4={handleExportMp4} onExportStill={handleExportStill} onExportGif={handleExportGif}
            onCancelExport={handleCancelExport} isExporting={isExporting} exportProgress={exportProgress}
            currentParams={params}
            onValidateExport={validateExport} validation={validation}
            videoFPS={videoFPS} videoDuration={videoDuration} videoWidth={videoWidth} videoHeight={videoHeight} videoCurrentTime={videoCurrentTime}
            lookName={activePreset} onEnqueueExport={exportQueue.enqueue}
            queueJobs={exportQueue.jobs} queueEtaMs={exportQueue.etaMs} queueActiveCount={exportQueue.activeCount}
            onCancelJob={exportQueue.cancelJob} onCancelAll={exportQueue.cancelAll} onClearFinished={exportQueue.clearFinished} />
        </DialogContent>
      </Dialog>

      {/* Top bar — doubles as the native window drag region on desktop. */}
      <header
        className={`flex items-center justify-between gap-3 py-2 bg-card border-b border-border shrink-0 relative ${
          isDesktopMac ? "titlebar-drag pl-[78px] pr-4" : "px-4"
        }`}
      >
        <div className="header-accent absolute bottom-0 left-0 right-0" />
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 rounded-[3px] bg-surface-2 flex items-center justify-center border border-border">
            <Tv className="w-4 h-4 text-foreground/80" />
          </div>
          <div className="leading-none">
            <h1 className="text-sm font-semibold text-foreground leading-none tracking-tight">Lost Media Emulator</h1>
            <p className="text-[11px] text-muted-foreground mt-1 tracking-wide hidden md:block">CRT · VHS · Analog · Film · Digital degradation</p>
          </div>
        </div>

        {/* Program readout — the signature. A recessed instrument panel reporting
            the live output as phosphor-green monospace, the way a broadcast
            processor reports its signal. The signal LED lights green when a look
            is passing through, dark when bypassed to clean source. */}
        <div className="hidden lg:flex flex-1 min-w-0 items-center justify-center px-2">
          <div className="readout flex items-center gap-2.5 min-w-0 px-3 py-1">
            <span className={`led ${masterBypass ? "led-off" : "led-on"}`} aria-hidden />
            <span
              className={`text-[11px] font-mono uppercase tracking-wide truncate ${masterBypass ? "signal-dim" : "signal-text"}`}
              title={activePreset || "Custom look"}
            >
              {masterBypass ? "BYPASS · CLEAN SOURCE" : (activePreset || "CUSTOM LOOK")}
            </span>
            {formatBadge && !masterBypass && (
              <>
                <span className="hidden xl:block w-px h-3.5 bg-border" />
                <span className="hidden xl:block text-[10px] font-mono uppercase tracking-wider signal-dim whitespace-nowrap">{formatBadge}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 titlebar-no-drag">
          {/* Master bypass toggle */}
          <button
            onClick={handleMasterBypass}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium border transition-all ${
              masterBypass
                ? "bg-destructive/15 border-destructive/40 text-destructive"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
            title="Bypass all effects (show clean source)"
          >
            {masterBypass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            <span className="hidden sm:inline">{masterBypass ? "Bypassed" : "Bypass"}</span>
            <kbd className="hidden sm:inline text-[10px] opacity-50 ml-0.5">B</kbd>
          </button>
          {/* A/B Split toggle */}
          <button
            onClick={() => setAbSplitEnabled(!abSplitEnabled)}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[12px] font-medium border transition-all ${
              abSplitEnabled
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
            title="Toggle A/B split comparison"
          >
            <SplitSquareHorizontal className="w-3 h-3" />
            <span className="hidden sm:inline">A/B</span>
          </button>
          <div className="relative group">
            <button onClick={() => setExportDialogOpen(true)} disabled={!hasImage}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[12px] font-medium hover:bg-primary/90 disabled:opacity-40 transition-colors">
              <Download className="w-3 h-3" />Export
            </button>
            {!hasImage && (
              <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-popover text-popover-foreground text-[12px] px-2 py-1 rounded border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Load an image or video first
              </span>
            )}
          </div>
          <div className="w-px h-5 bg-border mx-0.5 hidden sm:block" />
          <button onClick={handleUndo} disabled={!canUndo}
            className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 transition-colors" title={`Undo (${combo(mod, "Z")})`}>
            <Undo2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={handleRedo} disabled={!canRedo}
            className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 transition-colors" title={`Redo (${combo(mod, shiftKey, "Z")})`}>
            <Redo2 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <div className="w-px h-5 bg-border mx-0.5 hidden lg:block" />
          <button onClick={startTutorial} title="Show tutorial" aria-label="Show app tutorial"
            className="hidden lg:flex p-1.5 rounded hover:bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={startEffectTour} title="Guided effects tour" aria-label="Start guided effects tour"
            className="hidden lg:flex p-1.5 rounded hover:bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors">
            <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => window.dispatchEvent(new Event("shortcuts:open"))} title="Keyboard shortcuts (?)"
            className="hidden lg:flex p-1.5 rounded hover:bg-secondary transition-colors">
            <Keyboard className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => {
              const ev = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true });
              window.dispatchEvent(ev);
            }}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors text-[12px]"
            title={`Command palette (${combo(mod, "K")})`}>
            <Command className="w-3 h-3" />
            <span className="font-mono">{combo(mod, "K")}</span>
          </button>
        </div>
      </header>

      <div className="hidden lg:flex items-center justify-between gap-3 px-4 py-1.5 bg-card/80 border-b border-border shrink-0">
        <WorkflowNav onJump={handleJump} panelStates={{
          presets: true, grading: gradingEnabled, masks: masksEnabled, display: displayEnabled,
          digital: digitalEnabled, film: filmEnabled, tape: tapeEnabled, osd: osdEnabled, preview: true,
        }} />
      </div>

      <nav className="flex lg:hidden border-b border-border bg-card/95 glass-panel shrink-0">
        {([
          { id: "preview" as const, label: "Preview", icon: Monitor },
          { id: "presets" as const, label: "Looks", icon: Layers },
          { id: "effects" as const, label: "Effects", icon: Settings2 },
          { id: "export" as const, label: "Export", icon: Download },
        ]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setMobileTab(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[12px] font-medium transition-all ${
              mobileTab === id ? "text-primary mobile-tab-active" : "text-muted-foreground hover:text-foreground"
            }`}>
            <Icon className={`w-4 h-4 transition-transform ${mobileTab === id ? "scale-110" : ""}`} />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="hidden lg:flex h-full">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
              <aside data-sidebar className={`h-full overflow-y-auto ${panelPadding} ${panelSpacing} bg-card`}>
                {leftSidebar}
              </aside>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={56} minSize={30}>
              <main className="h-full flex flex-col p-3 min-w-0 gap-2" id="panel-preview">
                {isDesktop && (
                  <PreviewCanvas
                    canvasRef={canvasRef} containerRef={containerRef} hasImage={hasImage} onLoadImage={handleLoadFile}
                    zoom={previewSettings.previewScale}
                    sourceWidth={sourceElement ? ((sourceElement as HTMLVideoElement).videoWidth || (sourceElement as HTMLImageElement).naturalWidth || 0) : 0}
                    onFitScaleChange={setPreviewFitScale}
                    onZoomChange={(z) => { handlePreviewSettingsChange({ ...previewSettings, previewScale: z }); if (z <= 1.001) handlePanChange(0.5, 0.5); }}
                    panX={panCenter.x} panY={panCenter.y} onPanChange={handlePanChange}
                    compareSplit={previewSettings.compareSplit}
                    onCompareSplitRatioChange={(r) => handlePreviewSettingsChange({ ...previewSettings, compareSplitRatio: r })}
                  />
                )}
                <div className="shrink-0 px-1">
                  <PreviewControls fitScale={previewFitScale} settings={previewSettings} onChange={handlePreviewSettingsChange} isVideo={isVideo} gpuAvailable={gpuAvailable} rendererMode={rendererMode} ramPreview={ramPreview} onBuildRamPreview={buildRamPreview} onClearRamPreview={clearRamPreview} />
                </div>
                {/* Video Transport — professional playback controls */}
                {isVideo && (
                  <div className="shrink-0">
                    <VideoTransport
                      isVideo={isVideo}
                      hasImage={hasImage}
                      duration={videoDuration}
                      currentTime={videoCurrentTime}
                      isPlaying={videoPlaying}
                      fps={videoFPS}
                      videoWidth={videoWidth}
                      videoHeight={videoHeight}
                      speed={videoSpeed}
                      loop={videoLoop}
                      onPlay={playVideo}
                      onPause={pauseVideo}
                      onSeek={seekVideo}
                      onFrameStep={frameStepVideo}
                      onSpeedChange={setVideoPlaybackSpeed}
                      onLoopToggle={toggleVideoLoop}
                      onGoToStart={goToVideoStart}
                      onGoToEnd={goToVideoEnd}
                    />
                  </div>
                )}
                <div className="shrink-0">
                  <MiniTimeline
                    duration={keyframeState.duration}
                    onDurationChange={(d) => setKeyframeState(prev => ({ ...prev, duration: d }))}
                    currentTime={timelineTime}
                    onSeek={handleTimelineSeek}
                    isPlaying={timelinePlaying}
                    onPlayPause={handleTimelinePlayPause}
                    keyframeState={keyframeState}
                    onKeyframeStateChange={setKeyframeState}
                    currentParams={params as Record<string, number | string>}
                    audioBuffer={audioBuffer}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md cursor-pointer hover:bg-secondary/80 transition-colors border border-border">
                    <Monitor className="w-3.5 h-3.5" /> Import source
                    <input type="file" accept="image/*,video/*,.mov,.webm,.mp4" className="hidden"
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLoadFile(file); }} />
                  </label>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md cursor-pointer hover:bg-secondary/80 transition-colors border border-border">
                    <Music className="w-3.5 h-3.5" /> Audio
                    <input type="file" accept="audio/*" className="hidden"
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLoadAudio(file); }} />
                  </label>
                  <button onClick={handleResetParams}
                    className="px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors border border-border">
                    Reset all
                  </button>
                  <div className="flex-1" />
                  <span className="text-[12px] font-mono text-muted-foreground">
                    {activePreset || "Custom"}{isDirty ? " *" : ""}
                  </span>
                </div>
              </main>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={22} minSize={15} maxSize={35}>
              <aside data-sidebar className={`h-full overflow-y-auto ${panelPadding} ${panelSpacing} bg-card`}>
                {effectStack}
              </aside>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        <div className="flex lg:hidden h-full overflow-hidden">
          {mobileTab === "presets" && (
            <aside data-sidebar className={`flex-1 overflow-y-auto ${panelPadding} ${panelSpacing}`}>{leftSidebar}</aside>
          )}
          {mobileTab === "preview" && (
            <main className="flex-1 flex flex-col p-3 min-w-0 gap-2">
              {!isDesktop && (
                <PreviewCanvas
                  canvasRef={canvasRef} containerRef={containerRef} hasImage={hasImage} onLoadImage={handleLoadFile}
                  zoom={previewSettings.previewScale}
                  sourceWidth={sourceElement ? ((sourceElement as HTMLVideoElement).videoWidth || (sourceElement as HTMLImageElement).naturalWidth || 0) : 0}
                  onFitScaleChange={setPreviewFitScale}
                  onZoomChange={(z) => { handlePreviewSettingsChange({ ...previewSettings, previewScale: z }); if (z <= 1.001) handlePanChange(0.5, 0.5); }}
                  panX={panCenter.x} panY={panCenter.y} onPanChange={handlePanChange}
                  compareSplit={previewSettings.compareSplit}
                  onCompareSplitRatioChange={(r) => handlePreviewSettingsChange({ ...previewSettings, compareSplitRatio: r })}
                />
              )}
              <div className="shrink-0 px-1">
                <PreviewControls fitScale={previewFitScale} settings={previewSettings} onChange={handlePreviewSettingsChange} isVideo={isVideo} gpuAvailable={gpuAvailable} rendererMode={rendererMode} ramPreview={ramPreview} onBuildRamPreview={buildRamPreview} onClearRamPreview={clearRamPreview} />
              </div>
              {isVideo && (
                <div className="shrink-0">
                  <VideoTransport
                    isVideo={isVideo}
                    hasImage={hasImage}
                    duration={videoDuration}
                    currentTime={videoCurrentTime}
                    isPlaying={videoPlaying}
                    fps={videoFPS}
                    videoWidth={videoWidth}
                    videoHeight={videoHeight}
                    speed={videoSpeed}
                    loop={videoLoop}
                    onPlay={playVideo}
                    onPause={pauseVideo}
                    onSeek={seekVideo}
                    onFrameStep={frameStepVideo}
                    onSpeedChange={setVideoPlaybackSpeed}
                    onLoopToggle={toggleVideoLoop}
                    onGoToStart={goToVideoStart}
                    onGoToEnd={goToVideoEnd}
                  />
                </div>
              )}
              <div className="shrink-0">
                <MiniTimeline
                  duration={keyframeState.duration}
                  onDurationChange={(d) => setKeyframeState(prev => ({ ...prev, duration: d }))}
                  currentTime={timelineTime}
                  onSeek={handleTimelineSeek}
                  isPlaying={timelinePlaying}
                  onPlayPause={handleTimelinePlayPause}
                  keyframeState={keyframeState}
                  onKeyframeStateChange={setKeyframeState}
                  currentParams={params as Record<string, number | string>}
                  audioBuffer={audioBuffer}
                />
              </div>
            </main>
          )}
          {mobileTab === "effects" && (
            <aside data-sidebar className={`flex-1 overflow-y-auto ${panelPadding} ${panelSpacing}`}>{effectStack}</aside>
          )}
          {mobileTab === "export" && (
            <div className="flex-1 p-4 overflow-y-auto">
              <ExportPanel hasImage={hasImage} isVideo={isVideo} sourceHasAudio={sourceHasAudio}
                onExportMp4={handleExportMp4} onExportStill={handleExportStill} onExportGif={handleExportGif}
                onCancelExport={handleCancelExport} isExporting={isExporting} exportProgress={exportProgress}
                currentParams={params}
                onValidateExport={validateExport} validation={validation}
                videoFPS={videoFPS} videoDuration={videoDuration} videoWidth={videoWidth} videoHeight={videoHeight} videoCurrentTime={videoCurrentTime}
                lookName={activePreset} onEnqueueExport={exportQueue.enqueue}
                queueJobs={exportQueue.jobs} queueEtaMs={exportQueue.etaMs} queueActiveCount={exportQueue.activeCount}
                onCancelJob={exportQueue.cancelJob} onCancelAll={exportQueue.cancelAll} onClearFinished={exportQueue.clearFinished} />
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <footer className="hidden lg:flex status-bar items-center justify-between px-4 py-1 shrink-0 text-muted-foreground">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            {hasImage ? (isVideo ? <Video className="w-3 h-3" /> : <Monitor className="w-3 h-3" />) : <Circle className="w-3 h-3 opacity-40" />}
            {hasImage ? (isVideo ? "Video" : "Image") : "No source"}
          </span>
          {!isVideo && hasImage && sourceInfo && (
            <>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <Maximize className="w-3 h-3" />
                {sourceInfo.sourceW}×{sourceInfo.sourceH}
              </span>
              {sourceInfo.optimized && (
                <span
                  className="flex items-center gap-1 text-primary"
                  title={`Editing an optimised ${sourceInfo.workingW}×${sourceInfo.workingH} working copy for speed`}
                >
                  <Zap className="w-3 h-3" />
                  proxy {sourceInfo.workingW}×{sourceInfo.workingH}
                </span>
              )}
            </>
          )}
          {isVideo && hasImage && (
            <>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <Maximize className="w-3 h-3" />
                {videoWidth}×{videoHeight}
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <Film className="w-3 h-3" />
                {videoFPS}fps · {videoDuration.toFixed(1)}s · {Math.floor(videoDuration * videoFPS)} frames
              </span>
              <span className="text-border">|</span>
              <span className="flex items-center gap-1">
                <Gauge className="w-3 h-3" />
                {videoSpeed}× {videoLoop && <Repeat className="w-3 h-3" aria-label="Looping" />}
              </span>
            </>
          )}
          <span className="text-border">|</span>
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {activeParamCount} param{activeParamCount !== 1 ? "s" : ""}
          </span>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3" />
            {activePreset || "Custom"}{isDirty ? " *" : ""}
          </span>
          <span className="text-border">|</span>
          <span
            className={`flex items-center gap-1 ${formatPipelineEnabled ? "signal-text" : "opacity-50 line-through"}`}
            title={formatPipelineEnabled
              ? `Format pipeline active — ${activeFormatProfile?.dossier?.medium || ""}`
              : "Format pipeline off"}
          >
            <Film className="w-3 h-3" />
            {formatBadge}
          </span>

        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            {previewSettings.animationEnabled ? <Play className="w-2.5 h-2.5 fill-current" /> : <Square className="w-2.5 h-2.5 fill-current" />}
            {previewSettings.animationEnabled ? `${previewSettings.fpsLimit}fps` : "Still"}
          </span>
          <span className="text-border">|</span>
          <span className="opacity-60">{isVideo ? "K: Play · ←→: Frame step · L: Loop" : `${combo(mod, "K")}: Commands · B: Bypass`}</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
