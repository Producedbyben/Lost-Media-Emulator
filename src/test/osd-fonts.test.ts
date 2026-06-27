import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadOSDFonts,
  _resetOSDFontsForTest,
  OSD_DIGITAL_FONT_FAMILY,
  OSD_BROADCAST_FONT_FAMILY,
} from "@/lib/osd-fonts";

describe("loadOSDFonts", () => {
  beforeEach(() => {
    _resetOSDFontsForTest();
  });

  it("exposes the two bundled OFL family names", () => {
    expect(OSD_DIGITAL_FONT_FAMILY).toBe("LME Digital OSD");
    expect(OSD_BROADCAST_FONT_FAMILY).toBe("LME Broadcast OSD");
  });

  it("resolves false (never throws) when the Font Loading API is unavailable", async () => {
    // jsdom has no document.fonts by default.
    const original = (document as Document & { fonts?: unknown }).fonts;
    if (original) delete (document as Document & { fonts?: unknown }).fonts;
    await expect(loadOSDFonts()).resolves.toBe(false);
  });

  it("loads both faces and awaits readiness when the API exists", async () => {
    const load = vi.fn().mockResolvedValue([]);
    const ready = Promise.resolve();
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load, ready },
    });
    await expect(loadOSDFonts()).resolves.toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls.map((c) => c[0]).join(" ")).toContain(OSD_DIGITAL_FONT_FAMILY);
    delete (document as Document & { fonts?: unknown }).fonts;
  });

  it("is cached / idempotent (the load runs once)", async () => {
    const load = vi.fn().mockResolvedValue([]);
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { load, ready: Promise.resolve() },
    });
    await loadOSDFonts();
    await loadOSDFonts();
    await loadOSDFonts();
    expect(load).toHaveBeenCalledTimes(2); // 2 faces, once — not 6.
    delete (document as Document & { fonts?: unknown }).fonts;
  });
});
