import { describe, it, expect } from "vitest";
import { DEFAULT_PARAMS } from "@/hooks/useCRTRenderer";
import {
  clampParam,
  validateEnum,
  detectSchemaVersion,
  migrateV1toV2,
  normalizePreset,
  isTrueZero,
  PARAM_RANGES,
} from "@/lib/preset-migration";

describe("Effects Engine v2 — DEFAULT_PARAMS", () => {
  it("has all v2 numeric params default to neutral (0 or 1)", () => {
    const v2NumericKeys = [
      "lumaNoise", "chromaNoise", "chromaBleedHorizontal", "chromaBleedVertical",
      "chromaPhaseError", "blackLevelCrush", "highlightRollOff",
      "dropoutFrequency", "dropoutLength", "jitterSpeed", "jitterRandomness",
      "wowFlutterSlow", "wowFlutterFast", "flickerFrequencyHz", "flickerDepth", "autoExposureHunt",
      "headClogEvents", "trackingError", "tapeSkew", "chromaNoiseStreaking",
      "grainSize", "grainChromaticity", "gateJitterX", "gateJitterY", "gateRotation",
      "shutterJudder", "printFadeCyan", "printFadeMagenta", "printFadeYellow",
      "spliceFlash", "cueMarks",
      "gopLength", "deblockingStrength", "ringingStrength", "packetLossBurst", "upscaleSharpenHalos",
      "rollingShutterSkew", "fixedPatternNoise", "hotPixels", "lensSmear", "haze",
      "flareGhosts", "vignette", "cornerSharpnessFalloff",
      "phosphorPersistence", "beamSpotSizeX", "beamSpotSizeY", "pixelResponseTime",
      "mediaAgeYears", "copyGenerationCount", "restorationPassLevel",
    ];
    for (const key of v2NumericKeys) {
      expect((DEFAULT_PARAMS as any)[key]).toBe(0);
    }
    // gammaCurve defaults to 1 (neutral)
    expect(DEFAULT_PARAMS.gammaCurve).toBe(1);
  });

  it("has v2 string params default to neutral values", () => {
    expect(DEFAULT_PARAMS.chromaSubsamplingMode).toBe("444");
    expect(DEFAULT_PARAMS.scanlineProfile).toBe("off");
    expect(DEFAULT_PARAMS.subpixelLayoutOverride).toBe("none");
    expect(DEFAULT_PARAMS.storageCondition).toBe("ideal");
  });

  it("preserves all v1 defaults unchanged", () => {
    expect(DEFAULT_PARAMS.scanlineStrength).toBe(0.5);
    expect(DEFAULT_PARAMS.bloom).toBe(0.5);
    expect(DEFAULT_PARAMS.flicker).toBe(0.22);
    expect(DEFAULT_PARAMS.imageBrightness).toBe(1);
    expect(DEFAULT_PARAMS.maskType).toBe("phosphor");
  });
});

describe("Schema migration v1 → v2", () => {
  it("detects v1 preset (no v2 keys)", () => {
    const v1 = { scanlineStrength: 0.5, bloom: 0.3 };
    expect(detectSchemaVersion(v1)).toBe(1);
  });

  it("detects v2 preset (has v2 keys)", () => {
    const v2 = { scanlineStrength: 0.5, lumaNoise: 0.3 };
    expect(detectSchemaVersion(v2)).toBe(2);
  });

  it("detects v2 from explicit schemaVersion", () => {
    expect(detectSchemaVersion({ schemaVersion: 2 })).toBe(2);
  });

  it("migrates v1 to v2 by filling defaults", () => {
    const v1 = { scanlineStrength: 0.7, bloom: 0.4 };
    const migrated = migrateV1toV2(v1);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.scanlineStrength).toBe(0.7);
    expect(migrated.bloom).toBe(0.4);
    expect(migrated.lumaNoise).toBe(0);
    expect(migrated.chromaSubsamplingMode).toBe("444");
    expect(migrated.storageCondition).toBe("ideal");
  });

  it("preserves all v1 values during migration", () => {
    const v1 = {
      scanlineStrength: 0.5,
      phosphorMask: 0.5,
      barrelDistortion: -0.05,
      bloom: 0.5,
      advancedDropouts: 0.3,
      maskType: "dot",
    };
    const migrated = migrateV1toV2(v1);
    expect(migrated.scanlineStrength).toBe(0.5);
    expect(migrated.barrelDistortion).toBe(-0.05);
    expect(migrated.advancedDropouts).toBe(0.3);
    expect(migrated.maskType).toBe("dot");
  });
});

describe("Range clamping", () => {
  it("clamps values to valid ranges", () => {
    expect(clampParam("lumaNoise", 1.5)).toBe(1);
    expect(clampParam("lumaNoise", -0.5)).toBe(0);
    expect(clampParam("barrelDistortion", 0.5)).toBe(0.3);
    expect(clampParam("barrelDistortion", -0.5)).toBe(-0.3);
    expect(clampParam("mediaAgeYears", 150)).toBe(100);
    expect(clampParam("copyGenerationCount", 25)).toBe(20);
  });

  it("leaves values within range unchanged", () => {
    expect(clampParam("lumaNoise", 0.5)).toBe(0.5);
    expect(clampParam("gammaCurve", 1.5)).toBe(1.5);
  });

  it("handles unknown params gracefully (no clamping)", () => {
    expect(clampParam("unknownParam", 999)).toBe(999);
  });
});

describe("Enum fallback behavior", () => {
  it("validates known chroma subsampling values", () => {
    expect(validateEnum("chromaSubsamplingMode", "422")).toBe("422");
    expect(validateEnum("chromaSubsamplingMode", "420")).toBe("420");
  });

  it("falls back for invalid chroma subsampling", () => {
    expect(validateEnum("chromaSubsamplingMode", "invalid")).toBe("444");
    expect(validateEnum("chromaSubsamplingMode", "")).toBe("444");
  });

  it("validates scanline profile", () => {
    expect(validateEnum("scanlineProfile", "soft")).toBe("soft");
    expect(validateEnum("scanlineProfile", "hard")).toBe("hard");
    expect(validateEnum("scanlineProfile", "badValue")).toBe("off");
  });

  it("validates subpixel layout", () => {
    expect(validateEnum("subpixelLayoutOverride", "RGB")).toBe("RGB");
    expect(validateEnum("subpixelLayoutOverride", "PenTile")).toBe("PenTile");
    expect(validateEnum("subpixelLayoutOverride", "bad")).toBe("none");
  });

  it("validates storage condition", () => {
    expect(validateEnum("storageCondition", "humid")).toBe("humid");
    expect(validateEnum("storageCondition", "moldRisk")).toBe("moldRisk");
    expect(validateEnum("storageCondition", "bad")).toBe("ideal");
  });
});

describe("normalizePreset", () => {
  it("normalizes a v1 preset: migrates + clamps", () => {
    const v1 = { scanlineStrength: 2.0, bloom: 0.3, barrelDistortion: 0.5 };
    const norm = normalizePreset(v1);
    expect(norm.scanlineStrength).toBe(1); // clamped from 2
    expect(norm.barrelDistortion).toBe(0.3); // clamped from 0.5
    expect(norm.lumaNoise).toBe(0); // filled from default
    expect(norm.schemaVersion).toBe(2);
  });
});

describe("isTrueZero", () => {
  it("returns true for exact defaults", () => {
    expect(isTrueZero(DEFAULT_PARAMS)).toBe(true);
  });

  it("returns false when any param is modified", () => {
    expect(isTrueZero({ ...DEFAULT_PARAMS, lumaNoise: 0.1 })).toBe(false);
  });
});

describe("Old presets render without regression", () => {
  it("Consumer TV preset loads without any missing keys after migration", () => {
    const consumerTV = {
      scanlineStrength: 0.5, phosphorMask: 0.5, barrelDistortion: 0, bloom: 0.5,
      flicker: 0.22, chromaticAberration: 0.5, noise: 0.5, pixelSize: 1,
    };
    const normalized = normalizePreset(consumerTV);
    // All v2 keys should exist
    expect(normalized.lumaNoise).toBe(0);
    expect(normalized.chromaSubsamplingMode).toBe("444");
    expect(normalized.scanlineProfile).toBe("off");
    expect(normalized.mediaAgeYears).toBe(0);
    // Original values preserved
    expect(normalized.scanlineStrength).toBe(0.5);
    expect(normalized.bloom).toBe(0.5);
  });
});

describe("Render engine — GPU routing capability gate", () => {
  it("routes a True Zero / GPU-supported look to the GPU path", async () => {
    const { CRTRendererHybrid } = await import("@/lib/crt-renderer-hybrid.js");
    const r: any = new CRTRendererHybrid(false);
    const trueZero = {
      scanlineStrength: 0, phosphorMask: 0, barrelDistortion: 0, bloom: 0,
      flicker: 0, chromaticAberration: 0, noise: 0, pixelSize: 1, maskType: "none",
    };
    expect(r._gpuCanHandle(trueZero, {})).toBe(true);

    const supported = {
      scanlineStrength: 0.5, phosphorMask: 0.4, bloom: 0.3, chromaticAberration: 0.2,
      pixelSize: 1, maskType: "phosphor", imageBrightness: 1, advancedSaturation: 1,
    };
    expect(r._gpuCanHandle(supported, {})).toBe(true);
  });

  it("falls back to CPU when an unsupported effect is active", async () => {
    const { CRTRendererHybrid } = await import("@/lib/crt-renderer-hybrid.js");
    const r: any = new CRTRendererHybrid(false);
    // v2 effect the shader cannot reproduce
    expect(r._gpuCanHandle({ headClogEvents: 0.5, maskType: "none" }, {})).toBe(false);
    // Unsupported advanced effect
    expect(r._gpuCanHandle({ advancedGenerationLoss: 0.3, maskType: "none" }, {})).toBe(false);
    // OSD overlay
    expect(r._gpuCanHandle({ advancedTimestampOSD: 1, maskType: "none" }, {})).toBe(false);
    // Exotic mask type
    expect(r._gpuCanHandle({ maskType: "oledPentile", phosphorMask: 0.5 }, {})).toBe(false);
    // Zoom / pan source view
    expect(r._gpuCanHandle({ maskType: "none" }, { sourceView: { x: 0, y: 0, width: 0.5, height: 0.5 } })).toBe(false);
    // Non-neutral grading still on GPU
    expect(r._gpuCanHandle({ maskType: "none", imageGamma: 1.2 }, {})).toBe(true);
  });
});

