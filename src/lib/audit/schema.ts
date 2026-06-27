// src/lib/audit/schema.ts
import { ALL_PRESET_NAMES } from "@/lib/audit/inventory";

export const RUBRIC_CRITERIA = [
  "physicalPlausibility", // does the artifact match how the real medium degrades?
  "parameterBehaviour",   // does the slider move the look the way the medium would?
  "artifactCorrectness",  // right artifact shape/placement (not a generic filter)
  "defaults",             // sane, period-true default value
  "eraFit",               // matches the era/medium it claims
] as const;

const SEVERITIES = ["none", "low", "med", "high"] as const;

export type Scorecard = {
  id: string; kind: "preset" | "effect"; medium: string;
  referenceRefs: string[]; scores: Record<string, number>;
  severity: (typeof SEVERITIES)[number]; note: string;
};

export function validateScorecard(s: unknown): string[] {
  const p: string[] = [];
  const c = s as Partial<Scorecard>;
  if (!c || typeof c !== "object") return ["not an object"];
  if (!c.id) p.push("missing id");
  if (c.kind !== "preset" && c.kind !== "effect") p.push("kind must be preset|effect");
  if (!c.medium) p.push("missing medium");
  if (!Array.isArray(c.referenceRefs) || c.referenceRefs.length === 0) p.push("needs ≥1 referenceRef");
  if (!c.severity || !SEVERITIES.includes(c.severity)) p.push("bad severity");
  for (const crit of RUBRIC_CRITERIA) {
    const v = c.scores?.[crit];
    if (typeof v !== "number" || v < 1 || v > 5) p.push(`score ${crit} must be 1–5`);
  }
  return p;
}

export type ReferenceEntry = {
  id: string; medium: string; source: string; license: string;
  redistribute: boolean; demonstrates: string;
};

export function validateReference(r: unknown): string[] {
  const p: string[] = [];
  const e = r as Partial<ReferenceEntry>;
  if (!e || typeof e !== "object") return ["not an object"];
  for (const k of ["id", "medium", "source", "license", "demonstrates"] as const) {
    if (!e[k]) p.push(`missing ${k}`);
  }
  if (typeof e.redistribute !== "boolean") p.push("redistribute must be boolean");
  return p;
}

export function presetCoverage(scored: string[]): { covered: string[]; missing: string[] } {
  const set = new Set(scored);
  return {
    covered: ALL_PRESET_NAMES.filter((n) => set.has(n)),
    missing: ALL_PRESET_NAMES.filter((n) => !set.has(n)),
  };
}
