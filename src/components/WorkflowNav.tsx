import { Layers, Palette, Grid3X3, Tv, Cpu, Film, MessageSquare, Monitor, Rewind, Camera, MonitorPlay } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface WorkflowNavProps {
  onJump: (panelId: string) => void;
  panelStates?: Record<string, boolean>;
}

type Shortcut = { id: string; label: string; icon: LucideIcon };

// Quick-jumps grouped to mirror the signal chain: the captured source, then the
// display it's shown on. `presets` and `preview` are workflow anchors.
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
    label: "Display", icon: MonitorPlay, items: [
      { id: "display", label: "Display", icon: Tv },
      { id: "masks", label: "Masks", icon: Grid3X3 },
      { id: "preview", label: "Preview", icon: Monitor },
    ],
  },
];

const WorkflowNav = ({ onJump, panelStates }: WorkflowNavProps) => {
  return (
    <div className="space-y-1.5">
      {GROUPS.map((group) => {
        const GroupIcon = group.icon;
        return (
          <div key={group.label} className="flex flex-wrap items-center gap-1">
            <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-primary/70 pr-1">
              <GroupIcon className="w-3 h-3" />
              {group.label}
            </span>
            {group.items.map((s) => {
              const isEnabled = panelStates ? panelStates[s.id] !== false : true;
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => onJump(s.id)}
                  className={`flex items-center gap-1 px-2 py-0.5 text-[12px] font-semibold uppercase tracking-wide rounded border transition-colors ${
                    isEnabled
                      ? "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                      : "bg-secondary/50 border-border/50 text-muted-foreground/40 hover:text-muted-foreground hover:border-border"
                  }`}
                  title={`Jump to ${s.label}${!isEnabled ? " (disabled)" : ""}`}
                >
                  <Icon className={`w-3 h-3 ${isEnabled ? "opacity-80" : "opacity-30"}`} />
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
