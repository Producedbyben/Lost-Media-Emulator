import { useRef, useCallback, useEffect, useState } from "react";
import { Upload, ZoomIn, ZoomOut, Maximize, Square, Crosshair } from "lucide-react";

interface PreviewCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
  hasImage: boolean;
  onLoadImage: (file: File) => void;
  zoom?: number;                 // USER scale: 1 = 100% = one source px per CSS px (pixel-true, 1.1.6)
  fit?: boolean;                 // fit-to-window mode (zoom ignored while true)
  onZoomChange?: (zoom: number) => void;
  onFitChange?: (fit: boolean) => void;
  panX?: number;
  panY?: number;
  onPanChange?: (x: number, y: number) => void;
  compareSplit?: boolean;
  onCompareSplitRatioChange?: (ratio: number) => void;
  sourceWidth?: number;     // natural width of the loaded media — enables Photoshop-style 1:1 zoom (Ben-11 #5)
  onFitScaleChange?: (fitScale: number) => void; // reports source-px->CSS-px fit factor so sibling readouts can show user-true percentages
}

// User-facing source-pixel percentages (Photoshop-style): 12.5% .. 400%.
const USER_ZOOM_STEPS = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];

// Bundled sample sources (Ben-11 #6): Ben's own raw captures shipped with the app —
// no remote hotlinks (the old Unsplash URLs broke offline and weren't ours). Licence
// provenance: public/samples/PROVENANCE.md. Chosen to span the demo registers:
// neon night / bright daylight action / warm subject / foliage landscape.
const SAMPLE_IMAGES = [
  { url: "samples/neon-sign.jpg", name: "Neon sign (night)" },
  { url: "samples/cliff-dawn.jpg", name: "Cliff at dawn (landscape)" },
  { url: "samples/dog-portrait.jpg", name: "Dog portrait (indoor)" },
  { url: "samples/cafe-still-life.jpg", name: "Café still life (macro)" },
  { url: "samples/harbor-helicopter.jpg", name: "Harbour helicopter (daylight)" },
];

const PreviewCanvas = ({
  canvasRef,
  containerRef,
  hasImage,
  onLoadImage,
  zoom = 1,
  fit = true,
  onZoomChange,
  onFitChange,
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

  // Pixel-true zoom (1.1.6 #1): `zoom` IS the user scale (1 = one source px per CSS px) and
  // the canvas RENDERS the visible source window at full density (renderOptions.sourceView in
  // the hook) — never a CSS stretch. viewFrac = the fraction of the source that is visible.
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
  const viewFrac = !fit && sourceWidth > 0 && canvasBaseW > 0
    ? Math.min(1, (canvasBaseW / Math.max(0.05, zoom)) / sourceWidth)
    : 1;

  const stepZoom = useCallback((direction: number) => {
    if (!onZoomChange) return;
    // Steps are USER percentages. Stepping out of Fit starts from the fit percentage.
    const current = fit ? (fitScale || 1) : zoom;
    let idx = USER_ZOOM_STEPS.findIndex(v => Math.abs(v - current) < 0.01);
    if (idx < 0) {
      idx = USER_ZOOM_STEPS.reduce((best, v, i) =>
        Math.abs(v - current) < Math.abs(USER_ZOOM_STEPS[best] - current) ? i : best, 0);
    }
    const nextIdx = Math.max(0, Math.min(USER_ZOOM_STEPS.length - 1, idx + (direction > 0 ? 1 : -1)));
    onFitChange?.(false);
    onZoomChange(USER_ZOOM_STEPS[nextIdx]);
  }, [zoom, fit, onZoomChange, onFitChange, fitScale]);


  // Clamp the pan centre so the view window stays inside the source: with a visible
  // fraction f the centre can move ±(1-f)/2 from 0.5.
  const clampPan = useCallback((v: number) => {
    const m = Math.max(0, (1 - viewFrac) / 2);
    return Math.max(0.5 - m, Math.min(0.5 + m, v));
  }, [viewFrac]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!hasImage) return;
    // Zoom ONLY on an explicit gesture: Cmd/Ctrl+scroll or trackpad pinch (Chromium
    // delivers pinch as wheel+ctrlKey). A plain two-finger scroll must never silently
    // zoom - that left users stuck on a "cropped" video with no idea why.
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      stepZoom(e.deltaY < 0 ? 1 : -1);
      return;
    }
    // Zoomed in: plain scroll pans the view window (Photoshop-style). At fit: inert.
    if (viewFrac < 0.999 && onPanChange) {
      e.preventDefault();
      const canvas = canvasRef.current;
      const r = canvas ? canvas.getBoundingClientRect() : null;
      if (!r || !r.width) return;
      onPanChange(
        clampPan(panX + (e.deltaX / r.width) * viewFrac),
        clampPan(panY + (e.deltaY / r.height) * viewFrac)
      );
    }
  }, [hasImage, stepZoom, viewFrac, onPanChange, clampPan, panX, panY, canvasRef]);

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
      // Pointer delta (CSS px) -> source-fraction delta: divide by the canvas box and scale
      // by the visible fraction, so the image follows the cursor 1:1 on screen.
      clampPan(s.px - ((clientX - s.cx) / s.rw) * viewFrac),
      clampPan(s.py - ((clientY - s.cy) / s.rh) * viewFrac)
    );
  }, [onPanChange, clampPan, viewFrac]);

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
    if (viewFrac < 0.999 && onPanChange) {
      isDraggingPan.current = true;
      panPointerId.current = e.pointerId;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      beginPanDrag(e.clientX, e.clientY);
    }
  }, [hasImage, compareSplit, viewFrac, onPanChange, onCompareSplitRatioChange, beginPanDrag, updateSplitFromPointer]);

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

  // Double-click toggles Fit <-> 100% (1:1 source pixels), Photoshop-style.
  const handleDoubleClick = useCallback(() => {
    if (!hasImage || compareSplit) return;
    if (fit) { onFitChange?.(false); onZoomChange?.(1); }
    else onFitChange?.(true);
  }, [hasImage, compareSplit, fit, onFitChange, onZoomChange]);

  // QoL: recenter the pan without leaving the current zoom level.
  const recenter = useCallback(() => {
    onPanChange?.(0.5, 0.5);
  }, [onPanChange]);
  const isPanned = viewFrac < 0.999 && (Math.abs(panX - 0.5) > 0.001 || Math.abs(panY - 0.5) > 0.001);

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
    : viewFrac < 0.999
      ? "grab"
      : "default";

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
            {fit
              ? (fitScale > 0 ? `Fit · ${(fitScale * 100).toFixed(0)}%` : "Fit")
              : `${(zoom * 100).toFixed(0)}%`}
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
          <button onClick={() => onFitChange?.(true)}
            className={`p-1 hover:bg-secondary rounded transition-colors ${fit ? "text-primary" : "text-muted-foreground"}`}
            title="Fit to view (0)">
            <Maximize className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { onFitChange?.(false); onZoomChange?.(1); }}
            className={`px-1 py-0.5 hover:bg-secondary rounded transition-colors text-[10px] font-mono font-semibold ${!fit && Math.abs(zoom - 1) < 0.001 ? "text-primary" : "text-muted-foreground"}`}
            title="100% — one source pixel per screen pixel (1)"
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
