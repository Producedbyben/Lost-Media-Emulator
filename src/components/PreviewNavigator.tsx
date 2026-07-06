import { useRef, useCallback, useEffect } from "react";

interface PreviewNavigatorProps {
  fitScale?: number; // source-px->CSS-px fit factor from PreviewCanvas (user-true % display)
  /** The loaded source element (image or video) to thumbnail */
  sourceElement: HTMLImageElement | HTMLVideoElement | null;
  /** Current zoom level (1 = fit) */
  zoom: number;
  /** Pan center 0–1 */
  panX: number;
  panY: number;
  /** Called when user drags viewport */
  onPanChange: (x: number, y: number) => void;
  /** Called when user changes zoom via the navigator */
  onZoomChange?: (zoom: number) => void;
  hasImage: boolean;
  /** Increment to force thumbnail re-capture (e.g. after video seek) */
  thumbnailVersion?: number;
}

const NAV_WIDTH = 240;
const NAV_HEIGHT = 135;

const PreviewNavigator = ({
  sourceElement,
  zoom,
  panX,
  panY,
  onPanChange,
  onZoomChange,
  hasImage,
  thumbnailVersion = 0,
  fitScale = 0,
}: PreviewNavigatorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);

  const getSourceDimensions = useCallback(() => {
    if (!sourceElement) return { w: 1, h: 1 };
    const w = (sourceElement as HTMLVideoElement).videoWidth || (sourceElement as HTMLImageElement).naturalWidth || 1;
    const h = (sourceElement as HTMLVideoElement).videoHeight || (sourceElement as HTMLImageElement).naturalHeight || 1;
    return { w, h };
  }, [sourceElement]);

  const getDrawRect = useCallback(() => {
    const { w: srcW, h: srcH } = getSourceDimensions();
    const scale = Math.min(NAV_WIDTH / srcW, NAV_HEIGHT / srcH);
    const drawW = Math.max(1, Math.round(srcW * scale));
    const drawH = Math.max(1, Math.round(srcH * scale));
    const drawX = Math.round((NAV_WIDTH - drawW) / 2);
    const drawY = Math.round((NAV_HEIGHT - drawH) / 2);
    return { drawX, drawY, drawW, drawH, srcW, srcH };
  }, [getSourceDimensions]);

  const getViewport = useCallback(() => {
    const viewSize = Math.max(0.1, Math.min(1, 1 / zoom));
    const halfW = viewSize * 0.5;
    const halfH = viewSize * 0.5;
    const cx = Math.max(halfW, Math.min(1 - halfW, panX));
    const cy = Math.max(halfH, Math.min(1 - halfH, panY));
    return { x: cx - halfW, y: cy - halfH, width: viewSize, height: viewSize };
  }, [zoom, panX, panY]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    ctx.fillStyle = "#04060a";
    ctx.fillRect(0, 0, NAV_WIDTH, NAV_HEIGHT);

    if (!sourceElement || !hasImage) return;

    const { drawX, drawY, drawW, drawH, srcW, srcH } = getDrawRect();

    // Draw source thumbnail
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    try {
      ctx.drawImage(sourceElement, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);
    } catch {
      return;
    }

    // Dim the whole image area
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(drawX, drawY, drawW, drawH);

    // Compute viewport rect
    const view = getViewport();
    const vpX = drawX + Math.round(view.x * drawW);
    const vpY = drawY + Math.round(view.y * drawH);
    const vpW = Math.max(2, Math.round(view.width * drawW));
    const vpH = Math.max(2, Math.round(view.height * drawH));

    // Clear viewport area to show bright source
    ctx.clearRect(vpX, vpY, vpW, vpH);
    ctx.drawImage(sourceElement, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);
    // Re-dim outside viewport by drawing dim over full then clearing viewport
    // Actually: redraw source in viewport area only
    ctx.save();
    ctx.beginPath();
    ctx.rect(vpX, vpY, vpW, vpH);
    ctx.clip();
    ctx.drawImage(sourceElement, 0, 0, srcW, srcH, drawX, drawY, drawW, drawH);
    ctx.restore();

    // Viewport border
    ctx.strokeStyle = "rgba(227, 237, 255, 0.96)";
    ctx.lineWidth = 2;
    ctx.strokeRect(vpX + 0.5, vpY + 0.5, vpW - 1, vpH - 1);
  }, [sourceElement, hasImage, getDrawRect, getViewport]);

  // Redraw on state changes (including thumbnailVersion bump after video seek)
  useEffect(() => {
    draw();
  }, [draw, zoom, panX, panY, thumbnailVersion]);

  // NOTE: No interval redraw for video — we use still frames via thumbnailVersion

  const updatePanFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const { drawX, drawY, drawW, drawH } = getDrawRect();
      const canvasX = ((clientX - bounds.left) / bounds.width) * NAV_WIDTH;
      const canvasY = ((clientY - bounds.top) / bounds.height) * NAV_HEIGHT;
      const nx = (canvasX - drawX) / Math.max(1, drawW);
      const ny = (canvasY - drawY) / Math.max(1, drawH);
      onPanChange(
        Math.max(0, Math.min(1, nx)),
        Math.max(0, Math.min(1, ny))
      );
    },
    [getDrawRect, onPanChange]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!hasImage) return;
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      updatePanFromEvent(e.clientX, e.clientY);
    },
    [hasImage, updatePanFromEvent]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      updatePanFromEvent(e.clientX, e.clientY);
    },
    [updatePanFromEvent]
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Navigator</span>
        <span className="text-[12px] font-mono text-muted-foreground">{Math.round(zoom * (fitScale > 0 ? fitScale : 1) * 100)}%</span>
      </div>
      <canvas
        ref={canvasRef}
        width={NAV_WIDTH}
        height={NAV_HEIGHT}
        className="w-full rounded border border-border cursor-crosshair"
        style={{ opacity: hasImage ? 1 : 0.5, imageRendering: "auto" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
};

export default PreviewNavigator;
