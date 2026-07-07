import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, Upload, Layers, Sliders, Download, Sparkles, Play } from "lucide-react";

const TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Welcome to Lost Media Emulator",
    description: "Transform your images and videos with authentic retro effects — CRT monitors, VHS tapes, film grain, and more. Let's take a quick tour!",
    icon: Sparkles,
    highlight: null,
    position: "center",
  },
  {
    id: "import",
    title: "1. Import Your Media",
    description: "Drag and drop an image or video onto the preview area, or click 'Import source' to get started. We support JPG, PNG, MP4, WebM, and H.264 MOV files (convert ProRes to H.264 first).",
    icon: Upload,
    highlight: "preview",
    position: "right",
  },
  {
    id: "presets",
    title: "2. Choose a Preset",
    description: "Browse all 91 authentic looks in the left sidebar. From consumer TVs to VHS tapes, each look captures a unique era and aesthetic.",
    icon: Layers,
    highlight: "presets",
    position: "left",
  },
  {
    id: "effects",
    title: "3. Fine-Tune Effects",
    description: "Customize every detail in the right sidebar. Toggle individual effect panels on/off, adjust sliders, and use the Effect Stack to solo or mute specific stages.",
    icon: Sliders,
    highlight: "effects",
    position: "right",
  },
  {
    id: "timeline",
    title: "4. Animate Over Time",
    description: "Use the timeline at the bottom to create animated effects. Add keyframes to make parameters change over time for dynamic video exports.",
    icon: Play,
    highlight: "timeline",
    position: "bottom",
  },
  {
    id: "export",
    title: "5. Export Your Creation",
    description: "Click 'Export' in the header to render your final output. Choose from MP4, WebM, GIF, or still image formats with customizable resolution and quality.",
    icon: Download,
    highlight: "export",
    position: "top",
  },
];

const STORAGE_KEY = "lme-tutorial-completed";

interface TutorialOverlayProps {
  forceShow?: boolean;
  onComplete?: () => void;
}

const TutorialOverlay = ({ forceShow = false, onComplete }: TutorialOverlayProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed || forceShow) {
      setIsVisible(true);
    }
    setHasLoaded(true);
  }, [forceShow]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    // Signal the Effects tour it may chain — but only THIS session, so a cold launch
    // after skipping this tour never ambushes with a second modal (audit).
    try { sessionStorage.setItem("lme-general-tour-session", "1"); } catch { /* ignore */ }
    setIsVisible(false);
    onComplete?.();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  const handleNext = useCallback(() => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, handleComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isVisible) return;
    if (e.key === "Escape") handleSkip();
    if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
    if (e.key === "ArrowLeft") handlePrev();
  }, [isVisible, handleSkip, handleNext, handlePrev]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!hasLoaded || !isVisible) return null;

  const step = TUTORIAL_STEPS[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleSkip}
      />
      
      {/* Spotlight highlights */}
      {step.highlight && (
        <div className="absolute inset-0 pointer-events-none">
          {step.highlight === "preview" && (
            <div className="absolute top-[120px] left-[22%] right-[22%] bottom-[180px] border-2 border-primary/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] animate-pulse" />
          )}
          {step.highlight === "presets" && (
            <div className="absolute top-[120px] left-0 w-[22%] bottom-0 border-2 border-primary/50 rounded-r-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] animate-pulse" />
          )}
          {step.highlight === "effects" && (
            <div className="absolute top-[120px] right-0 w-[22%] bottom-0 border-2 border-primary/50 rounded-l-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] animate-pulse" />
          )}
          {step.highlight === "timeline" && (
            <div className="absolute bottom-0 left-[22%] right-[22%] h-[120px] border-2 border-primary/50 rounded-t-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] animate-pulse" />
          )}
          {step.highlight === "export" && (
            <div className="absolute top-0 left-0 right-0 h-[60px] border-2 border-primary/50 rounded-b-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] animate-pulse" />
          )}
        </div>
      )}

      {/* Tutorial card */}
      <div className={`relative bg-card border border-border rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden ${
        step.position === "center" ? "" :
        step.position === "left" ? "ml-auto mr-8" :
        step.position === "right" ? "mr-auto ml-8" :
        step.position === "top" ? "mb-auto mt-24" :
        "mt-auto mb-24"
      }`}>
        {/* Progress bar */}
        <div className="h-1 bg-secondary">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Skip tutorial (Esc)"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{step.title}</h2>
              <p className="text-xs text-muted-foreground">Step {currentStep + 1} of {TUTORIAL_STEPS.length}</p>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            {step.description}
          </p>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {TUTORIAL_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStep 
                    ? "bg-primary w-6" 
                    : idx < currentStep 
                      ? "bg-primary/50" 
                      : "bg-secondary"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground bg-secondary rounded-md transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={handleSkip}
              className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              {isLastStep ? "Get Started" : "Next"} 
              {!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Keyboard hints */}
        <div className="px-6 py-2 bg-secondary/50 border-t border-border flex items-center justify-center gap-4 text-[12px] text-muted-foreground">
          <span><kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">←</kbd> <kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">→</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">Enter</kbd> Continue</span>
          <span><kbd className="px-1.5 py-0.5 bg-background rounded border border-border font-mono">Esc</kbd> Skip</span>
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;

// Hook to manually trigger tutorial
export function useTutorial() {
  const [showTutorial, setShowTutorial] = useState(false);
  
  const startTutorial = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setShowTutorial(true);
  }, []);

  const TutorialComponent = useCallback(() => (
    showTutorial ? <TutorialOverlay forceShow onComplete={() => setShowTutorial(false)} /> : null
  ), [showTutorial]);

  return { startTutorial, TutorialComponent };
}
