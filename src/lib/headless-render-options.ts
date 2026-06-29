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
