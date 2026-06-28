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

async function renderFrame(
  img: HTMLImageElement, name: string, params: Params, width: number, height: number,
  frameIndex: number, fps: number, formatPipeline: boolean, ctx: CanvasRenderingContext2D,
): Promise<void> {
  const renderer = new CRTRendererFull();
  renderer.setImage(img, 1);
  const renderOptions = formatPipeline ? { formatProfile: getFormatProfile(name, undefined) } : {};
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
  await renderFrame(img, name, params, width, height, frameIndex, fps, formatPipeline, ctx);
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
    for (let i = 0; i < total; i++) {
      await renderFrame(img, name, params, width, height, i, fps, formatPipeline, ctx);
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
