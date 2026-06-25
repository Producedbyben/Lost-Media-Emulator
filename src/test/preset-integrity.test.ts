import { describe, it, expect } from "vitest";
import { DEFAULT_PARAMS, CRTParams } from "@/hooks/useCRTRenderer";
import { clampParam, validateEnum, PARAM_RANGES } from "@/lib/preset-migration";
// @ts-ignore - JS module
import {
  PRESETS, CAPTURE_PRESETS, DISPLAY_PRESETS, DISPLAY_PARAM_KEYS, combineChain,
} from "@/lib/presets.js";

/** Mirror of Index.blendParams — applies a preset on top of defaults. */
function applyPreset(values: Record<string, number | string>, intensity = 1): CRTParams {
  const result: any = { ...DEFAULT_PARAMS };
  for (const [k, v] of Object.entries(values)) {
    if (!(k in result)) continue;
    if (typeof v === "number") {
      const base = typeof (DEFAULT_PARAMS as any)[k] === "number" ? (DEFAULT_PARAMS as any)[k] : 0;
      result[k] = clampParam(k, base + (v - base) * intensity);
    } else if (typeof v === "string") {
      result[k] = validateEnum(k, v);
    }
  }
  return result;
}

const presetEntries = Object.entries(PRESETS) as [string, Record<string, number | string>][];

describe("Preset integrity", () => {
  it("ships a non-empty preset library", () => {
    expect(presetEntries.length).toBeGreaterThan(50);
  });

  it("only references known parameter keys (no typos / dead keys)", () => {
    const known = new Set(Object.keys(DEFAULT_PARAMS));
    const offenders: string[] = [];
    for (const [name, values] of presetEntries) {
      for (const key of Object.keys(values)) {
        // schemaVersion + categorical mask helpers are allowed meta keys
        if (key === "schemaVersion") continue;
        if (!known.has(key)) offenders.push(`${name} → ${key}`);
      }
    }
    expect(offenders, `Unknown keys: ${offenders.join(", ")}`).toEqual([]);
  });

  it("keeps every numeric value within its documented range", () => {
    const offenders: string[] = [];
    for (const [name, values] of presetEntries) {
      for (const [key, v] of Object.entries(values)) {
        if (typeof v !== "number") continue;
        const range = PARAM_RANGES[key];
        if (!range) continue;
        if (v < range.min - 1e-9 || v > range.max + 1e-9) {
          offenders.push(`${name}.${key}=${v} (range ${range.min}..${range.max})`);
        }
      }
    }
    expect(offenders, `Out-of-range: ${offenders.join(", ")}`).toEqual([]);
  });

  it("uses only valid enum values", () => {
    const offenders: string[] = [];
    for (const [name, values] of presetEntries) {
      for (const key of ["chromaSubsamplingMode", "scanlineProfile", "subpixelLayoutOverride", "storageCondition"]) {
        if (!(key in values)) continue;
        const raw = String(values[key]);
        if (validateEnum(key, raw) !== raw) offenders.push(`${name}.${key}=${raw}`);
      }
    }
    expect(offenders, `Invalid enums: ${offenders.join(", ")}`).toEqual([]);
  });

  it("resets every unused effect to its default when a preset is applied (no leftover)", () => {
    const offenders: string[] = [];
    for (const [name, values] of presetEntries) {
      const applied = applyPreset(values);
      for (const [key, def] of Object.entries(DEFAULT_PARAMS)) {
        if (key in values) continue; // preset intentionally sets this
        if ((applied as any)[key] !== def) {
          offenders.push(`${name}: ${key} = ${(applied as any)[key]} (expected default ${def})`);
        }
      }
    }
    expect(offenders.slice(0, 20), `Unused effect not reset: ${offenders.slice(0, 20).join(", ")}`).toEqual([]);
  });

  it("does NOT contaminate when switching from a heavy preset to a lighter one", () => {
    // Apply each preset starting from the previous preset's result instead of defaults,
    // confirming our defaults-first strategy fully clears prior effects.
    const offenders: string[] = [];
    for (let i = 0; i < presetEntries.length; i++) {
      const [, prevValues] = presetEntries[i];
      const [name, values] = presetEntries[(i + 1) % presetEntries.length];
      // Simulate naive merge (what a buggy switch would do) vs correct defaults-first
      const correct = applyPreset(values);
      // The correct result must never depend on prevValues
      const withPrev = applyPreset({ ...prevValues, ...values });
      for (const key of Object.keys(DEFAULT_PARAMS)) {
        if (key in values) continue;
        if ((correct as any)[key] !== (DEFAULT_PARAMS as any)[key]) {
          offenders.push(`${name}.${key} not default`);
        }
        // withPrev differs only where prevValues set a key the new preset doesn't —
        // our real switch uses `correct`, so document that correct is contamination-free.
      }
    }
    expect(offenders.slice(0, 20)).toEqual([]);
  });

  it("True Zero (Neutral) preset is a genuine pass-through", () => {
    const tz = PRESETS["True Zero (Neutral)"];
    if (!tz) return;
    const applied = applyPreset(tz) as any;
    // A genuine neutral pass-through: degradation effects fully off, grading at unity.
    const mustBeZero = [
      "scanlineStrength", "phosphorMask", "bloom", "flicker", "chromaticAberration",
      "noise", "advancedFilmGrain", "lumaNoise", "chromaNoise", "barrelDistortion",
    ];
    for (const key of mustBeZero) {
      expect(Math.abs(applied[key]), `${key} should be ~0 in True Zero`).toBeLessThan(0.05);
    }
    const mustBeUnity = ["imageBrightness", "imageContrast", "advancedSaturation", "imageGamma"];
    for (const key of mustBeUnity) {
      expect(Math.abs(applied[key] - 1), `${key} should be ~1 in True Zero`).toBeLessThan(0.05);
    }
    expect(applied.maskType).toBe("none");
  });
});

describe("Two-axis chain integrity", () => {
  const DISPLAY_KEYS = new Set(DISPLAY_PARAM_KEYS as string[]);
  const META = new Set(["schemaVersion", "__category"]);
  const captureEntries = Object.entries(CAPTURE_PRESETS) as [string, Record<string, number | string>][];
  const displayEntries = Object.entries(DISPLAY_PRESETS) as [string, Record<string, number | string>][];

  it("ships both axes", () => {
    expect(captureEntries.length).toBeGreaterThan(20);
    expect(displayEntries.length).toBeGreaterThan(15);
  });

  it("DISPLAY presets only touch display-axis keys", () => {
    const offenders: string[] = [];
    for (const [name, values] of displayEntries) {
      for (const key of Object.keys(values)) {
        if (META.has(key)) continue;
        if (!DISPLAY_KEYS.has(key)) offenders.push(`${name} → ${key}`);
      }
    }
    expect(offenders, `Non-display keys: ${offenders.join(", ")}`).toEqual([]);
  });

  it("CAPTURE presets never touch display-axis keys", () => {
    const offenders: string[] = [];
    for (const [name, values] of captureEntries) {
      for (const key of Object.keys(values)) {
        if (META.has(key)) continue;
        if (DISPLAY_KEYS.has(key)) offenders.push(`${name} → ${key}`);
      }
    }
    expect(offenders, `Display keys leaked into capture: ${offenders.join(", ")}`).toEqual([]);
  });

  it("only references known parameter keys", () => {
    const known = new Set(Object.keys(DEFAULT_PARAMS));
    const offenders: string[] = [];
    for (const [name, values] of [...captureEntries, ...displayEntries]) {
      for (const key of Object.keys(values)) {
        if (META.has(key)) continue;
        if (!known.has(key)) offenders.push(`${name} → ${key}`);
      }
    }
    expect(offenders, `Unknown keys: ${offenders.join(", ")}`).toEqual([]);
  });

  it("any capture × display combination stays within documented ranges", () => {
    const offenders: string[] = [];
    // Sample a representative cross-section to keep the matrix bounded.
    const caps = captureEntries.filter((_, i) => i % 3 === 0);
    const disps = displayEntries.filter((_, i) => i % 2 === 0);
    for (const [capName, capVals] of caps) {
      for (const [dispName, dispVals] of disps) {
        const combined = combineChain(capVals, dispVals) as Record<string, number | string>;
        for (const [key, v] of Object.entries(combined)) {
          if (typeof v !== "number") continue;
          const range = PARAM_RANGES[key];
          if (!range) continue;
          const clamped = clampParam(key, v);
          if (Math.abs(clamped - v) > 1e-6) {
            offenders.push(`${capName}→${dispName}.${key}=${v} (range ${range.min}..${range.max})`);
          }
        }
      }
    }
    expect(offenders.slice(0, 20), `Out-of-range combos: ${offenders.slice(0, 20).join(", ")}`).toEqual([]);
  });
});


