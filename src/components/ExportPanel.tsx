import { useState, useEffect } from "react";
import { Film, Image as ImageIcon, X, Video, Crop, Share, FileBox, Square, Smartphone, RectangleHorizontal, Tv, Camera, Info, ShieldCheck, ListPlus, FolderOpen, Type, Volume2, VolumeX } from "lucide-react";
import { downloadCubeLUT } from "@/lib/lut-exporter";
import { ensureFilename } from "@/lib/save-file.js";
import type { CRTParams } from "@/hooks/useCRTRenderer";
import ExportQueue from "@/components/ExportQueue";
import type { ExportJob, NewExportJob } from "@/hooks/useExportQueue";
// @ts-ignore
import { exportGif } from "@/lib/gif-exporter.js";

interface ValidationReport {
  ok?: boolean;
  error?: string;
  width?: number;
  height?: number;
  previewMode?: string;
  determinism?: { identical: boolean; maxDiff: number; meanDiff: number };
  parity?: { ok: boolean; maxDiff: number; meanDiff: number; changedRatio: number; tolerance: number };
}

interface ExportPanelProps {
  hasImage: boolean;
  isVideo?: boolean;
  // True only when the loaded source actually carries an audio track (desktop).
  sourceHasAudio?: boolean;
  onExportMp4: (fps: number, duration: number, options?: { resolution?: number; quality?: number; aspectRatio?: string; includeAudio?: boolean; degradeAudio?: boolean; format?: "mp4" | "webm"; fileName?: string; audioMode?: "off" | "original" }) => void;
  onExportStill: (options?: { aspectRatio?: string; fileName?: string }) => void;
  onExportGif?: (fps: number, duration: number, fileName?: string) => void;
  onCancelExport?: () => void;
  isExporting: boolean;
  exportProgress: number;
  currentParams?: CRTParams;
  onValidateExport?: () => Promise<ValidationReport | null>;
  validation?: ValidationReport | null;
  // Video metadata for auto-populating defaults
  videoFPS?: number;
  videoDuration?: number;
  videoWidth?: number;
  videoHeight?: number;
  // Export queue
  lookName?: string;
  onEnqueueExport?: (job: NewExportJob) => void;
  queueJobs?: ExportJob[];
  queueEtaMs?: number;
  queueActiveCount?: number;
  onCancelJob?: (id: string) => void;
  onCancelAll?: () => void;
  onClearFinished?: () => void;
}

const RESOLUTION_OPTIONS = [
  { label: "Source", value: 0 },
  { label: "2160p", value: 2160 },
  { label: "1440p", value: 1440 },
  { label: "1080p", value: 1080 },
  { label: "720p", value: 720 },
  { label: "480p", value: 480 },
];

const RENDER_QUALITY_OPTIONS = [
  { label: "Match preview", value: -1 },
  { label: "Fast", value: 307200 },
  { label: "Balanced", value: 921600 },
  { label: "High", value: 2073600 },
  { label: "Unlimited", value: 0 },
];

const ASPECT_RATIO_OPTIONS = [
  { label: "Original", value: "original", icon: <Square className="w-3.5 h-3.5" /> },
  { label: "16:9", value: "16:9", icon: <RectangleHorizontal className="w-3.5 h-3.5" />, desc: "YouTube / Landscape" },
  { label: "9:16", value: "9:16", icon: <Smartphone className="w-3.5 h-3.5" />, desc: "TikTok / Reels / Stories" },
  { label: "1:1", value: "1:1", icon: <Square className="w-3.5 h-3.5" />, desc: "Instagram / Square" },
  { label: "4:5", value: "4:5", icon: <Camera className="w-3.5 h-3.5" />, desc: "Instagram Portrait" },
  { label: "4:3", value: "4:3", icon: <Tv className="w-3.5 h-3.5" />, desc: "Classic TV" },
];

const FRAME_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Letterbox", value: "letterbox" },
  { label: "Pillarbox", value: "pillarbox" },
  { label: "Crop to fill", value: "crop" },
];

const LUT_SIZE_OPTIONS = [
  { label: "17³", value: 17 },
  { label: "33³", value: 33 },
  { label: "65³", value: 65 },
];

type ExportFormat = "mp4" | "webm" | "gif";

const ExportPanel = ({
  hasImage, isVideo, sourceHasAudio, onExportMp4, onExportStill, onExportGif,
  onCancelExport, isExporting, exportProgress, currentParams,
  onValidateExport, validation,
  videoFPS, videoDuration, videoWidth, videoHeight,
  lookName, onEnqueueExport, queueJobs, queueEtaMs, queueActiveCount,
  onCancelJob, onCancelAll, onClearFinished,
}: ExportPanelProps) => {
  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(4);
  const [resolution, setResolution] = useState(0);
  const [quality, setQuality] = useState(1);
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [renderQuality, setRenderQuality] = useState(0);
  // Keep the source's original audio. On by default for video; the engine mutes
  // it for image sources and when the source has no audio track.
  const [audioOn, setAudioOn] = useState(true);
  const [aspectRatio, setAspectRatio] = useState("original");
  const [frameMode, setFrameMode] = useState("none");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [lutSize, setLutSize] = useState(33);
  const [hasAutoPopulated, setHasAutoPopulated] = useState(false);
  const [validating, setValidating] = useState(false);
  const [fileName, setFileName] = useState("");

  // Whether we're in the native desktop shell (native Save panel) vs the web
  // build (browser Save dialog / download).
  const isDesktop =
    typeof window !== "undefined" &&
    (window as unknown as { desktop?: { isDesktop?: boolean } }).desktop?.isDesktop === true;

  // Default name derived from the active look; the user can override it. Stays a
  // placeholder so an empty field transparently falls back to the look name.
  const defaultBase = (lookName || "Lost Media Export")
    .replace(/[/\\:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-");
  const effectiveBase = fileName.trim() || defaultBase;
  const stillExt = "png";
  const videoExt = format; // mp4 | webm | gif

  // Honest audio state. On desktop we know from the probe whether the source has
  // a track; on web we can't, so we assume it might and let the encoder decide.
  const audioUnavailableReason = !isVideo
    ? "Audio applies to video sources"
    : isDesktop && !sourceHasAudio
      ? "This source has no audio track"
      : null;
  const audioControllable = isVideo && !audioUnavailableReason;
  const effectiveAudioOn = audioControllable && audioOn;
  const audioMode: "off" | "original" = effectiveAudioOn ? "original" : "off";

  const runValidation = async () => {
    if (!onValidateExport) return;
    setValidating(true);
    try { await onValidateExport(); }
    finally { setValidating(false); }
  };

  const handleAddToQueue = () => {
    if (!onEnqueueExport || !currentParams) return;
    const fmt = format;
    const jobFps = fmt === "gif" ? Math.min(15, fps) : fps;
    const ar = aspectRatio !== "original" ? aspectRatio : undefined;
    const name = `${lookName || "Custom look"} · ${fmt.toUpperCase()}${ar ? ` ${ar}` : ""} · ${duration}s`;
    onEnqueueExport({
      name,
      fileName: ensureFilename(effectiveBase, fmt, "lme-export"),
      format: fmt,
      fps: jobFps,
      duration,
      params: { ...currentParams },
      options: {
        resolution,
        quality,
        aspectRatio: ar,
        includeAudio: effectiveAudioOn ? true : undefined,
      },
    });
  };



  // Auto-populate export settings from video metadata when a video is loaded
  useEffect(() => {
    if (isVideo && videoFPS && videoFPS > 0 && videoDuration && videoDuration > 0) {
      // Round FPS to nearest standard value
      const standardFPS = [12, 15, 23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 120];
      const nearestFPS = standardFPS.reduce((prev, curr) =>
        Math.abs(curr - videoFPS) < Math.abs(prev - videoFPS) ? curr : prev
      );
      setFps(Math.round(nearestFPS));
      setDuration(Math.round(videoDuration * 100) / 100);
      setHasAutoPopulated(true);
    }
  }, [isVideo, videoFPS, videoDuration]);

  // Reset auto-populate flag when switching away from video
  useEffect(() => {
    if (!isVideo) {
      setHasAutoPopulated(false);
    }
  }, [isVideo]);

  const totalFrames = Math.floor(fps * duration);

  const formatTimecode = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * fps);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
  };

  const estimatedFileSizeMB = () => {
    const bitsPerSecond = quality * 8_000_000;
    return ((bitsPerSecond * duration) / 8 / 1_000_000).toFixed(1);
  };

  return (
    <div className="space-y-3">
      <div>
        <strong className="text-xs font-semibold text-foreground uppercase tracking-wide">Delivery</strong>
        <p className="text-[12px] text-muted-foreground">Name it, set the render, then export.</p>
      </div>

      {/* Output name — the file is saved with this name; the destination is
          chosen in the save dialog that opens on export. */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Type className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">File name</span>
        </div>
        <div className="flex items-stretch rounded-md border border-border bg-secondary focus-within:ring-1 focus-within:ring-primary/50 overflow-hidden">
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder={defaultBase}
            spellCheck={false}
            aria-label="Export file name"
            className="flex-1 min-w-0 bg-transparent px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
          />
          <span className="flex items-center px-2 text-[12px] font-mono text-muted-foreground border-l border-border select-none">.{videoExt}</span>
        </div>
        <p className="text-[11px] text-muted-foreground flex items-start gap-1">
          <FolderOpen className="w-3 h-3 mt-px shrink-0" />
          {isDesktop
            ? "Pick the folder in the save dialog — the file reveals in Finder when it's done."
            : "Choose where to save in your browser's save dialog (otherwise it goes to Downloads)."}
        </p>
      </div>

      {/* Source info badge */}
      {isVideo && videoWidth && videoHeight && (
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-secondary/60 rounded-md border border-border">
          <Info className="w-3 h-3 text-primary shrink-0" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-mono text-muted-foreground">
            <span className="text-foreground font-semibold">Source</span>
            <span>{videoWidth}×{videoHeight}</span>
            <span>{videoFPS?.toFixed(2)} fps</span>
            <span>{formatTimecode(videoDuration || 0)}</span>
            <span>{totalFrames.toLocaleString()} frames</span>
          </div>
        </div>
      )}

      {hasAutoPopulated && (
        <p className="text-[11px] text-primary/80 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
          Export settings matched to source video
        </p>
      )}

      {/* Social aspect ratio */}
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Crop className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Aspect ratio</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {ASPECT_RATIO_OPTIONS.map(({ label, value, icon }) => (
            <button key={value} onClick={() => setAspectRatio(value)}
              className={`flex items-center gap-1 px-2 py-0.5 text-[12px] rounded border transition-colors ${
                aspectRatio === value
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}>
              <span>{icon}</span> <span>{label}</span>
            </button>
          ))}
        </div>
        {aspectRatio !== "original" && (
          <div className="flex flex-wrap gap-1 mt-1">
            {FRAME_OPTIONS.map(({ label, value }) => (
              <button key={value} onClick={() => setFrameMode(value)}
                className={`px-2 py-0.5 text-[12px] rounded border transition-colors ${
                  frameMode === value
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}>
                {label}
              </button>
            ))}
          </div>
        )}
        {aspectRatio !== "original" && (
          <p className="text-[11px] text-muted-foreground">
            {ASPECT_RATIO_OPTIONS.find(a => a.value === aspectRatio)?.desc}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">FPS</span>
          <input type="number" value={fps} min={12} max={120}
            onChange={(e) => setFps(Number(e.target.value))}
            className="px-2.5 py-1.5 text-xs font-mono bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Duration (s)</span>
          <input type="number" value={duration} min={0.5} max={300} step={0.5}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="px-2.5 py-1.5 text-xs font-mono bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </label>
      </div>

      {/* Format */}
      <div className="space-y-1">
        <span className="text-xs text-muted-foreground">Format</span>
        <div className="flex gap-1">
          {(["mp4", "webm", "gif"] as ExportFormat[]).map((f) => (
            <button key={f} onClick={() => setFormat(f)}
              className={`px-2.5 py-0.5 text-[12px] rounded border transition-colors uppercase font-semibold ${
                format === f
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}>
              {f}
            </button>
          ))}
        </div>
        {format === "gif" && (
          <p className="text-[11px] text-muted-foreground">Max 480px wide · lower FPS recommended for file size</p>
        )}
      </div>

      {/* Audio — keep the source's original track. On desktop ffmpeg muxes it
          straight from the source file; honest about when it can't. */}
      {isVideo && (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Volume2 className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Audio</span>
          </div>
          {audioControllable ? (
            <>
              <div className="flex gap-1">
                {([["original", "Original", Volume2], ["off", "Muted", VolumeX]] as const).map(([val, label, Icon]) => {
                  const active = (val === "original") === audioOn;
                  return (
                    <button key={val} onClick={() => setAudioOn(val === "original")}
                      className={`flex items-center gap-1 px-2 py-0.5 text-[12px] rounded border transition-colors ${
                        active
                          ? "bg-primary/15 border-primary/30 text-primary"
                          : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                      }`}>
                      <Icon className="w-3 h-3" /> {label}
                    </button>
                  );
                })}
              </div>
              {audioOn && !isDesktop && (
                <p className="text-[11px] text-muted-foreground">Muxed where the browser supports it — the desktop app guarantees it.</p>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <VolumeX className="w-3 h-3 shrink-0" /> {audioUnavailableReason}
            </p>
          )}
        </div>
      )}

      {/* Advanced toggle */}
      <button onClick={() => setShowAdvanced(!showAdvanced)}
        className="text-[12px] text-muted-foreground hover:text-foreground transition-colors underline">
        {showAdvanced ? "Hide advanced" : "Show advanced options"}
      </button>

      {showAdvanced && (
        <div className="space-y-2 pl-2 border-l-2 border-border">
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Resolution</span>
            <div className="flex flex-wrap gap-1">
              {RESOLUTION_OPTIONS.map(({ label, value }) => (
                <button key={value} onClick={() => setResolution(value)}
                  className={`px-2 py-0.5 text-[12px] rounded border transition-colors ${
                    resolution === value
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Quality multiplier</span>
            <input type="number" value={quality} min={0.5} max={2.5} step={0.1}
              onChange={(e) => setQuality(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-mono bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </label>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Render mode</span>
            <div className="flex flex-wrap gap-1">
              {RENDER_QUALITY_OPTIONS.map(({ label, value }) => (
                <button key={value} onClick={() => setRenderQuality(value)}
                  className={`px-2 py-0.5 text-[12px] rounded border transition-colors ${
                    renderQuality === value
                      ? "bg-primary/15 border-primary/30 text-primary"
                      : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Export summary */}
      <div className="px-2.5 py-1.5 bg-secondary/40 rounded-md border border-border space-y-0.5">
        <p className="text-[12px] text-foreground font-mono font-medium">
          {totalFrames.toLocaleString()} frames · {duration}s @ {fps}fps · {format.toUpperCase()}
          {resolution > 0 ? ` · ${resolution}p` : " · Source res"}
          {aspectRatio !== "original" ? ` · ${aspectRatio}` : ""}
        </p>
        <p className="text-[11px] text-muted-foreground font-mono">
          TC: {formatTimecode(0)} → {formatTimecode(duration)}
          {format !== "gif" && ` · ~${estimatedFileSizeMB()} MB est.`}
        </p>
      </div>

      {isExporting && (
        <div className="space-y-1">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200"
              style={{ width: `${exportProgress * 100}%` }} />
          </div>
          <div className="flex justify-between text-[12px] text-muted-foreground font-mono">
            <span>Frame {Math.round(exportProgress * totalFrames)}/{totalFrames}</span>
            <span>{Math.round(exportProgress * 100)}%</span>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {format === "gif" ? (
          <div className="relative flex-1 group">
            <button
              onClick={() => onExportGif?.(fps, duration, ensureFilename(effectiveBase, "gif", "lme-export"))}
              disabled={!hasImage || isExporting}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors accent-glow">
              <Film className="w-3.5 h-3.5" /> Export GIF
            </button>
            {!hasImage && (
              <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-popover text-popover-foreground text-[12px] px-2 py-1 rounded border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Load an image first
              </span>
            )}
          </div>
        ) : (
          <div className="relative flex-1 group">
            <button
              onClick={() => onExportMp4(fps, duration, { resolution, quality, aspectRatio: aspectRatio !== "original" ? aspectRatio : undefined, includeAudio: effectiveAudioOn ? true : undefined, format, audioMode, fileName: ensureFilename(effectiveBase, videoExt, "lme-export") })}
              disabled={!hasImage || isExporting}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors accent-glow">
              {format === "mp4" ? <Film className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              Export {format.toUpperCase()}
            </button>
            {!hasImage && (
              <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-popover text-popover-foreground text-[12px] px-2 py-1 rounded border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Load an image first
              </span>
            )}
          </div>
        )}
        {isExporting && onCancelExport && (
          <button onClick={onCancelExport}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        )}
        <div className="relative group">
          <button onClick={() => onExportStill({ aspectRatio: aspectRatio !== "original" ? aspectRatio : undefined, fileName: ensureFilename(effectiveBase, stillExt, "lme-export") })} disabled={!hasImage || isExporting}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-border">
            <ImageIcon className="w-3.5 h-3.5" /> Still
          </button>
          {!hasImage && (
            <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-popover text-popover-foreground text-[12px] px-2 py-1 rounded border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Load an image first
            </span>
          )}
        </div>
      </div>

      {/* Add to queue — for managing long / multiple unattended renders */}
      {onEnqueueExport && (
        <button
          onClick={handleAddToQueue}
          disabled={!hasImage}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-dashed border-border">
          <ListPlus className="w-3.5 h-3.5" /> Add to export queue
        </button>
      )}

      {/* Export queue */}
      {queueJobs && onCancelJob && onCancelAll && onClearFinished && (
        <ExportQueue
          jobs={queueJobs}
          etaMs={queueEtaMs || 0}
          activeCount={queueActiveCount || 0}
          onCancelJob={onCancelJob}
          onCancelAll={onCancelAll}
          onClearFinished={onClearFinished}
        />
      )}



      {/* Export validator */}
      {onValidateExport && (
        <div className="border-t border-border pt-3 mt-3 space-y-2">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Export validator</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Checks that the export renders deterministically on the CPU and matches the live preview.
          </p>
          <button
            onClick={runValidation}
            disabled={!hasImage || validating || isExporting}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-border">
            <ShieldCheck className="w-3.5 h-3.5" /> {validating ? "Validating…" : "Validate export ↔ preview"}
          </button>
          {validation && (
            <div className={`px-2.5 py-1.5 rounded-md border text-[12px] font-mono space-y-0.5 ${
              validation.error
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : validation.ok
                  ? "bg-green-500/10 border-green-500/30 text-green-500"
                  : "bg-yellow-500/10 border-yellow-500/30 text-yellow-600"
            }`}>
              {validation.error ? (
                <p>Error: {validation.error}</p>
              ) : (
                <>
                  <p className="font-semibold">
                    {validation.ok ? "✓ Export verified" : "⚠ Differences detected"}
                  </p>
                  <p>
                    Deterministic: {validation.determinism?.identical ? "yes (byte-identical)" : `no (Δmax ${validation.determinism?.maxDiff})`}
                  </p>
                  <p>
                    Preview parity: {validation.parity?.ok ? "match" : "mismatch"} · Δmean {validation.parity?.meanDiff} (tol {validation.parity?.tolerance})
                  </p>
                  <p className="opacity-70">
                    Preview ran on {validation.previewMode?.toUpperCase()} · {validation.width}×{validation.height}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      )}



      {/* LUT Export */}
      <div className="border-t border-border pt-3 mt-3 space-y-2">
        <div className="flex items-center gap-1">
          <FileBox className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">LUT Export (.cube)</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {LUT_SIZE_OPTIONS.map(({ label, value }) => (
            <button key={value} onClick={() => setLutSize(value)}
              className={`px-2 py-0.5 text-[12px] rounded border transition-colors ${
                lutSize === value
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}>
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => currentParams && downloadCubeLUT(currentParams, { size: lutSize, title: "LME Color Grade" })}
          disabled={!currentParams}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-border">
          <FileBox className="w-3.5 h-3.5" /> Export .cube LUT
        </button>
        <p className="text-[11px] text-muted-foreground">
          Export color grading as industry-standard 3D LUT for use in DaVinci, Premiere, etc.
        </p>
      </div>
    </div>
  );
};

export default ExportPanel;
