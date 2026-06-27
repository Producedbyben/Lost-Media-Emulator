import { describe, it, expect } from "vitest";
import { seededNoiseRef } from "@/lib/effects-core/seeded-noise-ref";
import { seededNoiseF32 } from "@/lib/effects-core/seeded-noise-f32";

// Mirror of the CPU seededNoise in crt-renderer-full.js (the authority).
function cpuSeededNoise(x: number, y: number, frame: number) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - Math.floor(v);
}

describe("seededNoiseRef", () => {
  it("matches the CPU seededNoise exactly across samples", () => {
    for (const [x, y, f] of [[0, 0, 0], [1, 2, 3], [123.5, 7, 29], [480, 360, 1]] as const) {
      expect(seededNoiseRef(x, y, f)).toBeCloseTo(cpuSeededNoise(x, y, f), 12);
    }
  });
  it("returns a value in [0,1)", () => {
    const v = seededNoiseRef(5, 9, 17);
    expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1);
  });
});

// Naive single-precision hash — the BROKEN baseline, to prove emulation is needed.
const fr = Math.fround;
function naiveF32(x: number, y: number, frame: number) {
  const arg = fr(fr(fr(x * 12.9898) + fr(y * 78.233)) + fr(frame * 19.17));
  const s = fr(Math.sin(arg) * 43758.5453);
  return s - Math.floor(s);
}

describe("seededNoiseF32 (emulated-f64 in f32)", () => {
  // f32-exact args (integers + dyadic fractions) so f(x) === x — this isolates the hash
  // emulation from caller input-rounding. Args that diverge between f32 and f64 BEFORE
  // the hash (e.g. grain's x*gf) are a caller-precision concern gated by the fidelity sweep.
  const samples: [number, number, number][] = [
    [0, 0, 0], [1, 2, 3], [123, 7, 29], [480, 360, 1], [639, 479, 29], [256.5, 128.25, 13],
  ];
  it("matches the f64 reference within 0.02 across f32-exact samples incl. large coords", () => {
    for (const [x, y, f] of samples) {
      expect(Math.abs(seededNoiseF32(x, y, f) - seededNoiseRef(x, y, f))).toBeLessThan(0.02);
    }
  });
  it("naive f32 diverges at large coords (proving emulation is necessary)", () => {
    const worst = Math.max(
      ...([[480, 360, 1], [639, 479, 29]] as const).map(([x, y, f]) =>
        Math.abs(naiveF32(x, y, f) - seededNoiseRef(x, y, f))),
    );
    expect(worst).toBeGreaterThan(0.1);
  });
  it("returns a value in [0,1)", () => {
    const v = seededNoiseF32(639, 479, 29);
    expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1);
  });
});
