// src/lib/ffmpeg-export.ts
// Renderer-side orchestrator for the native ffmpeg export pipeline. Renders the
// look frame-by-frame to an offscreen canvas, streams each frame as a PNG to the
// main process, then asks ffmpeg to encode the sequence. Desktop-only; callers
// must feature-detect with isFfmpegExportAvailable() and fall back to WebCodecs.
import { computeContentRect } from "./export-size";
type Renderer = {
  render: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, params: unknown, frame: number, fps: number, renderOptions: unknown) => void;
  setImage: (el: HTMLVideoElement | HTMLImageElement, scale: number) => void;
  reset?: () => void;
};

interface FfmpegBridge {
  available: () => Promise<boolean>;
  begin: (o: { width: number; height: number; fps: number }) => Promise<{ sessionId: string }>;
  frame: (o: { sessionId: string; index: number; bytes: ArrayBuffer }) => Promise<{ ok: boolean }>;
  encode: (o: { sessionId: string; codec: string; outPath: string; audioSourcePath?: string; inSec?: number; outSec?: number }) => Promise<{ ok: boolean; outPath: string }>;
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
  codec: "h264" | "hevc" | "prores422" | "prores4444";
  outPath: string;
  audioSourcePath?: string;
  // Trim window in source seconds. When set, only [inSec, outSec) is rendered
  // (frame t = inSec + frame/fps) and the muxed audio is trimmed to match.
  // Default behaviour (omitted) renders [0, duration) exactly as before.
  inSec?: number;
  outSec?: number;
  videoElement?: HTMLVideoElement | null;
  sourceScale?: number;
  // Target export dimensions (from computeExportSize). When omitted we fall back
  // to the preview canvas size for back-compat — but callers SHOULD pass these so
  // the export renders at the source/selected resolution, not the preview size.
  targetWidth?: number;
  targetHeight?: number;
  // Letterbox / pillarbox pad the source into the target box (black bars). Any
  // other value (crop / none / undefined) lets the renderer cover-crop to fill.
  frameMode?: string;
  renderOptions?: unknown;
  onProgress?: (ratio: number) => void;
  signal?: AbortSignal;
}): Promise<{ outPath: string }> {
  const b = bridge();
  if (!b) throw new Error("ffmpeg bridge unavailable");

  const { canvas, renderer, params, fps, duration, codec, outPath } = opts;
  // Force full-resolution source during export — a preview proxy (sourceScale < 1)
  // must never shrink the exported pixels.
  const sourceScale = 1;
  const isVideoSource = opts.videoElement instanceof HTMLVideoElement;
  // Render at the explicit export target when given; otherwise the legacy
  // preview-canvas size (kept only so older callers don't break).
  const { width, height } = (opts.targetWidth && opts.targetHeight)
    ? evenSize(opts.targetWidth, opts.targetHeight)
    : evenSize(canvas.width, canvas.height);
  // Padded reframe (letterbox / pillarbox): render the look into a contained
  // content rect, then composite it centered onto a black target frame.
  const padded = opts.frameMode === "letterbox" || opts.frameMode === "pillarbox";
  const content = padded
    ? computeContentRect({
        sourceW: isVideoSource ? opts.videoElement!.videoWidth : width,
        sourceH: isVideoSource ? opts.videoElement!.videoHeight : height,
        targetW: width, targetH: height,
      })
    : null;

  // Trim window in source seconds. When in/out aren't given, render [0, duration)
  // exactly as before; otherwise render [inSec, outSec) and trim the audio mux
  // to match. `trimmed` gates whether in/out are forwarded to the encode (so a
  // full export keeps byte-identical ffmpeg args).
  const trimmed = opts.inSec != null || opts.outSec != null;
  const inSec = Math.max(0, opts.inSec ?? 0);
  const outSec = Math.max(inSec + 1 / fps, opts.outSec ?? inSec + duration);
  const windowDuration = outSec - inSec;
  const totalFrames = Math.max(1, Math.floor(fps * windowDuration));

  const work = document.createElement("canvas");
  work.width = width; work.height = height;
  const ctx = work.getContext("2d", { alpha: false })!;

  // For padded reframes the look is rendered into this content canvas first, then
  // blitted onto the (black) work frame, leaving the letterbox/pillarbox bars.
  const contentCanvas = content ? document.createElement("canvas") : null;
  if (contentCanvas && content) { contentCanvas.width = content.width; contentCanvas.height = content.height; }
  const contentCtx = contentCanvas ? contentCanvas.getContext("2d", { alpha: false })! : null;

  const { sessionId } = await b.begin({ width, height, fps });
  const unsub = b.onProgress((d) => {
    // Encode phase reports its OWN frame counter from 0; map it into the reserved last
    // 10% so the bar advances 90% -> 100% instead of snapping back to 0% (audit).
    if (d.sessionId === sessionId && opts.onProgress) {
      opts.onProgress(0.9 + Math.min(1, d.frame / Math.max(1, totalFrames)) * 0.1);
    }
  });

  try {
    renderer.reset?.();
    for (let frame = 0; frame < totalFrames; frame++) {
      if (opts.signal?.aborted) throw new DOMException("aborted", "AbortError");
      const t = inSec + frame / fps;
      if (isVideoSource && opts.videoElement) {
        const seekTime = Math.min(t, (opts.videoElement.duration || duration) - 0.001);
        await seekVideo(opts.videoElement, seekTime);
        renderer.setImage(opts.videoElement, sourceScale);
      }
      if (content && contentCtx) {
        // Pad mode: render the look into the content rect (its own aspect → no
        // crop), then composite centered onto a black target frame.
        renderer.render(contentCtx, content.width, content.height, t, params, frame, fps, opts.renderOptions);
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(contentCanvas!, content.x, content.y);
      } else {
        // Cover mode: renderer fills the target frame (crop-to-fill / original).
        renderer.render(ctx, width, height, t, params, frame, fps, opts.renderOptions);
      }
      const bytes = await canvasToPng(work);
      await b.frame({ sessionId, index: frame, bytes });
      opts.onProgress?.((frame + 1) / totalFrames * 0.9); // reserve last 10% for encode
    }
    const res = await b.encode({
      sessionId, codec, outPath, audioSourcePath: opts.audioSourcePath,
      ...(trimmed ? { inSec, outSec } : {}),
    });
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
