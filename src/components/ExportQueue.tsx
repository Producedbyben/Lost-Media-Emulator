import { ListVideo, X, Trash2, Loader2, CheckCircle2, AlertCircle, Clock, Ban } from "lucide-react";
import type { ExportJob } from "@/hooks/useExportQueue";

interface ExportQueueProps {
  jobs: ExportJob[];
  etaMs: number;
  activeCount: number;
  onCancelJob: (id: string) => void;
  onCancelAll: () => void;
  onClearFinished: () => void;
}

function formatDuration(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return "0s";
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const STATUS_META: Record<ExportJob["status"], { icon: JSX.Element; label: string; cls: string }> = {
  queued: { icon: <Clock className="w-3 h-3" />, label: "Queued", cls: "text-muted-foreground" },
  running: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: "Rendering", cls: "text-primary" },
  done: { icon: <CheckCircle2 className="w-3 h-3" />, label: "Done", cls: "text-green-500" },
  error: { icon: <AlertCircle className="w-3 h-3" />, label: "Failed", cls: "text-destructive" },
  cancelled: { icon: <Ban className="w-3 h-3" />, label: "Cancelled", cls: "text-muted-foreground" },
};

const ExportQueue = ({ jobs, etaMs, activeCount, onCancelJob, onCancelAll, onClearFinished }: ExportQueueProps) => {
  if (jobs.length === 0) return null;
  const hasFinished = jobs.some((j) => j.status === "done" || j.status === "error" || j.status === "cancelled");

  return (
    <div className="border-t border-border pt-3 mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <ListVideo className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Export queue</span>
          <span className="text-[11px] font-mono text-muted-foreground">({jobs.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <span className="text-[12px] font-mono text-primary flex items-center gap-1" title="Estimated time remaining">
              <Clock className="w-3 h-3" /> ETA {formatDuration(etaMs)}
            </span>
          )}
          {hasFinished && (
            <button onClick={onClearFinished} title="Clear finished jobs"
              className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {activeCount > 0 && (
            <button onClick={onCancelAll} title="Cancel all pending"
              className="text-[12px] px-1.5 py-0.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors">
              Stop all
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
        {jobs.map((job) => {
          const meta = STATUS_META[job.status];
          const pct = Math.round(job.progress * 100);
          const canCancel = job.status === "queued" || job.status === "running";
          return (
            <div key={job.id} className="rounded-md border border-border bg-secondary/40 px-2 py-1.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={meta.cls}>{meta.icon}</span>
                  <span className="text-[12px] text-foreground truncate">{job.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-mono uppercase px-1 py-0.5 rounded bg-background/60 text-muted-foreground">
                    {job.format}
                  </span>
                  <button
                    onClick={() => (canCancel ? onCancelJob(job.id) : onCancelJob(job.id))}
                    title={canCancel ? "Cancel job" : "Remove from list"}
                    className="p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>{job.fps}fps · {job.duration}s · {job.totalFrames.toLocaleString()}f{job.options?.aspectRatio ? ` · ${job.options.aspectRatio}` : ""}</span>
                <span className={meta.cls}>
                  {job.status === "running" ? `${pct}%` : job.status === "error" ? "error" : meta.label}
                </span>
              </div>

              {(job.status === "running" || job.status === "queued") && (
                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${pct}%` }} />
                </div>
              )}
              {job.status === "running" && job.statusText && (
                <p className="text-[11px] text-muted-foreground italic truncate">{job.statusText}</p>
              )}
              {job.status === "error" && job.error && (
                <p className="text-[11px] text-destructive truncate" title={job.error}>{job.error}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ExportQueue;
