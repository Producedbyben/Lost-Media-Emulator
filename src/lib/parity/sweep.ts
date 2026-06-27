// Pure helpers for the Epic 1 export-parity sweep. Severity classification and
// coverage roll-up; the actual pixel compare/render lives in export-validator.js.

export const SAMPLE_FRAMES = [0, 1, 7, 15, 29] as const;

export type Severity = "none" | "low" | "med" | "high";

export interface ParityResult {
  preset?: string;
  frame?: number;
  error?: string | null;
  determinism: { identical?: boolean; meanDiff?: number };
  parity: { meanDiff?: number; tolerance?: number };
}

export function classifyParityResult(r: ParityResult): { severity: Severity; reason: string } {
  if (r.error) return { severity: "high", reason: `render error: ${r.error}` };
  if (r.determinism?.identical === false)
    return { severity: "high", reason: "export not reproducible (determinism failed — likely unseeded temporal randomness or stale state)" };
  const md = r.parity?.meanDiff ?? 0;
  const tol = r.parity?.tolerance ?? 6;
  if (md <= tol) return { severity: "none", reason: "parity within tolerance" };
  const over = md / tol;
  if (over > 3) return { severity: "high", reason: `parity Δmean ${md} >> tol ${tol}` };
  if (over > 1.5) return { severity: "med", reason: `parity Δmean ${md} > tol ${tol}` };
  return { severity: "low", reason: `parity Δmean ${md} slightly over tol ${tol}` };
}

export function coverageSummary(results: ParityResult[]): { total: number; passed: number; failed: number; pct: number } {
  let passed = 0;
  for (const r of results) if (classifyParityResult(r).severity === "none") passed++;
  const total = results.length;
  return { total, passed, failed: total - passed, pct: total ? +((100 * passed) / total).toFixed(1) : 0 };
}
