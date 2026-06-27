import { describe, it, expect } from "vitest";
import { seededRng, applyGainFade } from "@/lib/audio-degrade";

describe("audio-degrade pure helpers", () => {
  it("seededRng is deterministic for a given seed and in [0,1)", () => {
    const a = seededRng(1234); const b = seededRng(1234);
    const seqA = [a(), a(), a()]; const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seededRng(1)()).not.toEqual(seededRng(2)());
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });

  it("applyGainFade scales by gain", () => {
    const ch = new Float32Array([1, 1, 1, 1]);
    applyGainFade(ch, 4, 0.5, 0, 0);
    expect(Array.from(ch)).toEqual([0.5, 0.5, 0.5, 0.5]);
  });

  it("applyGainFade ramps fade-in from 0 and fade-out to 0", () => {
    const ch = new Float32Array(8).fill(1);
    applyGainFade(ch, 8, 1, 0.5, 0.5); // 0.5s @ 8Hz = 4 samples each side
    expect(ch[0]).toBeCloseTo(0, 5);          // starts silent
    expect(ch[7]).toBeCloseTo(0, 1);          // ends near silent
    expect(ch[3]).toBeGreaterThan(ch[0]);     // ramps up
  });
});
