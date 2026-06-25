import { useRef, useState, useCallback, useEffect } from "react";
import { Paintbrush, Eraser, RotateCcw, Circle, Square, Eye, EyeOff, Download } from "lucide-react";

interface MaskPainterProps {
  width: number;
  height: number;
  onMaskChange: (maskData: ImageData | null) => void;
  sourceElement?: HTMLImageElement | HTMLVideoElement | null;
}

type BrushMode = "paint" | "erase";
type BrushShape = "circle" | "square";

const MaskPainter = ({ width, height, onMaskChange, sourceElement }: MaskPainterProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(30);
  const [brushMode, setBrushMode] = useState<BrushMode>("paint");
  const [brushShape, setBrushShape] = useState<BrushShape>("circle");
  const [brushHardness, setBrushHardness] = useState(0.8);
  const [isPainting, setIsPainting] = useState(false);
  const [showMask, setShowMask] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = Math.max(100, width || 400);
    canvas.height = Math.max(100, height || 300);
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "white"; // White = full effect
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [width, height]);

  const getCanvasPos = useCallback((e: React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const drawBrush = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    
    if (brushMode === "paint") {
      ctx.globalCompositeOperation = "source-over";
      // Create gradient for soft brush
      if (brushShape === "circle") {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, brushSize);
        gradient.addColorStop(0, `rgba(255, 255, 255, ${brushHardness})`);
        gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, brushSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${brushHardness})`;
        ctx.fillRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2);
      }
    } else {
      ctx.globalCompositeOperation = "source-over";
      // Erase = paint black (no effect)
      if (brushShape === "circle") {
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, brushSize);
        gradient.addColorStop(0, `rgba(0, 0, 0, ${brushHardness})`);
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, brushSize, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = `rgba(0, 0, 0, ${brushHardness})`;
        ctx.fillRect(x - brushSize, y - brushSize, brushSize * 2, brushSize * 2);
      }
    }
    
    ctx.restore();
  }, [brushMode, brushSize, brushShape, brushHardness]);

  const drawLine = useCallback((ctx: CanvasRenderingContext2D, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
    const steps = Math.max(1, Math.ceil(dist / (brushSize / 4)));
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      drawBrush(ctx, x, y);
    }
  }, [brushSize, drawBrush]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    
    setIsPainting(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    const pos = getCanvasPos(e);
    drawBrush(ctx, pos.x, pos.y);
    lastPosRef.current = pos;
    
    // Notify change
    onMaskChange(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }, [enabled, getCanvasPos, drawBrush, onMaskChange]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isPainting || !enabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    
    const pos = getCanvasPos(e);
    if (lastPosRef.current) {
      drawLine(ctx, lastPosRef.current, pos);
    }
    lastPosRef.current = pos;
    
    onMaskChange(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }, [isPainting, enabled, getCanvasPos, drawLine, onMaskChange]);

  const handlePointerUp = useCallback(() => {
    setIsPainting(false);
    lastPosRef.current = null;
  }, []);

  const clearMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    onMaskChange(null);
  }, [onMaskChange]);

  const invertMask = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
    ctx.putImageData(imageData, 0, 0);
    onMaskChange(imageData);
  }, [onMaskChange]);

  const exportMask = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `mask-${Date.now()}.png`;
    a.click();
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-foreground">Effect Mask</span>
        <div className="flex-1" />
        <button
          onClick={() => setEnabled(!enabled)}
          className={`flex items-center gap-1 px-2 py-0.5 text-[12px] rounded border transition-colors ${
            enabled
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-secondary border-border text-muted-foreground"
          }`}
        >
          {enabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {enabled && (
        <>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => setBrushMode("paint")}
              className={`p-1.5 rounded border transition-colors ${
                brushMode === "paint" ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary border-border text-muted-foreground"
              }`}
              title="Paint (add effect)"
            >
              <Paintbrush className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setBrushMode("erase")}
              className={`p-1.5 rounded border transition-colors ${
                brushMode === "erase" ? "bg-primary/15 border-primary/40 text-primary" : "bg-secondary border-border text-muted-foreground"
              }`}
              title="Erase (remove effect)"
            >
              <Eraser className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={() => setBrushShape(brushShape === "circle" ? "square" : "circle")}
              className="p-1.5 rounded border bg-secondary border-border text-muted-foreground hover:text-foreground transition-colors"
              title={`Shape: ${brushShape}`}
            >
              {brushShape === "circle" ? <Circle className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setShowMask(!showMask)}
              className="p-1.5 rounded border bg-secondary border-border text-muted-foreground hover:text-foreground transition-colors"
              title={showMask ? "Hide mask" : "Show mask"}
            >
              {showMask ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
            <div className="flex-1" />
            <button
              onClick={invertMask}
              className="px-2 py-0.5 text-[12px] bg-secondary border border-border rounded text-muted-foreground hover:text-foreground"
            >
              Invert
            </button>
            <button
              onClick={clearMask}
              className="p-1 rounded border bg-secondary border-border text-muted-foreground hover:text-foreground transition-colors"
              title="Clear mask"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={exportMask}
              className="p-1 rounded border bg-secondary border-border text-muted-foreground hover:text-foreground transition-colors"
              title="Export mask"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground w-12">Size:</span>
            <input
              type="range"
              value={brushSize}
              min={5}
              max={100}
              onChange={(e) => setBrushSize(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-[12px] font-mono text-foreground w-8">{brushSize}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-muted-foreground w-12">Soft:</span>
            <input
              type="range"
              value={brushHardness}
              min={0.1}
              max={1}
              step={0.1}
              onChange={(e) => setBrushHardness(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-[12px] font-mono text-foreground w-8">{(brushHardness * 100).toFixed(0)}%</span>
          </div>

          {/* Mask canvas */}
          <div
            className="relative rounded-lg border border-border overflow-hidden cursor-crosshair"
            style={{ aspectRatio: `${width || 16} / ${height || 9}` }}
          >
            {/* Source preview */}
            {sourceElement && (
              <canvas
                className="absolute inset-0 w-full h-full object-contain pointer-events-none opacity-50"
              />
            )}
            
            {/* Mask canvas */}
            <canvas
              ref={canvasRef}
              className={`w-full h-full ${showMask ? "opacity-60" : "opacity-0"}`}
              style={{ mixBlendMode: "multiply" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />

            {/* Brush cursor preview */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30">
              {brushShape === "circle" ? (
                <div
                  className="rounded-full border-2 border-primary"
                  style={{ width: brushSize * 2, height: brushSize * 2 }}
                />
              ) : (
                <div
                  className="border-2 border-primary"
                  style={{ width: brushSize * 2, height: brushSize * 2 }}
                />
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            White = effect applied, Black = no effect. Paint to create regions where effects apply.
          </p>
        </>
      )}
    </div>
  );
};

export default MaskPainter;
