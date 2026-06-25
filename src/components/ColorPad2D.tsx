import { useRef, useCallback, useState } from "react";

interface ColorPad2DProps {
  /** X-axis value: temperature (-1 to 1) */
  tempValue: number;
  /** Y-axis value: tint (-1 to 1) */
  tintValue: number;
  onTempChange: (v: number) => void;
  onTintChange: (v: number) => void;
}

const ColorPad2D = ({ tempValue, tintValue, onTempChange, onTintChange }: ColorPad2DProps) => {
  const padRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    // X: -1 (cool) to +1 (warm), Y: +1 (green/top) to -1 (magenta/bottom)
    const temp = (nx - 0.5) * 2;
    const tint = (0.5 - ny) * 2;
    onTempChange(Math.round(temp * 100) / 100);
    onTintChange(Math.round(tint * 100) / 100);
  }, [onTempChange, onTintChange]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  }, [updateFromPointer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    updateFromPointer(e.clientX, e.clientY);
  }, [isDragging, updateFromPointer]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    onTempChange(0);
    onTintChange(0);
  }, [onTempChange, onTintChange]);

  // Position: temp on X, tint on Y
  const dotX = ((tempValue + 1) / 2) * 100;
  const dotY = ((1 - (tintValue + 1) / 2)) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">Temperature / Tint</span>
        <span className="text-[12px] font-mono text-muted-foreground">
          {tempValue.toFixed(2)} / {tintValue.toFixed(2)}
        </span>
      </div>
      <div
        ref={padRef}
        className="relative w-full h-24 rounded-md border border-border cursor-crosshair overflow-hidden select-none"
        style={{
          background: `linear-gradient(to bottom, hsl(120 40% 40% / 0.3), transparent 50%, hsl(300 40% 40% / 0.3)),
                       linear-gradient(to right, hsl(210 60% 50% / 0.3), transparent 50%, hsl(30 70% 50% / 0.3))`,
          backgroundColor: "hsl(var(--surface-1))",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        title="Drag to adjust · Double-click to reset"
      >
        {/* Crosshair lines */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/50 pointer-events-none" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-border/50 pointer-events-none" />
        {/* Labels */}
        <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 pointer-events-none">Cool</span>
        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/60 pointer-events-none">Warm</span>
        <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/60 pointer-events-none">Green</span>
        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/60 pointer-events-none">Magenta</span>
        {/* Indicator dot */}
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-primary bg-primary/30 shadow-md pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75"
          style={{ left: `${dotX}%`, top: `${dotY}%` }}
        />
      </div>
    </div>
  );
};

export default ColorPad2D;
