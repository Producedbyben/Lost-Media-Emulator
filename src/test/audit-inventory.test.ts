// src/test/audit-inventory.test.ts
import { describe, it, expect } from "vitest";
import { listPresets, isActive, activeEffects, effectCategory, ALL_PRESET_NAMES } from "@/lib/audit/inventory";

describe("audit inventory", () => {
  it("lists every preset (91) with name + params", () => {
    const all = listPresets();
    expect(all.length).toBe(91);
    expect(all[0]).toHaveProperty("name");
    expect(all[0]).toHaveProperty("params");
    expect(ALL_PRESET_NAMES.length).toBe(91);
  });

  it("isActive flags non-neutral values only", () => {
    expect(isActive("scanlineStrength", 0)).toBe(false);
    expect(isActive("scanlineStrength", 0.45)).toBe(true);
    expect(isActive("pixelSize", 1)).toBe(false);   // 1 is neutral for pixelSize
    expect(isActive("maskType", "none")).toBe(false);
    expect(isActive("maskType", "aperture")).toBe(true);
  });

  it("activeEffects returns the effects a preset actually exercises", () => {
    const consumer = listPresets().find((p) => p.name === "Consumer TV")!;
    const eff = activeEffects(consumer.params);
    expect(eff).toContain("scanlineStrength");
    expect(eff).not.toContain("True Zero (Neutral)");
  });

  it("effectCategory maps known effects and is total", () => {
    expect(effectCategory("scanlineStrength")).toBe("Display & CRT : Optics");
    expect(effectCategory("advancedDropouts")).toBe("Tape & Dropouts : Video Artifacts");
    expect(typeof effectCategory("totallyUnknownKey")).toBe("string"); // never throws
    expect(effectCategory("totallyUnknownKey")).toBe("Uncategorized");
  });
});
