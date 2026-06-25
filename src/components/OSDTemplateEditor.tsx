import { useState, useRef, useCallback, useEffect } from "react";
import { Move, Type, Trash2, Plus, RotateCcw } from "lucide-react";
import { OSDOptions, DEFAULT_OSD_OPTIONS } from "./OSDControls";

interface OSDElement {
  id: string;
  text: string;
  x: number; // 0-100%
  y: number; // 0-100%
  fontSize: number;
  color: string;
}

interface OSDTemplateEditorProps {
  options: OSDOptions;
  onChange: (options: OSDOptions) => void;
  previewWidth: number;
  previewHeight: number;
}

const DEFAULT_ELEMENTS: OSDElement[] = [
  { id: "date", text: "{datetime}", x: 5, y: 92, fontSize: 14, color: "#ffa84a" },
  { id: "cam", text: "CAM2", x: 5, y: 5, fontSize: 14, color: "#ffa84a" },
  { id: "rec", text: "●REC", x: 90, y: 5, fontSize: 12, color: "#ff3a3a" },
];

const OSDTemplateEditor = ({ options, onChange, previewWidth, previewHeight }: OSDTemplateEditorProps) => {
  const [elements, setElements] = useState<OSDElement[]>(DEFAULT_ELEMENTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [showAddNew, setShowAddNew] = useState(false);
  const [newText, setNewText] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedElement = elements.find(e => e.id === selectedId);

  const updateElement = useCallback((id: string, partial: Partial<OSDElement>) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...partial } : e));
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    setDragging(id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    updateElement(dragging, {
      x: Math.max(0, Math.min(95, x)),
      y: Math.max(0, Math.min(95, y)),
    });
  }, [dragging, updateElement]);

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  const addElement = useCallback(() => {
    if (!newText.trim()) return;
    const id = `custom-${Date.now()}`;
    setElements(prev => [...prev, {
      id,
      text: newText.trim(),
      x: 50,
      y: 50,
      fontSize: 14,
      color: options.osdPrimaryColor,
    }]);
    setNewText("");
    setShowAddNew(false);
    setSelectedId(id);
  }, [newText, options.osdPrimaryColor]);

  const removeElement = useCallback((id: string) => {
    setElements(prev => prev.filter(e => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const resetToDefaults = useCallback(() => {
    setElements(DEFAULT_ELEMENTS);
    setSelectedId(null);
  }, []);

  // Sync to OSD corner config
  useEffect(() => {
    const cornerConfig: Record<string, { enabled: boolean; text: string }> = {};
    
    elements.forEach(el => {
      // Map position to corner
      let corner = "";
      if (el.y < 33) {
        corner = el.x < 50 ? "topLeft" : "topRight";
      } else if (el.y > 66) {
        corner = el.x < 50 ? "bottomLeft" : "bottomRight";
      } else {
        corner = el.x < 50 ? "bottomLeft" : "bottomRight";
      }
      
      if (!cornerConfig[corner] || el.text.length > (cornerConfig[corner]?.text?.length || 0)) {
        cornerConfig[corner] = { enabled: true, text: el.text };
      }
    });

    // Fill missing corners
    ["topLeft", "topCenter", "topRight", "bottomLeft", "bottomCenter", "bottomRight"].forEach(c => {
      if (!cornerConfig[c]) {
        cornerConfig[c] = options.osdCornerConfig[c] || { enabled: false, text: "" };
      }
    });

    onChange({ ...options, osdCornerConfig: cornerConfig });
  }, [elements]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">OSD Template Editor</span>
        <div className="flex-1" />
        <button
          onClick={resetToDefaults}
          className="p-1 rounded hover:bg-secondary transition-colors"
          title="Reset to defaults"
        >
          <RotateCcw className="w-3 h-3 text-muted-foreground" />
        </button>
        <button
          onClick={() => setShowAddNew(!showAddNew)}
          className="flex items-center gap-1 px-2 py-0.5 text-[12px] bg-primary/15 text-primary rounded hover:bg-primary/25 transition-colors"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>

      {showAddNew && (
        <div className="flex gap-1">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Text or {date}, {time}..."
            className="flex-1 px-2 py-1 text-[12px] bg-secondary border border-border rounded text-foreground"
            onKeyDown={(e) => e.key === "Enter" && addElement()}
          />
          <button
            onClick={addElement}
            className="px-2 py-1 text-[12px] bg-primary text-primary-foreground rounded"
          >
            Add
          </button>
        </div>
      )}

      {/* Visual preview area */}
      <div
        ref={containerRef}
        className="relative w-full bg-black/80 rounded-lg border border-border overflow-hidden select-none"
        style={{ aspectRatio: `${previewWidth || 16} / ${previewHeight || 9}` }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => setSelectedId(null)}
      >
        {/* Grid overlay */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-20">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="border border-dashed border-white/30" />
          ))}
        </div>

        {/* OSD Elements */}
        {elements.map(el => (
          <div
            key={el.id}
            className={`absolute cursor-move transition-shadow ${
              selectedId === el.id ? "ring-2 ring-primary" : ""
            }`}
            style={{
              left: `${el.x}%`,
              top: `${el.y}%`,
              fontSize: `${el.fontSize}px`,
              color: el.color,
              fontFamily: "monospace",
              textShadow: "0 0 4px currentColor",
            }}
            onPointerDown={(e) => handlePointerDown(e, el.id)}
          >
            <Move className="absolute -top-3 -left-3 w-3 h-3 text-primary opacity-50" />
            {el.text}
          </div>
        ))}

        {/* Safe area indicators */}
        <div className="absolute inset-[5%] border border-dashed border-white/10 pointer-events-none" />
      </div>

      {/* Element properties */}
      {selectedElement && (
        <div className="p-2 bg-secondary/50 rounded border border-border space-y-2">
          <div className="flex items-center gap-2">
            <Type className="w-3 h-3 text-muted-foreground" />
            <span className="text-[12px] font-medium text-foreground flex-1">Edit: {selectedElement.id}</span>
            <button
              onClick={() => removeElement(selectedElement.id)}
              className="p-0.5 hover:bg-destructive/20 rounded"
            >
              <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
            </button>
          </div>

          <input
            type="text"
            value={selectedElement.text}
            onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
            className="w-full px-2 py-1 text-[12px] bg-secondary border border-border rounded text-foreground font-mono"
          />

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Size:
              <input
                type="number"
                value={selectedElement.fontSize}
                min={8}
                max={48}
                onChange={(e) => updateElement(selectedElement.id, { fontSize: Number(e.target.value) })}
                className="w-12 px-1 py-0.5 bg-secondary border border-border rounded text-foreground font-mono"
              />
            </label>
            <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Color:
              <input
                type="color"
                value={selectedElement.color}
                onChange={(e) => updateElement(selectedElement.id, { color: e.target.value })}
                className="w-6 h-6 rounded border border-border cursor-pointer"
              />
            </label>
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Drag elements to position. Use {"{date}"}, {"{time}"}, {"{datetime}"}, {"{tc}"} for dynamic text.
      </p>
    </div>
  );
};

export default OSDTemplateEditor;
