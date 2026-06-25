import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Play, Pause, SkipBack, SkipForward, ChevronLeft, ChevronRight,
  Repeat, Volume2, VolumeX, Maximize, Film, Clock, Gauge,
} from "lucide-react";

interface VideoTransportProps {
  /** Is a video loaded? */
  isVideo: boolean;
  hasImage: boolean;
  /** Video duration in seconds */
  duration: number;
  /** Current playback time in seconds */
  currentTime: number;
  /** Is video currently playing? */
  isPlaying: boolean;
  /** Video native FPS (estimated) */
  fps: number;
  /** Video resolution */
  videoWidth: number;
  videoHeight: number;
  /** Playback speed */
  speed: number;
  /** Loop enabled? */
  loop: boolean;
  /** Callbacks */
  onPlay: () => void;
  onPause: () => void;
  onSeek: (time: number) => void;
  onFrameStep: (direction: 1 | -1) => void;
  onSpeedChange: (speed: number) => void;
  onLoopToggle: () => void;
  onGoToStart: () => void;
  onGoToEnd: () => void;
}

const SPEED_OPTIONS = [0.1, 0.25, 0.5, 1, 1.5, 2, 4];

/** Format time as HH:MM:SS:FF (timecode) */
function formatTimecode(seconds: number, fps: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0;
  const totalFrames = Math.floor(seconds * fps);
  const h = Math.floor(totalFrames / (fps * 3600));
  const m = Math.floor((totalFrames % (fps * 3600)) / (fps * 60));
  const s = Math.floor((totalFrames % (fps * 60)) / fps);
  const f = totalFrames % Math.round(fps);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(f).padStart(2, "0")}`;
}

/** Format duration as MM:SS.ms */
function formatDuration(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "00:00.000";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

const VideoTransport = ({
  isVideo,
  hasImage,
  duration,
  currentTime,
  isPlaying,
  fps,
  videoWidth,
  videoHeight,
  speed,
  loop,
  onPlay,
  onPause,
  onSeek,
  onFrameStep,
  onSpeedChange,
  onLoopToggle,
  onGoToStart,
  onGoToEnd,
}: VideoTransportProps) => {
  const scrubberRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const currentFrame = Math.floor(currentTime * fps);
  const totalFrames = Math.floor(duration * fps);

  const seekFromEvent = useCallback((clientX: number) => {
    const el = scrubberRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  }, [duration, onSeek]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isVideo || !hasImage) return;
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    seekFromEvent(e.clientX);
  }, [isVideo, hasImage, seekFromEvent]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const el = scrubberRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(ratio * duration);
    setHoverX(e.clientX - rect.left);
    if (isDragging.current) {
      seekFromEvent(e.clientX);
    }
  }, [duration, seekFromEvent]);

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handlePointerLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  // Keyboard shortcuts for frame stepping
  useEffect(() => {
    if (!isVideo) return;
    const handler = (e: KeyboardEvent) => {
      const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isTyping) return;
      if (e.key === "ArrowLeft" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onFrameStep(-1);
      }
      if (e.key === "ArrowRight" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onFrameStep(1);
      }
      if (e.key === "Home") {
        e.preventDefault();
        onGoToStart();
      }
      if (e.key === "End") {
        e.preventDefault();
        onGoToEnd();
      }
      if (e.key === "l" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        onLoopToggle();
      }
      if (e.key === "j" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const idx = SPEED_OPTIONS.indexOf(speed);
        if (idx > 0) onSpeedChange(SPEED_OPTIONS[idx - 1]);
      }
      if (e.key === "k" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (isPlaying) onPause(); else onPlay();
      }
      // Note: 'l' is taken by loop. Use shift+l for speed up
      if (e.key === "L" && e.shiftKey) {
        e.preventDefault();
        const idx = SPEED_OPTIONS.indexOf(speed);
        if (idx < SPEED_OPTIONS.length - 1) onSpeedChange(SPEED_OPTIONS[idx + 1]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isVideo, isPlaying, speed, onFrameStep, onGoToStart, onGoToEnd, onLoopToggle, onSpeedChange, onPlay, onPause]);

  if (!isVideo || !hasImage) return null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-fade-in">
      {/* Scrubber / Timeline bar */}
      <div className="relative px-3 pt-2 pb-1">
        {/* Time scrubber track */}
        <div
          ref={scrubberRef}
          className="relative h-6 rounded-sm bg-secondary/60 cursor-pointer group"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerLeave}
        >
          {/* Progress fill */}
          <div
            className="absolute inset-y-0 left-0 bg-primary/30 rounded-sm transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
          {/* Buffered / full duration indicator */}
          <div className="absolute inset-y-0 left-0 right-0 flex items-end px-0.5 pb-0.5">
            {/* Frame ticks for short videos */}
            {duration <= 10 && fps > 0 && (
              <div className="absolute inset-0 flex items-end">
                {Array.from({ length: Math.min(totalFrames, 300) }, (_, i) => (
                  <div
                    key={i}
                    className="absolute bottom-0 w-px bg-muted-foreground/10"
                    style={{ left: `${(i / totalFrames) * 100}%`, height: i % Math.round(fps) === 0 ? "100%" : "30%" }}
                  />
                ))}
              </div>
            )}
          </div>
          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-sm shadow-primary/40 z-10"
            style={{ left: `${progress}%`, transform: "translateX(-50%)" }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-primary rounded-full shadow-md shadow-primary/30 border-2 border-primary-foreground" />
          </div>
          {/* Hover preview tooltip */}
          {hoverTime !== null && !isDragging.current && (
            <div
              className="absolute -top-7 bg-popover text-popover-foreground text-[11px] font-mono px-1.5 py-0.5 rounded border border-border shadow-md pointer-events-none z-20 whitespace-nowrap"
              style={{ left: `${hoverX}px`, transform: "translateX(-50%)" }}
            >
              {formatTimecode(hoverTime, fps)} · F{Math.floor(hoverTime * fps)}
            </div>
          )}
        </div>
      </div>

      {/* Transport controls row */}
      <div className="flex items-center gap-1 px-3 pb-2">
        {/* Timecode display */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="bg-surface-0 border border-border rounded px-2 py-0.5 font-mono text-[12px] text-foreground tracking-wider tabular-nums whitespace-nowrap">
            {formatTimecode(currentTime, fps)}
          </div>
          <span className="text-[11px] text-muted-foreground font-mono tabular-nums whitespace-nowrap">
            / {formatTimecode(duration, fps)}
          </span>
        </div>

        <div className="flex-1" />

        {/* Transport buttons */}
        <div className="flex items-center gap-0.5">
          <button onClick={onGoToStart} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Go to start (Home)">
            <SkipBack className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={() => onFrameStep(-1)} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Previous frame (←)">
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={isPlaying ? onPause : onPlay}
            className={`p-2 rounded-md transition-all ${
              isPlaying
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                : "bg-secondary hover:bg-secondary/80 text-foreground"
            }`}
            title={isPlaying ? "Pause (K)" : "Play (K)"}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button onClick={() => onFrameStep(1)} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Next frame (→)">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button onClick={onGoToEnd} className="p-1.5 rounded hover:bg-secondary transition-colors" title="Go to end (End)">
            <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1" />

        {/* Right info cluster */}
        <div className="flex items-center gap-2">
          {/* Loop toggle */}
          <button
            onClick={onLoopToggle}
            className={`p-1.5 rounded transition-colors ${
              loop ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            title={`Loop ${loop ? "on" : "off"} (L)`}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Speed control */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[12px] font-mono border transition-colors ${
                speed !== 1
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-secondary border-border text-muted-foreground hover:text-foreground"
              }`}
              title="Playback speed"
            >
              <Gauge className="w-3 h-3" />
              {speed}×
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full mb-1 right-0 bg-popover border border-border rounded-lg shadow-xl z-30 py-1 min-w-[80px]">
                {SPEED_OPTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => { onSpeedChange(s); setShowSpeedMenu(false); }}
                    className={`w-full px-3 py-1 text-[12px] font-mono text-left hover:bg-secondary transition-colors ${
                      speed === s ? "text-primary font-bold" : "text-foreground"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Frame info */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono tabular-nums">
            <Film className="w-3 h-3" />
            <span>F{currentFrame}</span>
            <span className="opacity-40">/</span>
            <span>{totalFrames}</span>
          </div>

          {/* Resolution badge */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-muted-foreground font-mono">
            <Maximize className="w-3 h-3" />
            {videoWidth}×{videoHeight}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTransport;
