import { useRef, useEffect, useCallback, useState } from "react";

interface HistogramScopeProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  hasImage: boolean;
  mode: "histogram" | "waveform";
}

const SCOPE_WIDTH = 256;
const SCOPE_HEIGHT = 80;

const HistogramScope = ({ canvasRef, hasImage, mode }: HistogramScopeProps) => {
  const scopeRef = useRef<HTMLCanvasElement>(null);
  const [activeMode, setActiveMode] = useState<"histogram" | "waveform">(mode);

  const draw = useCallback(() => {
    const scope = scopeRef.current;
    const source = canvasRef.current;
    if (!scope || !source || !hasImage) return;

    const sCtx = source.getContext("2d");
    if (!sCtx) return;

    const ctx = scope.getContext("2d");
    if (!ctx) return;

    // Sample source at reduced resolution
    const sampleW = Math.min(source.width, 256);
    const sampleH = Math.min(source.height, 256);
    let imageData: ImageData;
    try {
      imageData = sCtx.getImageData(0, 0, sampleW, sampleH);
    } catch { return; }

    const data = imageData.data;
    ctx.clearRect(0, 0, SCOPE_WIDTH, SCOPE_HEIGHT);

    if (activeMode === "histogram") {
      const rHist = new Uint32Array(256);
      const gHist = new Uint32Array(256);
      const bHist = new Uint32Array(256);

      for (let i = 0; i < data.length; i += 4) {
        rHist[data[i]]++;
        gHist[data[i + 1]]++;
        bHist[data[i + 2]]++;
      }

      const maxVal = Math.max(
        ...Array.from(rHist).slice(1, 255),
        ...Array.from(gHist).slice(1, 255),
        ...Array.from(bHist).slice(1, 255),
        1
      );

      // Draw background
      ctx.fillStyle = "hsla(220, 14%, 10%, 0.9)";
      ctx.fillRect(0, 0, SCOPE_WIDTH, SCOPE_HEIGHT);

      const drawChannel = (hist: Uint32Array, color: string) => {
        ctx.beginPath();
        ctx.moveTo(0, SCOPE_HEIGHT);
        for (let i = 0; i < 256; i++) {
          const h = (hist[i] / maxVal) * SCOPE_HEIGHT * 0.9;
          ctx.lineTo(i, SCOPE_HEIGHT - h);
        }
        ctx.lineTo(255, SCOPE_HEIGHT);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      };

      drawChannel(rHist, "rgba(255, 80, 80, 0.35)");
      drawChannel(gHist, "rgba(80, 255, 80, 0.35)");
      drawChannel(bHist, "rgba(80, 80, 255, 0.35)");
    } else {
      // Waveform
      ctx.fillStyle = "hsla(220, 14%, 10%, 0.9)";
      ctx.fillRect(0, 0, SCOPE_WIDTH, SCOPE_HEIGHT);

      const step = Math.max(1, Math.floor(sampleW / SCOPE_WIDTH));
      for (let x = 0; x < sampleW; x += step) {
        for (let y = 0; y < sampleH; y += 2) {
          const idx = (y * sampleW + x) * 4;
          const luma = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
          const px = (x / sampleW) * SCOPE_WIDTH;
          const py = SCOPE_HEIGHT - luma * SCOPE_HEIGHT;
          ctx.fillStyle = `rgba(120, 200, 255, 0.08)`;
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }

    // Border
    ctx.strokeStyle = "hsla(220, 12%, 25%, 0.6)";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, SCOPE_WIDTH, SCOPE_HEIGHT);
  }, [canvasRef, hasImage, activeMode]);

  useEffect(() => {
    draw();
    const interval = setInterval(draw, 500);
    return () => clearInterval(interval);
  }, [draw]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <button
          onClick={() => setActiveMode("histogram")}
          className={`px-1.5 py-0.5 text-[11px] rounded border transition-colors ${
            activeMode === "histogram"
              ? "bg-primary/15 border-primary/30 text-primary"
              : "bg-secondary border-border text-muted-foreground"
          }`}
        >
          Histogram
        </button>
        <button
          onClick={() => setActiveMode("waveform")}
          className={`px-1.5 py-0.5 text-[11px] rounded border transition-colors ${
            activeMode === "waveform"
              ? "bg-primary/15 border-primary/30 text-primary"
              : "bg-secondary border-border text-muted-foreground"
          }`}
        >
          Waveform
        </button>
      </div>
      <canvas
        ref={scopeRef}
        width={SCOPE_WIDTH}
        height={SCOPE_HEIGHT}
        className="w-full rounded border border-border"
        style={{ imageRendering: "pixelated", opacity: hasImage ? 1 : 0.3 }}
      />
    </div>
  );
};

export default HistogramScope;
