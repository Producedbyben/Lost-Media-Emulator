import { describe, it, expect } from "vitest";
import { buildOSDRenderOptions, type OSDLike } from "@/lib/osd-render-options";

const SAMPLE: OSDLike = {
  osdStartDateTime: "1988-06-15T19:24:00",
  osdCountWithExport: true,
  osdBloom: 0.4,
  osdFontScale: 1.2,
  osdThickness: 1.1,
  osdSeed: 42,
  osdPrimaryColor: "#00ff00",
  osdAccentColor: "#ff0000",
  osdFontPreset: "camcorder",
  osdCornerConfig: {
    topLeft: { enabled: true, text: "CAM 01" },
    topRight: { enabled: false, text: "CH3" },
    bottomLeft: { enabled: true, text: "{tc}" },
  },
};

describe("buildOSDRenderOptions", () => {
  it("returns empty object when no OSD config", () => {
    expect(buildOSDRenderOptions(null)).toEqual({});
    expect(buildOSDRenderOptions(undefined)).toEqual({});
  });

  it("threads every OSD field through (the export-desync fix)", () => {
    const o = buildOSDRenderOptions(SAMPLE, { forExport: true });
    expect(o.osdStartDateTime).toBe("1988-06-15T19:24:00");
    expect(o.osdFontPreset).toBe("camcorder");
    expect(o.osdPrimaryColor).toBe("#00ff00");
    expect(o.osdAccentColor).toBe("#ff0000");
    expect(o.osdSeed).toBe(42);
    expect(o.osdBloom).toBe(0.4);
    expect(o.osdFontScale).toBe(1.2);
    expect(o.osdThickness).toBe(1.1);
    expect(o.osdCornerTopLeftEnabled).toBe(true);
    expect(o.osdCornerTopLeftText).toBe("CAM 01");
    expect(o.osdCornerTopRightEnabled).toBe(false);
    expect(o.osdCornerBottomLeftText).toBe("{tc}");
  });

  it("EXPORT (counting on): omits osdElapsedSeconds so renderer derives it per-frame", () => {
    const o = buildOSDRenderOptions(SAMPLE, { forExport: true });
    expect("osdElapsedSeconds" in o).toBe(false);
    expect(o.osdCountWithExport).toBe(true);
  });

  it("EXPORT (counting off): freezes the clock at 0", () => {
    const o = buildOSDRenderOptions({ ...SAMPLE, osdCountWithExport: false }, { forExport: true });
    expect(o.osdElapsedSeconds).toBe(0);
    expect(o.osdCountWithExport).toBe(false);
  });

  it("PREVIEW (counting on): drives the clock from the preview elapsed", () => {
    const o = buildOSDRenderOptions(SAMPLE, { elapsed: 12.5 });
    expect(o.osdElapsedSeconds).toBe(12.5);
  });

  it("PREVIEW (counting off): clock stays at 0 regardless of elapsed", () => {
    const o = buildOSDRenderOptions({ ...SAMPLE, osdCountWithExport: false }, { elapsed: 99 });
    expect(o.osdElapsedSeconds).toBe(0);
  });

  it("PREVIEW: clamps negative/NaN elapsed to 0", () => {
    expect(buildOSDRenderOptions(SAMPLE, { elapsed: -5 }).osdElapsedSeconds).toBe(0);
    expect(buildOSDRenderOptions(SAMPLE, { elapsed: NaN }).osdElapsedSeconds).toBe(0);
  });

  it("defaults the start date when missing", () => {
    const o = buildOSDRenderOptions({ osdCountWithExport: true }, { forExport: true });
    expect(o.osdStartDateTime).toBe("1998-10-31T22:48:00");
  });

  it("PARITY: export at frame N derives the same timestamp the preview shows at that elapsed", () => {
    // The renderer computes elapsed = frameIndex/fps for export. Prove the preview
    // builder at that same elapsed produces identical OSD config (everything except
    // elapsed, which the renderer supplies per-frame for export).
    const fps = 30;
    const frame = 90; // 3.0s in
    const elapsed = frame / fps;
    const exportOpts = buildOSDRenderOptions(SAMPLE, { forExport: true });
    const previewOpts = buildOSDRenderOptions(SAMPLE, { elapsed });
    // Strip the elapsed (export omits it; renderer fills frame/fps == previewElapsed)
    const { osdElapsedSeconds: _prevElapsed, ...previewRest } = previewOpts as Record<string, unknown>;
    expect(exportOpts).toEqual(previewRest);
    expect(_prevElapsed).toBe(elapsed);
  });
});
