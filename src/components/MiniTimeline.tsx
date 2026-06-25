import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Play, Pause, SkipBack, Plus, Diamond, Trash2, ChevronDown, ChevronRight, Music,
} from "lucide-react";
import {
  KeyframeTrack, KeyframeState, Keyframe, EasingType, EASING_OPTIONS,
  addKeyframe, removeKeyframe, createTrack, evaluateTrack,
} from "@/lib/keyframe-engine";

interface MiniTimelineProps {
  duration: number;
  onDurationChange: (d: number) => void;
  currentTime: number;
  onSeek: (t: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
  keyframeState: KeyframeState;
  onKeyframeStateChange: (state: KeyframeState) => void;
  currentParams: Record<string, number | string>;
  audioBuffer?: AudioBuffer | null;
}

const KEYFRAMEABLE_PARAMS = [
  { key: "scanlineStrength", label: "Scanlines", min: 0, max: 1 },
  { key: "phosphorMask", label: "Phosphor", min: 0, max: 1 },
  { key: "barrelDistortion", label: "Barrel", min: -0.3, max: 0.3 },
  { key: "bloom", label: "Bloom", min: 0, max: 2 },
  { key: "flicker", label: "Flicker", min: 0, max: 1 },
  { key: "chromaticAberration", label: "Chroma Ab.", min: 0, max: 2 },
  { key: "noise", label: "Noise", min: 0, max: 2 },
  { key: "pixelSize", label: "Pixel Size", min: 1, max: 12 },
  { key: "imageBrightness", label: "Brightness", min: 0.2, max: 3 },
  { key: "imageContrast", label: "Contrast", min: 0.2, max: 3 },
  { key: "advancedSaturation", label: "Saturation", min: 0, max: 3 },
  { key: "imageGamma", label: "Gamma", min: 0.2, max: 3 },
  { key: "imageTemperature", label: "Temperature", min: -1, max: 1 },
  { key: "advancedLineJitter", label: "Line Jitter", min: 0, max: 1 },
  { key: "advancedTimebaseWobble", label: "Wobble", min: 0, max: 1 },
  { key: "advancedGhosting", label: "Ghosting", min: 0, max: 1 },
  { key: "advancedFilmGrain", label: "Film Grain", min: 0, max: 1 },
  { key: "advancedInterlacing", label: "Interlacing", min: 0, max: 1 },
  { key: "advancedRfInterference", label: "RF Noise", min: 0, max: 1 },
  { key: "advancedQuantization", label: "Quantize", min: 0, max: 1 },
];

const TRACK_HEIGHT = 24;
const HEADER_WIDTH = 120;

const MiniTimeline = ({
  duration,
  onDurationChange,
  currentTime,
  onSeek,
  isPlaying,
  onPlayPause,
  keyframeState,
  onKeyframeStateChange,
  currentParams,
  audioBuffer,
}: MiniTimelineProps) => {
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [selectedKeyframe, setSelectedKeyframe] = useState<{ trackIdx: number; kfIdx: number } | null>(null);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioCanvasRef = useRef<HTMLCanvasElement>(null);

  const tracks = keyframeState.tracks;

  // Draw audio waveform
  useEffect(() => {
    const canvas = audioCanvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / w);

    ctx.fillStyle = "hsl(var(--primary) / 0.25)";
    for (let i = 0; i < w; i++) {
      let min = 1.0, max = -1.0;
      for (let j = 0; j < step; j++) {
        const sample = data[i * step + j] || 0;
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }
      const y1 = ((1 + min) / 2) * h;
      const y2 = ((1 + max) / 2) * h;
      ctx.fillRect(i, y1, 1, Math.max(1, y2 - y1));
    }
  }, [audioBuffer]);

  const timeToX = useCallback((t: number, trackWidth: number) => {
    return (t / duration) * trackWidth;
  }, [duration]);

  const xToTime = useCallback((x: number, trackWidth: number) => {
    return Math.max(0, Math.min(duration, (x / trackWidth) * duration));
  }, [duration]);

  const handleTimelineClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - HEADER_WIDTH;
    const trackWidth = rect.width - HEADER_WIDTH;
    if (x >= 0) {
      onSeek(xToTime(x, trackWidth));
    }
  }, [onSeek, xToTime]);

  const handleAddKeyframe = useCallback((trackIdx: number) => {
    const track = tracks[trackIdx];
    const currentVal = typeof currentParams[track.paramKey] === "number"
      ? currentParams[track.paramKey] as number
      : 0;
    const kf: Keyframe = { time: currentTime, value: currentVal, easing: "ease-in-out" };
    const newTrack = addKeyframe(track, kf);
    const newTracks = [...tracks];
    newTracks[trackIdx] = newTrack;
    onKeyframeStateChange({ ...keyframeState, tracks: newTracks });
  }, [tracks, currentTime, currentParams, keyframeState, onKeyframeStateChange]);

  const handleRemoveKeyframe = useCallback((trackIdx: number, kfIdx: number) => {
    const track = tracks[trackIdx];
    const kf = track.keyframes[kfIdx];
    const newTrack = removeKeyframe(track, kf.time);
    const newTracks = [...tracks];
    newTracks[trackIdx] = newTrack;
    onKeyframeStateChange({ ...keyframeState, tracks: newTracks });
    setSelectedKeyframe(null);
  }, [tracks, keyframeState, onKeyframeStateChange]);

  const handleChangeEasing = useCallback((trackIdx: number, kfIdx: number, easing: EasingType) => {
    const newTracks = [...tracks];
    const newKfs = [...newTracks[trackIdx].keyframes];
    newKfs[kfIdx] = { ...newKfs[kfIdx], easing };
    newTracks[trackIdx] = { ...newTracks[trackIdx], keyframes: newKfs };
    onKeyframeStateChange({ ...keyframeState, tracks: newTracks });
  }, [tracks, keyframeState, onKeyframeStateChange]);

  const handleAddTrack = useCallback((paramKey: string) => {
    if (tracks.find(t => t.paramKey === paramKey)) return;
    const newTrack = createTrack(paramKey);
    onKeyframeStateChange({
      ...keyframeState,
      tracks: [...tracks, newTrack],
    });
    setShowAddTrack(false);
  }, [tracks, keyframeState, onKeyframeStateChange]);

  const handleRemoveTrack = useCallback((idx: number) => {
    const newTracks = tracks.filter((_, i) => i !== idx);
    onKeyframeStateChange({ ...keyframeState, tracks: newTracks });
  }, [tracks, keyframeState, onKeyframeStateChange]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedTracks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const availableParams = useMemo(() =>
    KEYFRAMEABLE_PARAMS.filter(p => !tracks.find(t => t.paramKey === p.key)),
    [tracks]
  );

  const selectedKf = selectedKeyframe
    ? tracks[selectedKeyframe.trackIdx]?.keyframes[selectedKeyframe.kfIdx]
    : null;

  // Time ruler marks
  const rulerMarks = useMemo(() => {
    const marks: number[] = [];
    const step = duration <= 4 ? 0.5 : duration <= 10 ? 1 : 2;
    for (let t = 0; t <= duration; t += step) marks.push(t);
    return marks;
  }, [duration]);

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden animate-fade-in">
      {/* Transport bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-card/80">
        <button onClick={() => onSeek(0)} className="p-1 rounded hover:bg-secondary transition-colors" title="Go to start">
          <SkipBack className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button onClick={onPlayPause} className="p-1 rounded hover:bg-secondary transition-colors" title={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause className="w-3.5 h-3.5 text-primary" /> : <Play className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <span className="text-[12px] font-mono text-foreground min-w-[4.5rem]">
          {currentTime.toFixed(2)}s / {duration.toFixed(1)}s
        </span>
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-[12px] text-muted-foreground">
          Dur:
          <input type="number" value={duration} min={1} max={60} step={0.5}
            onChange={(e) => onDurationChange(Math.max(1, Number(e.target.value)))}
            className="w-12 px-1 py-0.5 bg-secondary border border-border rounded text-foreground font-mono text-[12px]" />
        </label>
        <button onClick={() => setShowAddTrack(!showAddTrack)}
          className="flex items-center gap-0.5 px-2 py-0.5 text-[12px] bg-primary/15 text-primary rounded hover:bg-primary/25 transition-colors font-medium">
          <Plus className="w-3 h-3" /> Track
        </button>
      </div>

      {/* Add track dropdown */}
      {showAddTrack && (
        <div className="border-b border-border bg-secondary/50 px-3 py-2 max-h-40 overflow-y-auto">
          <div className="flex flex-wrap gap-1">
            {availableParams.map(p => (
              <button key={p.key} onClick={() => handleAddTrack(p.key)}
                className="px-2 py-0.5 text-[12px] bg-card border border-border rounded hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors">
                {p.label}
              </button>
            ))}
            {availableParams.length === 0 && (
              <span className="text-[12px] text-muted-foreground">All parameters added</span>
            )}
          </div>
        </div>
      )}

      {/* Timeline area */}
      <div ref={timelineRef} className="relative overflow-x-auto" onClick={handleTimelineClick}>
        {/* Ruler */}
        <div className="flex h-5 border-b border-border" style={{ paddingLeft: HEADER_WIDTH }}>
          <div className="relative flex-1 min-w-0">
            {rulerMarks.map(t => (
              <span key={t} className="absolute top-0 text-[10px] font-mono text-muted-foreground -translate-x-1/2"
                style={{ left: `${(t / duration) * 100}%` }}>
                {t.toFixed(t % 1 === 0 ? 0 : 1)}s
              </span>
            ))}
          </div>
        </div>

        {/* Audio waveform row */}
        {audioBuffer && (
          <div className="flex items-center border-b border-border" style={{ height: 32 }}>
            <div className="flex items-center gap-1 px-2 shrink-0" style={{ width: HEADER_WIDTH }}>
              <Music className="w-3 h-3 text-muted-foreground" />
              <span className="text-[12px] text-muted-foreground truncate">Audio</span>
            </div>
            <div className="relative flex-1 min-w-0 h-full">
              <canvas ref={audioCanvasRef} width={600} height={32} className="w-full h-full" />
            </div>
          </div>
        )}

        {/* Tracks */}
        {tracks.map((track, tIdx) => {
          const paramDef = KEYFRAMEABLE_PARAMS.find(p => p.key === track.paramKey);
          const label = paramDef?.label || track.paramKey;
          const expanded = expandedTracks.has(track.paramKey);

          return (
            <div key={track.paramKey} className="border-b border-border last:border-b-0">
              <div className="flex items-center" style={{ height: TRACK_HEIGHT }}>
                {/* Track header */}
                <div className="flex items-center gap-1 px-2 shrink-0 border-r border-border" style={{ width: HEADER_WIDTH }}>
                  <button onClick={() => toggleExpand(track.paramKey)} className="p-0.5">
                    {expanded ? <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" /> : <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />}
                  </button>
                  <span className="text-[12px] text-foreground truncate flex-1">{label}</span>
                  <button onClick={() => handleAddKeyframe(tIdx)} className="p-0.5 hover:bg-secondary rounded" title="Add keyframe at current time">
                    <Diamond className="w-2.5 h-2.5 text-primary" />
                  </button>
                  <button onClick={() => handleRemoveTrack(tIdx)} className="p-0.5 hover:bg-destructive/20 rounded" title="Remove track">
                    <Trash2 className="w-2.5 h-2.5 text-muted-foreground" />
                  </button>
                </div>

                {/* Track lane */}
                <div className="relative flex-1 min-w-0 h-full bg-secondary/30">
                  {/* Easing curve visualization */}
                  {track.keyframes.length >= 2 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
                      {track.keyframes.slice(0, -1).map((kf, i) => {
                        const next = track.keyframes[i + 1];
                        const x1 = (kf.time / duration) * 100;
                        const x2 = (next.time / duration) * 100;
                        const min = paramDef?.min ?? 0;
                        const max = paramDef?.max ?? 1;
                        const range = max - min || 1;
                        const y1 = (1 - (kf.value - min) / range) * 100;
                        const y2 = (1 - (next.value - min) / range) * 100;
                        // Simple line for now
                        return (
                          <line key={i} x1={`${x1}%`} y1={`${y1}%`} x2={`${x2}%`} y2={`${y2}%`}
                            stroke="hsl(var(--primary) / 0.4)" strokeWidth="1.5" />
                        );
                      })}
                    </svg>
                  )}

                  {/* Keyframe diamonds */}
                  {track.keyframes.map((kf, kIdx) => {
                    const xPct = (kf.time / duration) * 100;
                    const isSelected = selectedKeyframe?.trackIdx === tIdx && selectedKeyframe?.kfIdx === kIdx;
                    return (
                      <button key={kIdx}
                        onClick={(e) => { e.stopPropagation(); setSelectedKeyframe({ trackIdx: tIdx, kfIdx: kIdx }); }}
                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border transition-colors z-10 ${
                          isSelected
                            ? "bg-primary border-primary shadow-sm shadow-primary/30"
                            : "bg-primary/60 border-primary/40 hover:bg-primary hover:border-primary"
                        }`}
                        style={{ left: `${xPct}%` }}
                        title={`${kf.time.toFixed(2)}s = ${kf.value.toFixed(2)} (${kf.easing})`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Expanded detail */}
              {expanded && (
                <div className="px-3 py-1.5 bg-secondary/20 text-[12px] text-muted-foreground border-t border-border/50">
                  <div className="flex flex-wrap gap-2">
                    {track.keyframes.map((kf, kIdx) => (
                      <span key={kIdx} className="font-mono">
                        @{kf.time.toFixed(1)}s → {kf.value.toFixed(2)} [{kf.easing}]
                      </span>
                    ))}
                    {track.keyframes.length === 0 && <span>No keyframes. Click ◆ to add.</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Playhead */}
        <div className="absolute top-0 bottom-0 w-px bg-primary z-20 pointer-events-none"
          style={{ left: `calc(${HEADER_WIDTH}px + (100% - ${HEADER_WIDTH}px) * ${currentTime / duration})` }}>
        </div>

        {tracks.length === 0 && !audioBuffer && (
          <div className="flex items-center justify-center h-12 text-[12px] text-muted-foreground">
            Click "+ Track" to add keyframeable parameters
          </div>
        )}
      </div>

      {/* Keyframe detail editor */}
      {selectedKf && selectedKeyframe && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border bg-card/80 text-[12px]">
          <span className="text-muted-foreground font-medium">Keyframe:</span>
          <span className="font-mono text-foreground">@{selectedKf.time.toFixed(2)}s</span>
          <label className="flex items-center gap-1 text-muted-foreground">
            Value:
            <input type="number" value={selectedKf.value} step={0.01}
              onChange={(e) => {
                const val = Number(e.target.value);
                const newTracks = [...tracks];
                const newKfs = [...newTracks[selectedKeyframe.trackIdx].keyframes];
                newKfs[selectedKeyframe.kfIdx] = { ...newKfs[selectedKeyframe.kfIdx], value: val };
                newTracks[selectedKeyframe.trackIdx] = { ...newTracks[selectedKeyframe.trackIdx], keyframes: newKfs };
                onKeyframeStateChange({ ...keyframeState, tracks: newTracks });
              }}
              className="w-16 px-1 py-0.5 bg-secondary border border-border rounded font-mono text-foreground" />
          </label>
          <label className="flex items-center gap-1 text-muted-foreground">
            Easing:
            <select value={selectedKf.easing}
              onChange={(e) => handleChangeEasing(selectedKeyframe.trackIdx, selectedKeyframe.kfIdx, e.target.value as EasingType)}
              className="px-1 py-0.5 bg-secondary border border-border rounded text-foreground">
              {EASING_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <button onClick={() => handleRemoveKeyframe(selectedKeyframe.trackIdx, selectedKeyframe.kfIdx)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 bg-destructive/15 text-destructive rounded hover:bg-destructive/25 transition-colors">
            <Trash2 className="w-2.5 h-2.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default MiniTimeline;
