import { describe, it, expect } from "vitest";
import { buildHeadlessRenderOptions, computeSourceView } from "@/lib/headless-render-options";

// B10 — CLI 9:16 renders center-cropped 16:9 sources and lopped off the subject. The engine
// already honours renderOptions.sourceView (a source-fraction crop window); computeSourceView
// turns a caller-supplied ANCHOR (where the subject is) into that window at the target aspect.
describe("computeSourceView — anchor-controlled crop window (kills the 9:16 center-crop footgun)", () => {
  it("returns null when aspects already match (no crop, no behaviour change)", () => {
    expect(computeSourceView(1920, 1080, 1280, 720, 0.5, 0.5)).toBeNull();
  });

  it("default center anchor reproduces today's center-crop exactly", () => {
    // 16:9 → 9:16: view width fraction = (9/16)/(16/9) = 81/256
    const v = computeSourceView(1920, 1080, 1080, 1920, 0.5, 0.5)!;
    expect(v.height).toBe(1);
    expect(v.width).toBeCloseTo(81 / 256, 10);
    expect(v.x).toBeCloseTo(0.5 - v.width / 2, 10);
    expect(v.y).toBe(0);
  });

  it("a left-side anchor moves the window to the subject", () => {
    const v = computeSourceView(1920, 1080, 1080, 1920, 0.2, 0.5)!;
    expect(v.x).toBeCloseTo(0.2 - v.width / 2, 10);
  });

  it("clamps so the window never leaves the source (anchor at the very edge)", () => {
    const v = computeSourceView(1920, 1080, 1080, 1920, 0.0, 0.5)!;
    expect(v.x).toBe(0);
    const v2 = computeSourceView(1920, 1080, 1080, 1920, 1.0, 0.5)!;
    expect(v2.x).toBeCloseTo(1 - v2.width, 10);
  });

  it("handles the transposed case (9:16 source → 16:9 target crops vertically)", () => {
    const v = computeSourceView(1080, 1920, 1920, 1080, 0.5, 0.25)!;
    expect(v.width).toBe(1);
    expect(v.y).toBeCloseTo(0.25 - v.height / 2, 10);
  });
});

// B1 — the headless/CLI render path historically passed the renderer only
// `{ formatProfile }`, so the burned-in OSD fell back to renderOSD()'s hardcoded
// defaults (1998 date, "CTFID CHANNEL3" labels). This helper threads the per-look
// OSD profile (generateOSDProfile -> buildOSDRenderOptions) the way the UI does,
// so a CLI render's OSD matches the app (the faithfulness rule).

describe("buildHeadlessRenderOptions", () => {
  it("threads the look's era date into the OSD options (not the 1998 fallback)", () => {
    // "Police Bodycam 2016" carries its era in the name -> 2016, not 1998.
    const o = buildHeadlessRenderOptions("Police Bodycam 2016", {}, true);
    expect(o.osdStartDateTime).toBe("2016-06-15T19:24:00");
    expect(o.osdStartDateTime).not.toBe("1998-10-31T22:48:00");
  });

  it("includes the format profile when the pipeline is on", () => {
    const o = buildHeadlessRenderOptions("Police Bodycam 2016", {}, true);
    expect(o.formatProfile).toBeTruthy();
  });

  it("omits the format profile when the pipeline is off, but still threads the OSD", () => {
    const o = buildHeadlessRenderOptions("Police Bodycam 2016", {}, false);
    expect("formatProfile" in o).toBe(false);
    expect(o.osdStartDateTime).toBe("2016-06-15T19:24:00");
  });

  it("uses forExport semantics — omits osdElapsedSeconds so the renderer derives it per-frame", () => {
    const o = buildHeadlessRenderOptions("Police Bodycam 2016", {}, true);
    expect("osdElapsedSeconds" in o).toBe(false);
    expect(o.osdCountWithExport).toBe(true);
  });

  it("threads the per-look corner label and disables the garbled top-right default", () => {
    const o = buildHeadlessRenderOptions("Public Access Archive", {}, true);
    expect(o.osdCornerTopLeftText).toBe("CH 03");
    expect(o.osdCornerTopLeftEnabled).toBe(true);
    expect(o.osdCornerTopRightEnabled).toBe(false); // no "CTFID CHANNEL3"
  });

  it("an empty-label look disables both ID corners (date/time only, no garbage)", () => {
    const o = buildHeadlessRenderOptions("GoPro Hero3 Action Cam", {}, true);
    expect(o.osdCornerTopLeftEnabled).toBe(false);
    expect(o.osdCornerTopRightEnabled).toBe(false);
  });
});
