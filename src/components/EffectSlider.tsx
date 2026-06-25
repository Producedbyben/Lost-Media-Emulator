import { useCallback, useRef, useState, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import EffectHelp from "./EffectHelp";

interface EffectSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  onChange: (value: number) => void;
  onDoubleClick?: () => void;
  /** Optional tutorial explainer shown via a hover "?" icon next to the label. */
  description?: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Snap a raw value to the slider's step grid so wheel/keyboard nudges stay aligned. */
function snap(value: number, min: number, max: number, step: number) {
  if (step <= 0) return clamp(value, min, max);
  const snapped = Math.round((value - min) / step) * step + min;
  // Avoid floating point drift like 0.30000000004
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return clamp(Number(snapped.toFixed(decimals + 2)), min, max);
}

const EffectSlider = ({ label, value, min, max, step, defaultValue, onChange, onDoubleClick, description }: EffectSliderProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  }, [onChange]);

  const handleReset = useCallback(() => {
    if (onDoubleClick) {
      onDoubleClick();
      return;
    }
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  }, [onDoubleClick, defaultValue, onChange]);

  // QoL: scroll wheel over a slider nudges its value (hold Shift for 10x coarse steps).
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const mult = e.shiftKey ? 10 : 1;
    const dir = e.deltaY < 0 ? 1 : -1;
    onChange(snap(value + dir * step * mult, min, max, step));
  }, [value, step, min, max, onChange]);

  // QoL: Shift+Arrow makes a coarse (10x) step; native arrows already do single steps.
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!e.shiftKey) return;
    let dir = 0;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") dir = 1;
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") dir = -1;
    if (dir === 0) return;
    e.preventDefault();
    onChange(snap(value + dir * step * 10, min, max, step));
  }, [value, step, min, max, onChange]);

  // QoL: click the numeric readout to type an exact value.
  const startEditing = useCallback(() => {
    const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
    setDraft(value.toFixed(decimals));
    setEditing(true);
  }, [value, step]);

  const commitEdit = useCallback(() => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) {
      onChange(snap(parsed, min, max, step));
    }
    setEditing(false);
  }, [draft, min, max, step, onChange]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const percentage = ((value - min) / (max - min)) * 100;
  const isDefault = defaultValue !== undefined && Math.abs(value - defaultValue) < (step * 0.5);

  return (
    <div className={`flex flex-col gap-1 rounded-md px-1.5 py-1 ${isDefault ? "" : "bg-primary/5 ring-1 ring-primary/20"}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`flex items-center gap-1 text-xs truncate pr-2 ${isDefault ? "text-muted-foreground" : "text-foreground font-medium"}`}>
          <span className="truncate">{label}</span>
          <EffectHelp text={description} label={label} />
        </span>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <input
              ref={inputRef}
              type="number"
              min={min}
              max={max}
              step={step}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
                else if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
              }}
              className="w-14 text-xs font-mono tabular-nums text-right bg-secondary border border-primary/40 rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <button
              onClick={startEditing}
              title="Click to type an exact value"
              className={`text-xs font-mono tabular-nums min-w-[3rem] text-right rounded px-0.5 hover:bg-secondary transition-colors ${isDefault ? "text-muted-foreground" : "text-primary"}`}
            >
              {step >= 1 ? value.toFixed(0) : step >= 0.1 ? value.toFixed(1) : value.toFixed(2)}
            </button>
          )}
          {!isDefault && defaultValue !== undefined && (
            <button
              onClick={handleReset}
              title="Reset to default"
              className="p-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <div
          className="absolute top-1/2 left-0 h-1 rounded-full bg-primary/40 pointer-events-none -translate-y-1/2"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onDoubleClick={handleReset}
          onWheel={handleWheel}
          onKeyDown={handleKeyDown}
          title="Scroll to adjust · Shift+scroll for coarse · double-click to reset"
          className="w-full relative z-10"
        />
      </div>
    </div>
  );
};

export default EffectSlider;
