// Builds the `renderOptions` object the headless/CLI render path (electron/lme-render*.cjs
// via headless-render.ts) hands to CRTRendererFull.render(). Historically that path passed
// only `{ formatProfile }`, so renderOSD() fell back to its hardcoded defaults (1998 date,
// vhs font, "CAM2"/"CTFID CHANNEL3" labels) — a faithfulness gap vs the app, whose UI threads
// a per-look OSD profile (see Index.tsx applyOsdProfile). This mirrors that for headless so a
// CLI render's burned-in OSD matches the app's (the faithfulness rule).
//
// forExport: true — headless renders are deterministic exports; we OMIT osdElapsedSeconds so
// the renderer derives it per-frame from frameIndex/fps (the export-parity contract in
// osd-render-options.ts). NEVER inject a wall-clock value.
//
// NOTE (B1 scope): generateOSDProfile supplies date/font/colours but NOT corner-label text,
// so garbled "CTFID CHANNEL3" labels are addressed separately (PE per-look label spec / a
// renderOSD default fix), and yearless 2010s looks (e.g. Ring Doorbell Night IR) need the
// device-era map in osd-profile.ts (B1b). This helper is the wiring both build on.

import { generateOSDProfile } from "./osd-profile";
import { buildOSDRenderOptions } from "./osd-render-options";
import { getFormatProfile } from "./format-profiles.js";

type Params = Record<string, number | string>;

export interface SourceView { x: number; y: number; width: number; height: number }

/**
 * Anchor-controlled crop window for aspect conversion (B10). The renderer already honours
 * `renderOptions.sourceView` — a crop window in SOURCE FRACTIONS — but the CLI never exposed
 * it, so 16:9→9:16 renders always centre-cropped and could lop off the subject. Given the
 * source/target sizes and an anchor point (source fractions — where the subject is), this
 * returns the target-aspect window centred on the anchor, clamped inside the source.
 * Returns null when the aspects already match (no crop — unchanged behaviour), and the
 * default 0.5,0.5 anchor reproduces the old centre-crop exactly (backwards-compatible).
 */
export function computeSourceView(
  srcW: number, srcH: number, dstW: number, dstH: number,
  anchorX = 0.5, anchorY = 0.5,
): SourceView | null {
  if (!(srcW > 0 && srcH > 0 && dstW > 0 && dstH > 0)) return null;
  const srcAspect = srcW / srcH;
  const dstAspect = dstW / dstH;
  if (Math.abs(srcAspect - dstAspect) < 1e-9) return null;
  const ax = Math.max(0, Math.min(1, Number(anchorX) || 0));
  const ay = Math.max(0, Math.min(1, Number(anchorY) || 0));
  if (srcAspect > dstAspect) {
    // Source is wider — crop horizontally around the anchor.
    const width = dstAspect / srcAspect;
    const x = Math.max(0, Math.min(1 - width, ax - width / 2));
    return { x, y: 0, width, height: 1 };
  }
  // Source is taller — crop vertically around the anchor.
  const height = srcAspect / dstAspect;
  const y = Math.max(0, Math.min(1 - height, ay - height / 2));
  return { x: 0, y, width: 1, height };
}

export function buildHeadlessRenderOptions(
  name: string,
  params: Params,
  formatPipeline: boolean,
): Record<string, unknown> {
  const base = formatPipeline ? { formatProfile: getFormatProfile(name, undefined) } : {};
  const osd = generateOSDProfile(name, params as Record<string, number>);
  const osdOpts = buildOSDRenderOptions(
    {
      osdStartDateTime: osd.startDateTime,
      osdFontPreset: osd.fontPreset,
      osdPrimaryColor: osd.primaryColor,
      osdAccentColor: osd.accentColor,
      osdCountWithExport: osd.countWithExport,
      osdCornerConfig: osd.cornerConfig,
    },
    { forExport: true },
  );
  return { ...base, ...osdOpts };
}
