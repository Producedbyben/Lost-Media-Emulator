import { Layers, Palette, Grid3X3, Tv, Cpu, Film, MessageSquare, Monitor, Rewind, Camera, MonitorPlay } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface WorkflowNavProps {
  onJump: (panelId: string) => void;
  panelStates?: Record<string, boolean>;
}

type Shortcut = { id: string; label: string; icon: LucideIcon };

// Quick-jumps grouped to mirror the signal chain: the captured source, then the
// display it's shown on. `presets` and `preview` are workflow anchors that are
// always "on" — they have no standby state.
const GROUPS: { label: string; icon: LucideIcon; items: Shortcut[] }[] = [
  {
    label: "Capture", icon: Camera, items: [
      { id: "presets", label: "Presets", icon: Layers },
      { id: "grading", label: "Color", icon: Palette },
      { id: "tape", label: "Tape", icon: Rewind },
      { id: "film", label: "Film", icon: Film },
      { id: "digital", label: "Digital", icon: Cpu },
      { id: "osd", label: "OSD", icon: MessageSquare },
    ],
  },
  {
    label: "Output", icon: MonitorPlay, items: [
      { id: "display", label: "Display", icon: Tv },
      { id: "masks", label: "Masks", icon: Grid3X3 },
      { id: "preview", label: "Preview", icon: Monitor },
    ],
  },
];

// Anchors that are always available — no on/standby LED, just a jump.
const ANCHORS = new Set(["presets", "preview"]);

const WorkflowNav = ({ onJump, panelStates }: WorkflowNavProps) => {
  return (
    <div className="flex items-center gap-1 flex-wrap min-w-0">
      {GROUPS.map((group, gi) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.label} className="flex items-center gap-1">
            {gi > 0 && <div className="w-px h-4 bg-border mx-1 self-center" />}
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/60 pr-0.5 select-none">
              <GroupIcon className="w-3 h-3" />
              <span className="hidden xl:inline">{group.label}</span>
            </span>
            {group.items.map((s) => {
              const isAnchor = ANCHORS.has(s.id);
              const isOn = isAnchor || (panelStates ? panelStates[s.id] !== false : true);
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => onJump(s.id)}
                  className="group flex items-center gap-1.5 pl-1.5 pr-2 py-1 text-[11px] font-semibold uppercase tracking-wide rounded border border-border bg-secondary/60 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-secondary transition-colors"
                  title={isAnchor ? `Jump to ${s.label}` : `Jump to ${s.label} — ${isOn ? "active" : "standby (click to edit)"}`}
                >
                  {isAnchor ? (
                    <Icon className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                  ) : (
                    <span className={`led ${isOn ? "led-on" : "led-off"}`} aria-hidden />
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowNav;
