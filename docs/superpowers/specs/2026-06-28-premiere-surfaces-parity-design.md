# Premiere CEP + UXP panels + C++ effects → desktop parity

**Date:** 2026-06-28
**Status:** Design approved (scope + print-fade strategy confirmed with owner)
**Goal:** Apply the standalone Lost Media Emulator desktop app's learnings and
upgrades to the three Adobe surfaces so a Premiere editor gets the same looks the
desktop app produces.

---

## 1. Context

The desktop app (`~/Projects/build-together-desktop`) is the source of truth for
every look. Three Adobe surfaces consume it:

| Surface | Repo | Role |
|---|---|---|
| **C++ effects** | `~/Projects/lost-media-premiere-plugin` | The native render path — 7 effects (CRT · Mask · Tint · VHS · Film · Digital · Signal) that produce the actual Premiere pixels. |
| **UXP panel** | `~/Projects/lost-media-premiere-panel` | Modern Premiere panel (HTML/JS) that drives the C++ effects onto clips. |
| **CEP extension** | `~/Projects/lost-media-premiere-cep` | Legacy-tech panel, same role; advertises "91 presets". |

**The bridge:** `lost-media-premiere-panel/tools/gen-presets.cjs` reads the app's
real `src/lib/presets.js`, `format-profiles.js`, and `crt-renderer-full.js` (the
**CPU renderer**), maps every app parameter onto the C++ effect parameter arrays
via its `map()` function, and writes two generated files:

- `presets.data.js` — `LM_PRESETS` (102 looks) + `LM_CAPTURE` + `LM_DISPLAY` + `LM_RECIPES`, each carrying raw app params + a format profile.
- `js/lme-render.js` — the desktop CPU renderer bundled as a browser global so panel thumbnails render with the exact desktop fidelity math.

The CEP extension currently carries **byte-identical copies** of those two
generated files.

## 2. Staleness / gap (measured 2026-06-28)

- Panel generated files are dated **Jun 26**; the desktop CPU renderer + 102
  presets were updated **Jun 27** (the LOW film/sensor batch + OSD merge). The
  panels are ~1.5 days behind.
- The Jun-27 film/sensor batch (`46be5e8`) added app params with **no current C++
  home**: `nitrateDecay`, `technicolorFringe`, `polaroidCrossover`, `irHotspot`,
  and per-channel `printFade{Cyan,Magenta,Yellow}` (C++ Film has a single "Print
  Fade"). Plus an Aerochrome IR false-colour renderer fix (no new param).
- Earlier Jun-27 commits upgraded effect **algorithms** (no new params):
  `dropouts`→clustered streaks, `headSwitching`→torn band, `quantization`→8×8 DCT
  + mosquito ringing, MiniDV block-error concealment, cable-scramble
  tearing/rolling/luma-invert, plasma burn-in persistent ghost.
- The Adobe AE SDK is present locally
  (`~/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK`), so
  the C++ effects compile here (universal arm64 + x86_64 via `build.sh`).

## 3. Scope

**In:** bring all three surfaces to parity with the Jun-27 desktop, in three
ordered layers (below).

**Out (not portable):** Epic 6 GPU acceleration (`effects-core/*.wgsl`,
`webgpu-backend.ts`). That is a GPU display path for the desktop only; the panels
render on a CPU canvas and the C++ effects render natively, so the GPU work has
no target here. Audio authenticity (Epic 4) and the ffmpeg export pipeline are
also desktop-only — Premiere owns audio and export.

---

## 4. Layer 1 — Data / renderer sync (prerequisite; fully verifiable here)

1. **Extend `map()` in `gen-presets.cjs` first** so the new params route onto C++
   slots (see §5 for the Film array layout). Without this, the regenerated
   presets carry the new looks but silently drop their new dimensions.
2. Run `node tools/gen-presets.cjs` → regenerates UXP `presets.data.js` +
   `js/lme-render.js` from the Jun-27 desktop.
3. Propagate both generated files to the CEP extension (they are meant to be
   identical copies).
4. **Verify:** `LM_PRESETS.length === 102`; the new looks (Kodachrome, Aerochrome,
   Nitrate Newsreel, Polaroid, etc.) are present; the bundled renderer matches the
   desktop `crt-renderer-full.js` (size/diff); thumbnails render.

## 5. Layer 2 — C++ effect parity (the fidelity core)

Authoritative math lives in `crt-renderer-full.js:1670–1866` (film/sensor grade
pass) and `46be5e8`. Each term is a no-op at 0 and clamps to 0–255.

### 5a. Film effect — new param layout (owner chose: replace Print Fade with CMY)

New `LostMediaFilm` parameter order (PiPL + `PF_ADD_*` must match the `map()`
array index):

| # | Param | Source app key | Algorithm (renderer ref) |
|---|---|---|---|
| 0 | Grain | advancedFilmGrain | existing |
| 1 | Halation | advancedFilmHalation | existing |
| 2 | Gate Weave | advancedFilmGateWeave | existing |
| 3 | Dust & Scratches | max(dust, scratches) | existing |
| 4 | Flicker | advancedExposurePump | existing |
| 5 | Vignette | vignette | existing |
| 6 | Warmth | max(0, imageTemperature) | existing |
| 7 | **Fade Cyan** | printFadeCyan | `r += C·(16 + sh·26)`, `sh = (1 − luma/255)^0.7` |
| 8 | **Fade Magenta** | printFadeMagenta | `g += M·(12 + sh·20)` |
| 9 | **Fade Yellow** | printFadeYellow | `b += Y·(16 + sh·26)` |
| 10 | IR False Color | infraredFalseColor | Aerochrome channel rotation (see 5b) |
| 11 | **Technicolor Fringe** | technicolorFringe | two offset composite copies; `shift = max(0.5, f·2.8)px`; red record screen @α≤0.28, cyan record multiply @α≤0.18 |
| 12 | **Nitrate Decay** | nitrateDecay | seeded radial blotches (screen), edge-fog linear gradient (screen), mottled multiply-blur; positions seeded on `seededNoise(b, frameIndex·k, seed)` |
| 13 | **Polaroid Crossover** | polaroidCrossover | shadow regime (luma<0.45): `r−=8p, g+=14p, b−=18p`; highlight regime (luma>0.6): `r+=18p, g−=4p, b−=10p` |
| 14 | **IR Hotspot** | irHotspot | central radial gradient (screen); `r0 = minDim·(0.08+h·0.10)`, `r1 = minDim·(0.35+h·0.20)` |

Notes: 11/12/14 use frame-varying / whole-image composites in the renderer; in the
C++ effect they become deterministic per-pixel functions of the frame time
(`PF_InData` `current_time`/`time_step` → frameIndex) using the existing
`seededNoise` already present in the plugin. Param disk-IDs: append IDs 11–14 to
preserve old IDs where possible; the Print-Fade→CMY change is an intentional break
(owner accepted reapplying on old projects).

### 5b. Aerochrome IR false-colour fix (no new param)

Update the existing IR False Color math to the renderer's fixed channel rotation
(`crt-renderer-full.js:1683–1697`): sky/veg detection, `nr = g0·1.1 + veg·f·80`
(green→vivid red), blue suppression `−veg·f·30` on foliage, sky lift `+sky·f·14`.

### 5c. Algorithm upgrades to existing effects (no new params)

Port the Jun-27 algorithm fixes so native render matches desktop:

- **VHS:** dropouts → horizontal clustered streaks (not per-pixel speckle);
  head-switching → torn noisy band (not smooth skew). (`27f9a39`, `f96af22`)
- **Digital:** quantization → hard 8×8 DCT block edges + mosquito ringing
  (`436f011`); MiniDV LP → DV block-error concealment (`d7d0295`).
- **Signal:** Analog Cable Scrambled → sync-suppression tearing / rolling /
  luma-inversion (`c240785`).
- **CRT/Mask:** Plasma burn-in → persistent retained-ghost layer (`9c9d2b2`).

### 5d. map() routing + build

- Extend `fx.film` in `gen-presets.cjs` to the 15-element layout above.
- Update PiPL resource files and param IDs in `LostMediaFilm.cpp`/`.r`.
- Compile all effects with the local SDK to prove they build:
  `AE_SDK="$HOME/AdobeSDK/AfterEffectsSDK_25.6_61_mac/ae25.6_61.64bit.AfterEffectsSDK" ./build.sh`

## 6. Layer 3 — Panel UI / UX parity

Port desktop UI learnings into the panels (`index.html` / `index.js` for UXP;
`index.html` / `js/main.js` for CEP): Edit Bay design tokens (warm-neutral palette,
phosphor readout signature, 3px radius), surface the new film/sensor looks in the
look browser, OSD timestamp toggle where the effects support it, clean 9-param CRT
alignment, and remove any stale "complete looks" remnants. Keep the two panels'
shared generated files identical; only their shells differ.

## 7. Cross-cutting

- `git init` each of the three plugin repos (none are under git today) so the work
  lands as small, reviewable, recoverable commits.
- Update each repo's README with the one-command sync procedure: edit desktop →
  `node tools/gen-presets.cjs` → propagate generated files to CEP.

## 8. Verification split

| Step | Where |
|---|---|
| Regenerate + propagate presets/renderer, diff/count checks | here |
| Panel markup/JS + thumbnail rendering | here (CEP via browser; UXP markup/logic) |
| C++ implementation + universal compile | here (local AE SDK) |
| `sudo ./build.sh install` (writes to `/Library/.../MediaCore`) | **owner's machine** |
| Final visual confirmation of each look in Premiere | **owner, in Premiere** |

## 9. Risks

- C++ ports of whole-image composite effects (nitrate/fringe/hotspot) must be
  reframed as per-pixel deterministic functions; visual match is "close", not
  bit-exact, vs. the canvas renderer. Owner eyeball is the acceptance gate.
- Premiere caches effects; after install the owner may need to clear the media
  cache / restart Premiere to see new params (note in README).

## 10. Success criteria

1. Both panels' preset library, thumbnail renderer, and param mappings match the
   Jun-27 desktop (102 presets; new looks present and rendering).
2. The Film effect exposes the 15-param layout and the four algorithm-upgraded
   effects compile clean (universal binary) with the local SDK.
3. `map()` routes every new param; regenerated panel data is propagated to CEP.
4. Panels carry the desktop UI learnings; READMEs document one-command sync.
5. All three repos are under git with small, labelled commits.
