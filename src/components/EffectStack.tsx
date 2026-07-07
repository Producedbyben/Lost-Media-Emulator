import { useState } from "react";
import { 
  Eye, EyeOff, Headphones, ChevronDown,
  Palette, Grid3X3, Tv, Radio, Rewind, Cpu, Film, Timer, MessageSquare,
  Waves, Disc, Camera, Monitor, Clock,
  LucideIcon
} from "lucide-react";

export interface EffectStage {
  id: string;
  label: string;
  paramKeys: string[];
  icon: LucideIcon;
}

export const EFFECT_STAGES: EffectStage[] = [
  { id: "grading", label: "Color & Grade", paramKeys: ["imageBrightness", "imageContrast", "advancedSaturation", "imageGamma", "imageTemperature", "imageTint"], icon: Palette },
  { id: "masks", label: "Mask Effects", paramKeys: ["phosphorMask", "maskScale"], icon: Grid3X3 },
  { id: "crt", label: "CRT Effects", paramKeys: ["scanlineStrength", "barrelDistortion", "chromaticAberration", "bloom", "flicker"], icon: Tv },
  { id: "signal", label: "Signal & Noise", paramKeys: ["noise", "advancedLineJitter", "advancedTimebaseWobble", "advancedRfInterference"], icon: Radio },
  { id: "tape", label: "Tape Artifacts", paramKeys: ["advancedHeadSwitching", "advancedChromaDelay", "advancedCrossColor", "advancedDropouts", "advancedGhosting", "advancedInterlacing", "advancedTapeCrease"], icon: Rewind },
  { id: "digital", label: "Digital & Compression", paramKeys: ["advancedQuantization", "advancedGenerationLoss", "advancedMacroBlocking", "advancedCctvMonochrome"], icon: Cpu },
  { id: "film", label: "Film Effects", paramKeys: ["advancedFilmGrain", "advancedFilmDust", "advancedFilmScratches", "advancedFilmGateWeave", "advancedFilmHalation"], icon: Film },
  { id: "temporal", label: "Temporal", paramKeys: ["advancedFrameStutter", "advancedExposurePump", "advancedWhiteBalanceDrift", "advancedFocusBreathing"], icon: Timer },
  { id: "osd", label: "Overlays & OSD", paramKeys: ["advancedTimestampOSD", "advancedOSDStyle", "advancedNeonPhosphorBleed"], icon: MessageSquare },
  // V2 stages
  { id: "colorSignal", label: "Color & Signal", paramKeys: ["lumaNoise", "chromaNoise", "chromaBleedHorizontal", "chromaBleedVertical", "chromaPhaseError", "blackLevelCrush", "highlightRollOff", "gammaCurve"], icon: Waves },
  { id: "temporalV2", label: "Temporal Instability", paramKeys: ["dropoutFrequency", "dropoutLength", "jitterSpeed", "jitterRandomness", "wowFlutterSlow", "wowFlutterFast", "flickerFrequencyHz", "flickerDepth", "autoExposureHunt"], icon: Clock },
  { id: "tapeMech", label: "Tape Mechanics", paramKeys: ["headClogEvents", "trackingError", "tapeSkew", "chromaNoiseStreaking"], icon: Disc },
  { id: "filmV2", label: "Film Advanced", paramKeys: ["grainSize", "grainChromaticity", "gateJitterX", "gateJitterY", "gateRotation", "shutterJudder", "printFadeCyan", "printFadeMagenta", "printFadeYellow", "spliceFlash", "cueMarks"], icon: Film },
  { id: "compression", label: "Compression", paramKeys: ["gopLength", "deblockingStrength", "ringingStrength", "packetLossBurst", "upscaleSharpenHalos"], icon: Cpu },
  { id: "sensorLens", label: "Sensor & Lens", paramKeys: ["rollingShutterSkew", "fixedPatternNoise", "hotPixels", "lensSmear", "haze", "flareGhosts", "vignette", "cornerSharpnessFalloff"], icon: Camera },
  { id: "displayV2", label: "Display / Panel", paramKeys: ["phosphorPersistence", "beamSpotSizeX", "beamSpotSizeY", "pixelResponseTime"], icon: Monitor },
  { id: "metaAging", label: "Media Aging", paramKeys: ["mediaAgeYears", "copyGenerationCount", "restorationPassLevel"], icon: Clock },
];

// Each effect-stack stage maps to the sidebar panel that holds its controls, so
// clicking a stage jumps straight to the sliders that drive it.
const STAGE_TO_PANEL: Record<string, string> = {
  grading: "grading", colorSignal: "grading",
  masks: "masks",
  crt: "display", displayV2: "display",
  signal: "digital", digital: "digital", compression: "digital", temporal: "digital",
  tape: "tape", tapeMech: "tape", temporalV2: "tape",
  film: "film", filmV2: "film",
  osd: "osd",
  sensorLens: "sensorLens",
  metaAging: "metaAging",
};

interface EffectStackProps {
  mutedStages: Set<string>;
  soloStage: string | null;
  onToggleMute: (stageId: string) => void;
  onToggleSolo: (stageId: string) => void;
  currentParams?: Record<string, number | string>;
  onJump?: (panelId: string) => void;
}

const EffectStack = ({ mutedStages, soloStage, onToggleMute, onToggleSolo, currentParams, onJump }: EffectStackProps) => {
  const [collapsed, setCollapsed] = useState(() => {
    try { const v = localStorage.getItem("lme-effect-stack-collapsed"); return v === null ? true : v === "1"; }
    catch { return true; } // collapsed by default (Ben-11 #8); user choice persists
  });
  const toggleCollapsed = () => setCollapsed((c) => {
    try { localStorage.setItem("lme-effect-stack-collapsed", c ? "0" : "1"); } catch { /* ignore */ }
    return !c;
  });

  const getActiveCount = (stage: EffectStage): number => {
    if (!currentParams) return 0;
    return stage.paramKeys.filter(key => {
      const val = currentParams[key];
      return typeof val === "number" && Math.abs(val) > 0.001;
    }).length;
  };

  const totalActive = EFFECT_STAGES.reduce((sum, s) => sum + getActiveCount(s), 0);
  const mutedCount = mutedStages.size;

  return (
    <div className="bg-card rounded-lg border border-border panel-glow overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
        onClick={toggleCollapsed}
      >
        <span className="text-[13px] font-semibold text-foreground uppercase tracking-wider flex-1">Effect Stack</span>
        {totalActive > 0 && (
          <span className="text-[11px] font-mono text-primary/70 tabular-nums">{totalActive} active</span>
        )}
        {mutedCount > 0 && (
          <span className="text-[11px] font-mono text-destructive/70 tabular-nums">{mutedCount} muted</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && (
        <div className="px-2 pb-2 space-y-0.5 border-t border-border/50 max-h-72 overflow-y-auto">
          {EFFECT_STAGES.map((stage) => {
            const isMuted = mutedStages.has(stage.id);
            const isSolo = soloStage === stage.id;
            const isActive = soloStage ? isSolo : !isMuted;
            const activeCount = getActiveCount(stage);
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[12px] transition-colors ${
                  isActive
                    ? "bg-secondary/60 text-foreground"
                    : "bg-secondary/20 text-muted-foreground opacity-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onJump?.(STAGE_TO_PANEL[stage.id] || stage.id)}
                  title={`Jump to ${stage.label} controls`}
                  className="flex items-center gap-1.5 flex-1 min-w-0 text-left hover:text-primary transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1 truncate font-medium">{stage.label}</span>
                </button>
                {activeCount > 0 && isActive && (
                  <span className="text-[11px] font-mono text-primary/70 tabular-nums">{activeCount}</span>
                )}
                <button
                  onClick={() => onToggleSolo(stage.id)}
                  title={isSolo ? "Unsolo" : "Solo this stage"}
                  className={`p-0.5 rounded transition-colors ${
                    isSolo
                      ? "bg-warning/20 text-warning"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <Headphones className="w-3 h-3" />
                </button>
                <button
                  onClick={() => onToggleMute(stage.id)}
                  title={isMuted ? "Unmute" : "Mute this stage"}
                  className={`p-0.5 rounded transition-colors ${
                    isMuted
                      ? "bg-destructive/20 text-destructive"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  {isMuted ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default EffectStack;
