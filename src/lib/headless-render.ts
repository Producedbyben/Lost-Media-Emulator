// Headless render API for automated asset creation (Claude Code / CLI driver). Attached to
// `window.lmeHeadless` at boot so a headless Electron driver can render LME looks without the GUI.
// Uses the authoritative CPU renderer (CRTRendererFull) — the same pipeline exports force — so the
// output is byte-identical to an export and deterministic, and it needs no GPU/display.
//
// Driven by electron/lme-render.cjs. See docs/superpowers/specs/2026-06-28-lme-headless-render-design.md.
// @ts-ignore — plain-JS engine modules
import { CRTRendererFull } from "./crt-renderer-full.js";
// @ts-ignore
import { PRESETS } from "./presets.js";
// @ts-ignore
import { getFormatProfile } from "./format-profiles.js";
import { buildHeadlessRenderOptions, computeSourceView, type SourceView } from "./headless-render-options";
import { DEFAULT_PARAMS } from "@/hooks/useCRTRenderer";

type Params = Record<string, number | string>;
type LookInput = string | { name?: string; params?: Params } | Params;

interface StillOpts {
  input: string;            // image data URL
  look?: LookInput;         // preset name | look JSON | raw params (default = clean defaults)
  width?: number;
  height?: number;
  frameIndex?: number;      // which frame of the temporal effects (default 0)
  fps?: number;
  formatPipeline?: boolean; // apply the NTSC/PAL/resolution format profile (default true)
  anchor?: { x: number; y: number }; // subject focus (source fractions) for aspect-conversion crops (B10)
  view?: SourceView;        // explicit crop window (source fractions) — wins over anchor
}
interface VideoOpts extends StillOpts {
  durationSec?: number;
  codec?: string;           // h264 | hevc | prores
  outPath: string;
}

// Resolve a look to { name, params } merged over the defaults. Accepts a preset name, a JSON
// string, an exported look object ({name?, params}), or a bare params object.
function resolveLook(look: LookInput | undefined): { name: string; params: Params } {
  if (look == null) return { name: "Custom", params: { ...DEFAULT_PARAMS } };
  if (typeof look === "string") {
    const preset = (PRESETS as Record<string, unknown>)[look] as { params?: Params } | Params | undefined;
    if (preset) {
      const params = (preset as { params?: Params }).params ?? (preset as Params);
      return { name: look, params: { ...DEFAULT_PARAMS, ...params } };
    }
    try { return resolveLook(JSON.parse(look)); } catch { /* not JSON, fall through */ }
    return { name: look, params: { ...DEFAULT_PARAMS } };
  }
  const obj = look as { name?: string; params?: Params };
  if (obj.params && typeof obj.params === "object") {
    return { name: obj.name || "Custom", params: { ...DEFAULT_PARAMS, ...obj.params } };
  }
  return { name: obj.name || "Custom", params: { ...DEFAULT_PARAMS, ...(look as Params) } };
}

function loadImage(dataURL: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("headless-render: failed to decode input image"));
    img.src = dataURL;
  });
}

// Resolve the caller's framing control (B10): an explicit view wins; otherwise an anchor
// becomes a target-aspect window via computeSourceView; otherwise null = engine default
// (centre-crop), exactly the old behaviour.
function resolveSourceView(opts: StillOpts, img: HTMLImageElement, width: number, height: number): SourceView | null {
  if (opts.view) return opts.view;
  if (opts.anchor) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    return computeSourceView(iw, ih, width, height, opts.anchor.x, opts.anchor.y);
  }
  return null;
}

async function renderFrame(
  img: HTMLImageElement, name: string, params: Params, width: number, height: number,
  frameIndex: number, fps: number, formatPipeline: boolean, ctx: CanvasRenderingContext2D,
  sourceView: SourceView | null = null,
  renderer: InstanceType<typeof CRTRendererFull> = new CRTRendererFull(),
): Promise<void> {
  // Reuse the same renderer instance across a video's frames (caller passes one in) so
  // inter-frame feedback buffers (datamosh accumulator, e-ink refresh-ghost real buffer)
  // see a genuinely continuous frameIndex sequence instead of resetting every frame.
  // setImage() doesn't call reset(), so re-drawing the same source each frame is harmless.
  renderer.setImage(img, 1);
  // Thread the per-look OSD profile (date/font/colours) alongside the format profile so the
  // burned-in OSD matches the app instead of renderOSD()'s 1998 fallback. See headless-render-options.ts.
  const renderOptions: Record<string, unknown> = buildHeadlessRenderOptions(name, params, formatPipeline);
  if (sourceView) renderOptions.sourceView = sourceView; // caller-controlled framing (B10)
  renderer.render(ctx, width, height, frameIndex / fps, params, frameIndex, fps, renderOptions);
}

async function renderStill(opts: StillOpts): Promise<string> {
  if (document.fonts?.ready) await document.fonts.ready;
  const { width = 1280, height = 720, frameIndex = 0, fps = 30, formatPipeline = true } = opts;
  const { name, params } = resolveLook(opts.look);
  const img = await loadImage(opts.input);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("headless-render: 2d context unavailable");
  await renderFrame(img, name, params, width, height, frameIndex, fps, formatPipeline, ctx,
    resolveSourceView(opts, img, width, height));
  return canvas.toDataURL("image/png");
}

async function renderVideo(opts: VideoOpts): Promise<{ outPath: string; frames: number }> {
  const desktop = (window as unknown as { desktop?: { ffmpeg?: any } }).desktop;
  if (!desktop?.ffmpeg) throw new Error("headless-render: window.desktop.ffmpeg unavailable (run via the Electron CLI)");
  if (!(await desktop.ffmpeg.available())) throw new Error("headless-render: ffmpeg binary not found");
  if (document.fonts?.ready) await document.fonts.ready;

  const { width = 1280, height = 720, fps = 30, durationSec = 4, codec = "h264", formatPipeline = true, outPath } = opts;
  const { name, params } = resolveLook(opts.look);
  const img = await loadImage(opts.input);
  const total = Math.max(1, Math.round(durationSec * fps));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("headless-render: 2d context unavailable");

  const pngBytes = (): Promise<Uint8Array> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) { reject(new Error("headless-render: frame encode failed")); return; }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, "image/png");
    });

  const { sessionId } = await desktop.ffmpeg.begin({ width, height, fps });
  try {
    const sourceView = resolveSourceView(opts, img, width, height);
    // One renderer instance for the whole video: frameIndex advances by exactly 1 each
    // call, so inter-frame feedback (datamosh accumulator, e-ink refresh-ghost real
    // buffer) sees a genuinely continuous sequence instead of resetting every frame.
    const renderer = new CRTRendererFull();
    for (let i = 0; i < total; i++) {
      await renderFrame(img, name, params, width, height, i, fps, formatPipeline, ctx, sourceView, renderer);
      await desktop.ffmpeg.frame({ sessionId, index: i, bytes: await pngBytes() });
    }
    await desktop.ffmpeg.encode({ sessionId, codec, outPath });
  } catch (e) {
    try { await desktop.ffmpeg.cancel({ sessionId }); } catch { /* ignore */ }
    throw e;
  }
  return { outPath, frames: total };
}

function listLooks(): { name: string; system: string; medium: string }[] {
  return Object.keys(PRESETS as Record<string, unknown>).map((name) => {
    let system = "";
    let medium = "";
    try {
      const fp = getFormatProfile(name, undefined);
      system = String(fp?.system ?? "");
      medium = String(fp?.dossier?.medium ?? "");
    } catch { /* ignore */ }
    return { name, system, medium };
  });
}

export function installHeadlessRenderApi(): void {
  (window as unknown as { lmeHeadless?: unknown }).lmeHeadless = {
    version: 1,
    listLooks,
    renderStill,
    renderVideo,
  };
}
