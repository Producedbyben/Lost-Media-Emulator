import { useMemo, useState } from "react";
import { Monitor, Eye, Pause, Play, SlidersHorizontal, Cpu, Zap, Database, Loader2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface PreviewSettings {
  sourceScale: number;
  maxPixels: number;
  fpsLimit: number;
  animationEnabled: boolean;
  previewScale: number;
  compareMode: "off" | "hold" | "lock";
  compareSplit: boolean;
  compareSplitRatio: number;
  gpuAcceleration: boolean;
  adaptiveQuality: boolean;
}

export const DEFAULT_PREVIEW_SETTINGS: PreviewSettings = {
  sourceScale: 1,
  maxPixels: 2073600,
  fpsLimit: 30,
  animationEnabled: false,
  previewScale: 1,
  compareMode: "off",
  compareSplit: false,
  compareSplitRatio: 0.5,
  // Default GPU (Metal) acceleration ON in the native desktop build, where it's
  // verified against the Apple Silicon Metal backend. Web stays opt-in.
  gpuAcceleration:
    typeof window !== "undefined" &&
    (window as unknown as { desktop?: { isDesktop?: boolean } }).desktop?.isDesktop === true,
  adaptiveQuality: true,
};

// True when running inside the native (Electron) desktop shell.
export const IS_DESKTOP =
  typeof window !== "undefined" &&
  (window as unknown as { desktop?: { isDesktop?: boolean } }).desktop?.isDesktop === true;


type RendererMode = "gpu" | "cpu" | "gpu-ready" | "hybrid";

interface RamPreviewState {
  status: "idle" | "building" | "ready";
  progress: number;
  frames: number;
}

interface PreviewControlsProps {
  settings: PreviewSettings;
  onChange: (settings: PreviewSettings) => void;
  isVideo: boolean;
  gpuAvailable?: boolean;
  rendererMode?: RendererMode;
  ramPreview?: RamPreviewState;
  onBuildRamPreview?: () => void;
  onClearRamPreview?: () => void;
}


const SOURCE_SCALES = [
  { label: "100%", value: 1 },
  { label: "75%", value: 0.75 },
  { label: "50%", value: 0.5 },
  { label: "33%", value: 0.33 },
];

const QUALITY_OPTIONS = [
  { label: "Fast", value: 307200 },
  { label: "Balanced", value: 921600 },
  { label: "High", value: 2073600 },
  { label: "Unlimited", value: 0 },
];

const FPS_OPTIONS = [15, 30, 60];

const ZOOM_OPTIONS = [
  { label: "50%", value: 0.5 },
  { label: "Fit", value: 1 },
  { label: "133%", value: 1.33 },
  { label: "2×", value: 2 },
  { label: "3×", value: 3 },
  { label: "4×", value: 4 },
];

const PreviewControls = ({
  settings, onChange, isVideo, gpuAvailable = false,
  rendererMode = "cpu", ramPreview, onBuildRamPreview, onClearRamPreview,
}: PreviewControlsProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const update = (patch: Partial<PreviewSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const qualityLabel = useMemo(
    () => QUALITY_OPTIONS.find((o) => o.value === settings.maxPixels)?.label ?? "Custom",
    [settings.maxPixels]
  );

  const modeInfo = useMemo(() => {
    switch (rendererMode) {
      case "gpu": return { label: "GPU", title: "Rendering on the GPU (WebGL2)", cls: "text-green-400 border-green-400/30 bg-green-400/10" };
      case "hybrid": return { label: "Hybrid", title: "GPU preferred — this look falls back to CPU for fidelity", cls: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" };
      case "gpu-ready": return { label: "CPU", title: "GPU available but disabled — rendering on CPU", cls: "text-muted-foreground border-border bg-secondary" };
      default: return { label: "CPU", title: "Rendering on the CPU pipeline", cls: "text-muted-foreground border-border bg-secondary" };
    }
  }, [rendererMode]);

  const ramStatus = ramPreview?.status ?? "idle";

  return (
    <div className="flex items-center gap-1.5 flex-wrap text-[12px]">
      <div
        title={modeInfo.title}
        className={`flex items-center gap-1 px-2 py-1 rounded border ${modeInfo.cls}`}
      >
        {rendererMode === "gpu" || rendererMode === "hybrid" ? <Zap className="w-3 h-3" /> : <Cpu className="w-3 h-3" />}
        <span className="font-medium">{modeInfo.label}</span>
      </div>


      <button
        onClick={() => update({ animationEnabled: !settings.animationEnabled })}
        className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
          settings.animationEnabled
            ? "bg-primary/15 text-primary border-primary/30"
            : "bg-secondary text-muted-foreground border-border"
        }`}
      >
        {settings.animationEnabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
        <span className="font-medium">{settings.animationEnabled ? "Live" : "Still"}</span>
      </button>

      <button
        onPointerDown={() => update({ compareMode: "hold" })}
        onPointerUp={() => { if (settings.compareMode === "hold") update({ compareMode: "off" }); }}
        onPointerLeave={() => { if (settings.compareMode === "hold") update({ compareMode: "off" }); }}
        className={`flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
          settings.compareMode !== "off"
            ? "bg-primary/15 text-primary border-primary/30"
            : "bg-secondary text-muted-foreground border-border"
        }`}
      >
        <Eye className="w-3 h-3" />
        <span className="font-medium">Compare</span>
      </button>

      <button
        onClick={() => update({ compareMode: settings.compareMode === "lock" ? "off" : "lock" })}
        className={`px-2 py-1 rounded border transition-colors ${
          settings.compareMode === "lock"
            ? "bg-primary/15 text-primary border-primary/30"
            : "bg-secondary text-muted-foreground border-border"
        }`}
      >
        {settings.compareMode === "lock" ? "Unlock" : "Lock"}
      </button>

      <div className="flex items-center gap-1 px-2 py-1 rounded border border-border bg-secondary text-muted-foreground">
        <Monitor className="w-3 h-3" />
        <span className="font-mono">{Math.round(settings.previewScale * 100)}%</span>
      </div>

      {isVideo && (onBuildRamPreview || onClearRamPreview) && (
        ramStatus === "building" ? (
          <div
            title="Caching frames to RAM for jank-free playback"
            className="flex items-center gap-1 px-2 py-1 rounded border border-primary/30 bg-primary/10 text-primary"
          >
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="font-mono">{Math.round((ramPreview?.progress ?? 0) * 100)}%</span>
          </div>
        ) : ramStatus === "ready" ? (
          <button
            onClick={() => onClearRamPreview?.()}
            title={`RAM preview cached (${ramPreview?.frames ?? 0} frames) — click to clear`}
            className="flex items-center gap-1 px-2 py-1 rounded border border-green-400/30 bg-green-400/10 text-green-400 transition-colors"
          >
            <Database className="w-3 h-3" />
            <span className="font-medium">RAM</span>
            <X className="w-2.5 h-2.5" />
          </button>
        ) : (
          <button
            onClick={() => onBuildRamPreview?.()}
            title="Precache all frames to RAM (After Effects style) for smooth real-time playback"
            className="flex items-center gap-1 px-2 py-1 rounded border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Database className="w-3 h-3" />
            <span className="font-medium">RAM Preview</span>
          </button>
        )
      )}



      <Popover open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1 px-2 py-1 rounded border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            <SlidersHorizontal className="w-3 h-3" />
            Advanced
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-3">
          <div className="space-y-3 text-[12px]">
            <div className="space-y-1">
              <p className="text-muted-foreground font-medium">Zoom</p>
              <div className="flex flex-wrap gap-1">
                {ZOOM_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => update({ previewScale: value })}
                    className={`px-1.5 py-0.5 rounded font-mono transition-colors ${
                      Math.abs(settings.previewScale - value) < 0.01
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground font-medium">Source scale</p>
              <div className="flex flex-wrap gap-1">
                {SOURCE_SCALES.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => update({ sourceScale: value })}
                    className={`px-1.5 py-0.5 rounded font-mono transition-colors ${
                      settings.sourceScale === value
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground font-medium">Preview quality ({qualityLabel})</p>
              <div className="flex flex-wrap gap-1">
                {QUALITY_OPTIONS.map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => update({ maxPixels: value })}
                    className={`px-1.5 py-0.5 rounded font-mono transition-colors ${
                      settings.maxPixels === value
                        ? "bg-primary/15 text-primary"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {(settings.animationEnabled || isVideo) && (
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">FPS</p>
                <div className="flex gap-1">
                  {FPS_OPTIONS.map((fps) => (
                    <button
                      key={fps}
                      onClick={() => update({ fpsLimit: fps })}
                      className={`px-1.5 py-0.5 rounded font-mono transition-colors ${
                        settings.fpsLimit === fps
                          ? "bg-primary/15 text-primary"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {fps}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <label className="flex items-center gap-1 text-muted-foreground">
              <input
                type="checkbox"
                checked={settings.compareSplit}
                onChange={(e) => update({ compareSplit: e.target.checked })}
                className="w-3 h-3 rounded accent-primary"
              />
              Split compare handle
            </label>

            <label className="flex items-center gap-1 text-muted-foreground">
              <input
                type="checkbox"
                checked={settings.adaptiveQuality}
                onChange={(e) => update({ adaptiveQuality: e.target.checked })}
                className="w-3 h-3 rounded accent-primary"
              />
              Adaptive quality (auto resolution + sharpness)
            </label>

            <label className={`flex items-center gap-1 ${gpuAvailable ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
              <input
                type="checkbox"
                checked={settings.gpuAcceleration}
                disabled={!gpuAvailable}
                onChange={(e) => update({ gpuAcceleration: e.target.checked })}
                className="w-3 h-3 rounded accent-primary"
              />
              GPU acceleration {gpuAvailable ? (IS_DESKTOP ? "(Metal)" : "(experimental)") : "(unavailable)"}
            </label>

          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default PreviewControls;
