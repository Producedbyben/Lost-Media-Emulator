# Premiere Surfaces → Desktop Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Premiere CEP extension, UXP panel, and C++ effects to parity with the Jun-27 Lost Media Emulator desktop app, so a Premiere editor gets the same looks the desktop produces.

**Architecture:** The desktop app is the source of truth. `lost-media-premiere-panel/tools/gen-presets.cjs` reads the app's `presets.js` + `format-profiles.js` + `crt-renderer-full.js` and generates `presets.data.js` + `js/lme-render.js` for the panels; its `map()` translates app params into the C++ effect parameter arrays. The C++ effects (`lost-media-premiere-plugin`) are the native render path. Work lands in three ordered layers: (1) regenerate/propagate panel data, (2) port new pixel-math into the C++ effects, (3) panel UI parity.

**Tech Stack:** Node.js (generator, CommonJS), C++14 (AE/PrPro Effect SDK, `clang++ -bundle`, universal arm64+x86_64), HTML/JS (CEP + UXP panels).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-28-premiere-surfaces-parity-design.md` — authoritative for scope and the Film 15-param layout.
- **Source of truth for all effect math:** `~/Projects/build-together-desktop/src/lib/crt-renderer-full.js` (the CPU renderer) and the named desktop commits.
- **Out of scope:** Epic 6 GPU (`effects-core/*.wgsl`, `webgpu-backend.ts`), audio (Epic 4), ffmpeg export — no native target.
- **AE SDK path:** `AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK"`.
- **Build command (all effects):** `cd ~/Projects/lost-media-premiere-plugin && AE_SDK="…" ./build.sh` (universal binary). `install` target needs `sudo` → owner's machine.
- **The two panels share identical generated files** (`presets.data.js`, `js/lme-render.js`); only their shells differ.
- **Param index order in C++ must match the `map()` `fx.<effect>` array index** (effect param index `i` ↔ `fx[i-1]`, since index 0 is INPUT).
- **Acceptance for C++ visual correctness is the owner's eyeball in Premiere** after `sudo ./build.sh install`. Automated gates here = clean universal compile + param-layout parity check.
- **Repos `lost-media-premiere-{plugin,panel,cep}` are not git repos until Task 1.** All commit steps assume Task 1 ran first.

---

## Phase 0 — Foundation

### Task 1: git-init the three plugin repos

**Files:**
- Create: `~/Projects/lost-media-premiere-plugin/.gitignore`
- Create: `~/Projects/lost-media-premiere-panel/.gitignore`
- Create: `~/Projects/lost-media-premiere-cep/.gitignore`

**Interfaces:**
- Produces: three git repos on `main` with a clean initial commit, so every later task can commit.

- [ ] **Step 1: Write `.gitignore` for the plugin repo**

`~/Projects/lost-media-premiere-plugin/.gitignore`:
```
build/
*.plugin
Adobe Premiere Pro Auto-Save/
*.prproj
*.prin
.DS_Store
```

- [ ] **Step 2: Write `.gitignore` for the panel repo**

`~/Projects/lost-media-premiere-panel/.gitignore`:
```
node_modules/
.DS_Store
```

- [ ] **Step 3: Write `.gitignore` for the CEP repo**

`~/Projects/lost-media-premiere-cep/.gitignore`:
```
node_modules/
.debug/
.DS_Store
```

- [ ] **Step 4: Init each repo and make the initial commit**

```bash
for d in lost-media-premiere-plugin lost-media-premiere-panel lost-media-premiere-cep; do
  cd ~/Projects/$d
  git init -q
  git add -A
  git commit -q -m "chore: initial commit — import existing $d state

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
  echo "$d: $(git rev-parse --short HEAD)"
done
```

- [ ] **Step 5: Verify all three are on `main` with one commit**

Run: `for d in lost-media-premiere-plugin lost-media-premiere-panel lost-media-premiere-cep; do (cd ~/Projects/$d && echo "$d $(git branch --show-current) $(git rev-list --count HEAD)"); done`
Expected: each prints `… main 1`.

---

## Phase 1 — Layer 1: Data / renderer sync

### Task 2: Extend `map()` for the Film 15-slot layout

The Jun-27 app params `printFade{Cyan,Magenta,Yellow}`, `technicolorFringe`, `nitrateDecay`, `polaroidCrossover`, `irHotspot` have no C++ home. Extend the generator's `map()` so the regenerated presets carry them in the new Film array order (spec §5a).

**Files:**
- Modify: `~/Projects/lost-media-premiere-panel/tools/gen-presets.cjs:99-111` (the `filmAct` block + `fx.film` array)
- Modify: `~/Projects/lost-media-premiere-panel/tools/gen-presets.cjs:49` (`filmAct` activation keys)

**Interfaces:**
- Produces: `fx.film` is a 15-element array indexed exactly: `[grain, halation, gateWeave, dust, flicker, vignette, warmth, fadeC, fadeM, fadeY, irFalse, technicolorFringe, nitrateDecay, polaroidCrossover, irHotspot]`.

- [ ] **Step 1: Broaden `filmAct` to trigger on the new looks**

Replace the `filmAct` line (currently `gen-presets.cjs:49`):
```js
  const filmAct = ["advancedFilmGrain", "advancedFilmHalation", "advancedFilmGateWeave", "advancedFilmDust", "advancedFilmScratches", "printFadeCyan", "printFadeMagenta", "printFadeYellow", "infraredFalseColor", "technicolorFringe", "nitrateDecay", "polaroidCrossover", "irHotspot"].some((k) => g(p, k) > 0.02);
```

- [ ] **Step 2: Replace the `fx.film` array with the 15-slot layout**

Replace the `if (filmAct) { fx.film = [ … ]; }` block (currently `gen-presets.cjs:99-111`):
```js
  if (filmAct) {
    fx.film = [
      cl(g(p, "advancedFilmGrain") * 100),                                   // 0 Grain
      cl(g(p, "advancedFilmHalation") * 100),                                // 1 Halation
      cl(g(p, "advancedFilmGateWeave") * 100),                               // 2 Gate Weave
      cl(Math.max(g(p, "advancedFilmDust"), g(p, "advancedFilmScratches")) * 100), // 3 Dust & Scratches
      cl(g(p, "advancedExposurePump") * 100),                                // 4 Flicker
      cl(g(p, "vignette") * 100),                                            // 5 Vignette
      cl(Math.max(0, g(p, "imageTemperature")) * 100),                       // 6 Warmth
      cl(g(p, "printFadeCyan") * 100),                                       // 7 Fade Cyan
      cl(g(p, "printFadeMagenta") * 100),                                    // 8 Fade Magenta
      cl(g(p, "printFadeYellow") * 100),                                     // 9 Fade Yellow
      cl(g(p, "infraredFalseColor") * 100),                                  // 10 IR False Color
      cl(g(p, "technicolorFringe") * 100),                                   // 11 Technicolor Fringe
      cl(g(p, "nitrateDecay") * 100),                                        // 12 Nitrate Decay
      cl(g(p, "polaroidCrossover") * 100),                                   // 13 Polaroid Crossover
      cl(g(p, "irHotspot") * 100),                                           // 14 IR Hotspot
    ];
  }
```

- [ ] **Step 3: Commit (generator change only; regeneration is Task 3)**

```bash
cd ~/Projects/lost-media-premiere-panel
git add tools/gen-presets.cjs
git commit -m "feat(gen): route Jun-27 film/sensor params into 15-slot Film array

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 3: Regenerate panel data + renderer and verify invariants

**Files:**
- Create: `~/Projects/lost-media-premiere-panel/tools/verify-presets.cjs`
- Regenerate (via generator): `~/Projects/lost-media-premiere-panel/presets.data.js`, `~/Projects/lost-media-premiere-panel/js/lme-render.js`

**Interfaces:**
- Consumes: the extended `map()` from Task 2.
- Produces: `presets.data.js` with `LM_PRESETS.length === 102` and 15-element `fx.film` arrays on film-active looks; `js/lme-render.js` matching the desktop `crt-renderer-full.js`.

- [ ] **Step 1: Write the verification script (the automated test for this layer)**

`~/Projects/lost-media-premiere-panel/tools/verify-presets.cjs`:
```js
// Load the generated panel data in a sandbox and assert sync invariants.
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const PANEL = path.resolve(__dirname, "..");
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(PANEL + "/presets.data.js", "utf8"), ctx);
const P = ctx.window.LM_PRESETS || [];
const fail = (m) => { console.error("FAIL: " + m); process.exit(1); };

if (P.length !== 102) fail(`LM_PRESETS.length = ${P.length}, expected 102`);

// Every film-active look carries the full 15-slot Film array.
for (const pr of P) {
  if (pr.fx && pr.fx.film && pr.fx.film.length !== 15)
    fail(`${pr.name}: fx.film length ${pr.fx.film.length}, expected 15`);
}

// The Jun-27 looks are present.
for (const name of ["Kodachrome 1960s", "Nitrate Newsreel 1930s", "Technicolor Print 1950s"]) {
  if (!P.some((p) => p.name === name)) fail(`missing new look: ${name}`);
}

// The renderer bundle is a faithful copy of the desktop CPU renderer.
const APP = "/Users/ben/Projects/build-together-desktop/src/lib/crt-renderer-full.js";
const appSrc = fs.readFileSync(APP, "utf8").replace(/^export\s+class\s+CRTRendererFull/m, "class CRTRendererFull");
const bundle = fs.readFileSync(PANEL + "/js/lme-render.js", "utf8");
if (!bundle.includes(appSrc.trim().slice(0, 200))) fail("lme-render.js does not contain the current desktop renderer head");

console.log(`OK: ${P.length} presets, all film arrays = 15 slots, new looks present, renderer current`);
```

> Note: confirm the exact look names ("Kodachrome 1960s" etc.) against `build-together-desktop/src/lib/presets.js` `PRESETS` keys before running; adjust the array in Step 1 to three real Jun-27 keys if they differ.

- [ ] **Step 2: Run the generator**

Run: `cd ~/Projects/lost-media-premiere-panel && node tools/gen-presets.cjs`
Expected: prints `wrote 102 presets, <n> capture, <n> display, <n> recipes …`.

- [ ] **Step 3: Run the verification script — expect PASS**

Run: `cd ~/Projects/lost-media-premiere-panel && node tools/verify-presets.cjs`
Expected: `OK: 102 presets, all film arrays = 15 slots, new looks present, renderer current`.
(If it fails on look names, fix the names in Step 1 per the note, re-run.)

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/lost-media-premiere-panel
git add tools/verify-presets.cjs presets.data.js js/lme-render.js
git commit -m "feat: regenerate panel data + renderer from Jun-27 desktop (102 looks, 15-slot Film)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4: Propagate generated files to the CEP extension

**Files:**
- Overwrite: `~/Projects/lost-media-premiere-cep/presets.data.js` (copy of panel's)
- Overwrite: `~/Projects/lost-media-premiere-cep/js/lme-render.js` (copy of panel's)

**Interfaces:**
- Consumes: the regenerated panel files from Task 3.
- Produces: CEP carries byte-identical generated files.

- [ ] **Step 1: Copy both generated files**

```bash
cp ~/Projects/lost-media-premiere-panel/presets.data.js ~/Projects/lost-media-premiere-cep/presets.data.js
cp ~/Projects/lost-media-premiere-panel/js/lme-render.js ~/Projects/lost-media-premiere-cep/js/lme-render.js
```

- [ ] **Step 2: Verify byte-identical**

Run: `diff -q ~/Projects/lost-media-premiere-panel/presets.data.js ~/Projects/lost-media-premiere-cep/presets.data.js && diff -q ~/Projects/lost-media-premiere-panel/js/lme-render.js ~/Projects/lost-media-premiere-cep/js/lme-render.js && echo IDENTICAL`
Expected: `IDENTICAL`.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/lost-media-premiere-cep
git add presets.data.js js/lme-render.js
git commit -m "feat: sync presets + renderer from panel (Jun-27 desktop, 102 looks)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 — Layer 2: C++ Film effect new looks

### Task 5: Film header + ParamsSetup — 15-param layout

**Files:**
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaFilm.h:26-50` (param enums)
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaFilm.cpp:43-56` (`ParamsSetup`)
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaFilm.cpp:60-68` (param reads in `Render`)
- Create: `~/Projects/lost-media-premiere-plugin/tools/check-film-layout.sh`

**Interfaces:**
- Produces: param index order `GRAIN=1…WARMTH=7, FADE_C=8, FADE_M=9, FADE_Y=10, IRFALSE=11, FRINGE=12, NITRATE=13, POLAROID=14, HOTSPOT=15`, `FILM_NUM_PARAMS=16`. Render reads `fadeC, fadeM, fadeY, irfc, fringe, nitrate, polaroid, hotspot` as doubles in 0..1.

- [ ] **Step 1: Replace the param enums in the header**

Replace `LostMediaFilm.h:26-50` (both enums):
```cpp
enum {
    FILM_INPUT = 0,
    FILM_GRAIN,
    FILM_HALATION,
    FILM_WEAVE,
    FILM_DUST,
    FILM_FLICKER,
    FILM_VIGNETTE,
    FILM_WARMTH,
    FILM_FADE_C,       /* per-channel print dye-fade (cyan record) */
    FILM_FADE_M,       /* magenta record */
    FILM_FADE_Y,       /* yellow record */
    FILM_IRFALSE,      /* Aerochrome IR false-colour */
    FILM_FRINGE,       /* Technicolor 3-strip registration fringe */
    FILM_NITRATE,      /* nitrate chemical decay */
    FILM_POLAROID,     /* Polaroid SX-70 colour crossover */
    FILM_HOTSPOT,      /* IR illuminator central hotspot */
    FILM_NUM_PARAMS
};

enum {
    FILM_GRAIN_ID = 1,
    FILM_HALATION_ID,
    FILM_WEAVE_ID,
    FILM_DUST_ID,
    FILM_FLICKER_ID,
    FILM_VIGNETTE_ID,
    FILM_WARMTH_ID,
    FILM_FADE_C_ID,    /* reuses old FILM_FADE_ID = 8 */
    FILM_IRFALSE_ID,   /* = 9, unchanged */
    FILM_FADE_M_ID,    /* = 10 (new) */
    FILM_FADE_Y_ID,    /* = 11 (new) */
    FILM_FRINGE_ID,    /* = 12 (new) */
    FILM_NITRATE_ID,   /* = 13 (new) */
    FILM_POLAROID_ID,  /* = 14 (new) */
    FILM_HOTSPOT_ID    /* = 15 (new) */
};
```

- [ ] **Step 2: Replace `ParamsSetup` param declarations**

Replace `LostMediaFilm.cpp:45-54` (the `PF_ADD_*` block + `num_params`):
```cpp
    PF_ADD_FLOAT_SLIDERX("Grain", 0, 100, 0, 100, 22, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_GRAIN_ID);
    PF_ADD_FLOAT_SLIDERX("Halation", 0, 100, 0, 100, 30, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_HALATION_ID);
    PF_ADD_FLOAT_SLIDERX("Gate Weave", 0, 100, 0, 100, 25, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_WEAVE_ID);
    PF_ADD_FLOAT_SLIDERX("Dust & Scratches", 0, 100, 0, 100, 20, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_DUST_ID);
    PF_ADD_FLOAT_SLIDERX("Flicker", 0, 100, 0, 100, 15, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_FLICKER_ID);
    PF_ADD_FLOAT_SLIDERX("Vignette", 0, 100, 0, 100, 30, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_VIGNETTE_ID);
    PF_ADD_FLOAT_SLIDERX("Warmth", 0, 100, 0, 100, 35, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_WARMTH_ID);
    PF_ADD_FLOAT_SLIDERX("Fade Cyan", 0, 100, 0, 100, 0, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_FADE_C_ID);
    PF_ADD_FLOAT_SLIDERX("Fade Magenta", 0, 100, 0, 100, 0, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_FADE_M_ID);
    PF_ADD_FLOAT_SLIDERX("Fade Yellow", 0, 100, 0, 100, 0, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_FADE_Y_ID);
    PF_ADD_FLOAT_SLIDERX("IR False Color", 0, 100, 0, 100, 0, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_IRFALSE_ID);
    PF_ADD_FLOAT_SLIDERX("Technicolor Fringe", 0, 100, 0, 100, 0, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_FRINGE_ID);
    PF_ADD_FLOAT_SLIDERX("Nitrate Decay", 0, 100, 0, 100, 0, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_NITRATE_ID);
    PF_ADD_FLOAT_SLIDERX("Polaroid Crossover", 0, 100, 0, 100, 0, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_POLAROID_ID);
    PF_ADD_FLOAT_SLIDERX("IR Hotspot", 0, 100, 0, 100, 0, 1, PF_ValueDisplayFlag_PERCENT, 0, FILM_HOTSPOT_ID);
    out_data->num_params = FILM_NUM_PARAMS;
```

- [ ] **Step 3: Replace the param reads in `Render`**

Replace `LostMediaFilm.cpp:67-68` (the `fade`/`irfc` reads) with:
```cpp
    const double fadeC  = params[FILM_FADE_C]->u.fs_d.value   / 100.0;
    const double fadeM  = params[FILM_FADE_M]->u.fs_d.value   / 100.0;
    const double fadeY  = params[FILM_FADE_Y]->u.fs_d.value   / 100.0;
    const double irfc   = params[FILM_IRFALSE]->u.fs_d.value  / 100.0;
    const double fringe   = params[FILM_FRINGE]->u.fs_d.value   / 100.0;
    const double nitrate  = params[FILM_NITRATE]->u.fs_d.value  / 100.0;
    const double polaroid = params[FILM_POLAROID]->u.fs_d.value / 100.0;
    const double hotspot  = params[FILM_HOTSPOT]->u.fs_d.value  / 100.0;
```
(The render body still references `fade`; Task 6 replaces that block, so a transient compile break here is expected and resolved in Task 6. Do Steps 1-3 and Task 6 Step 1 before compiling.)

- [ ] **Step 4: Write the layout-parity check script**

`~/Projects/lost-media-premiere-plugin/tools/check-film-layout.sh`:
```bash
#!/bin/bash
# Assert the Film effect's PF_ADD label order matches the expected 15-slot layout.
set -e
EXPECT=("Grain" "Halation" "Gate Weave" "Dust & Scratches" "Flicker" "Vignette" "Warmth" "Fade Cyan" "Fade Magenta" "Fade Yellow" "IR False Color" "Technicolor Fringe" "Nitrate Decay" "Polaroid Crossover" "IR Hotspot")
mapfile -t GOT < <(grep -oE 'PF_ADD_FLOAT_SLIDERX\("[^"]+"' src/LostMediaFilm.cpp | sed -E 's/.*\("([^"]+)"/\1/')
if [ "${#GOT[@]}" -ne "${#EXPECT[@]}" ]; then echo "FAIL: ${#GOT[@]} params, expected ${#EXPECT[@]}"; exit 1; fi
for i in "${!EXPECT[@]}"; do
  if [ "${GOT[$i]}" != "${EXPECT[$i]}" ]; then echo "FAIL: slot $i = '${GOT[$i]}', expected '${EXPECT[$i]}'"; exit 1; fi
done
echo "OK: Film param layout matches the 15-slot map() order"
```

- [ ] **Step 5: Run the layout check — expect PASS**

Run: `cd ~/Projects/lost-media-premiere-plugin && chmod +x tools/check-film-layout.sh && ./tools/check-film-layout.sh`
Expected: `OK: Film param layout matches the 15-slot map() order`.

(Commit happens at the end of Task 6, once the render body compiles.)

### Task 6: Film render — per-channel print fade + Aerochrome fix

Port the exact grade math from `crt-renderer-full.js:1683-1708` into the Film render loop, working in the loop's 0..1 RGB space. Replaces the old single-`fade` block and the old `irfc` block.

**Files:**
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaFilm.cpp:95-124` (the `irfc` + `fade`/`warm` blocks inside the per-pixel loop)

**Interfaces:**
- Consumes: `fadeC, fadeM, fadeY, irfc` from Task 5.

- [ ] **Step 1: Replace the IR false-colour block with the fixed Aerochrome rotation**

Replace `LostMediaFilm.cpp:95-103` (the `if (irfc > 0) { … }` block):
```cpp
            /* Aerochrome IR false-colour (renderer crt-renderer-full.js:1683-1697):
               green->vivid red, red->muted green, sky stays blue; magenta lift on
               vegetated pixels. Renderer constants are 0..255 additive → /255 here. */
            if (irfc > 0) {
                const double r0 = R, g0 = G, b0 = B;
                const double sky = fmax(0.0, b0 - fmax(r0, g0));
                const double veg = fmax(0.0, g0 - fmax(r0, b0));
                const double tt  = irfc * (1.0 - sky * 0.75);
                const double nr = g0 * 1.1 + veg * irfc * (80.0 / 255.0);
                const double ng = r0 * 0.45 + b0 * 0.15;
                const double nb = b0 * 0.82 + r0 * 0.08;
                R = r0 * (1.0 - tt) + nr * tt;
                G = g0 * (1.0 - tt) + ng * tt;
                B = b0 * (1.0 - tt) + nb * tt - veg * irfc * (30.0 / 255.0) + sky * irfc * (14.0 / 255.0);
            }
```

- [ ] **Step 2: Replace the single Print-Fade block with per-channel CMY**

Replace `LostMediaFilm.cpp:118-123` (the `if (fade > 0) { … }` block; keep the `warm` line that follows at line 124):
```cpp
            /* Per-channel print dye-fade (renderer crt-renderer-full.js:1703-1708):
               shadow-weighted lift per channel. sh = (1 - luma)^0.7. */
            if (fadeC > 0 || fadeM > 0 || fadeY > 0) {
                const double luma = R * 0.2126 + G * 0.7152 + B * 0.0722;
                const double sh = pow(fmax(0.0, 1.0 - luma), 0.7);
                R += fadeC * (16.0 + sh * 26.0) / 255.0;
                G += fadeM * (12.0 + sh * 20.0) / 255.0;
                B += fadeY * (16.0 + sh * 26.0) / 255.0;
            }
```

- [ ] **Step 3: Build the Film effect (proves Tasks 5-6 compile)**

Run: `cd ~/Projects/lost-media-premiere-plugin && AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK" ./build.sh`
Expected: `==> building Lost Media Film.plugin` with no clang errors; `build/Lost Media Film.plugin` exists.

- [ ] **Step 4: Confirm universal binary**

Run: `lipo -archs "build/Lost Media Film.plugin/Contents/MacOS/Lost Media Film"`
Expected: `x86_64 arm64`.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/lost-media-premiere-plugin
git add src/LostMediaFilm.h src/LostMediaFilm.cpp tools/check-film-layout.sh
git commit -m "feat(film): per-channel print fade + fixed Aerochrome rotation + 15-param layout

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 7: Film render — Polaroid crossover

Simple per-pixel port of `crt-renderer-full.js:1722-1732` (shadow/highlight-weighted channel shifts). Insert after the print-fade block.

**Files:**
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaFilm.cpp` (per-pixel loop, after the print-fade block from Task 6)

**Interfaces:**
- Consumes: `polaroid` from Task 5.

- [ ] **Step 1: Insert the Polaroid crossover block (after the print-fade block, before the `warm` line)**

```cpp
            /* Polaroid SX-70 crossover (renderer crt-renderer-full.js:1722-1732):
               greenish/yellow shadows crossing to warm pink highlights. /255. */
            if (polaroid > 0) {
                const double luma = R * 0.2126 + G * 0.7152 + B * 0.0722;
                const double shadowW = fmax(0.0, 1.0 - luma / 0.45);
                const double highlightW = fmax(0.0, (luma - 0.6) / 0.4);
                R += (shadowW * polaroid * (-8.0) + highlightW * polaroid * 18.0) / 255.0;
                G += (shadowW * polaroid * 14.0  + highlightW * polaroid * (-4.0)) / 255.0;
                B += (shadowW * polaroid * (-18.0) + highlightW * polaroid * (-10.0)) / 255.0;
            }
```

- [ ] **Step 2: Build and confirm universal**

Run: `cd ~/Projects/lost-media-premiere-plugin && AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK" ./build.sh && lipo -archs "build/Lost Media Film.plugin/Contents/MacOS/Lost Media Film"`
Expected: clean build; `x86_64 arm64`.

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/lost-media-premiere-plugin
git add src/LostMediaFilm.cpp
git commit -m "feat(film): Polaroid SX-70 colour crossover

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 8: Film render — Technicolor fringe + IR hotspot

Port `crt-renderer-full.js:1832-1848` (fringe = offset record copies) and `:1853-1866` (hotspot = central radial screen). The canvas composites become per-pixel functions: fringe reuses `sampleBilinear` (as halation does) to read offset records; hotspot is a screen-blend of a near-white radial gradient over a pixel-distance falloff. These are eyeball-gated approximations of the canvas blends.

**Files:**
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaFilm.cpp` (per-pixel loop, after Polaroid; needs `u,v,iW,iH,W,H` already in scope — they are)

**Interfaces:**
- Consumes: `fringe, hotspot` from Task 5; `sampleBilinear`, `lerpd`, `clampd` (existing helpers).

- [ ] **Step 1: Insert the Technicolor fringe block (offset record mis-registration)**

```cpp
            /* Technicolor 3-strip fringe (renderer crt-renderer-full.js:1832-1848):
               faint red-record screen at +shift, cyan-record multiply at -shift.
               shift in px = max(0.5, fringe*2.8). Approximated per-pixel via offset
               samples of the source (like halation's taps). */
            if (fringe > 0) {
                const double shift = fmax(0.5, fringe * 2.8);
                double sr, sg, sb, sd;
                /* Red record: desaturated, brightened, shifted +x/-y → screen onto R. */
                sampleBilinear(input, u * iW + shift, v * iH - shift * 0.3, &sr, &sg, &sb, &sd);
                const double rl = (sr * 0.2126 + sg * 0.7152 + sb * 0.0722) / 255.0 * 1.2;
                const double aR = fmin(0.28, fringe * 0.32);
                R = 1.0 - (1.0 - R) * (1.0 - rl * aR);           /* screen */
                /* Cyan record: hue-rotated, shifted -x/+y → multiply onto G,B. */
                sampleBilinear(input, u * iW - shift * 0.7, v * iH + shift * 0.2, &sr, &sg, &sb, &sd);
                const double cy = ((sg + sb) * 0.5) / 255.0 * 0.9;
                const double aC = fmin(0.18, fringe * 0.22);
                G *= (1.0 - aC) + cy * aC;                       /* multiply */
                B *= (1.0 - aC) + cy * aC;
            }
```

- [ ] **Step 2: Insert the IR hotspot block (central radial screen)**

```cpp
            /* IR illuminator central hotspot (renderer crt-renderer-full.js:1853-1866):
               near-white radial bloom from frame centre, screen-blended. Radii in px
               relative to min(W,H). */
            if (hotspot > 0) {
                const double minDim = (double)(W < H ? W : H);
                const double r0 = minDim * (0.08 + hotspot * 0.10);
                const double r1 = minDim * (0.35 + hotspot * 0.20);
                const double dx = (double)x - W * 0.5, dy = (double)y - H * 0.5;
                const double dist = sqrt(dx * dx + dy * dy);
                double a;                               /* gradient coverage */
                if (dist <= r0)      a = fmin(0.85, hotspot * 0.9);
                else if (dist >= r1) a = 0.0;
                else {
                    const double mid = r0 + 0.4 * (r1 - r0);
                    const double a0 = fmin(0.85, hotspot * 0.9);
                    const double a1 = fmin(0.45, hotspot * 0.5);
                    a = (dist < mid) ? lerpd(a0, a1, (dist - r0) / (mid - r0))
                                     : lerpd(a1, 0.0, (dist - mid) / (r1 - mid));
                }
                if (a > 0) {                            /* screen toward near-white */
                    R = lerpd(R, 1.0, a);
                    G = lerpd(G, 1.0, a);
                    B = lerpd(B, 1.0, a);
                }
            }
```

- [ ] **Step 3: Build, confirm universal, run layout check**

Run: `cd ~/Projects/lost-media-premiere-plugin && AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK" ./build.sh && lipo -archs "build/Lost Media Film.plugin/Contents/MacOS/Lost Media Film" && ./tools/check-film-layout.sh`
Expected: clean build; `x86_64 arm64`; `OK: Film param layout …`.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/lost-media-premiere-plugin
git add src/LostMediaFilm.cpp
git commit -m "feat(film): Technicolor fringe + IR hotspot (per-pixel ports)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 9: Film render — Nitrate decay + update PiPL

Port `crt-renderer-full.js:1794-1826` (multi-blotch screen + edge fog + mottle). Multi-blotch needs a small per-pixel loop over `N = max(2, round(nitrate*9))` seeded blotches using the existing `hash2`. Then update the PiPL resource so Premiere shows the new param set.

**Files:**
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaFilm.cpp` (per-pixel loop, after hotspot)
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaFilm_PiPL.r` (if it enumerates params/param-count; read first)

**Interfaces:**
- Consumes: `nitrate` from Task 5; `hash2`, `t` (frame), `W,H,x,y`.

- [ ] **Step 1: Hoist blotch centres above the pixel loop (deterministic per frame)**

Immediately before the `for (int y …)` loop, add:
```cpp
    /* Nitrate decay blotch centres — seeded per frame (renderer :1794-1811). */
    const int nBlotch = nitrate > 0 ? (int)fmax(2.0, floor(nitrate * 9.0 + 0.5)) : 0;
    double blotchX[9], blotchY[9], blotchR[9], blotchA[9];
    for (int b = 0; b < nBlotch; ++b) {
        blotchX[b] = hash2(b * 1.3, t * 0.07 + b * 0.41) * W;
        blotchY[b] = hash2(b * 0.87, t * 0.11 + b * 0.53) * H;
        blotchR[b] = (0.04 + hash2(b * 2.1, t * 0.05) * 0.12) * (W < H ? W : H);
        blotchA[b] = nitrate * (0.18 + hash2(b, t * 0.09) * 0.22);
    }
```

- [ ] **Step 2: Insert the nitrate per-pixel block (after the hotspot block)**

```cpp
            /* Nitrate decay (renderer crt-renderer-full.js:1794-1826): warm radial
               blotches (screen) + left-edge fog (screen) + mottle (darken). */
            if (nitrate > 0) {
                for (int b = 0; b < nBlotch; ++b) {
                    const double dx = (double)x - blotchX[b], dy = (double)y - blotchY[b];
                    const double d = sqrt(dx * dx + dy * dy) / blotchR[b];
                    if (d < 1.0) {
                        const double a = fmin(0.55, blotchA[b]) * (1.0 - d);
                        R = 1.0 - (1.0 - R) * (1.0 - (255.0 / 255.0) * a);  /* warm ~ (255,248,220) */
                        G = 1.0 - (1.0 - G) * (1.0 - (248.0 / 255.0) * a);
                        B = 1.0 - (1.0 - B) * (1.0 - (220.0 / 255.0) * a);
                    }
                }
                /* Left-edge fog: bright band over the first 20% width. */
                const double edge = fmax(0.0, 1.0 - (u / 0.2));
                const double fa = fmin(0.45, nitrate * 0.28) * edge;
                if (fa > 0) {
                    R = 1.0 - (1.0 - R) * (1.0 - (255.0 / 255.0) * fa);
                    G = 1.0 - (1.0 - G) * (1.0 - (250.0 / 255.0) * fa);
                    B = 1.0 - (1.0 - B) * (1.0 - (220.0 / 255.0) * fa);
                }
                /* Mottle: low-frequency darken (approximates the multiply-blur pass). */
                const double m = (hash2(floor(x / 8.0), floor(y / 8.0)) - 0.5) * nitrate * 0.30;
                R *= (1.0 - fmax(0.0, m)); G *= (1.0 - fmax(0.0, m)); B *= (1.0 - fmax(0.0, m));
            }
```

- [ ] **Step 3: Read the PiPL and update param metadata if present**

Run: `sed -n '1,80p' ~/Projects/lost-media-premiere-plugin/src/LostMediaFilm_PiPL.r`
If the `.r` hard-codes a param count or enumerates params, update it to 15 params matching Task 5's labels/IDs. If it only declares effect name/category/entry point (no per-param data — common for these SDK PiPLs), no change is needed.

- [ ] **Step 4: Build, confirm universal, run layout check**

Run: `cd ~/Projects/lost-media-premiere-plugin && AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK" ./build.sh && lipo -archs "build/Lost Media Film.plugin/Contents/MacOS/Lost Media Film" && ./tools/check-film-layout.sh`
Expected: clean build; `x86_64 arm64`; `OK`.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/lost-media-premiere-plugin
git add src/LostMediaFilm.cpp src/LostMediaFilm_PiPL.r
git commit -m "feat(film): nitrate chemical decay (blotches + edge fog + mottle)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 — Layer 2: Algorithm upgrades to existing effects

Each task: read the target `.cpp` first, port the named desktop fix's math (renderer/commit cited), rebuild that effect, confirm universal, commit. No new params — these change pixel math to match the desktop's improved algorithms. Visual correctness is the owner's eyeball gate; the automated gate is a clean universal compile.

### Task 10: VHS — clustered dropouts + torn head-switch band

**Files:**
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaVHS.cpp` (dropouts + head-switching code paths)

**Source math:** desktop commits `27f9a39` (dropouts → horizontal clustered streaks, not per-pixel speckle) and `f96af22` (head-switching → torn noisy band, not smooth skew). Cross-reference `crt-renderer-full.js` `advancedDropouts` / `advancedHeadSwitching` blocks.

- [ ] **Step 1: Read the VHS effect and locate the dropouts + head-switch blocks**

Run: `grep -nE 'dropout|head|switch|skew' ~/Projects/lost-media-premiere-plugin/src/LostMediaVHS.cpp` then read those regions.

- [ ] **Step 2: Port the clustered-streak dropouts**

Replace the per-pixel speckle dropout with horizontal clustered streaks: seed a small set of streak rows per frame (`hash2(floor(t), row)`), each spanning a contiguous x-range, writing desaturated/white-noise runs. Mirror the renderer's `advancedDropouts` constants from `crt-renderer-full.js`.

- [ ] **Step 3: Port the torn head-switch band**

Replace the smooth bottom skew with a torn noisy band: in the bottom ~8% of the frame, apply a per-row random horizontal tear offset plus injected noise, scaled by the head-switch param (renderer `advancedHeadSwitching`).

- [ ] **Step 4: Build + confirm universal**

Run: `cd ~/Projects/lost-media-premiere-plugin && AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK" ./build.sh && lipo -archs "build/Lost Media VHS.plugin/Contents/MacOS/Lost Media VHS"`
Expected: clean build; `x86_64 arm64`.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/lost-media-premiere-plugin
git add src/LostMediaVHS.cpp
git commit -m "fix(vhs): clustered dropouts + torn head-switch band (match desktop 27f9a39/f96af22)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 11: Digital — 8×8 DCT quantization + MiniDV block-error

**Files:**
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaDigital.cpp`

**Source math:** desktop `436f011` (quantization → hard 8×8 DCT block-edge structure + mosquito ringing) and `d7d0295` (MiniDV LP → DV block-error concealment). Cross-reference `crt-renderer-full.js` `advancedQuantization` / MiniDV blocks.

- [ ] **Step 1: Read the Digital effect; locate quantization + block code**

Run: `grep -nE 'quant|block|dct|macro|ring' ~/Projects/lost-media-premiere-plugin/src/LostMediaDigital.cpp` then read.

- [ ] **Step 2: Port hard 8×8 DCT block edges + mosquito ringing**

Snap to 8×8 blocks with hard inter-block edges and add high-frequency ringing near block boundaries (mosquito noise), per the renderer constants.

- [ ] **Step 3: Port MiniDV block-error concealment**

Replace any analog-streak behaviour in the DV path with 8×8 block-error concealment (copy/hold neighbouring block on "error").

- [ ] **Step 4: Build + confirm universal**

Run: `cd ~/Projects/lost-media-premiere-plugin && AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK" ./build.sh && lipo -archs "build/Lost Media Digital.plugin/Contents/MacOS/Lost Media Digital"`
Expected: clean build; `x86_64 arm64`.

- [ ] **Step 5: Commit**

```bash
cd ~/Projects/lost-media-premiere-plugin
git add src/LostMediaDigital.cpp
git commit -m "fix(digital): 8x8 DCT quantization + MiniDV block-error (match desktop 436f011/d7d0295)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 12: Signal — cable-scramble tearing/rolling/luma-invert

**Files:**
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaSignal.cpp`

**Source math:** desktop `c240785` (Analog Cable Scrambled → sync-suppression tearing / rolling / luma-inversion). Cross-reference the renderer's scrambled-signal block.

- [ ] **Step 1: Read the Signal effect; find the scramble/sync path (or add one gated by an existing param)**

Run: `grep -nE 'scramble|sync|roll|tear|invert' ~/Projects/lost-media-premiere-plugin/src/LostMediaSignal.cpp` then read. If no scramble param exists, gate the new behaviour behind the closest existing param per the `map()` `fx.signal` routing (do not add a new param in this task).

- [ ] **Step 2: Port sync-suppression artifacts**

Add periodic horizontal tearing, vertical roll (frame-time-driven y offset), and intermittent luma inversion bands, scaled by the gating param.

- [ ] **Step 3: Build + confirm universal**

Run: `cd ~/Projects/lost-media-premiere-plugin && AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK" ./build.sh && lipo -archs "build/Lost Media Signal.plugin/Contents/MacOS/Lost Media Signal"`
Expected: clean build; `x86_64 arm64`.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/lost-media-premiere-plugin
git add src/LostMediaSignal.cpp
git commit -m "fix(signal): cable-scramble tearing/rolling/luma-invert (match desktop c240785)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 13: CRT/Mask — plasma burn-in retained-ghost layer

**Files:**
- Modify: `~/Projects/lost-media-premiere-plugin/src/LostMediaCRT.cpp` (or `LostMediaMask.cpp` — whichever owns the plasma/burn behaviour; determine in Step 1)

**Source math:** desktop `9c9d2b2` (CRT Plasma Burn-In → persistent retained-ghost layer `burnInGhost`). Note: a true inter-frame retained ghost needs frame history that a stateless PF render can't keep; port as a static high-contrast retained-edge ghost derived from the current frame (the desktop's deterministic approximation), per the renderer's `burnInGhost` block.

- [ ] **Step 1: Decide the owning effect and read it**

Run: `grep -lnE 'plasma|burn|ghost' ~/Projects/lost-media-premiere-plugin/src/LostMedia{CRT,Mask}.cpp` then read the match.

- [ ] **Step 2: Port the retained-ghost layer**

Add a faint high-contrast self-derived ghost overlay (static offset, low alpha) gated by the plasma/burn param, matching the renderer constants.

- [ ] **Step 3: Build + confirm universal**

Run: `cd ~/Projects/lost-media-premiere-plugin && AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK" ./build.sh && lipo -archs "build/Lost Media CRT.plugin/Contents/MacOS/Lost Media CRT"`
Expected: clean build; `x86_64 arm64`.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/lost-media-premiere-plugin
git add -A src/
git commit -m "fix(crt): plasma burn-in retained-ghost layer (match desktop 9c9d2b2)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 4 — Layer 3: Panel UI / UX parity

### Task 14: Edit Bay design tokens into both panel shells

**Files:**
- Modify: `~/Projects/lost-media-premiere-panel/index.html` (UXP shell styles)
- Modify: `~/Projects/lost-media-premiere-cep/index.html` (CEP shell styles)

**Source:** the desktop "Edit Bay" design system (memory: warm-neutral palette, phosphor signal-readout signature, flat instrument finish, 3px radius). Read the desktop app's theme tokens for exact values.

- [ ] **Step 1: Extract the desktop Edit Bay tokens**

Run: `grep -rnE '--(bg|panel|accent|phosphor|radius|fg|border)' ~/Projects/build-together-desktop/src/index.css ~/Projects/build-together-desktop/tailwind.config.ts 2>/dev/null | head -40`
Capture the warm-neutral background/panel/border colours, accent, and the 3px radius.

- [ ] **Step 2: Apply the tokens to the UXP shell**

Update `index.html`'s `<style>` (or linked CSS) to the warm-neutral palette + 3px radius + the phosphor accent, replacing any generic greys. Keep UXP-safe CSS only (no unsupported selectors).

- [ ] **Step 3: Apply the same tokens to the CEP shell**

Mirror Step 2 in the CEP `index.html`. Keep the two shells visually consistent.

- [ ] **Step 4: Verify the CEP shell renders in a browser**

Use the webapp-testing / preview tooling to load `~/Projects/lost-media-premiere-cep/index.html`, screenshot, and confirm the warm-neutral theme + no console errors. (UXP can't render outside Premiere; rely on markup review + the shared renderer already verified in Task 3.)

- [ ] **Step 5: Commit (each repo)**

```bash
cd ~/Projects/lost-media-premiere-panel && git add index.html && git commit -m "style(panel): Edit Bay design tokens (warm-neutral, phosphor accent, 3px radius)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd ~/Projects/lost-media-premiere-cep && git add index.html && git commit -m "style(cep): Edit Bay design tokens (warm-neutral, phosphor accent, 3px radius)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 15: Surface new looks + strip stale remnants

**Files:**
- Modify: `~/Projects/lost-media-premiere-panel/index.js`
- Modify: `~/Projects/lost-media-premiere-cep/js/main.js`

**Goal:** the look browser shows the regenerated 102-look library (incl. the new film/sensor looks) grouped by family; remove any stale "complete looks" remnants; confirm the apply path sets the new Film slots 7-14.

- [ ] **Step 1: Read both panels' look-browser + apply code**

Run: `grep -nE 'LM_PRESETS|complete|look|applyEffect|setValue|film' ~/Projects/lost-media-premiere-panel/index.js ~/Projects/lost-media-premiere-cep/js/main.js`

- [ ] **Step 2: Confirm/adjust the apply path for the 15-slot Film array**

Ensure the code that pushes `fx.film` onto the clip iterates all 15 values (not a hard-coded 9). If the count is hard-coded, change it to `fx.film.length`.

- [ ] **Step 3: Remove stale "complete looks" remnants**

Delete any dead "complete looks" UI/handlers found in Step 1 (memory: already removed from CEP previously — confirm none remain in either shell).

- [ ] **Step 4: Verify CEP look browser renders the 102 looks**

Load the CEP `index.html` in the preview tool; confirm the look list populates from `LM_PRESETS` (102 entries) and the new looks appear. Screenshot.

- [ ] **Step 5: Commit (each repo)**

```bash
cd ~/Projects/lost-media-premiere-panel && git add index.js && git commit -m "feat(panel): surface 102-look library incl. new film looks; 15-slot Film apply

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd ~/Projects/lost-media-premiere-cep && git add js/main.js && git commit -m "feat(cep): surface 102-look library incl. new film looks; 15-slot Film apply

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 5 — Cross-cutting docs

### Task 16: One-command sync procedure in all three READMEs

**Files:**
- Modify: `~/Projects/lost-media-premiere-panel/README.md`
- Modify: `~/Projects/lost-media-premiere-cep/README.md`
- Modify: `~/Projects/lost-media-premiere-plugin/README.md`

- [ ] **Step 1: Document the panel sync in the panel + CEP READMEs**

Add a "Syncing from the desktop app" section to both:
```markdown
## Syncing from the desktop app
1. Edit looks/effects in `~/Projects/build-together-desktop`.
2. Regenerate panel data + renderer: `cd ~/Projects/lost-media-premiere-panel && node tools/gen-presets.cjs`
3. Verify: `node tools/verify-presets.cjs`
4. Propagate to CEP: `cp presets.data.js js/lme-render.js ../lost-media-premiere-cep/{,js/}` (copy `presets.data.js` to the CEP root and `js/lme-render.js` to CEP `js/`).
```

- [ ] **Step 2: Document the C++ build/install + param-layout check in the plugin README**

Add:
```markdown
## Building the effects
AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK" ./build.sh        # build all (universal)
./tools/check-film-layout.sh                                                                           # assert Film 15-param layout
sudo AE_SDK="…" ./build.sh install                                                                    # install to /Library/.../MediaCore (restart Premiere)
```
Note that the Film param layout changed (per-channel print fade + 4 new looks) and old projects using the former single "Print Fade" must reapply.

- [ ] **Step 3: Commit (each repo)**

```bash
cd ~/Projects/lost-media-premiere-panel && git add README.md && git commit -m "docs: desktop→panel sync procedure

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd ~/Projects/lost-media-premiere-cep && git add README.md && git commit -m "docs: desktop→panel sync procedure

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
cd ~/Projects/lost-media-premiere-plugin && git add README.md && git commit -m "docs: build/install + Film 15-param layout note

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Owner verification (after the plan lands)

These two steps are inherently the owner's (machine-gated) and are NOT part of automated execution:

1. `cd ~/Projects/lost-media-premiere-plugin && sudo AE_SDK="…" ./build.sh install` then restart Premiere (clear media cache if effects don't refresh).
2. In Premiere: apply the new film/sensor looks (Kodachrome, Nitrate Newsreel, Technicolor, Polaroid, Aerochrome) via the panel and confirm each matches the desktop app visually. Report any look that's off for a targeted constant tweak.
