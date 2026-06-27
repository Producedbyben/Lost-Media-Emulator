// src/lib/audit/inventory.ts
// Enumerates the preset/effect surface so the audit can guarantee total coverage.
// PRESETS is a flat map of preset name -> param object (src/lib/presets.js).
import { PRESETS } from "@/lib/presets.js";

// Params whose *neutral* value is 1 (a multiplier), not 0.
const NEUTRAL_ONE = new Set(["pixelSize", "maskScale"]);

export const ALL_PRESET_NAMES: string[] = Object.keys(PRESETS as Record<string, unknown>);

export function listPresets(): { name: string; params: Record<string, unknown> }[] {
  return Object.entries(PRESETS as Record<string, Record<string, unknown>>)
    .map(([name, params]) => ({ name, params }));
}

export function isActive(key: string, value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "" && value !== "none";
  if (typeof value === "number") return NEUTRAL_ONE.has(key) ? value !== 1 : value !== 0;
  return false;
}

export function activeEffects(params: Record<string, unknown>): string[] {
  return Object.entries(params).filter(([k, v]) => isActive(k, v)).map(([k]) => k);
}

// Seed map for the most common effects → the 9 effect-info.ts categories. Unmapped
// keys return "Uncategorized" so the coverage report surfaces them for the auditor
// to file; extend this map as scoring proceeds.
const EFFECT_CATEGORIES: Record<string, string> = {
  scanlineStrength: "Display & CRT : Optics",
  phosphorMask: "Display & CRT : Optics",
  barrelDistortion: "Display & CRT : Optics",
  bloom: "Display & CRT : Optics",
  flicker: "Display & CRT : Optics",
  chromaticAberration: "Display & CRT : Optics",
  maskType: "Display & CRT : Optics",
  advancedNeonPhosphorBleed: "Display & CRT : Optics",
  advancedLineJitter: "Tape & Dropouts : Video Artifacts",
  advancedTimebaseWobble: "Tape & Dropouts : Video Artifacts",
  advancedDropouts: "Tape & Dropouts : Video Artifacts",
  advancedGhosting: "Tape & Dropouts : Video Artifacts",
  advancedTapeCrease: "Tape & Dropouts : Video Artifacts",
  advancedHeadSwitching: "Tape & Dropouts : Tape Mechanics",
  advancedInterlacing: "Tape & Dropouts : Temporal Instability",
  advancedFrameStutter: "Tape & Dropouts : Temporal Instability",
  advancedFilmGrain: "Film : Grain & Gate",
  advancedFilmDust: "Film : Grain & Gate",
  advancedFilmScratches: "Film : Grain & Gate",
  advancedFilmHalation: "Film : Grain & Gate",
  advancedQuantization: "Digital & Compression : Digital Noise",
  advancedMacroBlocking: "Digital & Compression : Digital Noise",
  advancedGenerationLoss: "Digital & Compression : Digital Noise",
  advancedTimestampOSD: "Sensor & Lens",
  advancedOSDStyle: "Sensor & Lens",
  advancedCctvMonochrome: "Sensor & Lens",
};

export function effectCategory(key: string): string {
  return EFFECT_CATEGORIES[key] ?? "Uncategorized";
}
