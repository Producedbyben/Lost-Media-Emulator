import { describe, it, expect } from "vitest";
import { cueMarkState, spliceFlashState, spliceBarY } from "@/lib/film-print-events";

// 1.2.0 worn-print projection events. The contract that matters: deterministic
// (export parity), clean stills (frame 0 never shows an event), correct pairing
// (cue dots come in twos), and rarity that scales with the amount.

describe("cueMarkState", () => {
  it("frame 0 is always clean (stills never carry a cue dot)", () => {
    for (const amt of [0.2, 0.5, 1]) {
      for (const fps of [24, 30, 60]) {
        expect(cueMarkState(0, fps, amt).show).toBe(false);
      }
    }
  });

  it("is deterministic: same frame → same state", () => {
    for (let f = 0; f < 400; f += 37) {
      expect(cueMarkState(f, 30, 0.6)).toEqual(cueMarkState(f, 30, 0.6));
    }
  });

  it("amount 0 never shows", () => {
    for (let f = 0; f < 2000; f += 13) expect(cueMarkState(f, 30, 0).show).toBe(false);
  });

  it("shows within one interval and comes as a PAIR (motor + changeover)", () => {
    const fps = 24;
    const seen = new Set<number>();
    for (let f = 0; f < fps * 30; f++) {
      const s = cueMarkState(f, fps, 1);
      if (s.show) seen.add(s.eventIndex);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2); // both dots of at least one pair
    const idx = [...seen].sort((a, b) => a - b);
    expect(idx.some((v, i) => i > 0 && v === idx[i - 1] + 1)).toBe(true); // consecutive pair
  });

  it("higher amount → more frequent events", () => {
    const fps = 30;
    const count = (amt: number) => {
      let n = 0;
      for (let f = 0; f < fps * 120; f++) if (cueMarkState(f, fps, amt).show) n++;
      return n;
    };
    expect(count(1)).toBeGreaterThan(count(0.15));
  });
});

describe("spliceFlashState", () => {
  it("frame 0 + the whole first slot are clean", () => {
    const fps = 30;
    const slot = Math.max(30, Math.round(fps * (26 - 1 * 20)));
    for (let f = 0; f < slot; f++) expect(spliceFlashState(f, fps, 1)).toBe(0);
  });

  it("is deterministic and rare: single-digit event frames per minute even at full", () => {
    const fps = 30;
    let events = 0;
    for (let f = 0; f < fps * 60; f++) {
      const a = spliceFlashState(f, fps, 1);
      expect(a).toBe(spliceFlashState(f, fps, 1));
      if (a > 0) events++;
    }
    expect(events).toBeGreaterThan(0);
    expect(events).toBeLessThan(fps); // far rarer than one per second
  });

  it("strength is bounded 0.6..1 when firing", () => {
    const fps = 24;
    for (let f = 0; f < fps * 300; f++) {
      const a = spliceFlashState(f, fps, 0.8);
      if (a > 0) {
        expect(a).toBeGreaterThanOrEqual(0.6);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });

  it("bar position stays inside the frame's middle band", () => {
    for (let f = 0; f < 10000; f += 111) {
      const y = spliceBarY(f, 30, 0.7);
      expect(y).toBeGreaterThan(0.2);
      expect(y).toBeLessThan(0.8);
    }
  });
});
