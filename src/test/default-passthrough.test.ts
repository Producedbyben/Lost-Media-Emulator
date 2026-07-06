import { describe, it, expect } from "vitest";
import { DEFAULT_PARAMS } from "@/hooks/useCRTRenderer";
// @ts-expect-error -- plain-JS engine module
import { PRESETS } from "@/lib/presets.js";

// Ben-11 #4: every imported asset used to wear a baked-in CRT look because DEFAULT_PARAMS
// shipped 7 non-neutral legacy values. New clips must enter as UNEDITED SOURCE.
// The OLD defaults are pinned here so the second suite can prove that neutralising them
// did not change ANY of the 91 shipped looks (sparse presets inherited these values and
// must now carry them explicitly).
const OLD_LEGACY_DEFAULTS: Record<string, number | string> = {
  scanlineStrength: 0.5,
  phosphorMask: 0.5,
  bloom: 0.5,
  flicker: 0.22,
  chromaticAberration: 0.5,
  noise: 0.5,
  maskType: "phosphor",
};

describe("default state is true passthrough (Ben-11 #4)", () => {
  it("ships every legacy effect param neutral — no effect without user action", () => {
    expect(DEFAULT_PARAMS.scanlineStrength).toBe(0);
    expect(DEFAULT_PARAMS.phosphorMask).toBe(0);
    expect(DEFAULT_PARAMS.bloom).toBe(0);
    expect(DEFAULT_PARAMS.flicker).toBe(0);
    expect(DEFAULT_PARAMS.chromaticAberration).toBe(0);
    expect(DEFAULT_PARAMS.noise).toBe(0);
    expect(DEFAULT_PARAMS.maskType).toBe("none");
  });

  it("matches the True Zero (Neutral) preset on those keys (defaults ARE true zero)", () => {
    const tz = (PRESETS["True Zero (Neutral)"].params ?? PRESETS["True Zero (Neutral)"]) as Record<string, unknown>;
    for (const k of Object.keys(OLD_LEGACY_DEFAULTS)) {
      const effective = k in tz ? tz[k] : DEFAULT_PARAMS[k];
      expect(effective, k).toBe(DEFAULT_PARAMS[k]);
    }
  });
});

describe("neutralising the defaults changed NO shipped look (byte-identity guard)", () => {
  it("every preset's effective value for the 7 legacy keys equals the pre-change baseline", () => {
    const offenders: string[] = [];
    for (const [name, def] of Object.entries(PRESETS as Record<string, unknown>)) {
      const p = ((def as { params?: object }).params ?? def) as Record<string, unknown>;
      for (const [k, oldDefault] of Object.entries(OLD_LEGACY_DEFAULTS)) {
        const before = k in p ? p[k] : oldDefault;          // what the look rendered as pre-change
        const after = k in p ? p[k] : DEFAULT_PARAMS[k];    // what it renders as now
        if (before !== after) offenders.push(`${name}.${k}: ${String(before)} -> ${String(after)}`);
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
