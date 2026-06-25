import { useState, useEffect, useRef, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import EffectHelp from "./EffectHelp";

interface CollapsiblePanelProps {
  title: string;
  badge?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  enabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  /** Optional tutorial explainer shown via a hover "?" icon next to the title. */
  description?: string;
  /** If set, this panel listens for `panel-focus:<panelId>` events and auto-opens */
  panelId?: string;
}

const CollapsiblePanel = ({
  title,
  badge,
  children,
  defaultOpen = true,
  enabled,
  onToggleEnabled,
  description,
  panelId,
}: CollapsiblePanelProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!panelId) return;
    const handler = () => setIsOpen(true);
    window.addEventListener(`panel-focus:${panelId}`, handler);
    return () => window.removeEventListener(`panel-focus:${panelId}`, handler);
  }, [panelId]);

  // Listen for global collapse/expand events
  useEffect(() => {
    const collapseAll = () => setIsOpen(false);
    const expandAll = () => setIsOpen(true);
    window.addEventListener("panels:collapse-all", collapseAll);
    window.addEventListener("panels:expand-all", expandAll);
    return () => {
      window.removeEventListener("panels:collapse-all", collapseAll);
      window.removeEventListener("panels:expand-all", expandAll);
    };
  }, []);

  // Measure content height for animation
  useEffect(() => {
    if (!contentRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentHeight(entry.contentRect.height);
      }
    });
    ro.observe(contentRef.current);
    return () => ro.disconnect();
  }, []);

  const isDisabled = enabled === false;

  return (
    <div className={`bg-card rounded-lg border transition-all duration-200 ${
      isDisabled ? "border-border/50 opacity-75" : "border-border hover:border-border/80"
    } panel-glow overflow-hidden animate-fade-in`}>
      <div className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors group">
        {badge && (
          <span className="flex items-center justify-center w-5 h-5 rounded bg-primary/20 text-primary text-[12px] font-mono font-semibold shrink-0">
            {badge}
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          className="flex items-center min-w-0 text-left rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={`text-[13px] font-semibold truncate ${isDisabled ? "text-muted-foreground" : "text-foreground"}`}>{title}</span>
        </button>
        <EffectHelp text={description} label={title} side="right" />
        <span className="flex-1" />
        {onToggleEnabled !== undefined && (
          <div
            role="switch"
            aria-checked={enabled}
            aria-label={`Toggle ${title}`}
            tabIndex={0}
            onClick={() => onToggleEnabled(!enabled)}
            onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onToggleEnabled(!enabled); } }}
            className={`relative w-7 h-4 rounded-full transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              enabled ? "bg-primary" : "bg-surface-3"
            }`}
          >
            <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-3" : "translate-x-0"
            }`} />
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? `Collapse ${title}` : `Expand ${title}`}
          className="shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "" : "-rotate-90"
            }`}
          />
        </button>
      </div>
      <div
        className="overflow-hidden transition-[max-height] duration-200 ease-in-out"
        style={{ maxHeight: isOpen ? (contentHeight !== undefined ? contentHeight + 24 : 2000) : 0 }}
      >
        <div
          ref={contentRef}
          className={`px-3 pb-3 space-y-2 border-t border-border/50 transition-opacity duration-150 ${
            isDisabled ? "opacity-40 pointer-events-none select-none" : ""
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsiblePanel;
