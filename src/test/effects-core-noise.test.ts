import { describe, it, expect } from "vitest";
import { seededNoiseRef } from "@/lib/effects-core/seeded-noise-ref";

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
