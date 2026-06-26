// src/lib/ffmpeg-export.ts
// Renderer-side orchestrator for the native ffmpeg export pipeline. Renders the
// look frame-by-frame to an offscreen canvas, streams each frame as a PNG to the
// main process, then asks ffmpeg to encode the sequence. Desktop-only; callers
// must feature-detect with isFfmpegExportAvailable() and fall back to WebCodecs.
type Renderer = {
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, params: unknown, frame: number, fps: number, renderOptions: unknown) => void;
  setImage: (el: HTMLVideoElement | HTMLImageElement, scale: number) => void;
  reset?: () => void;
};

interface FfmpegBridge {
  available: () => Promise<boolean>;
  begin: (o: { width: number; height: number; fps: number }) => Promise<{ sessionId: string }>;
  frame: (o: { sessionId: string; index: number; bytes: ArrayBuffer }) => Promise<{ ok: boolean }>;
  encode: (o: { sessionId: string; codec: string; outPath: string; audioSourcePath?: string }) => Promise<{ ok: boolean; outPath: string }>;
  cancel: (o: { sessionId: string }) => Promise<void>;
  onProgress: (cb: (d: { sessionId: string; frame: number; totalFrames: number }) => void) => () => void;
}

function bridge(): FfmpegBridge | null {
  const d = (window as unknown as { desktop?: { ffmpeg?: FfmpegBridge } }).desktop;
  return d?.ffmpeg ?? null;
}

export async function isFfmpegExportAvailable(): Promise<boolean> {
  const b = bridge();
  if (!b) return false;
  try { return await b.available(); } catch { return false; }
}

function evenSize(w: number, h: number) {
  const e = (n: number) => (n % 2 ? n + 1 : n);
  return { width: e(Math.max(2, Math.floor(w))), height: e(Math.max(2, Math.floor(h))) };
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("frame encode failed"));
      blob.arrayBuffer().then(resolve, reject);
    }, "image/png");
  });
}

export async function exportViaFfmpeg(opts: {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  params: unknown;
  fps: number;
  duration: number;
  codec: "h264" | "hevc";
  outPath: string;
  audioSourcePath?: string;
  videoElement?: HTMLVideoElement | null;
  sourceScale?: number;
  renderOptions?: unknown;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}): Promise<{ outPath: string }> {
  const b = bridge();
  if (!b) throw new Error("ffmpeg bridge unavailable");

  const { canvas, renderer, params, fps, duration, codec, outPath } = opts;
  const sourceScale = opts.sourceScale ?? 1;
  const isVideoSource = opts.videoElement instanceof HTMLVideoElement;
  const { width, height } = evenSize(canvas.width, canvas.height);
  const totalFrames = Math.max(1, Math.floor(fps * duration));

  const work = document.createElement("canvas");
  work.width = width; work.height = height;
  const ctx = work.getContext("2d", { alpha: false })!;

  const { sessionId } = await b.begin({ width, height, fps });
  const unsub = b.onProgress((d) => {
    if (d.sessionId === sessionId && opts.onProgress) opts.onProgress(d.frame / totalFrames);
  });

  try {
    renderer.reset?.();
    for (let frame = 0; frame < totalFrames; frame++) {
      if (opts.signal?.aborted) throw new DOMException("aborted", "AbortError");
      const t = frame / fps;
      if (isVideoSource && opts.videoElement) {
        const seekTime = Math.min(t, (opts.videoElement.duration || duration) - 0.001);
        await seekVideo(opts.videoElement, seekTime);
        renderer.setImage(opts.videoElement, sourceScale);
      }
      renderer.render(ctx, width, height, t, params, frame, fps, opts.renderOptions);
      const bytes = await canvasToPng(work);
      await b.frame({ sessionId, index: frame, bytes });
      opts.onProgress?.((frame + 1) / totalFrames * 0.9); // reserve last 10% for encode
    }
    const res = await b.encode({ sessionId, codec, outPath, audioSourcePath: opts.audioSourcePath });
    opts.onProgress?.(1);
    return { outPath: res.outPath };
  } catch (err) {
    await b.cancel({ sessionId }).catch(() => {});
    throw err;
  } finally {
    unsub();
  }
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - time) < 0.0005 && video.readyState >= 2) return resolve();
    const done = () => { video.removeEventListener("seeked", done); resolve(); };
    video.addEventListener("seeked", done);
    const watchdog = setTimeout(done, 500);
    video.currentTime = time;
    void watchdog;
  });
}
