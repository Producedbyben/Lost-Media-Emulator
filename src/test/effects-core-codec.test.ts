import { describe, it, expect } from "vitest";
import { bitrotDesyncColor, dctEdgeFactor } from "@/lib/effects-core/codec-corruption";

// B6 codec-sim bug (NEEDS-BEN #13): on smooth/AI sources the codec looks emitted garish
// rainbow "confetti" (random-hue block tiles) + a uniform DCT grid that ignored local
// content. Real codec artefacts are CONTENT-DEPENDENT: corruption derives from image data,
// and block edges only appear where a block has AC energy. These helpers encode that.

describe("bitrotDesyncColor — image-derived block corruption (kills rainbow confetti)", () => {
  it("preserves the input's chroma spread (a muted block can't become a garish tile)", () => {
    // Old bug: hsl(randomHue, 90%, 50%) → full saturation regardless of the source.
    // A channel desync is a permutation of the block's OWN channels, so the spread is kept.
    const [r, g, b] = bitrotDesyncColor(120, 100, 130, 0.5);
    const inSpread = 130 - 100;
    const outSpread = Math.max(r, g, b) - Math.min(r, g, b);
    expect(outSpread).toBe(inSpread);
  });

  it("leaves flat grey unchanged (no rainbow on smooth grey areas)", () => {
    expect(bitrotDesyncColor(128, 128, 128, 0.9)).toEqual([128, 128, 128]);
  });

  it("actually corrupts a colourful block (it is not a no-op)", () => {
    expect(bitrotDesyncColor(200, 40, 90, 0.5)).not.toEqual([200, 40, 90]);
  });

  it("only ever outputs values present in the input (derived, never invented)", () => {
    const inp = [200, 40, 90];
    const out = bitrotDesyncColor(inp[0], inp[1], inp[2], 0.7);
    for (const v of out) expect(inp).toContain(v);
  });
});

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
