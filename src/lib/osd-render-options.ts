// Single source of truth for the OSD render-option object that the renderer's
// renderOSD() consumes. Used by BOTH the live preview and EVERY export/offscreen
// render path so the burned-in OSD is identical across preview and export.
//
// The desync this fixes: exports historically passed `renderOptions: { formatProfile }`
// only, so renderOSD() fell back to its hardcoded defaults (vhs font, 1998 date,
// "CAM2"/"CTFID CHANNEL3", no synced clock). Threading the full option set through
// every export site removes that fallback.
//
// DETERMINISM CONTRACT (export-parity guarantee):
// The OSD timestamp/animation is a pure function of `frameIndex` + the OSD start
// time. For PREVIEW we pass an explicit `osdElapsedSeconds` (the preview clock).
// For EXPORT we DELIBERATELY OMIT `osdElapsedSeconds` so the renderer derives it
// per frame from `frameIndex / fps` (see renderOSD: `osdElapsedSeconds ?? frameSeconds`).
// That keeps the burned timecode advancing correctly per exported frame and makes
// preview↔export parity hold at any given frame. NEVER inject a wall-clock value here.

export interface OSDLike {
  osdStartDateTime?: string;
  osdCountWithExport?: boolean;
  osdBloom?: number;
  osdFontScale?: number;
  osdThickness?: number;
  osdSeed?: number;
  osdPrimaryColor?: string;
  osdAccentColor?: string;
  osdFontPreset?: string;
  osdCornerConfig?: Record<string, { enabled?: boolean; text?: string }>;
}

export interface OSDRenderOptions {
  osdStartDateTime: string;
  osdElapsedSeconds?: number;
  osdCountWithExport: boolean;
  osdBloom?: number;
  osdFontScale?: number;
  osdThickness?: number;
  osdSeed?: number;
  osdPrimaryColor?: string;
  osdAccentColor?: string;
  osdFontPreset?: string;
  osdCornerTopLeftEnabled?: boolean;
  osdCornerTopLeftText?: string;
  osdCornerTopCenterEnabled?: boolean;
  osdCornerTopCenterText?: string;
  osdCornerTopRightEnabled?: boolean;
  osdCornerTopRightText?: string;
  osdCornerBottomLeftEnabled?: boolean;
  osdCornerBottomLeftText?: string;
  osdCornerBottomCenterEnabled?: boolean;
  osdCornerBottomCenterText?: string;
  osdCornerBottomRightEnabled?: boolean;
  osdCornerBottomRightText?: string;
}

/**
 * Build the flat OSD render-option object renderOSD() reads.
 *
 * @param osd The OSD options (preview UI state). When null/undefined, returns {} —
 *            renderOSD() then uses its own defaults (matching pre-OSD behaviour).
 * @param opts.elapsed Preview clock in seconds. Used ONLY when `forExport` is false.
 * @param opts.forExport When true, OMIT `osdElapsedSeconds` so the renderer derives
 *            it per-frame from frameIndex/fps (export parity + trim correctness).
 */
export function buildOSDRenderOptions(
  osd: OSDLike | null | undefined,
  opts: { elapsed?: number; forExport?: boolean } = {},
): OSDRenderOptions | Record<string, never> {
  if (!osd) return {};
  const cc = osd.osdCornerConfig || {};
  const forExport = opts.forExport === true;
  const countWithExport = osd.osdCountWithExport !== false;

  const out: OSDRenderOptions = {
    osdStartDateTime: osd.osdStartDateTime || "1998-10-31T22:48:00",
    osdCountWithExport: countWithExport,
    osdBloom: osd.osdBloom,
    osdFontScale: osd.osdFontScale,
    osdThickness: osd.osdThickness,
    osdSeed: osd.osdSeed,
    osdPrimaryColor: osd.osdPrimaryColor,
    osdAccentColor: osd.osdAccentColor,
    osdFontPreset: osd.osdFontPreset,
    osdCornerTopLeftEnabled: cc.topLeft?.enabled,
    osdCornerTopLeftText: cc.topLeft?.text,
    osdCornerTopCenterEnabled: cc.topCenter?.enabled,
    osdCornerTopCenterText: cc.topCenter?.text,
    osdCornerTopRightEnabled: cc.topRight?.enabled,
    osdCornerTopRightText: cc.topRight?.text,
    osdCornerBottomLeftEnabled: cc.bottomLeft?.enabled,
    osdCornerBottomLeftText: cc.bottomLeft?.text,
    osdCornerBottomCenterEnabled: cc.bottomCenter?.enabled,
    osdCornerBottomCenterText: cc.bottomCenter?.text,
    osdCornerBottomRightEnabled: cc.bottomRight?.enabled,
    osdCornerBottomRightText: cc.bottomRight?.text,
  };

  if (!forExport) {
    // Preview: drive the clock from the preview elapsed (or 0 when the OSD is
    // configured not to count). Export deliberately leaves this undefined.
    out.osdElapsedSeconds = countWithExport ? Math.max(0, Number(opts.elapsed) || 0) : 0;
  } else if (!countWithExport) {
    // Export with counting disabled: freeze the clock at the start time.
    out.osdElapsedSeconds = 0;
  }
  // else (export + counting enabled): omit osdElapsedSeconds -> renderer uses frameIndex/fps.

  return out;
}
