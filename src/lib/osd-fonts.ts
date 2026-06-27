// OSD font loading (HYBRID font plan).
// ------------------------------------
// Canvas 2D fillText() does not wait for web fonts — if a named face isn't yet
// resident it silently substitutes a fallback, so the digital-era OSD would render
// in the wrong font for the first frame(s) of preview AND for an export kicked off
// before the face loaded. loadOSDFonts() forces the bundled OFL faces to load and
// resolves once they are ready, so callers can `await` it before the first render
// and before each export.
//
// The analog eras (vhs/camcorder/cctv/led/filmSegmentThin) use procedural glyphs in
// the renderer and need no font load; this only covers the two bundled digital faces.

// CSS family names defined in src/styles/osd-fonts.css.
export const OSD_DIGITAL_FONT_FAMILY = "LME Digital OSD"; // Share Tech Mono (OFL)
export const OSD_BROADCAST_FONT_FAMILY = "LME Broadcast OSD"; // Saira Condensed (OFL)

const OSD_FONT_SPECS = [
  `16px "${OSD_DIGITAL_FONT_FAMILY}"`,
  `16px "${OSD_BROADCAST_FONT_FAMILY}"`,
];

let osdFontsPromise: Promise<boolean> | null = null;

/**
 * Ensure the bundled digital-era OSD fonts are resident. Idempotent and cached:
 * the actual load runs once; subsequent calls return the same promise.
 *
 * Resolves `true` when the faces are ready, `false` when the Font Loading API is
 * unavailable (e.g. jsdom/tests or an old runtime) — in which case the renderer's
 * CSS fallback stack applies, exactly as before this change. Never rejects.
 */
export function loadOSDFonts(): Promise<boolean> {
  if (osdFontsPromise) return osdFontsPromise;

  const fonts = typeof document !== "undefined"
    ? (document as Document & { fonts?: FontFaceSet }).fonts
    : undefined;

  if (!fonts || typeof fonts.load !== "function") {
    osdFontsPromise = Promise.resolve(false);
    return osdFontsPromise;
  }

  osdFontsPromise = Promise.all(
    OSD_FONT_SPECS.map((spec) => fonts.load(spec).catch(() => undefined)),
  )
    .then(() => (typeof fonts.ready?.then === "function" ? fonts.ready : undefined))
    .then(() => true)
    .catch(() => false);

  return osdFontsPromise;
}

/** Test-only: reset the cached promise so each test can re-exercise the loader. */
export function _resetOSDFontsForTest(): void {
  osdFontsPromise = null;
}
