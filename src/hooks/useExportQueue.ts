import { useCallback, useEffect, useRef, useState } from "react";
import type { CRTParams } from "@/hooks/useCRTRenderer";

export type ExportJobStatus = "queued" | "running" | "done" | "error" | "cancelled";

export interface ExportJobOptions {
  resolution?: number;
  quality?: number;
  aspectRatio?: string;
  includeAudio?: boolean;
  degradeAudio?: boolean;
  // Queued jobs must honour the SAME choices as a one-off export (audit): codec, reframe
  // mode, audio mode and trim window were previously dropped -> every job became H.264/MP4.
  codec?: "h264" | "hevc" | "prores422" | "prores4444";
  frameMode?: string;
  audioMode?: "off" | "original" | "degrade";
  inSec?: number;
  outSec?: number;
}

export interface ExportJob {
  id: string;
  name: string;
  /** Saved filename base (no extension). Falls back to `name` when unset. */
  fileName?: string;
  format: "mp4" | "webm" | "gif";
  fps: number;
  duration: number;
  totalFrames: number;
  options?: ExportJobOptions;
  params: CRTParams;
  status: ExportJobStatus;
  progress: number;
  statusText?: string;
  startedAt?: number;
  finishedAt?: number;
  msPerFrame?: number;
  error?: string;
}

export type NewExportJob = Omit<ExportJob, "id" | "status" | "progress" | "totalFrames"> & { totalFrames?: number };

type RunJob = (
  job: Pick<ExportJob, "format" | "fps" | "duration" | "params" | "options">,
  onProgress: (ratio: number, frame: number, total: number, status?: string) => void,
  signal: AbortSignal,
) => Promise<unknown>;

const DEFAULT_MS_PER_FRAME = 45;

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useExportQueue(runExportJob: RunJob, isExporting: boolean) {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const runningIdRef = useRef<string | null>(null);
  const processingRef = useRef(false);

  const enqueue = useCallback((job: NewExportJob) => {
    const totalFrames = job.totalFrames ?? Math.max(1, Math.floor(job.fps * job.duration));
    setJobs((prev) => [
      ...prev,
      { ...job, id: uid(), status: "queued", progress: 0, totalFrames },
    ]);
  }, []);

  const removeJob = useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id || j.status === "running"));
  }, []);

  const cancelJob = useCallback((id: string) => {
    if (runningIdRef.current === id) {
      controllerRef.current?.abort();
    } else {
      setJobs((prev) => prev.filter((j) => j.id !== id));
    }
  }, []);

  const cancelAll = useCallback(() => {
    controllerRef.current?.abort();
    setJobs((prev) => prev.filter((j) => j.status === "running"));
  }, []);

  const clearFinished = useCallback(() => {
    setJobs((prev) => prev.filter((j) => j.status === "queued" || j.status === "running"));
  }, []);

  // Sequential processor — picks the next queued job whenever idle.
  useEffect(() => {
    if (processingRef.current || isExporting) return;
    const next = jobs.find((j) => j.status === "queued");
    if (!next) return;

    processingRef.current = true;
    runningIdRef.current = next.id;
    const controller = new AbortController();
    controllerRef.current = controller;
    const startedAt = performance.now();

    setJobs((prev) => prev.map((j) => (j.id === next.id ? { ...j, status: "running", startedAt, progress: 0 } : j)));

    runExportJob(
      next,
      (ratio, frame, _total, statusText) => {
        const msPerFrame = frame > 0 ? (performance.now() - startedAt) / frame : undefined;
        setJobs((prev) => prev.map((j) => (j.id === next.id ? { ...j, progress: ratio, statusText, ...(msPerFrame ? { msPerFrame } : {}) } : j)));
      },
      controller.signal,
    )
      .then(() => {
        setJobs((prev) => prev.map((j) => (j.id === next.id ? { ...j, status: "done", progress: 1, statusText: undefined, finishedAt: performance.now() } : j)));
      })
      .catch((err: any) => {
        const cancelled = err?.name === "AbortError";
        setJobs((prev) => prev.map((j) => (j.id === next.id
          ? { ...j, status: cancelled ? "cancelled" : "error", error: cancelled ? undefined : (err?.message || String(err)), finishedAt: performance.now() }
          : j)));
      })
      .finally(() => {
        processingRef.current = false;
        runningIdRef.current = null;
        controllerRef.current = null;
      });
  }, [jobs, isExporting, runExportJob]);

  // Derived metrics
  const runningJob = jobs.find((j) => j.status === "running") || null;
  const queuedCount = jobs.filter((j) => j.status === "queued").length;
  const activeCount = jobs.filter((j) => j.status === "queued" || j.status === "running").length;

  // Estimate ms/frame from the running job, falling back to the last completed job.
  const referenceMsPerFrame =
    runningJob?.msPerFrame ||
    [...jobs].reverse().find((j) => j.status === "done" && j.msPerFrame)?.msPerFrame ||
    DEFAULT_MS_PER_FRAME;

  let etaMs = 0;
  if (runningJob) {
    const remaining = Math.max(0, runningJob.totalFrames * (1 - runningJob.progress));
    etaMs += remaining * (runningJob.msPerFrame || referenceMsPerFrame);
  }
  for (const j of jobs) {
    if (j.status === "queued") etaMs += j.totalFrames * referenceMsPerFrame;
  }

  return {
    jobs,
    enqueue,
    removeJob,
    cancelJob,
    cancelAll,
    clearFinished,
    runningJob,
    queuedCount,
    activeCount,
    etaMs,
    isProcessing: activeCount > 0,
  };
}
