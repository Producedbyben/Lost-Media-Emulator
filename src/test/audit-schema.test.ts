// src/test/audit-schema.test.ts
import { describe, it, expect } from "vitest";
import { validateScorecard, validateReference, presetCoverage, RUBRIC_CRITERIA } from "@/lib/audit/schema";
import { ALL_PRESET_NAMES } from "@/lib/audit/inventory";

const goodCard = {
  id: "Consumer TV", kind: "preset", medium: "vhs",
  referenceRefs: ["vhs-bbc-1987"],
  scores: Object.fromEntries(RUBRIC_CRITERIA.map((c) => [c, 4])),
  severity: "low", note: "scanlines slightly too regular vs reference",
};

describe("audit schema", () => {
  it("accepts a well-formed scorecard", () => {
    expect(validateScorecard(goodCard)).toEqual([]);
  });
  it("rejects a scorecard missing a rubric criterion or a reference", () => {
    expect(validateScorecard({ ...goodCard, referenceRefs: [] }).length).toBeGreaterThan(0);
    expect(validateScorecard({ ...goodCard, scores: { foo: 3 } }).length).toBeGreaterThan(0);
  });
  it("rejects out-of-range scores", () => {
    expect(validateScorecard({ ...goodCard, scores: { ...goodCard.scores, [RUBRIC_CRITERIA[0]]: 9 } }).length).toBeGreaterThan(0);
  });
  it("validates a reference entry and its license fields", () => {
    expect(validateReference({ id: "vhs-bbc-1987", medium: "vhs", source: "https://…", license: "CC-BY-4.0", redistribute: true, demonstrates: "head-switching noise band" })).toEqual([]);
    expect(validateReference({ id: "x", medium: "vhs" }).length).toBeGreaterThan(0);
  });
  it("coverage reports missing presets against the full inventory", () => {
    const cov = presetCoverage([ALL_PRESET_NAMES[0]]);
    expect(cov.covered).toContain(ALL_PRESET_NAMES[0]);
    expect(cov.missing.length).toBe(ALL_PRESET_NAMES.length - 1);
  });
});
