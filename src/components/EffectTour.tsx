import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Sparkles, Eye, Palette, MonitorPlay, Clapperboard, Film, Binary } from "lucide-react";
import { EFFECT_INFO, PANEL_INFO, getProTip } from "@/lib/effect-info";

/**
 * Curated "most important effects" walkthrough. Each step is intentionally tied to
 * a real control: the body text is the SAME explainer that the inline "?" hover
 * help shows (pulled from EFFECT_INFO / PANEL_INFO), so the tour and the
 * self-documenting tooltips never drift apart. "Show me" jumps to the live panel
 * (via the shared panel-focus flow) so the user can immediately try it and read
 * the matching hover help in context.
 */
interface TourStep {
  id: string;
  title: string;
  /** Panel key understood by Index's handleJump (matches PANEL_IDS). */
  panelKey: string;
  /** Optional param key — when set, the step reuses that control's hover-help text. */
  paramKey?: keyof typeof EFFECT_INFO;
  /** Fallback panel-level help text key. */
  panelInfoKey?: keyof typeof PANEL_INFO;
  /** Extra context shown above the shared hover-help text. */
  intro: string;
  icon: typeof Sparkles;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "intro",
    title: "Tour the key effects",
    panelKey: "presets",
    intro:
      "A quick tour of the effects that shape most looks. Each step shows the same explainer you'll see on the control's hover-help (?) icon, and you can jump straight to it.",
    icon: Sparkles,
  },
  {
    id: "saturation",
    title: "Colour & Grade — Saturation",
    panelKey: "grading",
    paramKey: "advancedSaturation",
    intro: "Start with exposure and colour. Saturation is the fastest way to swing between bold and washed-out.",
    icon: Palette,
  },
  {
    id: "scanlines",
    title: "Display & CRT — Scanlines",
    panelKey: "display",
    paramKey: "scanlineStrength",
    intro: "Pick the screen the footage lives on. Scanlines give you the unmistakable CRT raster.",
    icon: MonitorPlay,
  },
  {
    id: "dropouts",
    title: "Tape & Dropouts",
    panelKey: "tape",
    paramKey: "advancedDropouts",
    intro: "Add magnetic-tape wear. Dropouts are the signature VHS signal glitch.",
    icon: Clapperboard,
  },
  {
    id: "grain",
    title: "Film — Grain",
    panelKey: "film",
    paramKey: "advancedFilmGrain",
    intro: "Reach for film when you want a photochemical texture instead of a video one.",
    icon: Film,
  },
  {
    id: "compression",
    title: "Digital & Compression",
    panelKey: "digital",
    paramKey: "advancedMacroBlocking",
    intro: "Finish with codec-era decay. Macro-blocking sells the look of a low-bitrate digital file.",
    icon: Binary,
  },
];

const STORAGE_KEY = "lme-effects-tour-completed";
const GENERAL_TUTORIAL_KEY = "lme-tutorial-completed";

interface EffectTourProps {
  forceShow?: boolean;
  /** Jump to / open a panel so the user can try the effect and read its hover help. */
  onShowStep?: (panelKey: string) => void;
  onComplete?: () => void;
}

const EffectTour = ({ forceShow = false, onShowStep, onComplete }: EffectTourProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY);
    const generalDone = localStorage.getItem(GENERAL_TUTORIAL_KEY);
    // Auto-open only when the general welcome tour was finished IN THIS SESSION — so the
    // two chain on a genuine first run, but a cold launch after skipping never ambushes
    // with a second full-screen modal (audit). Explicit forceShow always opens.
    let chainedThisSession = false;
    try { chainedThisSession = sessionStorage.getItem("lme-general-tour-session") === "1"; } catch { /* ignore */ }
    if (forceShow || (!done && generalDone && chainedThisSession)) {
      setIsVisible(true);
    }
    setHasLoaded(true);
  }, [forceShow]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsVisible(false);
    onComplete?.();
  }, [onComplete]);

  const step = TOUR_STEPS[currentStep];

  const handleShow = useCallback(() => {
    if (step && onShowStep) onShowStep(step.panelKey);
  }, [step, onShowStep]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) setCurrentStep((s) => s + 1);
    else handleComplete();
  }, [currentStep, handleComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible) return;
      if (e.key === "Escape") handleComplete();
      else if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      else if (e.key === "ArrowLeft") handlePrev();
    },
    [isVisible, handleComplete, handleNext, handlePrev],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!hasLoaded || !isVisible || !step) return null;

  const Icon = step.icon;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const isFirstStep = currentStep === 0;
  const helpText = step.paramKey
    ? EFFECT_INFO[step.paramKey]
    : step.panelInfoKey
      ? PANEL_INFO[step.panelInfoKey]
      : undefined;
  const proText = getProTip(helpText);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="effect-tour-title"
      aria-describedby="effect-tour-desc"
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleComplete} />

      <div className="relative bg-card border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        <button
          onClick={handleComplete}
          aria-label="Close effects tour"
          className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <div className="p-6 pt-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 id="effect-tour-title" className="text-lg font-semibold text-foreground">{step.title}</h2>
              <p className="text-xs text-muted-foreground">Step {currentStep + 1} of {TOUR_STEPS.length}</p>
            </div>
          </div>

          <p id="effect-tour-desc" className="text-sm text-muted-foreground leading-relaxed mb-3">
            {step.intro}
          </p>

          {helpText && (
            <div className="mb-5 rounded-lg border border-border bg-secondary/40 p-3 space-y-2.5">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-primary/70 mb-1">
                  What it does
                </p>
                <p className="text-sm text-foreground/90 leading-relaxed">{helpText}</p>
              </div>
              {proText && (
                <div className="pt-2.5 border-t border-border/60">
                  <p className="flex items-center gap-1 text-[12px] font-semibold uppercase tracking-wider text-primary/70 mb-1">
                    <Eye className="w-3 h-3" aria-hidden="true" /> Pro tip
                  </p>
                  <p className="text-sm text-foreground/80 leading-relaxed">{proText}</p>
                </div>
              )}
            </div>
          )}

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-1.5 mb-5">
            {TOUR_STEPS.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setCurrentStep(idx)}
                aria-label={`Go to step ${idx + 1}: ${s.title}`}
                aria-current={idx === currentStep ? "step" : undefined}
                className={`h-2 rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  idx === currentStep ? "bg-primary w-6" : idx < currentStep ? "bg-primary/50 w-2" : "bg-secondary w-2"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
              </button>
            )}
            {!isFirstStep && (
              <button
                onClick={handleShow}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              >
                <Eye className="w-4 h-4" aria-hidden="true" /> Show me
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={handleComplete}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            >
              {isLastStep ? "Done" : "Next"}
              {!isLastStep && <ChevronRight className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div className="px-6 py-2 bg-secondary/50 border-t border-border flex items-center justify-center gap-4 text-[12px] text-muted-foreground">
          <span><kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">←</kbd> <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">→</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">Enter</kbd> Next</span>
          <span><kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
};

export default EffectTour;

/** Hook to manually (re)launch the effects tour, mirroring useTutorial. */
export function useEffectTour() {
  const [showTour, setShowTour] = useState(false);

  const startEffectTour = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setShowTour(true);
  }, []);

  return { showTour, setShowTour, startEffectTour };
}
