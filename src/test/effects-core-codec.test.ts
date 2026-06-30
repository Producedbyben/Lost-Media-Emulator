import { describe, it, expect } from "vitest";
import { dctEdgeFactor } from "@/lib/effects-core/codec-corruption";

// B6 codec-sim bug (NEEDS-BEN #13): on smooth/AI sources the codec looks emitted garish
// rainbow "confetti" (random-hue block tiles) + a uniform DCT grid that ignored local
// content. The fix makes artefacts CONTENT-DEPENDENT: corruption clusters into contiguous
// scene-coloured / scene-averaged macroblocks (verified visually in the renderer), and block
// edges only appear where a block has AC energy — which this helper encodes.

describe("dctEdgeFactor — block-edge visibility scales with AC energy (kills uniform grid)", () => {
  it("is 0 for a perfectly flat block (no edge on smooth areas)", () => {
    expect(dctEdgeFactor(0)).toBe(0);
  });

  it("stays near-clean for a near-flat block", () => {
    expect(dctEdgeFactor(0.05)).toBeLessThan(0.05);
  });

  it("is full strength for a high-contrast block", () => {
    expect(dctEdgeFactor(1)).toBe(1);
  });

  it("increases monotonically with contrast", () => {
    expect(dctEdgeFactor(0.3)).toBeLessThan(dctEdgeFactor(0.7));
  });
});
