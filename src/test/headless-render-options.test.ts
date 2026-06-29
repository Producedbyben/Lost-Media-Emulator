import { describe, it, expect } from "vitest";
import { buildHeadlessRenderOptions } from "@/lib/headless-render-options";

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
