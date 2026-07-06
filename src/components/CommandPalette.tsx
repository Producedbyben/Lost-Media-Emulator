import { useState, useEffect, useCallback, useMemo } from "react";
import { mod, shiftKey, combo } from "@/lib/platform";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Sparkles, FolderOpen, Image, Undo2, Redo2, RotateCcw, SlidersHorizontal } from "lucide-react";
// @ts-ignore
import { PRESETS } from "@/lib/presets.js";
import { DEFAULT_PARAMS } from "@/hooks/useCRTRenderer";

interface CommandPaletteProps {
  onSelectPreset: (name: string, values: Record<string, number>) => void;
  onJump: (panelId: string) => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onImport: () => void;
  onExportStill: () => void;
  onParamChange?: (key: string, value: number) => void;
  currentParams?: Record<string, number | string>;
}

const PANELS = [
  { id: "presets", label: "Jump to Presets" },
  { id: "grading", label: "Jump to Color & Grade" },
  { id: "masks", label: "Jump to Masks & Geometry" },
  { id: "display", label: "Jump to Display & CRT" },
  { id: "tape", label: "Jump to Tape & Dropouts" },
  { id: "film", label: "Jump to Film" },
  { id: "digital", label: "Jump to Digital & Compression" },
  { id: "osd", label: "Jump to Overlays & OSD" },
  { id: "preview", label: "Jump to Preview" },
];

// Human-readable param labels
const PARAM_LABELS: Record<string, string> = {
  scanlineStrength: "Scanline Strength",
  phosphorMask: "Phosphor Mask",
  barrelDistortion: "Barrel Distortion",
  bloom: "Bloom",
  flicker: "Flicker",
  chromaticAberration: "Chromatic Aberration",
  noise: "Noise",
  pixelSize: "Pixel Size",
  maskScale: "Mask Scale",
  imageBrightness: "Brightness",
  imageContrast: "Contrast",
  advancedSaturation: "Saturation",
  imageGamma: "Gamma",
  imageTemperature: "Temperature",
  imageTint: "Tint",
  advancedLineJitter: "Line Jitter",
  advancedTimebaseWobble: "Timebase Wobble",
  advancedHeadSwitching: "Head Switching",
  advancedChromaDelay: "Chroma Delay",
  advancedCrossColor: "Cross-Color",
  advancedDropouts: "Dropouts",
  advancedGhosting: "Ghosting",
  advancedInterlacing: "Interlacing",
  advancedFrameStutter: "Frame Stutter",
  advancedRfInterference: "RF Interference",
  advancedExposurePump: "Exposure Pump",
  advancedWhiteBalanceDrift: "White Balance Drift",
  advancedFocusBreathing: "Focus Breathing",
  advancedTapeCrease: "Tape Crease",
  advancedCctvMonochrome: "CCTV Monochrome",
  advancedQuantization: "Quantization",
  advancedGenerationLoss: "Generation Loss",
  advancedMacroBlocking: "Macroblocking",
  advancedFilmGrain: "Film Grain",
  advancedFilmDust: "Film Dust",
  advancedFilmScratches: "Film Scratches",
  advancedFilmGateWeave: "Film Gate Weave",
  advancedFilmHalation: "Film Halation",
  advancedNeonPhosphorBleed: "Neon Phosphor Bleed",
};

const CommandPalette = ({ onSelectPreset, onJump, onReset, onUndo, onRedo, onImport, onExportStill, onParamChange, currentParams }: CommandPaletteProps) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const presetNames = Object.keys(PRESETS);

  const paramEntries = useMemo(() =>
    Object.entries(PARAM_LABELS).map(([key, label]) => ({
      key,
      label,
      value: currentParams ? (typeof currentParams[key] === "number" ? currentParams[key] as number : undefined) : undefined,
      defaultValue: typeof (DEFAULT_PARAMS as any)[key] === "number" ? (DEFAULT_PARAMS as any)[key] : undefined,
    })),
  [currentParams]);

  const handleSelect = useCallback((action: string) => {
    setOpen(false);
    if (action.startsWith("preset:")) {
      const name = action.slice(7);
      onSelectPreset(name, PRESETS[name]);
    } else if (action.startsWith("jump:")) {
      onJump(action.slice(5));
    } else if (action.startsWith("reset-param:") && onParamChange) {
      const key = action.slice(12);
      const def = (DEFAULT_PARAMS as any)[key];
      if (typeof def === "number") onParamChange(key, def);
    } else if (action === "reset") onReset();
    else if (action === "undo") onUndo();
    else if (action === "redo") onRedo();
    else if (action === "import") onImport();
    else if (action === "export-still") onExportStill();
  }, [onSelectPreset, onJump, onReset, onUndo, onRedo, onImport, onExportStill, onParamChange]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search presets, panels, parameters…" className="text-sm" />
      <CommandList className="max-h-80">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => handleSelect("import")}>
            <FolderOpen className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs">Import source file…</span>
            <span className="ml-auto text-[12px] text-muted-foreground font-mono">{combo(mod, "I")}</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("export-still")}>
            <Image className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs">Export still</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("undo")}>
            <Undo2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs">Undo</span>
            <span className="ml-auto text-[12px] text-muted-foreground font-mono">{combo(mod, "Z")}</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("redo")}>
            <Redo2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs">Redo</span>
            <span className="ml-auto text-[12px] text-muted-foreground font-mono">{combo(mod, shiftKey, "Z")}</span>
          </CommandItem>
          <CommandItem onSelect={() => handleSelect("reset")}>
            <RotateCcw className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs">Reset all parameters</span>
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Parameters">
          {paramEntries.map(({ key, label, value, defaultValue }) => {
            const isModified = value !== undefined && defaultValue !== undefined && Math.abs(value - defaultValue) > 0.001;
            return (
              <CommandItem key={key} onSelect={() => handleSelect(`reset-param:${key}`)}>
                <SlidersHorizontal className={`w-3.5 h-3.5 shrink-0 ${isModified ? "text-primary" : "text-muted-foreground"}`} aria-hidden="true" />
                <span className={`text-xs ${isModified ? "text-primary font-medium" : ""}`}>
                  {label}
                </span>
                {value !== undefined && (
                  <span className={`ml-auto text-[12px] font-mono ${isModified ? "text-primary" : "text-muted-foreground"}`}>
                    {typeof value === "number" ? value.toFixed(2) : value}
                  </span>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Navigate">
          {PANELS.map((p) => (
            <CommandItem key={p.id} onSelect={() => handleSelect(`jump:${p.id}`)}>
              <span className="text-xs">{p.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Presets">
          {presetNames.map((name) => (
            <CommandItem key={name} onSelect={() => handleSelect(`preset:${name}`)}>
              <div className="flex items-center gap-1.5"><Sparkles className="w-3 h-3 text-muted-foreground" /><span className="text-xs">{name}</span></div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
