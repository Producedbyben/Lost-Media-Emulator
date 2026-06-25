/**
 * Preset Migration & Validation — Effects Engine v2
 * Handles v1 → v2 schema migration, range clamping, and enum validation.
 */

import { CRTParams, DEFAULT_PARAMS } from "@/hooks/useCRTRenderer";

// Schema version constants
export const CURRENT_SCHEMA_VERSION = 2;

// Enum valid values
const VALID_CHROMA_SUBSAMPLING = ["444", "422", "420", "411"] as const;
const VALID_SCANLINE_PROFILE = ["off", "soft", "hard", "triadAware"] as const;
const VALID_SUBPIXEL_LAYOUT = ["none", "RGB", "BGR", "PenTile"] as const;
const VALID_STORAGE_CONDITION = ["ideal", "humid", "hot", "moldRisk"] as const;

// Parameter range definitions for clamping
export const PARAM_RANGES: Record<string, { min: number; max: number }> = {
  // V1 params
  scanlineStrength: { min: 0, max: 1 },
  phosphorMask: { min: 0, max: 1 },
  barrelDistortion: { min: -0.3, max: 0.3 },
  bloom: { min: 0, max: 1 },
  flicker: { min: 0, max: 1 },
  chromaticAberration: { min: 0, max: 1 },
  noise: { min: 0, max: 1 },
  pixelSize: { min: 1, max: 8 },
  maskScale: { min: 0.5, max: 2 },
  imageBrightness: { min: 0, max: 3 },
  imageContrast: { min: 0, max: 3 },
  advancedSaturation: { min: 0, max: 3 },
  imageGamma: { min: 0.1, max: 3 },
  imageTemperature: { min: -1, max: 1 },
  imageTint: { min: -1, max: 1 },
  // V2: Color & Signal
  lumaNoise: { min: 0, max: 1 },
  chromaNoise: { min: 0, max: 1 },
  chromaBleedHorizontal: { min: 0, max: 1 },
  chromaBleedVertical: { min: 0, max: 1 },
  chromaPhaseError: { min: 0, max: 1 },
  blackLevelCrush: { min: 0, max: 1 },
  highlightRollOff: { min: 0, max: 1 },
  gammaCurve: { min: 0.1, max: 3 },
  // V2: Temporal
  dropoutFrequency: { min: 0, max: 1 },
  dropoutLength: { min: 0, max: 1 },
  jitterSpeed: { min: 0, max: 1 },
  jitterRandomness: { min: 0, max: 1 },
  wowFlutterSlow: { min: 0, max: 1 },
  wowFlutterFast: { min: 0, max: 1 },
  flickerFrequencyHz: { min: 0, max: 1 },
  flickerDepth: { min: 0, max: 1 },
  autoExposureHunt: { min: 0, max: 1 },
  // V2: Tape
  headClogEvents: { min: 0, max: 1 },
  trackingError: { min: 0, max: 1 },
  tapeSkew: { min: 0, max: 1 },
  chromaNoiseStreaking: { min: 0, max: 1 },
  // V2: Film
  grainSize: { min: 0, max: 1 },
  grainChromaticity: { min: 0, max: 1 },
  gateJitterX: { min: 0, max: 1 },
  gateJitterY: { min: 0, max: 1 },
  gateRotation: { min: 0, max: 1 },
  shutterJudder: { min: 0, max: 1 },
  printFadeCyan: { min: 0, max: 1 },
  printFadeMagenta: { min: 0, max: 1 },
  printFadeYellow: { min: 0, max: 1 },
  spliceFlash: { min: 0, max: 1 },
  cueMarks: { min: 0, max: 1 },
  // V2: Digital Compression
  gopLength: { min: 0, max: 1 },
  deblockingStrength: { min: 0, max: 1 },
  ringingStrength: { min: 0, max: 1 },
  packetLossBurst: { min: 0, max: 1 },
  upscaleSharpenHalos: { min: 0, max: 1 },
  // V2: Sensor/Lens
  rollingShutterSkew: { min: 0, max: 1 },
  fixedPatternNoise: { min: 0, max: 1 },
  hotPixels: { min: 0, max: 1 },
  lensSmear: { min: 0, max: 1 },
  haze: { min: 0, max: 1 },
  flareGhosts: { min: 0, max: 1 },
  vignette: { min: 0, max: 1 },
  cornerSharpnessFalloff: { min: 0, max: 1 },
  // V2: Display
  phosphorPersistence: { min: 0, max: 1 },
  beamSpotSizeX: { min: 0, max: 1 },
  beamSpotSizeY: { min: 0, max: 1 },
  pixelResponseTime: { min: 0, max: 1 },
  // V2: Meta-aging
  mediaAgeYears: { min: 0, max: 100 },
  copyGenerationCount: { min: 0, max: 20 },
  restorationPassLevel: { min: 0, max: 1 },
  // Datamosh / true digital decay
  datamoshBloom: { min: 0, max: 1 },
  datamoshDisplacement: { min: 0, max: 1 },
  pixelSort: { min: 0, max: 1 },
  bitrotCorruption: { min: 0, max: 1 },
};

/** Clamp a numeric value to its valid range */
export function clampParam(key: string, value: number): number {
  const range = PARAM_RANGES[key];
  if (!range) return value;
  return Math.max(range.min, Math.min(range.max, value));
}

/** Validate and fallback enum values */
export function validateEnum(key: string, value: string): string {
  switch (key) {
    case "chromaSubsamplingMode":
      return (VALID_CHROMA_SUBSAMPLING as readonly string[]).includes(value) ? value : "444";
    case "scanlineProfile":
      return (VALID_SCANLINE_PROFILE as readonly string[]).includes(value) ? value : "off";
    case "subpixelLayoutOverride":
      return (VALID_SUBPIXEL_LAYOUT as readonly string[]).includes(value) ? value : "none";
    case "storageCondition":
      return (VALID_STORAGE_CONDITION as readonly string[]).includes(value) ? value : "ideal";
    default:
      return value;
  }
}

/** Detect schema version of a preset (v1 has no v2 keys, or explicit schemaVersion) */
export function detectSchemaVersion(preset: Record<string, any>): number {
  if (preset.schemaVersion) return preset.schemaVersion;
  // If any v2 key exists, it's v2
  const v2Keys = [
    "lumaNoise", "chromaNoise", "chromaBleedHorizontal", "dropoutFrequency",
    "headClogEvents", "grainSize", "gopLength", "rollingShutterSkew",
    "scanlineProfile", "mediaAgeYears",
  ];
  for (const k of v2Keys) {
    if (k in preset) return 2;
  }
  return 1;
}

/** Migrate a v1 preset to v2 by filling missing keys with defaults */
export function migrateV1toV2(preset: Record<string, any>): Record<string, any> {
  const migrated: Record<string, any> = { ...preset };

  // Fill all missing numeric keys from defaults
  for (const [key, value] of Object.entries(DEFAULT_PARAMS)) {
    if (!(key in migrated)) {
      migrated[key] = value;
    }
  }

  migrated.schemaVersion = 2;
  return migrated;
}

/** Normalize a preset: migrate, clamp, validate enums */
export function normalizePreset(preset: Record<string, any>): Record<string, any> {
  const version = detectSchemaVersion(preset);
  let normalized = version < 2 ? migrateV1toV2(preset) : { ...preset };

  // Clamp numeric values
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value === "number") {
      normalized[key] = clampParam(key, value);
    }
    if (typeof value === "string" && key !== "maskType") {
      normalized[key] = validateEnum(key, value);
    }
  }

  return normalized;
}

/** Check if all default values produce a visually neutral output (True Zero) */
export function isTrueZero(params: CRTParams): boolean {
  for (const [key, defaultVal] of Object.entries(DEFAULT_PARAMS)) {
    const current = (params as any)[key];
    if (typeof defaultVal === "number" && typeof current === "number") {
      if (Math.abs(current - defaultVal) > 0.001) return false;
    }
    if (typeof defaultVal === "string" && current !== defaultVal) return false;
  }
  return true;
}

/** Serialize preset with schema version */
export function serializePresetV2(name: string, params: Record<string, any>): Record<string, any> {
  const data: Record<string, any> = { schemaVersion: CURRENT_SCHEMA_VERSION };
  for (const [key, value] of Object.entries(params)) {
    const def = (DEFAULT_PARAMS as any)[key];
    if (def === undefined) continue;
    if (typeof value === "number" && typeof def === "number" && Math.abs(value - def) > 0.0005) {
      data[key] = Math.round(value * 1000) / 1000;
    }
    if (typeof value === "string" && value !== def) {
      data[key] = value;
    }
  }
  return data;
}

/** Deserialize any version preset into full CRTParams */
export function deserializePreset(data: Record<string, any>): CRTParams {
  const normalized = normalizePreset(data);
  const result = { ...DEFAULT_PARAMS };
  for (const [key, value] of Object.entries(normalized)) {
    if (key in result) {
      (result as any)[key] = value;
    }
  }
  return result;
}
