import { useMemo, useState, memo } from "react";
import { Lock, Unlock, X, ArrowDown, Camera, MonitorPlay, Search } from "lucide-react";
import EffectSlider from "./EffectSlider";
import PresetThumbnail from "./PresetThumbnail";
// @ts-ignore
import {
  CAPTURE_PRESETS, DISPLAY_PRESETS,
  CAPTURE_PRESET_CATEGORIES, DISPLAY_PRESET_CATEGORIES,
} from "@/lib/presets.js";

type Axis = "capture" | "display";

export interface SignalChainBuilderProps {
  captureSlot: string | null;
  displaySlot: string | null;
  captureIntensity: number;
  displayIntensity: number;
  captureLocked: boolean;
  displayLocked: boolean;
  onSelectCapture: (name: string, values: Record<string, number>) => void;
  onSelectDisplay: (name: string, values: Record<string, number>) => void;
  onCaptureIntensity: (v: number) => void;
  onDisplayIntensity: (v: number) => void;
  onToggleCaptureLock: () => void;
  onToggleDisplayLock: () => void;
  onClearCapture: () => void;
  onClearDisplay: () => void;
}

interface SlotConfig {
  axis: Axis;
  title: string;
  subtitle: string;
  icon: typeof Camera;
  presets: Record<string, Record<string, number>>;
  categories: Record<string, string[]>;
  selected: string | null;
  intensity: number;
  locked: boolean;
  emptyLabel: string;
  onSelect: (name: string, values: Record<string, number>) => void;
  onIntensity: (v: number) => void;
  onToggleLock: () => void;
  onClear: () => void;
}

const Slot = ({ config }: { config: SlotConfig }) => {
  const {
    title, subtitle, icon: Icon, presets, categories, selected, intensity,
    locked, emptyLabel, onSelect, onIntensity, onToggleLock, onClear,
  } = config;
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");

  const categoryTabs = useMemo(() => ["All", ...Object.keys(categories)], [categories]);

  const visibleNames = useMemo(() => {
    let names = Object.keys(presets);
    if (activeCategory !== "All") {
      const catNames = categories[activeCategory] || [];
      names = names.filter((n) => catNames.includes(n));
    }
    if (search) {
      const q = search.toLowerCase();
      names = names.filter((n) => n.toLowerCase().includes(q));
    }
    return names;
  }, [presets, categories, activeCategory, search]);

  return (
    <div className={`rounded-lg border bg-card/60 p-2 space-y-2 transition-colors ${
      locked ? "border-primary/40" : "border-border"
    }`}>
      <div className="flex items-center gap-2">
        <Icon className={`w-3.5 h-3.5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-foreground leading-none">{title}</div>
          <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{subtitle}</div>
        </div>
        <button
          onClick={onToggleLock}
          title={locked ? "Locked — kept when switching the other layer or applying a look. Click to unlock." : "Lock this layer"}
          className={`p-1 rounded border transition-colors ${
            locked
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-secondary border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
        </button>
        {selected && (
          <button
            onClick={onClear}
            title="Clear this layer"
            className="p-1 rounded border bg-secondary border-border text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 rounded bg-secondary/60 border border-border px-2 py-1">
        <span className="text-[12px] text-muted-foreground shrink-0">Selected</span>
        <span className={`text-[12px] font-medium truncate ${selected ? "text-primary" : "text-muted-foreground/60 italic"}`}>
          {selected || emptyLabel}
        </span>
      </div>


      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
        <input
          type="text" placeholder={`Search ${title.toLowerCase()}…`}
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-7 pr-2 py-1 text-[12px] bg-secondary border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Category dropdown (Ben-11 #9 — one consistent pattern; replaces the button row) */}
      <select
        value={activeCategory}
        onChange={(e) => setActiveCategory(e.target.value)}
        aria-label={`${title} category`}
        className="w-full px-2 py-1 text-[12px] bg-secondary border border-border rounded text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
      >
        {categoryTabs.map((cat) => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>

      <div className="max-h-40 overflow-y-auto pr-1 grid grid-cols-2 gap-1.5">
        {visibleNames.map((name) => {
          const isSel = selected === name;
          return (
            <button
              key={name}
              onClick={() => onSelect(name, presets[name])}
              className={`group text-left rounded-md border p-1.5 transition-all ${
                isSel
                  ? "bg-primary/15 text-primary border-primary/30 shadow-sm"
                  : "bg-secondary/40 border-border text-secondary-foreground hover:bg-secondary hover:border-border/60"
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <PresetThumbnail values={presets[name]} width={32} height={20} />
              </div>
              <p className="text-[12px] leading-tight line-clamp-2 min-h-[1.8rem]">{name}</p>
            </button>
          );
        })}
        {visibleNames.length === 0 && (
          <p className="col-span-2 text-[12px] text-muted-foreground text-center py-3">No matches</p>
        )}
      </div>

      <EffectSlider
        label="Layer intensity"
        value={intensity}
        min={0}
        max={1}
        step={0.01}
        defaultValue={1}
        onChange={onIntensity}
      />
    </div>
  );
};

/**
 * Two-axis "signal chain" builder. Pick a Capture / Recording format (the source
 * media) and a Display device (the screen it's shown on); they stack into one
 * final look. Each layer has its own intensity and a lock so adjustments survive
 * while browsing the other layer or applying a Classic.
 */
const SignalChainBuilder = (props: SignalChainBuilderProps) => {
  const captureConfig: SlotConfig = {
    axis: "capture",
    title: "Capture / Format",
    subtitle: "Source media — film, tape, codec, sensor",
    icon: Camera,
    presets: CAPTURE_PRESETS,
    categories: CAPTURE_PRESET_CATEGORIES,
    selected: props.captureSlot,
    intensity: props.captureIntensity,
    locked: props.captureLocked,
    emptyLabel: "Direct Digital (clean source)",
    onSelect: props.onSelectCapture,
    onIntensity: props.onCaptureIntensity,
    onToggleLock: props.onToggleCaptureLock,
    onClear: props.onClearCapture,
  };

  const displayConfig: SlotConfig = {
    axis: "display",
    title: "Display / Output",
    subtitle: "Screen it's shown on — CRT, LCD, billboard",
    icon: MonitorPlay,
    presets: DISPLAY_PRESETS,
    categories: DISPLAY_PRESET_CATEGORIES,
    selected: props.displaySlot,
    intensity: props.displayIntensity,
    locked: props.displayLocked,
    emptyLabel: "Direct / No Display (clean panel)",
    onSelect: props.onSelectDisplay,
    onIntensity: props.onDisplayIntensity,
    onToggleLock: props.onToggleDisplayLock,
    onClear: props.onClearDisplay,
  };

  const finalLabel = `${props.captureSlot || "Direct Digital"} → ${props.displaySlot || "Direct / No Display"}`;

  return (
    <div className="space-y-2">
      <Slot config={captureConfig} />
      <div className="flex items-center justify-center -my-0.5">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary border border-border">
          <ArrowDown className="w-3 h-3 text-primary" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">shown on</span>
        </div>
      </div>
      <Slot config={displayConfig} />
      <div className="flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/30 px-2 py-1.5">
        <span className="text-[11px] uppercase tracking-wider text-primary/70 shrink-0">Final</span>
        <span className="text-[12px] font-medium text-primary truncate">{finalLabel}</span>
      </div>
    </div>
  );
};

export default memo(SignalChainBuilder);
