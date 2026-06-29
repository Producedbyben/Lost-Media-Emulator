import { describe, it, expect } from "vitest";
import { generateOSDProfile } from "@/lib/osd-profile";

// B1b — yearless OSD looks (no 4-digit year in the name) used to fall back to the hardcoded
// 1998 datestamp; surveillance/IR looks also showed the garbled "CAM2"/"CTFID CHANNEL3" corner
// labels. PE's osd-era-map.md gives an engine-grounded date + corner label per look.

describe("generateOSDProfile — era map (B1b)", () => {
  it("stamps a yearless 2010s look with its real era, not 1998", () => {
    // Ring Doorbell Night IR is a ~2019 device; it used to stamp 1998.
    expect(generateOSDProfile("Ring Doorbell Night IR", {}).startDateTime).toBe("2019-11-03T23:41:00");
  });

  it("stamps a yearless CCTV look with its DVR era", () => {
    expect(generateOSDProfile("Security Camera Dump", {}).startDateTime).toBe("2006-02-18T03:14:00");
  });

  it("leaves year-named looks on the existing name-derived era (regex path unchanged)", () => {
    expect(generateOSDProfile("Police Bodycam 2016", {}).startDateTime).toBe("2016-06-15T19:24:00");
  });
});

describe("generateOSDProfile — corner labels (B1b)", () => {
  it("supplies the explicit per-look label and disables the garbled top-right default", () => {
    const cc = generateOSDProfile("Public Access Archive", {}).cornerConfig;
    expect(cc.topLeft).toEqual({ enabled: true, text: "CH 03" });
    expect(cc.topRight.enabled).toBe(false); // kills "CTFID CHANNEL3"
  });

  it("DEFAULT RULE: a look not in the label map shows no corner label (never garbage)", () => {
    const cc = generateOSDProfile("True Zero (Neutral)", {}).cornerConfig;
    expect(cc.topLeft.enabled).toBe(false);
    expect(cc.topRight.enabled).toBe(false);
  });

  it("an explicit empty-label look (date/time only) disables both ID corners", () => {
    const cc = generateOSDProfile("GoPro Hero3 Action Cam", {}).cornerConfig;
    expect(cc.topLeft.enabled).toBe(false);
    expect(cc.topRight.enabled).toBe(false);
  });
});
