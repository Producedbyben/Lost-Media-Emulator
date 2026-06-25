import { HelpCircle, Zap } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getProTip } from "@/lib/effect-info";

interface EffectHelpProps {
  /** Beginner explainer shown on hover/focus. Renders nothing when empty. */
  text?: string;
  /** Human name of the control this explains, used as the tooltip title and aria-label. */
  label?: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

/**
 * Small inline "?" help icon that reveals a richer tutorial card on hover OR
 * keyboard focus. The card is built for two audiences at once:
 *   - a plain-language "what it does" summary for beginners, and
 *   - a "Pro" tip (typical ranges, pairings, pipeline order) for power users,
 * resolved automatically from the summary text via getProTip so call sites only
 * ever pass the beginner string.
 *
 * Accessibility:
 *  - The trigger is a real <button> in the tab order (Tab to reach, focus reveals
 *    the tooltip, Esc dismisses it — all handled by Radix).
 *  - A descriptive aria-label ("Help: <label>") names the control it belongs to.
 *  - Radix wires `aria-describedby` from the trigger to the tooltip content so
 *    screen readers announce the explainer on focus.
 */
const EffectHelp = ({ text, label, side = "left", className = "" }: EffectHelpProps) => {
  if (!text) return null;
  const pro = getProTip(text);
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label ? `Help: ${label}` : "What does this do?"}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className={`shrink-0 rounded-full text-muted-foreground/50 hover:text-primary focus-visible:text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background transition-colors ${className}`}
        >
          <HelpCircle className="w-3 h-3" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        role="tooltip"
        className="w-[280px] max-w-[280px] p-0 overflow-hidden shadow-lg"
      >
        <div className="p-3 space-y-2">
          {label && (
            <p className="text-[12px] font-semibold tracking-wide text-foreground">{label}</p>
          )}
          <p className="text-xs leading-relaxed font-normal text-muted-foreground">{text}</p>
          {pro && (
            <div className="flex items-start gap-2 pt-2 border-t border-border/60">
              <span className="mt-px flex shrink-0 items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                <Zap className="w-2.5 h-2.5" aria-hidden="true" /> Pro
              </span>
              <p className="text-[12px] leading-relaxed font-normal text-foreground/80">{pro}</p>
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default EffectHelp;
