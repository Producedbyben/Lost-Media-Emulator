import { useState, useMemo, useCallback, useRef } from "react";
import { Search, Save, Trash2, Upload, Download, Link, Share2, Dice3, Grid3X3, List, Star, Clock, Tv, Film, Video, Eye, Radio, Monitor, Layers, Sparkles, Zap, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
// @ts-ignore
import { PRESETS } from "@/lib/presets.js";
import EffectSlider from "@/components/EffectSlider";
import PresetThumbnail from "@/components/PresetThumbnail";
import {
  loadCustomPresets, saveCustomPreset, deleteCustomPreset,
  exportPresetsJSON, importPresetsJSON, generateShareURL,
  exportLookJSON, parseLookJSON,
  CustomPreset,
} from "@/lib/preset-storage";
import { CRTParams } from "@/hooks/useCRTRenderer";
import SignalChainBuilder, { SignalChainBuilderProps } from "@/components/SignalChainBuilder";

interface PresetSelectorProps {
  activePreset: string;
  onSelectPreset: (name: string, values: Record<string, number>) => void;
  presetIntensity: number;
  onIntensityChange: (value: number) => void;
  isDirty: boolean;
  currentParams?: CRTParams;
  onRandomize?: () => void;
  favorites?: string[];
  recentlyUsed?: string[];
  onToggleFavorite?: (name: string) => void;
  isFavorite?: (name: string) => boolean;
  // Two-axis signal chain
  chain?: SignalChainBuilderProps;
}

const CATEGORIES: Record<string, string[]> = {
  "CRT / Monitor": [
    "True Zero (Neutral)", "Consumer TV", "PVM/BVM", "Arcade",
    "CRT PC Monitor (1995)", "PAL Living Room TV (1970s)",
    "Sony Trinitron WEGA (2001)", "Shadow Mask CRT Terminal (Amber)",
    "Retro Pixel LCD", "Rear-Projection CRT TV (2004)",
  ],
  "VHS / Tape": [
    "Late-80s Home VHS", "90s Rental Tape (3rd Gen Dub)",
    "U-matic Field Tape 1970s", "Betacam SP ENG 1980s",
    "LaserDisc Transfer 1990s", "Cable Access Recorder (1984)",
    "VHS-C Camcorder (1993)", "S-VHS Master Tape (1996)",
    "Betamax Home Recording (1981)", "Video8 Handycam (1988)",
    "D-VHS HD Recording (2003)", "2-inch Quadruplex Broadcast (1960s)",
  ],
  "Camcorder": [
    "Hi8 Vacation Cam", "MiniDV Family Cam (2002)", "HDV Camcorder 2005",
    "DSLR Video 2010", "Bootleg Concert Cam", "GoPro Hero3 Action Cam",
    "MiniDV LP Mode (Dropout-Prone)", "Pocket Digicam MJPEG (2004)",
  ],
  "Broadcast": [
    "Off-Air Analog Broadcast", "Public Access Archive",
    "Live NTSC Kinescope 1950s", "16mm Broadcast Kinescope",
    "ATSC Broadcast Transition (2009)", "Analog Cable Scrambled Signal",
    "TV Tuner Card Capture (2007)",
  ],
  "Digital": [
    "Early Web Rip (2006)", "Streaming Compression", "DVD Rip 2001",
    "Video CD Capture (1999)", "Early Smartphone 2012",
    "4K HDR Streaming 2020s", "Early Webcam (2008)",
    "RealPlayer 240p Stream (1999)", "Blu-ray Disc Transfer (2008)",
    "XviD AVI Fansub (2003)", "Zoom Call Recording (2020)",
  ],
  "Social / Mobile": [
    "Vine Reupload Compilation (2014)", "Vertical Livestream Story (2024)",
    "LED Billboard Phone Capture",
  ],
  "Surveillance": [
    "Security Camera Dump", "Digital Surveillance",
    "Night Vision Camcorder", "Police Bodycam 2016",
    "Covert Spycam Button Lens", "Ring Doorbell Daytime",
    "Ring Doorbell Night IR", "Disposable Security IR Flood",
  ],
  "Film": [
    "Silent Film 1920s", "Technicolor Print 1950s",
    "Super 8 Home Reel 1970s", "Nitrate Newsreel 1930s",
    "Polaroid SX-70 Instant", "Disposable Camera 35mm Flash",
    "Aerochrome Infrared Film",
  ],
  "Display": [
    "IPS Office LCD (2013)", "OLED Smartphone PenTile (2018)",
    "Pioneer Plasma TV (2007)", "Cyberpunk OLED",
  ],
  "Stylized": [
    "Neon Sign Bloom (TikTok Style)", "Damaged Archive Recovery",
  ],
  "V2: Advanced": [
    "PAL UHF Antenna (1978)", "VHS Mold Damage (30yr Attic)", "Betamax Humid Garage (1983)",
    "35mm Faded Cinema Print", "8mm Kodachrome Home Movie", "YouTube 2007 Re-encode",
    "MPEG-2 Satellite Glitch", "iPhone 3G Vertical Video", "Instagram Live 2024",
    "CRT Plasma Burn-In", "PenTile OLED Sunlight", "Trinitron Warm Glow",
    "Drone Footage Jello", "Restored Archive Master", "4th Gen VHS Bootleg",
    "TikTok Screen Record Repost",
  ],
};

const PresetSelector = ({
  activePreset, onSelectPreset, presetIntensity, onIntensityChange, isDirty, currentParams, onRandomize,
  favorites = [], recentlyUsed = [], onToggleFavorite, isFavorite, chain,
}: PresetSelectorProps) => {
  const [mode, setMode] = useState<"chain" | "library">(chain ? "chain" : "library");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(loadCustomPresets);
  const [saveName, setSaveName] = useState("");
  const [showSave, setShowSave] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const importRef = useRef<HTMLInputElement>(null);
  const lookImportRef = useRef<HTMLInputElement>(null);

  const presetNames = useMemo(() => Object.keys(PRESETS), []);

  const categorizedNames = useMemo(() => {
    const all = new Set<string>();
    Object.values(CATEGORIES).forEach(names => names.forEach(n => all.add(n)));
    return all;
  }, []);

  const filteredPresets = useMemo(() => {
    let names: string[];

    if (activeCategory === "Custom") {
      names = customPresets.map(p => p.name);
    } else if (activeCategory === "Favorites") {
      names = favorites.filter(n => n in PRESETS);
    } else if (activeCategory === "Recent") {
      names = recentlyUsed.filter(n => n in PRESETS);
    } else {
      names = presetNames;
      if (activeCategory !== "All" && activeCategory !== "Uncategorized") {
        const catNames = CATEGORIES[activeCategory] || [];
        names = names.filter((n) => catNames.includes(n));
      } else if (activeCategory === "Uncategorized") {
        names = names.filter((n) => !categorizedNames.has(n));
      }
    }

    if (search) {
      const q = search.toLowerCase();
      names = names.filter((n) => n.toLowerCase().includes(q));
    }
    return names;
  }, [presetNames, activeCategory, search, categorizedNames, customPresets, favorites, recentlyUsed]);

  const uncategorizedCount = useMemo(() => presetNames.filter(n => !categorizedNames.has(n)).length, [presetNames, categorizedNames]);

  const handleSaveCustom = useCallback(() => {
    if (!saveName.trim() || !currentParams) return;
    const preset: CustomPreset = {
      name: saveName.trim(),
      params: { ...currentParams } as Record<string, number | string>,
      createdAt: Date.now(),
    };
    const updated = saveCustomPreset(preset);
    setCustomPresets(updated);
    setSaveName("");
    setShowSave(false);
    toast.success(`Preset "${saveName.trim()}" saved`);
  }, [saveName, currentParams]);

  const handleDeleteCustom = useCallback((name: string) => {
    const updated = deleteCustomPreset(name);
    setCustomPresets(updated);
    toast.info(`Preset "${name}" deleted`);
  }, []);

  const handleExportJSON = useCallback(() => {
    const json = exportPresetsJSON(customPresets);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lme-presets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [customPresets]);

  const handleImportJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = importPresetsJSON(reader.result as string);
      imported.forEach(p => saveCustomPreset(p));
      setCustomPresets(loadCustomPresets());
    };
    reader.readAsText(file);
  }, []);

  // Export the CURRENT settings (the full live look) as a single portable JSON file.
  const handleExportLook = useCallback(() => {
    if (!currentParams) return;
    const json = exportLookJSON(currentParams as Record<string, number | string>, activePreset || "Custom Look");
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lme-look-${(activePreset || "custom").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Look exported as JSON");
  }, [currentParams, activePreset]);

  // Import a look JSON and APPLY it to the current settings.
  const handleImportLook = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const look = parseLookJSON(reader.result as string);
      if (!look) { toast.error("That JSON isn't a valid look file"); return; }
      onSelectPreset(look.name, look.params as Record<string, number>);
      toast.success(`Look "${look.name}" imported`);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [onSelectPreset]);

  const handleShareURL = useCallback(() => {
    if (!currentParams) return;
    const url = generateShareURL(currentParams);
    setShareUrl(url);
    navigator.clipboard.writeText(url).catch(() => {});
    toast.success("Share link copied to clipboard");
  }, [currentParams]);

  const renderPresetTile = (name: string, values: Record<string, number>) => {
    const selected = activePreset === name;
    const fav = isFavorite?.(name) ?? false;

    const getPresetIcon = (): LucideIcon => {
      if (name.includes("VHS") || name.includes("Tape") || name.includes("Betacam") || name.includes("U-matic")) return Film;
      if (name.includes("TV") || name.includes("CRT") || name.includes("Monitor") || name.includes("Trinitron") || name.includes("Shadow Mask") || name.includes("Plasma") || name.includes("LCD") || name.includes("OLED")) return Tv;
      if (name.includes("Film") || name.includes("Nitrate") || name.includes("Kinescope") || name.includes("Polaroid") || name.includes("Disposable") || name.includes("Aerochrome") || name.includes("Technicolor")) return Film;
      if (name.includes("Camera") || name.includes("Cam") || name.includes("DSLR") || name.includes("GoPro") || name.includes("Smartphone") || name.includes("Webcam") || name.includes("Spycam") || name.includes("Bodycam")) return Video;
      if (name.includes("Surveillance") || name.includes("Security") || name.includes("Ring Doorbell") || name.includes("CCTV") || name.includes("Night Vision") || name.includes("Covert")) return Eye;
      if (name.includes("Broadcast") || name.includes("Access") || name.includes("ATSC")) return Radio;
      if (name.includes("Web Rip") || name.includes("Streaming") || name.includes("DVD") || name.includes("Video CD") || name.includes("LaserDisc")) return Monitor;
      if (name.includes("Neon") || name.includes("Cyberpunk")) return Sparkles;
      if (name.includes("Damaged") || name.includes("Archive")) return Layers;
      return Zap;
    };

    const Icon = getPresetIcon();

    return (
      // Card is a div with button semantics (not a <button>) so the favorite
      // toggle can nest inside it without invalid <button>-in-<button> markup.
      <div
        key={name}
        role="button"
        tabIndex={0}
        onClick={() => onSelectPreset(name, values)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelectPreset(name, values); } }}
        className={`group text-left rounded-md border p-2 transition-all relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
          selected
            ? "bg-primary/15 text-primary border-primary/30 shadow-sm"
            : "bg-secondary/40 border-border text-secondary-foreground hover:bg-secondary hover:border-border/60"
        }`}
      >
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(name); }}
            className={`absolute top-1 right-1 p-0.5 rounded transition-colors ${
              fav ? "text-warning" : "text-muted-foreground/30 opacity-0 group-hover:opacity-100"
            }`}
            title={fav ? "Remove from favorites" : "Add to favorites"}
          >
            <Star className={`w-3 h-3 ${fav ? "fill-current" : ""}`} />
          </button>
        )}
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className={`w-3.5 h-3.5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
          <PresetThumbnail values={values} width={36} height={24} />
          <span className={`text-[11px] font-mono px-1 py-0.5 rounded truncate ${selected ? "bg-primary/20" : "bg-background/50"}`}>
            {name.split(" ")[0]}
          </span>
        </div>
        <p className="text-[12px] leading-tight line-clamp-2 min-h-[2rem]">{name}</p>
      </div>
    );
  };

  const categoryTabs = ["All", "Favorites", "Recent", ...Object.keys(CATEGORIES), ...(uncategorizedCount > 0 ? ["Uncategorized"] : []), "Custom"];

  return (
    <div className="space-y-2">
      {chain && (
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-secondary/60 rounded-md border border-border">
          <button
            onClick={() => setMode("chain")}
            className={`flex items-center justify-center gap-1 px-2 py-1 text-[12px] font-medium rounded transition-colors ${
              mode === "chain" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="w-3 h-3" /> Build Chain
          </button>
          <button
            onClick={() => setMode("library")}
            className={`flex items-center justify-center gap-1 px-2 py-1 text-[12px] font-medium rounded transition-colors ${
              mode === "library" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3 h-3" /> Classics
          </button>
        </div>
      )}

      {chain && mode === "chain" ? (
        <SignalChainBuilder {...chain} />
      ) : (
      <>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text" placeholder="Search presets..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>


      <div className="flex items-center gap-1">
        <button
          onClick={() => setViewMode("grid")}
          className={`p-1 rounded border transition-colors ${
            viewMode === "grid" ? "bg-primary/15 border-primary/30 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"
          }`}
          title="Grid view" aria-label="Grid view"
        >
          <Grid3X3 className="w-3 h-3" />
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`p-1 rounded border transition-colors ${
            viewMode === "list" ? "bg-primary/15 border-primary/30 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"
          }`}
          title="List view" aria-label="List view"
        >
          <List className="w-3 h-3" />
        </button>
        <div className="flex-1" />
        {isDirty && <span className="text-[11px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium">Modified</span>}
      </div>

      <div className="flex flex-wrap gap-0.5">
        {categoryTabs.map((cat) => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`flex items-center gap-1 px-1.5 py-0.5 text-[11px] rounded border transition-colors ${
              activeCategory === cat
                ? "bg-primary/20 border-primary/40 text-primary font-medium"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-border/60"
            }`}>
            {cat === "Favorites" && <Star className="w-2.5 h-2.5" />}
            {cat === "Recent" && <Clock className="w-2.5 h-2.5" />}
            {cat}{cat === "Custom" && customPresets.length > 0 ? ` (${customPresets.length})` : ""}
            {cat === "Favorites" && favorites.length > 0 ? ` (${favorites.length})` : ""}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-muted-foreground font-medium">Preset library</span>
        <div className="flex-1" />
        {onRandomize && (
          <button onClick={onRandomize} title="Surprise me!" aria-label="Surprise me!"
            className="flex items-center gap-1 px-1.5 py-0.5 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80 transition-colors">
            <Dice3 className="w-3 h-3" /> Surprise
          </button>
        )}
        <button onClick={() => setShowSave(!showSave)} title="Save current look" aria-label="Save current look"
          className="flex items-center gap-1 px-1.5 py-0.5 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80 transition-colors">
          <Save className="w-3 h-3" />
        </button>
        <button onClick={handleShareURL} title="Copy share link" aria-label="Copy share link"
          className="flex items-center gap-1 px-1.5 py-0.5 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80 transition-colors">
          <Share2 className="w-3 h-3" />
        </button>
        <button onClick={handleExportLook} title="Export current look as JSON" aria-label="Export current look as JSON"
          className="flex items-center gap-1 px-1.5 py-0.5 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80 transition-colors">
          <Download className="w-3 h-3" />
        </button>
        <button onClick={() => lookImportRef.current?.click()} title="Import a look from JSON" aria-label="Import a look from JSON"
          className="flex items-center gap-1 px-1.5 py-0.5 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80 transition-colors">
          <Upload className="w-3 h-3" />
        </button>
        <input ref={lookImportRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportLook} />
      </div>

      {shareUrl && (
        <div className="flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-md px-2 py-1">
          <Link className="w-3 h-3 text-primary shrink-0" />
          <input readOnly value={shareUrl}
            className="flex-1 text-[12px] font-mono bg-transparent text-primary border-none outline-none"
            onFocus={(e) => e.target.select()} />
          <button onClick={() => setShareUrl("")} aria-label="Dismiss share link" className="text-primary hover:text-primary/80"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {showSave && (
        <div className="flex gap-1">
          <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)}
            placeholder="Preset name…" maxLength={40}
            className="flex-1 px-2 py-1 text-xs bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveCustom(); }} />
          <button onClick={handleSaveCustom} disabled={!saveName.trim()}
            className="px-2 py-1 text-[12px] bg-primary text-primary-foreground rounded-md disabled:opacity-40 hover:bg-primary/90">
            Save
          </button>
        </div>
      )}

      {activeCategory === "Custom" ? (
        <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
          {customPresets.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())).map((p) => (
            <div key={p.name} className="flex items-center gap-1">
              <button
                onClick={() => onSelectPreset(p.name, p.params as Record<string, number>)}
                className={`flex-1 text-left px-2.5 py-1.5 text-xs rounded-md transition-all ${
                  activePreset === p.name
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-secondary-foreground hover:bg-secondary/80 border border-transparent"
                }`}>
                {p.name}
              </button>
              <button onClick={() => handleDeleteCustom(p.name)} className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
          {customPresets.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No custom presets saved yet</p>}
        </div>
      ) : viewMode === "grid" ? (
        <div className="max-h-56 overflow-y-auto pr-1 grid grid-cols-2 gap-1.5">
          {filteredPresets.map((name) => renderPresetTile(name, PRESETS[name] || {}))}
          {filteredPresets.length === 0 && <p className="col-span-2 text-xs text-muted-foreground text-center py-3">No presets found</p>}
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
          {filteredPresets.map((name) => {
            const fav = isFavorite?.(name) ?? false;
            return (
              <div key={name} className="flex items-center gap-0.5">
                <button onClick={() => onSelectPreset(name, PRESETS[name] || {})}
                  className={`flex-1 text-left px-2.5 py-1.5 text-xs rounded-md transition-all ${
                    activePreset === name
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "text-secondary-foreground hover:bg-secondary/80 border border-transparent"
                  }`}>
                  {name}
                </button>
                {onToggleFavorite && (
                  <button onClick={() => onToggleFavorite(name)}
                    className={`p-1 rounded transition-colors ${fav ? "text-warning" : "text-muted-foreground/40 hover:text-warning/60"}`}>
                    <Star className={`w-3 h-3 ${fav ? "fill-current" : ""}`} />
                  </button>
                )}
              </div>
            );
          })}
          {filteredPresets.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No presets found</p>}
        </div>
      )}

      <p className="text-[12px] text-muted-foreground">
        {activeCategory === "Custom"
          ? `${customPresets.length} custom preset${customPresets.length !== 1 ? "s" : ""}`
          : `${filteredPresets.length} of ${presetNames.length} presets`}
      </p>

      {activeCategory === "Custom" && (
        <div className="flex gap-1">
          <button onClick={handleExportJSON} disabled={customPresets.length === 0}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80 disabled:opacity-40">
            <Download className="w-3 h-3" /> Export JSON
          </button>
          <button onClick={() => importRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80">
            <Upload className="w-3 h-3" /> Import JSON
          </button>
          <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
        </div>
      )}

      <EffectSlider label="Preset intensity" value={presetIntensity} min={0} max={2} step={0.01} defaultValue={1} onChange={onIntensityChange} />
      </>
      )}
    </div>
  );
};

export default PresetSelector;
