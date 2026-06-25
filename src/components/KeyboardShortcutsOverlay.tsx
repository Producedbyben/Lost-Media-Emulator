import { useState, useEffect } from "react";
import { X } from "lucide-react";

const SHORTCUTS = [
  { keys: "Ctrl + Z", action: "Undo" },
  { keys: "Ctrl + Shift + Z", action: "Redo" },
  { keys: "Ctrl + K", action: "Command palette" },
  { keys: "Ctrl + I", action: "Import source" },
  { keys: "B", action: "Toggle bypass (all effects off/on)" },
  { keys: "R", action: "Randomize preset (undoable)" },
  { keys: "Space (hold)", action: "Compare original" },
  { keys: "Ctrl + V", action: "Paste image from clipboard" },
  { keys: "Scroll wheel", action: "Zoom preview" },
  { keys: "Double-click canvas", action: "Toggle Fit / 2× zoom" },
  { keys: "Click + drag", action: "Pan (when zoomed)" },
  { keys: "Scroll on slider", action: "Adjust value (Shift = coarse)" },
  { keys: "Click slider value", action: "Type an exact number" },
  { keys: "Shift + Arrow", action: "Coarse slider step (focused)" },
  { keys: "Double-click slider", action: "Reset to default" },
  { keys: "?", action: "Toggle this overlay" },
];

const KeyboardShortcutsOverlay = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isTyping = (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement);
      if (isTyping) return;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Expose open function for external trigger
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("shortcuts:open", handler);
    return () => window.removeEventListener("shortcuts:open", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="bg-card border border-border rounded-xl shadow-2xl p-6 max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={keys} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
              <span className="text-xs text-muted-foreground">{action}</span>
              <kbd className="px-2 py-0.5 text-[12px] font-mono bg-secondary border border-border rounded text-foreground">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground mt-3 text-center">Press ? or Esc to close</p>
      </div>
    </div>
  );
};

export default KeyboardShortcutsOverlay;
