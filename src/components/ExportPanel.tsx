import { useState, useEffect, type ReactNode } from "react";
import { Film, Image as ImageIcon, X, Video, Crop, Share, FileBox, Square, Smartphone, RectangleHorizontal, Tv, Camera, Info, ShieldCheck, ListPlus, FolderOpen, Type, Volume2, VolumeX, Scissors, ChevronDown, Settings2, Monitor, type LucideIcon } from "lucide-react";
import { downloadCubeLUT } from "@/lib/lut-exporter";
import { computeExportSize } from "@/lib/export-size";
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
  onExportMp4: (fps: number, duration: number, options?: { resolution?: number; quality?: number; aspectRatio?: string; frameMode?: string; includeAudio?: boolean; degradeAudio?: boolean; format?: "mp4" | "webm"; fileName?: string; audioMode?: "off" | "original"; codec?: "h264" | "hevc" | "prores422" | "prores4444"; inSec?: number; outSec?: number }) => void;
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
  // Live playhead position (source seconds) for "set in/out from playhead".
  videoCurrentTime?: number;
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

type ExportCodec = "h264" | "hevc" | "prores422" | "prores4444" | "gif";

// Codec tiers shown in the export panel. `desktopOnly` ones need the native
// ffmpeg engine; `container` drives the file extension. ProRes is the editorial
// master; H.264 is the universal deliverable.
const CODEC_TIERS: { value: ExportCodec; label: string; ext: string; desktopOnly: boolean; hint: string }[] = [
  { value: "h264", label: "H.264", ext: "mp4", desktopOnly: false, hint: "Universal delivery" },
  { value: "hevc", label: "HEVC", ext: "mp4", desktopOnly: true, hint: "High quality, smaller" },
  { value: "prores422", label: "ProRes 422", ext: "mov", desktopOnly: true, hint: "Editorial master" },
  { value: "prores4444", label: "ProRes 4444", ext: "mov", desktopOnly: true, hint: "Highest quality" },
  { value: "gif", label: "GIF", ext: "gif", desktopOnly: false, hint: "Quick share" },
];

// One-click delivery presets: set codec, resolution, and aspect in a single tap.
// `desktopOnly` (Master/ProRes) is dimmed on the web build. resolution 0 = source.
const DELIVERY_PRESETS: { value: string; label: string; codec: ExportCodec; resolution: number; aspectRatio: string; desktopOnly: boolean; hint: string }[] = [
  { value: "web", label: "Web", codec: "h264", resolution: 1080, aspectRatio: "original", desktopOnly: false, hint: "H.264 · 1080p" },
  { value: "social", label: "Social", codec: "h264", resolution: 1080, aspectRatio: "9:16", desktopOnly: false, hint: "H.264 · 9:16 1080p" },
  { value: "master", label: "Master", codec: "prores422", resolution: 0, aspectRatio: "original", desktopOnly: true, hint: "ProRes 422 HQ · source res" },
  { value: "gif", label: "GIF", codec: "gif", resolution: 0, aspectRatio: "original", desktopOnly: false, hint: "Quick share" },
];

// Shared chip class — the small toggle buttons used throughout (preset, codec,
// aspect, resolution…). `active` is the selected/highlight state.
const chip = (active: boolean, disabled = false) =>
  `px-2 py-0.5 text-[12px] rounded border transition-colors ${
    active
      ? "bg-primary/15 border-primary/30 text-primary"
      : disabled
        ? "bg-secondary/40 border-border/60 text-muted-foreground/40 cursor-not-allowed"
        : "bg-secondary border-border text-muted-foreground hover:text-foreground"
  }`;

// A collapsible settings group, styled like an NLE export panel section
// (Premiere's disclosure groups): a header bar with a chevron over a body that
// animates open/closed via a grid-rows transition.
const Section = ({ title, icon: Icon, defaultOpen = true, hint, children }: {
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  hint?: ReactNode;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-md border border-border bg-card/30 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 bg-secondary/50 hover:bg-secondary/70 transition-colors text-left">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
          <Icon className="w-3 h-3 text-primary" /> {title}
        </span>
        <span className="flex items-center gap-2">
          {hint && <span className="text-[11px] font-mono text-muted-foreground/70">{hint}</span>}
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`} />
        </span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="p-2.5 space-y-2.5">{children}</div>
        </div>
      </div>
    </section>
  );
};

// One label/value line in the left "Output" summary rail (reads like Premiere's
// output summary block).
const SummaryRow = ({ label, value, accent }: { label: string; value: ReactNode; accent?: boolean }) => (
  <div className="flex items-baseline justify-between gap-2 py-1">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 shrink-0">{label}</span>
    <span className={`text-[12px] font-mono text-right leading-tight ${accent ? "text-primary" : "text-foreground"}`}>{value}</span>
  </div>
);

const ExportPanel = ({
  hasImage, isVideo, sourceHasAudio, onExportMp4, onExportStill, onExportGif,
  onCancelExport, isExporting, exportProgress, currentParams,
  onValidateExport, validation,
  videoFPS, videoDuration, videoWidth, videoHeight, videoCurrentTime,
  lookName, onEnqueueExport, queueJobs, queueEtaMs, queueActiveCount,
  onCancelJob, onCancelAll, onClearFinished,
}: ExportPanelProps) => {
  const [fps, setFps] = useState(30);
  const [duration, setDuration] = useState(4);
  // Trim (in/out) window in source seconds. Video-only; default 0..duration.
  // Only the native ffmpeg export honours these — the web fallback ignores them.
  const [inPoint, setInPoint] = useState(0);
  const [outPoint, setOutPoint] = useState(4);
  const [resolution, setResolution] = useState(0);
  const [quality, setQuality] = useState(1);
  const [codec, setCodec] = useState<ExportCodec>("h264");
  const [renderQuality, setRenderQuality] = useState(0);
  // Keep the source's original audio. On by default for video; the engine mutes
  // it for image sources and when the source has no audio track.
  const [audioOn, setAudioOn] = useState(true);
  const [aspectRatio, setAspectRatio] = useState("original");
  const [frameMode, setFrameMode] = useState("none");
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
  const tier = CODEC_TIERS.find((t) => t.value === codec) ?? CODEC_TIERS[0];
  const isGif = codec === "gif";
  const isProRes = codec === "prores422" || codec === "prores4444";
  const videoExt = tier.ext; // mp4 | mov | gif
  // ffmpeg-only tiers can't run on the web build; the queue uses the WebCodecs
  // engine, so it only accepts H.264 and GIF.
  const queueable = codec === "h264" || codec === "gif";
  // Which delivery preset (if any) the current settings match — for the highlight.
  const activePreset = DELIVERY_PRESETS.find(
    (p) => p.codec === codec && p.resolution === resolution && p.aspectRatio === aspectRatio,
  )?.value;

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

  // Trim window, clamped and ordered. A trim is "active" only when it carves out
  // a real sub-range — a full 0..duration window exports byte-identically.
  const trimIn = Math.max(0, Math.min(inPoint, duration));
  const trimOut = Math.max(trimIn + 1 / Math.max(1, fps), Math.min(outPoint, duration));
  const trimDuration = trimOut - trimIn;
  const isTrimmed = isVideo && (trimIn > 0.001 || trimOut < duration - 0.001);
  const playhead = videoCurrentTime ?? 0;

  // The actually-exported length: the trim window when trimming, else the whole
  // duration. Drives the frame count, timecode range, and size estimate.
  const exportSeconds = isTrimmed ? trimDuration : duration;
  const exportFrames = Math.max(1, Math.floor(fps * exportSeconds));

  const runValidation = async () => {
    if (!onValidateExport) return;
    setValidating(true);
    try { await onValidateExport(); }
    finally { setValidating(false); }
  };

  const handleAddToQueue = () => {
    if (!onEnqueueExport || !currentParams) return;
    // Queue runs on the WebCodecs engine → H.264 mp4 or GIF only.
    const fmt: "mp4" | "gif" = isGif ? "gif" : "mp4";
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
      const dur = Math.round(videoDuration * 100) / 100;
      setDuration(dur);
      setInPoint(0);
      setOutPoint(dur);
      setHasAutoPopulated(true);
    }
  }, [isVideo, videoFPS, videoDuration]);

  // Reset auto-populate flag when switching away from video
  useEffect(() => {
    if (!isVideo) {
      setHasAutoPopulated(false);
    }
  }, [isVideo]);

  const formatTimecode = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const f = Math.floor((seconds % 1) * fps);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
  };

  const estimatedFileSizeMB = () =>
    ((quality * 8_000_000 * exportSeconds) / 8 / 1_000_000).toFixed(1);

  // Left-rail "Output" summary values — the at-a-glance read of what will be
  // written, the way an NLE export panel surfaces it.
  const summaryFormat = isGif ? "GIF · .gif" : `${tier.label} · .${tier.ext}`;
  // Show the TRUE exported dimensions (source + chosen resolution + aspect),
  // not just the chosen option — so the preview summary can't mislead about
  // what gets written. Falls back to the option label when source dims are unknown.
  const summaryRes = (videoWidth && videoHeight)
    ? (() => {
        const s = computeExportSize({
          sourceW: videoWidth, sourceH: videoHeight, resolution,
          aspectRatio: aspectRatio !== "original" ? aspectRatio : undefined,
        });
        return `${s.width}×${s.height}`;
      })()
    : resolution > 0 ? `${resolution}p` : "Source";
  const summaryAspect = aspectRatio === "original"
    ? "Original"
    : `${aspectRatio}${frameMode !== "none" ? ` · ${frameMode}` : ""}`;
  const summaryAudio = !isVideo ? "—"
    : !audioControllable ? "n/a"
      : audioOn ? (isProRes ? "PCM 16-bit" : "AAC 192 kbps") : "Muted";
  const summarySize = isGif ? "—" : isProRes ? "Large (master)" : `~${estimatedFileSizeMB()} MB`;

  // Disabled-state tooltip shown under the export/still buttons.
  const NeedsImage = () => (
    <span className="absolute top-full mt-1 left-1/2 -translate-x-1/2 whitespace-nowrap bg-popover text-popover-foreground text-[12px] px-2 py-1 rounded border border-border shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
      Load an image first
    </span>
  );

  return (
    <div className="space-y-3">
      {/* Panel heading + "matched to source" status, NLE-style. */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <strong className="text-xs font-semibold text-foreground uppercase tracking-wide">Export Settings</strong>
          <p className="text-[12px] text-muted-foreground">Set the format, then export.</p>
        </div>
        {hasAutoPopulated && (
          <span className="flex items-center gap-1 text-[11px] text-primary/90 bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
            Matched to source
          </span>
        )}
      </div>

      {/* Two-pane: left "Output" summary monitor, right grouped settings —
          stacks to one column below the sm breakpoint (mobile / narrow). */}
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,15rem)_1fr] gap-3 items-start">

        {/* ── Left: Output summary + file name ─────────────────────────── */}
        <aside className="space-y-2 min-w-0">
          <div className="rounded-md border border-border bg-secondary/30 overflow-hidden">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary/60 border-b border-border">
              <Monitor className="w-3 h-3 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">Output</span>
            </div>
            <div className="px-2.5 py-1 divide-y divide-border/50">
              <SummaryRow label="Format" value={summaryFormat} accent />
              <SummaryRow label="Resolution" value={summaryRes} />
              <SummaryRow label="Frame rate" value={`${fps} fps`} />
              <SummaryRow label="Aspect" value={summaryAspect} />
              {isVideo && (
                <SummaryRow label="Range"
                  value={isTrimmed ? `${formatTimecode(trimIn)}–${formatTimecode(trimOut)}` : "Full clip"}
                  accent={isTrimmed} />
              )}
              <SummaryRow label="Duration" value={`${exportSeconds.toFixed(2)}s · ${exportFrames.toLocaleString()}f`} />
              {isVideo && <SummaryRow label="Audio" value={summaryAudio} />}
              <SummaryRow label="Est. size" value={summarySize} />
            </div>
          </div>

          {/* Output name — saved with this name; the destination is chosen in the
              save dialog that opens on export. */}
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
                ? "Pick the folder in the save dialog — reveals in Finder when done."
                : "Choose where to save in your browser's dialog (else it goes to Downloads)."}
            </p>
          </div>

          {/* Source info badge (stacked under the summary) */}
          {isVideo && videoWidth && videoHeight && (
            <div className="flex items-start gap-2 px-2.5 py-1.5 bg-secondary/60 rounded-md border border-border">
              <Info className="w-3 h-3 text-primary shrink-0 mt-0.5" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
                <span className="text-foreground font-semibold">Source</span>
                <span>{videoWidth}×{videoHeight}</span>
                <span>{videoFPS?.toFixed(2)} fps</span>
                <span>{formatTimecode(videoDuration || 0)}</span>
              </div>
            </div>
          )}
        </aside>

        {/* ── Right: grouped settings stack ────────────────────────────── */}
        <div className="space-y-2.5 min-w-0">

          {/* Format — preset + codec (Premiere puts Format/Preset up top). */}
          <Section title="Format" icon={Film} hint={`.${tier.ext}`}>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Preset</span>
              <div className="flex flex-wrap gap-1">
                {DELIVERY_PRESETS.map((p) => {
                  const disabled = p.desktopOnly && !isDesktop;
                  const active = activePreset === p.value;
                  return (
                    <button key={p.value}
                      onClick={() => { if (disabled) return; setCodec(p.codec); setResolution(p.resolution); setAspectRatio(p.aspectRatio); }}
                      disabled={disabled}
                      title={disabled ? `${p.label} — desktop app only` : p.hint}
                      className={chip(active, disabled)}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Codec</span>
              <div className="flex flex-wrap gap-1">
                {CODEC_TIERS.map((t) => {
                  const disabled = t.desktopOnly && !isDesktop;
                  const active = codec === t.value;
                  return (
                    <button key={t.value} onClick={() => !disabled && setCodec(t.value)} disabled={disabled}
                      title={disabled ? `${t.label} — desktop app only` : t.hint}
                      className={`${chip(active, disabled)} font-semibold`}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {isGif ? "Max 480px wide · lower FPS recommended for file size" : `${tier.hint} · .${tier.ext}`}
              </p>
            </div>
          </Section>

          {/* Video — timing, framing, resolution. */}
          <Section title="Video" icon={Video} hint={`${fps}fps`}>
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

            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Crop className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Aspect ratio</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {ASPECT_RATIO_OPTIONS.map(({ label, value, icon }) => (
                  <button key={value} onClick={() => setAspectRatio(value)}
                    className={`flex items-center gap-1 ${chip(aspectRatio === value)}`}>
                    <span>{icon}</span> <span>{label}</span>
                  </button>
                ))}
              </div>
              {aspectRatio !== "original" && (
                <>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {FRAME_OPTIONS.map(({ label, value }) => (
                      <button key={value} onClick={() => setFrameMode(value)}
                        className={chip(frameMode === value)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {ASPECT_RATIO_OPTIONS.find(a => a.value === aspectRatio)?.desc}
                  </p>
                </>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Resolution</span>
              <div className="flex flex-wrap gap-1">
                {RESOLUTION_OPTIONS.map(({ label, value }) => (
                  <button key={value} onClick={() => setResolution(value)}
                    className={chip(resolution === value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Source · Trim — in/out points (native ffmpeg export only). */}
          {isVideo && (
            <Section title="Source · Trim" icon={Scissors}
              hint={isTrimmed ? `${trimDuration.toFixed(2)}s` : "Full"}>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">In (s)</span>
                  <div className="flex gap-1">
                    <input type="number" value={inPoint} min={0} max={duration} step={0.1}
                      onChange={(e) => setInPoint(Math.max(0, Math.min(Number(e.target.value), outPoint - 1 / Math.max(1, fps))))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    <button title="Set in point from the current playhead"
                      onClick={() => setInPoint(Math.max(0, Math.min(playhead, outPoint - 1 / Math.max(1, fps))))}
                      className="px-2 py-0.5 text-[11px] rounded border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      ⇤
                    </button>
                  </div>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-muted-foreground">Out (s)</span>
                  <div className="flex gap-1">
                    <input type="number" value={outPoint} min={0} max={duration} step={0.1}
                      onChange={(e) => setOutPoint(Math.max(inPoint + 1 / Math.max(1, fps), Math.min(Number(e.target.value), duration)))}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                    <button title="Set out point from the current playhead"
                      onClick={() => setOutPoint(Math.max(inPoint + 1 / Math.max(1, fps), Math.min(playhead, duration)))}
                      className="px-2 py-0.5 text-[11px] rounded border border-border bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0">
                      ⇥
                    </button>
                  </div>
                </label>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-mono text-muted-foreground">
                  {isTrimmed
                    ? <>{formatTimecode(trimIn)} → {formatTimecode(trimOut)} · {trimDuration.toFixed(2)}s</>
                    : <>Entire clip · {duration.toFixed(2)}s</>}
                </p>
                {isTrimmed && (
                  <button onClick={() => { setInPoint(0); setOutPoint(duration); }}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                    Reset
                  </button>
                )}
              </div>
            </Section>
          )}

          {/* Audio — keep the source's original track (ffmpeg muxes it). */}
          {isVideo && (
            <Section title="Audio" icon={Volume2}
              hint={audioControllable ? (audioOn ? "Original" : "Muted") : "n/a"}>
              {audioControllable ? (
                <>
                  <div className="flex gap-1">
                    {([["original", "Original", Volume2], ["off", "Muted", VolumeX]] as const).map(([val, label, Icon]) => {
                      const active = (val === "original") === audioOn;
                      return (
                        <button key={val} onClick={() => setAudioOn(val === "original")}
                          className={`flex items-center gap-1 ${chip(active)}`}>
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
            </Section>
          )}

          {/* Advanced — render fidelity controls. */}
          <Section title="Advanced" icon={Settings2} defaultOpen={false}>
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
                    className={chip(renderQuality === value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Render progress */}
      {isExporting && (
        <div className="space-y-1">
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-200"
              style={{ width: `${exportProgress * 100}%` }} />
          </div>
          <div className="flex justify-between text-[12px] text-muted-foreground font-mono">
            <span>Frame {Math.round(exportProgress * exportFrames)}/{exportFrames}</span>
            <span>{Math.round(exportProgress * 100)}%</span>
          </div>
        </div>
      )}

      {/* Action bar — secondary on the left, primary Export on the right
          (Premiere anchors Export bottom-right). */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <div className="relative group">
          <button onClick={() => onExportStill({ aspectRatio: aspectRatio !== "original" ? aspectRatio : undefined, fileName: ensureFilename(effectiveBase, stillExt, "lme-export") })} disabled={!hasImage || isExporting}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-border">
            <ImageIcon className="w-3.5 h-3.5" /> Still
          </button>
          {!hasImage && <NeedsImage />}
        </div>

        {onEnqueueExport && (
          <button
            onClick={handleAddToQueue}
            disabled={!hasImage || !queueable}
            title={queueable ? undefined : "The queue supports H.264 and GIF — export ProRes/HEVC directly"}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-[12px] font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors border border-dashed border-border">
            <ListPlus className="w-3.5 h-3.5" /> Add to queue
          </button>
        )}

        <div className="flex-1 min-w-[0.5rem]" />

        {isExporting && onCancelExport && (
          <button onClick={onCancelExport}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors">
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        )}

        {isGif ? (
          <div className="relative group">
            <button
              onClick={() => onExportGif?.(fps, duration, ensureFilename(effectiveBase, "gif", "lme-export"))}
              disabled={!hasImage || isExporting}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors accent-glow">
              <Film className="w-3.5 h-3.5" /> Export GIF
            </button>
            {!hasImage && <NeedsImage />}
          </div>
        ) : (
          <div className="relative group">
            <button
              onClick={() => onExportMp4(fps, duration, { resolution, quality, aspectRatio: aspectRatio !== "original" ? aspectRatio : undefined, frameMode: aspectRatio !== "original" && frameMode !== "none" ? frameMode : undefined, includeAudio: effectiveAudioOn ? true : undefined, format: "mp4", codec: codec as "h264" | "hevc" | "prores422" | "prores4444", audioMode, fileName: ensureFilename(effectiveBase, videoExt, "lme-export"), ...(isTrimmed ? { inSec: trimIn, outSec: trimOut } : {}) })}
              disabled={!hasImage || isExporting}
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors accent-glow">
              {isProRes ? <Video className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
              Export {tier.label}
            </button>
            {!hasImage && <NeedsImage />}
          </div>
        )}
      </div>

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
              className={chip(lutSize === value)}>
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
