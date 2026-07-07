import { useRef, useCallback, useEffect, useState } from "react";
import { Upload, ZoomIn, ZoomOut, Maximize, Square, Crosshair } from "lucide-react";

interface PreviewCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  hasImage: boolean;
  onLoadImage: (file: File) => void;
  zoom?: number;
  onZoomChange?: (zoom: number) => void;
  panX?: number;
  panY?: number;
  onPanChange?: (x: number, y: number) => void;
  compareSplit?: boolean;
  onCompareSplitRatioChange?: (ratio: number) => void;
  sourceWidth?: number;     // natural width of the loaded media — enables Photoshop-style 1:1 zoom (Ben-11 #5)
  onFitScaleChange?: (fitScale: number) => void; // reports source-px->CSS-px fit factor so sibling readouts can show user-true percentages
}

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.33, 2, 3, 4, 6];
// User-facing source-pixel percentages (Photoshop-style): 12.5% .. 400%.
const USER_ZOOM_STEPS = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

// Bundled sample sources (Ben-11 #6): Ben's own raw captures shipped with the app —
// no remote hotlinks (the old Unsplash URLs broke offline and weren't ours). Licence
// provenance: public/samples/PROVENANCE.md. Chosen to span the demo registers:
// neon night / bright daylight action / warm subject / foliage landscape.
const SAMPLE_IMAGES = [
  { url: "samples/neon-sign.jpg", name: "Neon sign (night)" },
  { url: "samples/harbor-helicopter.jpg", name: "Harbour helicopter (daylight)" },
  { url: "samples/dog-portrait.jpg", name: "Dog portrait (indoor)" },
  { url: "samples/tea-plantation.jpg", name: "Tea plantation (landscape)" },
];

const PreviewCanvas = ({
  canvasRef,
  containerRef,
  hasImage,
  onLoadImage,
  zoom = 1,
  onZoomChange,
  panX = 0.5,
  panY = 0.5,
  onPanChange,
  compareSplit = false,
  onCompareSplitRatioChange,
  sourceWidth = 0,
  onFitScaleChange,
}: PreviewCanvasProps) => {
  const isDraggingPan = useRef(false);
  const isDraggingSplit = useRef(false);
  const panPointerId = useRef<number | null>(null);
  // Grab-drag origin: pointer + pan center + canvas rect captured at drag start.
  const panDragStart = useRef<{ cx: number; cy: number; px: number; py: number; rw: number; rh: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadingSample, setLoadingSample] = useState<number | null>(null);

  useEffect(() => {
    const handler = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) onLoadImage(file);
          return;
        }
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [onLoadImage]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
        onLoadImage(file);
      }
    },
    [onLoadImage]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only trigger if leaving the container itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  }, []);

  // Photoshop-style zoom semantics (Ben-11 #5): the USER-facing percentage is source-pixel
  // scale — 100% = one source pixel per screen (CSS) pixel — while the internal `zoom` value
  // stays a transform factor over the fitted canvas box (all pan/drag machinery unchanged).
  // Conversion: userScale = zoom * fitScale, where fitScale maps source px -> CSS px at fit.
  const [canvasBaseW, setCanvasBaseW] = useState(0);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setCanvasBaseW(el.offsetWidth || 0));
    ro.observe(el);
    setCanvasBaseW(el.offsetWidth || 0);
    return () => ro.disconnect();
  }, [canvasRef, hasImage]);
  const fitScale = sourceWidth > 0 && canvasBaseW > 0 ? canvasBaseW / sourceWidth : 0;
  useEffect(() => { onFitScaleChange?.(fitScale); }, [fitScale, onFitScaleChange]);

  const stepZoom = useCallback((direction: number) => {
    if (!onZoomChange) return;
    if (fitScale > 0) {
      // Step through USER percentages (source-pixel scale), Photoshop-style.
      const current = zoom * fitScale;
      let idx = USER_ZOOM_STEPS.findIndex(v => Math.abs(v - current) < 0.01);
      if (idx < 0) {
        idx = USER_ZOOM_STEPS.reduce((best, v, i) =>
          Math.abs(v - current) < Math.abs(USER_ZOOM_STEPS[best] - current) ? i : best, 0);
      }
      const nextIdx = Math.max(0, Math.min(USER_ZOOM_STEPS.length - 1, idx + (direction > 0 ? 1 : -1)));
      onZoomChange(USER_ZOOM_STEPS[nextIdx] / fitScale);
      return;
    }
    const current = zoom;
    let idx = ZOOM_STEPS.findIndex(v => Math.abs(v - current) < 0.01);
    if (idx < 0) {
      idx = ZOOM_STEPS.reduce((best, v, i) =>
        Math.abs(v - current) < Math.abs(ZOOM_STEPS[best] - current) ? i : best, 0);
    }
    const nextIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + (direction > 0 ? 1 : -1)));
    onZoomChange(ZOOM_STEPS[nextIdx]);
  }, [zoom, onZoomChange, fitScale]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!hasImage) return;
    e.preventDefault();
    stepZoom(e.deltaY < 0 ? 1 : -1);
  }, [hasImage, stepZoom]);

  // Clamp the pan centre so the magnified image always fills the viewport (no
  // empty borders). At zoom z the centre can move ±(z-1)/(2z) from 0.5.
  const clampPan = useCallback((v: number) => {
    const m = Math.max(0, (zoom - 1) / (2 * zoom));
    return Math.max(0.5 - m, Math.min(0.5 + m, v));
  }, [zoom]);

  // Relative grab-drag: capture the pan centre and the on-screen canvas size at
  // pointer-down, then translate 1:1 with pointer movement (image follows the
  // cursor) — the natural, expected pan gesture.
  const beginPanDrag = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    panDragStart.current = {
      cx: clientX, cy: clientY, px: panX, py: panY,
      rw: rect.width || 1, rh: rect.height || 1,
    };
  }, [canvasRef, panX, panY]);

  const updatePanDrag = useCallback((clientX: number, clientY: number) => {
    const s = panDragStart.current;
    if (!s || !onPanChange) return;
    onPanChange(
      clampPan(s.px - (clientX - s.cx) / s.rw),
      clampPan(s.py - (clientY - s.cy) / s.rh)
    );
  }, [onPanChange, clampPan]);

  const updateSplitFromPointer = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !onCompareSplitRatioChange) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = (clientX - rect.left) / rect.width;
    onCompareSplitRatioChange(Math.max(0, Math.min(1, ratio)));
  }, [canvasRef, onCompareSplitRatioChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!hasImage) return;
    if (compareSplit && onCompareSplitRatioChange) {
      isDraggingSplit.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updateSplitFromPointer(e.clientX);
      return;
    }
    if (zoom > 1.001 && onPanChange) {
      isDraggingPan.current = true;
      panPointerId.current = e.pointerId;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      beginPanDrag(e.clientX, e.clientY);
    }
  }, [hasImage, compareSplit, zoom, onPanChange, onCompareSplitRatioChange, beginPanDrag, updateSplitFromPointer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isDraggingSplit.current) {
      updateSplitFromPointer(e.clientX);
      return;
    }
    if (isDraggingPan.current && e.pointerId === panPointerId.current) {
      updatePanDrag(e.clientX, e.clientY);
    }
  }, [updatePanDrag, updateSplitFromPointer]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (isDraggingSplit.current) {
      isDraggingSplit.current = false;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
    if (isDraggingPan.current && e.pointerId === panPointerId.current) {
      isDraggingPan.current = false;
      panPointerId.current = null;
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    }
  }, []);

  // QoL: double-click canvas toggles between Fit and 2x zoom for quick inspection.
  const handleDoubleClick = useCallback(() => {
    if (!hasImage || !onZoomChange || compareSplit) return;
    // Toggle Fit <-> 100% (1:1 source pixels), Photoshop-style.
    onZoomChange(Math.abs(zoom - 1) > 0.001 ? 1 : (fitScale > 0 ? 1 / fitScale : 2));
  }, [hasImage, onZoomChange, compareSplit, zoom]);

  // QoL: recenter the pan without leaving the current zoom level.
  const recenter = useCallback(() => {
    onPanChange?.(0.5, 0.5);
  }, [onPanChange]);
  const isPanned = zoom > 1.001 && (Math.abs(panX - 0.5) > 0.001 || Math.abs(panY - 0.5) > 0.001);

  const loadSampleImage = useCallback(async (sample: { url: string; name: string }, idx: number) => {
    setLoadingSample(idx);
    try {
      const resp = await fetch(sample.url);
      const blob = await resp.blob();
      const file = new File([blob], `${sample.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`, { type: "image/jpeg" });
      onLoadImage(file);
    } catch (err) {
      console.error("Failed to load sample image", err);
    } finally {
      setLoadingSample(null);
    }
  }, [onLoadImage]);

  const cursorStyle = compareSplit
    ? "ew-resize"
    : zoom > 1.001
      ? "grab"
      : "default";

  // Zoom/pan as a GPU-composited viewport transform — instant, never re-renders
  // the effect pipeline. transform-origin is the centre; pan shifts the (already
  // scaled) canvas by a fraction of its own box, clamped so no empty borders show.
  const zoomed = Math.abs(zoom - 1) > 0.001; // <1 zoom must render too (Ben-11 #5): 50%/25% steps were dead
  const viewTransform = zoomed
    ? `scale(${zoom}) translate(${(0.5 - clampPan(panX)) * 100}%, ${(0.5 - clampPan(panY)) * 100}%)`
    : undefined;

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 flex items-center justify-center bg-surface-0 rounded-lg border overflow-hidden min-h-0 transition-colors ${
        isDragOver ? "border-primary border-2 bg-primary/5" : "border-border"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-primary/10 backdrop-blur-sm pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Upload className="w-10 h-10 text-primary animate-bounce" />
            <p className="text-sm font-medium text-primary">Drop to load</p>
          </div>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="max-w-full max-h-full object-contain"
        style={{
          imageRendering: "auto",
          cursor: cursorStyle,
          transform: viewTransform,
          transformOrigin: "center center",
          willChange: zoomed ? "transform" : "auto",
        }}
        onWheel={handleWheel as any}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />


      {hasImage && (
        <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-1.5 py-1 shadow-lg">
          <button onClick={() => stepZoom(-1)} className="p-1 hover:bg-secondary rounded transition-colors" title="Zoom out (scroll down)">
            <ZoomOut className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <span className="text-[12px] font-mono text-foreground min-w-[3rem] text-center"
            title={fitScale > 0 ? "Source-pixel scale — 100% = one source pixel per screen pixel" : undefined}>
            {fitScale > 0
              ? (zoom === 1 ? `Fit · ${(zoom * fitScale * 100).toFixed(0)}%` : `${(zoom * fitScale * 100).toFixed(0)}%`)
              : (zoom === 1 ? "Fit" : `${(zoom * 100).toFixed(0)}%`)}
          </span>
          <button onClick={() => stepZoom(1)} className="p-1 hover:bg-secondary rounded transition-colors" title="Zoom in (scroll up)">
            <ZoomIn className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          {isPanned && (
            <button onClick={recenter} className="p-1 hover:bg-secondary rounded transition-colors" title="Recenter view">
              <Crosshair className="w-3.5 h-3.5 text-primary" />
            </button>
          )}
          <button onClick={() => onZoomChange?.(1)} className="p-1 hover:bg-secondary rounded transition-colors" title="Fit to view (double-click canvas)">
            <Maximize className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <button
            onClick={() => onZoomChange?.(fitScale > 0 ? 1 / fitScale : 2)}
            className="px-1 py-0.5 hover:bg-secondary rounded transition-colors text-[10px] font-mono font-semibold text-muted-foreground"
            title="100% — one source pixel per screen pixel (double-click canvas)"
          >
            1:1
          </button>
        </div>
      )}

      {!hasImage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-surface-0/95 px-4">
          <div className="w-16 h-16 rounded-[4px] bg-surface-1 flex items-center justify-center border border-border">
            <Upload className="w-7 h-7 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-medium text-foreground">Drop an image or video to load a source</p>
            <p className="text-[12px] text-muted-foreground font-mono">or paste from clipboard · ⌘V</p>
          </div>
          <label className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-[3px] cursor-pointer hover:bg-primary/90 transition-colors">
            Browse files
            <input
              type="file"
              accept="image/*,video/*,.mov,.webm,.mp4"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onLoadImage(file);
              }}
            />
          </label>

          <div className="flex flex-col items-center gap-3 mt-2">
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Quick start</p>
            <div className="flex gap-3">
              {SAMPLE_IMAGES.map((sample, i) => (
                <button
                  key={sample.url}
                  onClick={() => loadSampleImage(sample, i)}
                  disabled={loadingSample !== null}
                  className={`w-20 h-16 rounded-lg overflow-hidden border-2 border-border hover:border-primary/60 transition-all shadow-sm ${
                    loadingSample === i ? "opacity-50 animate-pulse" : "opacity-80 hover:opacity-100 hover:scale-105"
                  }`}
                  title={`Load sample: ${sample.name}`}
                >
                  <img src={sample.url} alt={sample.name} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default PreviewCanvas;
