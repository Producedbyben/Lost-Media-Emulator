# Epic 0 — Reference Ground-Truth Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the audit *system* — inventory, machine-checkable rubric/scorecards, a license-clean reference corpus structure, render tooling, and coverage tracking — then prove it end-to-end on one medium family (VHS/consumer tape), producing the first prioritized fix-list. The bulk scoring of the remaining mediums is then a tracked, repeatable loop, not part of this plan.

**Architecture:** Pure, unit-tested helpers in `src/lib/audit/` (inventory + schema/coverage) define and validate the audit data. Human-judgment artifacts live as docs/data under `docs/audit/`. In-app/Node tooling under `tools/audit/` renders contact sheets and emits a coverage report. The audit's output (`docs/audit/FIX-LIST.md`) is the language-agnostic ground truth both the v2 quality track and the engine leap consume.

**Tech Stack:** TypeScript + vitest (jsdom) for helpers; Node ESM scripts (`.mjs`) for tooling; the existing canvas renderer (`src/lib/crt-renderer-full.js`) + `src/lib/presets.js` (193 presets) for rendering; Markdown + JSON for audit artifacts.

## Global Constraints

- Effects/presets are judged against **real reference footage/stills**, never vibes. No medium is scored until its reference corpus has **≥1 license-cleared reference** in the manifest.
- **Commercial product:** every bundled/redistributed reference asset must be license-cleared; references that are only legal as *private internal comparison* are marked `redistribute: false` and never shipped in the app or committed if the license forbids it (store a URL + provenance instead).
- Keep the **87 existing tests green**; `npx tsc --noEmit` clean. New helpers are TDD'd.
- Preset source of truth: `src/lib/presets.js` (`export const PRESETS`, 193 flat param objects). Effect catalogue + categories: `src/lib/effect-info.ts` (`EFFECT_INFO`, 9 category groups).
- Audit artifacts live under `docs/audit/`; tooling under `tools/audit/`; helpers under `src/lib/audit/`.
- This plan delivers the **system + a proven pilot**, not a full 193-preset score. "Done" = the method works, is demonstrated on the VHS family, and the remaining work is a tracked loop.

---

### Task 1: Audit inventory + category mapping (pure helper, TDD)

**Files:**
- Create: `src/lib/audit/inventory.ts`
- Test: `src/test/audit-inventory.test.ts`

**Interfaces:**
- Consumes: `PRESETS` from `@/lib/presets.js`.
- Produces:
  - `listPresets(): { name: string; params: Record<string, unknown> }[]`
  - `isActive(key: string, value: unknown): boolean`
  - `activeEffects(params: Record<string, unknown>): string[]`
  - `effectCategory(key: string): string` (one of the 9 category labels, or `"Uncategorized"`)
  - `ALL_PRESET_NAMES: string[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/test/audit-inventory.test.ts
import { describe, it, expect } from "vitest";
import { listPresets, isActive, activeEffects, effectCategory, ALL_PRESET_NAMES } from "@/lib/audit/inventory";

describe("audit inventory", () => {
  it("lists every preset (193) with name + params", () => {
    const all = listPresets();
    expect(all.length).toBe(193);
    expect(all[0]).toHaveProperty("name");
    expect(all[0]).toHaveProperty("params");
    expect(ALL_PRESET_NAMES.length).toBe(193);
  });

  it("isActive flags non-neutral values only", () => {
    expect(isActive("scanlineStrength", 0)).toBe(false);
    expect(isActive("scanlineStrength", 0.45)).toBe(true);
    expect(isActive("pixelSize", 1)).toBe(false);   // 1 is neutral for pixelSize
    expect(isActive("maskType", "none")).toBe(false);
    expect(isActive("maskType", "aperture")).toBe(true);
  });

  it("activeEffects returns the effects a preset actually exercises", () => {
    const consumer = listPresets().find((p) => p.name === "Consumer TV")!;
    const eff = activeEffects(consumer.params);
    expect(eff).toContain("scanlineStrength");
    expect(eff).not.toContain("True Zero (Neutral)");
  });

  it("effectCategory maps known effects and is total", () => {
    expect(effectCategory("scanlineStrength")).toBe("Display & CRT : Optics");
    expect(effectCategory("advancedDropouts")).toBe("Tape & Dropouts : Video Artifacts");
    expect(typeof effectCategory("totallyUnknownKey")).toBe("string"); // never throws
    expect(effectCategory("totallyUnknownKey")).toBe("Uncategorized");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/audit-inventory.test.ts`
Expected: FAIL — `Cannot find module '@/lib/audit/inventory'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/audit/inventory.ts
// Enumerates the preset/effect surface so the audit can guarantee total coverage.
// PRESETS is a flat map of preset name -> param object (src/lib/presets.js).
import { PRESETS } from "@/lib/presets.js";

// Params whose *neutral* value is 1 (a multiplier), not 0.
const NEUTRAL_ONE = new Set(["pixelSize", "maskScale"]);

export const ALL_PRESET_NAMES: string[] = Object.keys(PRESETS as Record<string, unknown>);

export function listPresets(): { name: string; params: Record<string, unknown> }[] {
  return Object.entries(PRESETS as Record<string, Record<string, unknown>>)
    .map(([name, params]) => ({ name, params }));
}

export function isActive(key: string, value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "" && value !== "none";
  if (typeof value === "number") return NEUTRAL_ONE.has(key) ? value !== 1 : value !== 0;
  return false;
}

export function activeEffects(params: Record<string, unknown>): string[] {
  return Object.entries(params).filter(([k, v]) => isActive(k, v)).map(([k]) => k);
}

// Seed map for the most common effects → the 9 effect-info.ts categories. Unmapped
// keys return "Uncategorized" so the coverage report surfaces them for the auditor
// to file; extend this map as scoring proceeds.
const EFFECT_CATEGORIES: Record<string, string> = {
  scanlineStrength: "Display & CRT : Optics",
  phosphorMask: "Display & CRT : Optics",
  barrelDistortion: "Display & CRT : Optics",
  bloom: "Display & CRT : Optics",
  flicker: "Display & CRT : Optics",
  chromaticAberration: "Display & CRT : Optics",
  maskType: "Display & CRT : Optics",
  advancedNeonPhosphorBleed: "Display & CRT : Optics",
  advancedLineJitter: "Tape & Dropouts : Video Artifacts",
  advancedTimebaseWobble: "Tape & Dropouts : Video Artifacts",
  advancedDropouts: "Tape & Dropouts : Video Artifacts",
  advancedGhosting: "Tape & Dropouts : Video Artifacts",
  advancedTapeCrease: "Tape & Dropouts : Video Artifacts",
  advancedHeadSwitching: "Tape & Dropouts : Tape Mechanics",
  advancedInterlacing: "Tape & Dropouts : Temporal Instability",
  advancedFrameStutter: "Tape & Dropouts : Temporal Instability",
  advancedFilmGrain: "Film : Grain & Gate",
  advancedFilmDust: "Film : Grain & Gate",
  advancedFilmScratches: "Film : Grain & Gate",
  advancedFilmHalation: "Film : Grain & Gate",
  advancedQuantization: "Digital & Compression : Digital Noise",
  advancedMacroBlocking: "Digital & Compression : Digital Noise",
  advancedGenerationLoss: "Digital & Compression : Digital Noise",
  advancedTimestampOSD: "Sensor & Lens",
  advancedOSDStyle: "Sensor & Lens",
  advancedCctvMonochrome: "Sensor & Lens",
};

export function effectCategory(key: string): string {
  return EFFECT_CATEGORIES[key] ?? "Uncategorized";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/audit-inventory.test.ts`
Expected: PASS (4 tests). If the preset count assertion fails, update `193` to the real `Object.keys(PRESETS).length` and note it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/inventory.ts src/test/audit-inventory.test.ts
git commit -m "audit: preset/effect inventory + category mapping helper"
```

---

### Task 2: Audit data schema + coverage (pure helper, TDD)

**Files:**
- Create: `src/lib/audit/schema.ts`
- Test: `src/test/audit-schema.test.ts`

**Interfaces:**
- Consumes: `ALL_PRESET_NAMES` from `@/lib/audit/inventory`.
- Produces:
  - `RUBRIC_CRITERIA: readonly string[]` (the scoring axes)
  - `type Scorecard = { id: string; kind: "preset" | "effect"; medium: string; referenceRefs: string[]; scores: Record<string, number>; severity: "none" | "low" | "med" | "high"; note: string }`
  - `validateScorecard(s: unknown): string[]` (returns list of problems; empty = valid)
  - `type ReferenceEntry = { id: string; medium: string; source: string; license: string; redistribute: boolean; demonstrates: string }`
  - `validateReference(r: unknown): string[]`
  - `presetCoverage(scored: string[]): { covered: string[]; missing: string[] }`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/test/audit-schema.test.ts`
Expected: FAIL — `Cannot find module '@/lib/audit/schema'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/audit/schema.ts
import { ALL_PRESET_NAMES } from "@/lib/audit/inventory";

export const RUBRIC_CRITERIA = [
  "physicalPlausibility", // does the artifact match how the real medium degrades?
  "parameterBehaviour",   // does the slider move the look the way the medium would?
  "artifactCorrectness",  // right artifact shape/placement (not a generic filter)
  "defaults",             // sane, period-true default value
  "eraFit",               // matches the era/medium it claims
] as const;

const SEVERITIES = ["none", "low", "med", "high"] as const;

export type Scorecard = {
  id: string; kind: "preset" | "effect"; medium: string;
  referenceRefs: string[]; scores: Record<string, number>;
  severity: (typeof SEVERITIES)[number]; note: string;
};

export function validateScorecard(s: unknown): string[] {
  const p: string[] = [];
  const c = s as Partial<Scorecard>;
  if (!c || typeof c !== "object") return ["not an object"];
  if (!c.id) p.push("missing id");
  if (c.kind !== "preset" && c.kind !== "effect") p.push("kind must be preset|effect");
  if (!c.medium) p.push("missing medium");
  if (!Array.isArray(c.referenceRefs) || c.referenceRefs.length === 0) p.push("needs ≥1 referenceRef");
  if (!c.severity || !SEVERITIES.includes(c.severity)) p.push("bad severity");
  for (const crit of RUBRIC_CRITERIA) {
    const v = c.scores?.[crit];
    if (typeof v !== "number" || v < 1 || v > 5) p.push(`score ${crit} must be 1–5`);
  }
  return p;
}

export type ReferenceEntry = {
  id: string; medium: string; source: string; license: string;
  redistribute: boolean; demonstrates: string;
};

export function validateReference(r: unknown): string[] {
  const p: string[] = [];
  const e = r as Partial<ReferenceEntry>;
  if (!e || typeof e !== "object") return ["not an object"];
  for (const k of ["id", "medium", "source", "license", "demonstrates"] as const) {
    if (!e[k]) p.push(`missing ${k}`);
  }
  if (typeof e.redistribute !== "boolean") p.push("redistribute must be boolean");
  return p;
}

export function presetCoverage(scored: string[]): { covered: string[]; missing: string[] } {
  const set = new Set(scored);
  return {
    covered: ALL_PRESET_NAMES.filter((n) => set.has(n)),
    missing: ALL_PRESET_NAMES.filter((n) => !set.has(n)),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/test/audit-schema.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/audit/schema.ts src/test/audit-schema.test.ts
git commit -m "audit: scorecard/reference schema + preset coverage"
```

---

### Task 3: Author the authenticity rubric

**Files:**
- Create: `docs/audit/rubric.md`

**Interfaces:**
- Consumes: `RUBRIC_CRITERIA` (Task 2), the 9 category headers in `src/lib/effect-info.ts`.

- [ ] **Step 1: Write `docs/audit/rubric.md`**

Write the rubric document. It MUST contain, with no placeholders:
- The **scoring scale 1–5** with a concrete definition per level (1 = wrong/generic filter, 3 = plausible but off, 5 = indistinguishable from reference).
- One short paragraph per **RUBRIC_CRITERIA** axis (`physicalPlausibility`, `parameterBehaviour`, `artifactCorrectness`, `defaults`, `eraFit`) saying exactly what evidence raises/lowers the score.
- A section per **effect category** (all 9 from `effect-info.ts`: Color & Grade : Primary Grade / Colour Signal; Display & CRT : Optics; Tape & Dropouts : Video Artifacts / Temporal Instability / Tape Mechanics; Film : Grain & Gate; Digital & Compression : Digital Noise; Sensor & Lens; Media Aging) naming the specific real-world artifact to check that category against.
- The hard rule: **no score without a `referenceRef`**, and severity definitions (none/low/med/high) tied to "how visible is the inaccuracy in a normal export."

- [ ] **Step 2: Verify coverage of categories**

Run: `grep -c "Tape & Dropouts\|Display & CRT\|Film :\|Digital & Compression\|Sensor & Lens\|Media Aging\|Color & Grade" docs/audit/rubric.md`
Expected: ≥ 9 (every category named).

- [ ] **Step 3: Commit**

```bash
git add docs/audit/rubric.md
git commit -m "audit: authenticity rubric (scale, criteria, per-category checks)"
```

---

### Task 4: Reference corpus structure + license policy

**Files:**
- Create: `docs/audit/references/manifest.json`
- Create: `docs/audit/references/README.md`

**Interfaces:**
- Consumes: `validateReference` (Task 2).

- [ ] **Step 1: Create the manifest skeleton + policy**

`docs/audit/references/manifest.json` — a JSON array of `ReferenceEntry` objects (Task 2 shape). Seed it with **at least one real, license-cleared VHS/consumer-tape reference** (URL in `source`, real `license`, `redistribute` set honestly, `demonstrates` describing the artifact). Example entry shape (replace with a real cleared source):

```json
[
  {
    "id": "vhs-consumer-1989",
    "medium": "vhs",
    "source": "https://archive.org/details/<cleared-item>",
    "license": "Public Domain",
    "redistribute": true,
    "demonstrates": "head-switching noise band, chroma bleed, soft luma, dropout streaks"
  }
]
```

`docs/audit/references/README.md` — the **license policy**: commercial product ⇒ only `redistribute: true` assets may be bundled/committed; `redistribute: false` references are cited by URL + provenance only and never shipped. Document the acquisition checklist (medium, era, what artifact it proves, license check).

- [ ] **Step 2: Validate the manifest against the schema**

Run:
```bash
node --input-type=module -e "import('./src/lib/audit/schema.ts').catch(()=>{}); const m=JSON.parse(require('fs').readFileSync('docs/audit/references/manifest.json')); console.log('entries', m.length); if(!m.length) process.exit(1);"
```
Expected: `entries 1` (or more). (Schema-shape is unit-covered in Task 2; this just confirms the file parses and is non-empty.)

- [ ] **Step 3: Commit**

```bash
git add docs/audit/references/manifest.json docs/audit/references/README.md
git commit -m "audit: reference corpus manifest skeleton + commercial license policy"
```

---

### Task 5: Coverage report generator (Node script)

**Files:**
- Create: `tools/audit/report.mjs`
- Create: `docs/audit/coverage.md` (generated output, committed as the living tracker)

**Interfaces:**
- Consumes: `listPresets` / `ALL_PRESET_NAMES` (Task 1), `presetCoverage` (Task 2), the scorecards directory `docs/audit/scorecards/*.json`.

- [ ] **Step 1: Write the report script**

```js
// tools/audit/report.mjs
// Emits docs/audit/coverage.md: which presets are scored vs outstanding.
// Reads every docs/audit/scorecards/*.json (array of scorecards) and diffs the
// scored ids against the full preset inventory.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, "..", "..");
const { ALL_PRESET_NAMES } = await import(pathToFileURL(path.join(root, "src/lib/audit/inventory.ts")));
const { presetCoverage } = await import(pathToFileURL(path.join(root, "src/lib/audit/schema.ts")));

const dir = path.join(root, "docs/audit/scorecards");
const scored = new Set();
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    for (const c of JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))) {
      if (c.kind === "preset" && c.id) scored.add(c.id);
    }
  }
}
const cov = presetCoverage([...scored]);
const pct = ((cov.covered.length / ALL_PRESET_NAMES.length) * 100).toFixed(1);
const out = [
  `# Audit coverage`, ``,
  `Presets scored: **${cov.covered.length} / ${ALL_PRESET_NAMES.length}** (${pct}%)`, ``,
  `## Outstanding presets`, ``,
  ...cov.missing.map((n) => `- [ ] ${n}`), ``,
].join("\n");
fs.writeFileSync(path.join(root, "docs/audit/coverage.md"), out);
console.log(`coverage: ${cov.covered.length}/${ALL_PRESET_NAMES.length} (${pct}%)`);
```

> Note: `report.mjs` imports `.ts` directly. If Node can't resolve the TS import in this repo's setup, run it with the project's TS loader (`npx tsx tools/audit/report.mjs`) — confirm which works in Step 2 and pin that command in the README (Task 7).

- [ ] **Step 2: Run it and verify output**

Run: `npx tsx tools/audit/report.mjs` (fall back to `node tools/audit/report.mjs` if `tsx` isn't needed)
Expected: prints `coverage: 0/193 (0.0%)` and writes `docs/audit/coverage.md` listing 193 unchecked presets.

- [ ] **Step 3: Commit**

```bash
git add tools/audit/report.mjs docs/audit/coverage.md
git commit -m "audit: coverage report generator + initial 0/193 tracker"
```

---

### Task 6: Contact-sheet comparison renderer (in-app tool)

**Files:**
- Create: `tools/audit/contact-sheet.snippet.js`

**Interfaces:**
- Consumes: `CRTRendererFull` (`src/lib/crt-renderer-full.js`), `PRESETS` (`src/lib/presets.js`) — mirrors the existing `tools/gpu-coverage.snippet.js` load pattern.

- [ ] **Step 1: Write the snippet (adapt `tools/gpu-coverage.snippet.js`)**

Create an in-app devtools snippet that:
- loads `CRTRendererFull` + `PRESETS` exactly like `tools/gpu-coverage.snippet.js` (dynamic `import('/src/lib/...')`);
- takes an input frame — either the neutral test chart from the gpu-coverage snippet OR a loaded reference still (a `loadImage(url)` helper reading from `docs/audit/references/`);
- renders a chosen **subset of presets** (filter by name substring, e.g. all VHS-family names) at a fixed size onto one tiled **contact-sheet canvas**, each cell labelled with the preset name;
- triggers a PNG download of the contact sheet (`a.download = 'contact-vhs.png'`).

Reuse the renderer setup (`new CRTRendererFull()`, `setImage`, `render(ctx,w,h,t,params,frame,fps,{})`) from the gpu-coverage snippet verbatim where possible.

- [ ] **Step 2: Run it and verify**

Start the app (`npm run electron:dev` or the preview tooling on port 5176), paste the snippet into the devtools console with a VHS-name filter, and confirm a `contact-vhs.png` downloads showing each VHS preset rendered + labelled. (This is a visual tool; no unit test.)

- [ ] **Step 3: Commit**

```bash
git add tools/audit/contact-sheet.snippet.js
git commit -m "audit: contact-sheet comparison renderer (in-app snippet)"
```

---

### Task 7: Pilot — score the VHS / consumer-tape family end-to-end

**Files:**
- Create: `docs/audit/scorecards/vhs.json` (array of `Scorecard`)
- Modify: `docs/audit/references/manifest.json` (ensure ≥1 cleared VHS reference)
- Modify: `docs/audit/coverage.md` (regenerated)

**Interfaces:**
- Consumes: rubric (Task 3), references (Task 4), contact sheet (Task 6), `validateScorecard` (Task 2), report script (Task 5).

- [ ] **Step 1: Identify the VHS-family presets**

Run: `node -e "const {PRESETS}=require('./src/lib/presets.js'); console.log(Object.keys(PRESETS).filter(n=>/vhs|tape|consumer|rental|bootleg|ep |sp |camcorder|hi8|video8/i.test(n)))"`
(If `require` fails on the ESM module, list them from the contact sheet instead.)
Record the list — these are the pilot's scope.

- [ ] **Step 2: Score each pilot preset against the reference**

For every VHS-family preset, compare its contact-sheet cell against the cleared VHS reference and write a `Scorecard` object into `docs/audit/scorecards/vhs.json`: `id`, `kind:"preset"`, `medium:"vhs"`, `referenceRefs` (manifest ids), a 1–5 `score` per `RUBRIC_CRITERIA` axis, `severity`, and a concrete `note` (what's wrong vs the reference, e.g. "dropouts too uniform; real tape drops are clustered + chroma-only"). Also score the core **tape/dropout effects** (`kind:"effect"`) the family relies on.

- [ ] **Step 3: Validate every pilot scorecard**

Run:
```bash
npx tsx -e "import('./src/lib/audit/schema.ts').then(({validateScorecard})=>{const c=require('fs').readFileSync('docs/audit/scorecards/vhs.json','utf8');const cards=JSON.parse(c);const bad=cards.flatMap(x=>validateScorecard(x).map(p=>x.id+': '+p));if(bad.length){console.error(bad.join('\n'));process.exit(1);}console.log('all',cards.length,'pilot cards valid');})"
```
Expected: `all <N> pilot cards valid` (exit 0). Fix any reported problems.

- [ ] **Step 4: Regenerate coverage**

Run: `npx tsx tools/audit/report.mjs`
Expected: coverage % rises; every VHS-family preset moves out of the outstanding list in `docs/audit/coverage.md`.

- [ ] **Step 5: Commit**

```bash
git add docs/audit/scorecards/vhs.json docs/audit/references/manifest.json docs/audit/coverage.md
git commit -m "audit: pilot — VHS/consumer-tape family scored against reference"
```

---

### Task 8: Prioritized fix-list + audit README (the loop)

**Files:**
- Create: `docs/audit/FIX-LIST.md`
- Create: `docs/audit/README.md`

**Interfaces:**
- Consumes: all pilot scorecards (Task 7), the tooling commands (Tasks 5–6).

- [ ] **Step 1: Write `docs/audit/FIX-LIST.md`**

Aggregate every pilot scorecard with `severity` ≥ `low` into a prioritized table — columns: `effect/preset`, `medium`, `problem (vs reference)`, `severity`, `est. effort`, `fix lane` (`CPU-now` vs `port-time` for the engine leap). Sort by severity then effort. This file is the artifact Track Q and Track E (engine leap) consume.

- [ ] **Step 2: Write `docs/audit/README.md`**

Document the method end-to-end so scoring the remaining mediums is a repeatable loop: the rubric, the reference/license policy, the exact tooling commands (pin the working `report.mjs` command from Task 5 Step 2 and the contact-sheet usage), the scorecard shape, and the per-medium loop ("add cleared reference → render contact sheet → score → validate → regenerate coverage → append to FIX-LIST"). Link every audit artifact.

- [ ] **Step 3: Verify the fix-list reflects the pilot**

Run: `grep -c "| " docs/audit/FIX-LIST.md`
Expected: ≥ 1 data row beyond the header (the pilot produced real fixes).

- [ ] **Step 4: Final test sweep + commit**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass (87 existing + audit helper tests), tsc clean.

```bash
git add docs/audit/FIX-LIST.md docs/audit/README.md
git commit -m "audit: prioritized fix-list + README (repeatable per-medium loop)"
```

---

## Self-Review

**Spec coverage** (against `docs/superpowers/specs/2026-06-27-v2-roadmap-design.md` §Epic 0):
- "real reference footage/stills per medium" → Tasks 4, 7 (manifest + cleared VHS reference; license policy in Global Constraints).
- "per-effect authenticity rubric" → Task 3 (+ `RUBRIC_CRITERIA` in Task 2).
- "score every effect and every preset" → Tasks 1–2 establish total inventory + coverage; Task 7 pilots the scoring loop; Task 8 documents finishing it. (Full 193 scoring is the tracked loop, per Global Constraints — deliberate, not a gap.)
- "prioritized fix list" → Task 8 (`FIX-LIST.md`).
- "curated reference corpus stored in-repo / documented external location" → Task 4 (manifest + redistribute flag for in-repo vs URL-only).
- "language-agnostic, doubles as engine fidelity target" → `FIX-LIST.md` `fix lane` column (Task 8) marks CPU-now vs port-time.

**Placeholder scan:** code steps contain full code; doc steps specify exact required contents + a grep/validate verification. The one runtime unknown (does `report.mjs` resolve the `.ts` import under Node vs `tsx`) is called out with a fallback command and pinned in Task 7/8 — not a placeholder.

**Type consistency:** `Scorecard` / `ReferenceEntry` / `RUBRIC_CRITERIA` defined in Task 2 are used unchanged in Tasks 5, 7, 8; `ALL_PRESET_NAMES` / `presetCoverage` / `listPresets` names match across Tasks 1, 2, 5.
