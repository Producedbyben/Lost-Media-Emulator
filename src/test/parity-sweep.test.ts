import { describe, it, expect } from "vitest";
import { SAMPLE_FRAMES, classifyParityResult, coverageSummary } from "@/lib/parity/sweep";

describe("parity sweep helpers", () => {
  it("samples frames that exercise temporal effects", () => {
    expect([...SAMPLE_FRAMES]).toEqual([0, 1, 7, 15, 29]);
  });

  it("flags non-deterministic export as high severity", () => {
    const r = classifyParityResult({ determinism: { identical: false, meanDiff: 4 }, parity: { meanDiff: 1, tolerance: 6 }, error: null });
    expect(r.severity).toBe("high");
    expect(r.reason).toMatch(/reproduc|determin/i);
  });

  it("passes a deterministic, in-tolerance result", () => {
    const r = classifyParityResult({ determinism: { identical: true, meanDiff: 0 }, parity: { meanDiff: 2, tolerance: 6 }, error: null });
    expect(r.severity).toBe("none");
  });

  it("scales parity severity by how far over tolerance", () => {
    expect(classifyParityResult({ determinism: { identical: true }, parity: { meanDiff: 7, tolerance: 6 } }).severity).toBe("low");
    expect(classifyParityResult({ determinism: { identical: true }, parity: { meanDiff: 12, tolerance: 6 } }).severity).toBe("med");
    expect(classifyParityResult({ determinism: { identical: true }, parity: { meanDiff: 30, tolerance: 6 } }).severity).toBe("high");
  });

  it("treats a render error as high severity", () => {
    expect(classifyParityResult({ error: "boom", determinism: {}, parity: {} }).severity).toBe("high");
  });

  it("summarizes coverage across results", () => {
    const results = [
      { determinism: { identical: true }, parity: { meanDiff: 1, tolerance: 6 }, error: null },
      { determinism: { identical: false }, parity: { meanDiff: 1, tolerance: 6 }, error: null },
    ];
    const s = coverageSummary(results);
    expect(s.total).toBe(2);
    expect(s.passed).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.pct).toBe(50);
  });
});
