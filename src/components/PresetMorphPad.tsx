import { useRef, useState, useCallback, useMemo } from "react";
// @ts-ignore
import { PRESETS } from "@/lib/presets.js";
import { CRTParams, DEFAULT_PARAMS } from "@/hooks/useCRTRenderer";

interface PresetMorphPadProps {
  onParamsChange: (params: CRTParams) => void;
  currentParams: CRTParams;
}

const CORNER_PRESETS = [
  { position: "tl", defaultPreset: "Consumer TV" },
  { position: "tr", defaultPreset: "Late-80s Home VHS" },
  { position: "bl", defaultPreset: "Security Camera Dump" },
  { position: "br", defaultPreset: "Super 8 Home Reel 1970s" },
];

const PresetMorphPad = ({ onParamsChange, currentParams }: PresetMorphPadProps) => {
  const padRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5 });
  const [corners, setCorners] = useState(CORNER_PRESETS.map(c => c.defaultPreset));

  const presetNames = useMemo(() => Object.keys(PRESETS), []);

  const blendPresets = useCallback((x: number, y: number) => {
    // Bilinear interpolation between 4 corner presets
    const tl = PRESETS[corners[0]] || {};
    const tr = PRESETS[corners[1]] || {};
    const bl = PRESETS[corners[2]] || {};
    const br = PRESETS[corners[3]] || {};

    const result: Record<string, number> = {};
    
    // Get all numeric keys from all presets
    const allKeys = new Set<string>();
    [tl, tr, bl, br].forEach(p => Object.keys(p).forEach(k => {
      if (typeof p[k] === "number") allKeys.add(k);
    }));

    for (const key of allKeys) {
      const vtl = typeof tl[key] === "number" ? tl[key] : (DEFAULT_PARAMS as any)[key] ?? 0;
      const vtr = typeof tr[key] === "number" ? tr[key] : (DEFAULT_PARAMS as any)[key] ?? 0;
      const vbl = typeof bl[key] === "number" ? bl[key] : (DEFAULT_PARAMS as any)[key] ?? 0;
      const vbr = typeof br[key] === "number" ? br[key] : (DEFAULT_PARAMS as any)[key] ?? 0;

      // Bilinear interpolation
      const top = vtl + (vtr - vtl) * x;
      const bottom = vbl + (vbr - vbl) * x;
      result[key] = top + (bottom - top) * y;
    }

    return result;
  }, [corners]);

  const updateFromPointer = useCallback((clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    setPosition({ x, y });

    const blended = blendPresets(x, y);
    onParamsChange({ ...currentParams, ...blended } as CRTParams);
  }, [blendPresets, onParamsChange, currentParams]);

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

  const handleCornerChange = useCallback((idx: number, preset: string) => {
    const newCorners = [...corners];
    newCorners[idx] = preset;
    setCorners(newCorners);
    // Re-blend with new corners
    const blended = blendPresets(position.x, position.y);
    onParamsChange({ ...currentParams, ...blended } as CRTParams);
  }, [corners, position, blendPresets, onParamsChange, currentParams]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-muted-foreground">Preset Morph Pad</span>
        <span className="text-[11px] font-mono text-muted-foreground">
          {(position.x * 100).toFixed(0)}%, {(position.y * 100).toFixed(0)}%
        </span>
      </div>

      <div className="relative">
        {/* Corner preset selectors */}
        <div className="grid grid-cols-2 gap-1 mb-1">
          {[0, 1].map(idx => (
            <select
              key={idx}
              value={corners[idx]}
              onChange={(e) => handleCornerChange(idx, e.target.value)}
              className="px-1.5 py-0.5 text-[11px] bg-secondary border border-border rounded text-foreground truncate"
            >
              {presetNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          ))}
        </div>

        {/* Morph pad */}
        <div
          ref={padRef}
          className="relative w-full h-32 rounded-lg border border-border cursor-crosshair overflow-hidden"
          style={{
            background: `linear-gradient(to bottom right,
              hsl(var(--primary) / 0.15),
              hsl(var(--accent) / 0.1),
              hsl(var(--warning) / 0.15),
              hsl(var(--destructive) / 0.1))`,
            backgroundColor: "hsl(var(--surface-1))",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Grid lines */}
          <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 pointer-events-none">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="border-r border-b border-border/20" />
            ))}
          </div>

          {/* Corner labels */}
          <span className="absolute top-1 left-1 text-[10px] text-muted-foreground/60 pointer-events-none truncate max-w-[45%]">
            {corners[0].split(" ")[0]}
          </span>
          <span className="absolute top-1 right-1 text-[10px] text-muted-foreground/60 pointer-events-none truncate max-w-[45%] text-right">
            {corners[1].split(" ")[0]}
          </span>
          <span className="absolute bottom-1 left-1 text-[10px] text-muted-foreground/60 pointer-events-none truncate max-w-[45%]">
            {corners[2].split(" ")[0]}
          </span>
          <span className="absolute bottom-1 right-1 text-[10px] text-muted-foreground/60 pointer-events-none truncate max-w-[45%] text-right">
            {corners[3].split(" ")[0]}
          </span>

          {/* Position indicator */}
          <div
            className="absolute w-5 h-5 rounded-full border-2 border-primary bg-primary/30 shadow-lg pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75"
            style={{ left: `${position.x * 100}%`, top: `${position.y * 100}%` }}
          >
            <div className="absolute inset-1 rounded-full bg-primary" />
          </div>
        </div>

        {/* Bottom corner selectors */}
        <div className="grid grid-cols-2 gap-1 mt-1">
          {[2, 3].map(idx => (
            <select
              key={idx}
              value={corners[idx]}
              onChange={(e) => handleCornerChange(idx, e.target.value)}
              className="px-1.5 py-0.5 text-[11px] bg-secondary border border-border rounded text-foreground truncate"
            >
              {presetNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Drag to blend between 4 presets. Change corners using dropdowns.
      </p>
    </div>
  );
};

export default PresetMorphPad;
