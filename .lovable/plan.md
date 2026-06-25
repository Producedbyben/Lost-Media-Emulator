# Two-Axis Presets: Capture/Format × Display

Turn the single flat preset list into a **signal chain**: pick one *Capture / Recording / Transmission format* (the source: film stock, VHS, codec, sensor) and one *Display device* (the output: CRT, LCD/OLED, billboard, portable TV). They stack into one final look — e.g. "Silent B&W Film" → "OLED Smartphone", or "IMAX Large-Format" → "Portable TV". The ~95 existing combined presets stay as one-click **Classics**.

## How combination works

Params already split cleanly into two disjoint families:

- **Display-axis keys**: `scanlineStrength, phosphorMask, maskScale, maskType, barrelDistortion, chromaticAberration, bloom, flicker, pixelSize` + the `displayV2` group (`phosphorPersistence, beamSpotSizeX/Y, pixelResponseTime, scanlineProfile, subpixelLayoutOverride`).
- **Capture-axis keys**: everything else (grading, colorSignal, film/filmV2, tape artifacts, tapeMech, temporalV2, compression, datamosh, sensorLens, digital noise, OSD, metaAging).

Final params = `DEFAULT_PARAMS`, then apply Capture preset's capture-keys scaled by *capture intensity*, then Display preset's display-keys scaled by *display intensity*. Because the key sets don't overlap, no conflicts. The existing `blendParams` + `syncPanelsToParams` (auto enable/disable panels by used params) work unchanged on the merged result.

## Data model (`src/lib/presets.js`)

- Keep `PRESETS` (Classics) untouched.
- Add `CAPTURE_PRESETS` and `DISPLAY_PRESETS` maps, each authored to only set keys in its own axis (any stray cross-axis keys stripped).
- Add lightweight category metadata for each new map for the in-slot tabs.
- Derive most capture presets from existing classics (film stocks, VHS/Betamax/Hi8/MiniDV generations, broadcast/transmission, DVD/streaming/social codecs, surveillance/IR, datamosh) reduced to capture-only keys.

### Display gamut (retune + add, covering all four families)
- **CRT**: Consumer TV, PVM/BVM, Trinitron WEGA, Arcade, Shadow-Mask Amber Terminal, Rear-Projection, PAL Living-Room TV.
- **Flat panel**: IPS Office LCD, OLED PenTile Smartphone, Pioneer Plasma, Cyberpunk OLED, plus a clean **E-Ink Mono** and **Retro Pixel LCD / Game Boy**-style.
- **Large / public**: **LED Billboard** (coarse pixel grid via `pixelSize` + large `maskScale` + dot mask + bloom), **Cinema Projector** (near-neutral, soft bloom, faint vignette via grading), **IMAX Large-Format** (ultra-clean reference display), **Jumbotron**.
- **Portable / retro**: **Portable Pocket TV** (soft scanlines, low res, slight barrel), **Camcorder Viewfinder Mono**, **Handheld LCD**.
- A neutral **Direct / No Display** option (pass-through) so a capture look can be viewed un-degraded.

### Capture gamut
Neutral **Direct Digital** pass-through plus the existing format families re-expressed as capture-only presets, retuned so they read correctly when paired with any display.

## UI reorganization

### Signal-chain preset area (`PresetSelector.tsx` + small new pieces)
Replace the single library with three tabs: **Build (Chain)**, **Classics**, **Custom**.

Build tab shows two stacked slots with a downward arrow between them (signal flow):

```text
┌── CAPTURE / FORMAT ─────────┐   (source media + recording)
│  [browse grid]  intensity ▢ │  🔒 lock
└─────────────┬───────────────┘
              ▼
┌── DISPLAY / OUTPUT ─────────┐   (screen it's shown on)
│  [browse grid]  intensity ▢ │  🔒 lock
└─────────────────────────────┘
   Final: "Silent B&W Film → OLED Smartphone"
```

- Each slot reuses the existing thumbnail-grid + category-tab browser, scoped to its axis.
- **Per-slot intensity** slider and a **lock** toggle: a locked slot is preserved while you browse/swap the other (and protected from Classics overwriting it). Clear-slot (✕) per slot.
- Live "Final" label combines both names; empty slot = neutral pass-through.
- Classics tab = current behavior; selecting one applies directly and clears unlocked slots.

### Effect-stack panels (`Index.tsx`, `WorkflowNav.tsx`)
Group the existing panels under two macro-section headers mirroring the chain, so the stack reads top-to-bottom as signal flow:

- **▸ CAPTURE / FORMAT**: Grading, Color Signal, Film, Film v2, Tape Artifacts, Tape Mechanics, Temporal, Compression, Datamosh, Sensor & Lens, Digital, OSD, Media Aging.
- **▸ DISPLAY / OUTPUT**: CRT Effects, Masks, Display/Panel v2, Pixel & Resolution.

Keep existing collapse/expand-all, active-only filter, pin, and count badges. Update `WorkflowNav` quick-jumps to show the two groups.

## Wiring (`src/pages/Index.tsx`)

- New state: `captureSlot`, `displaySlot` (name + values), `captureIntensity`, `displayIntensity`, `captureLocked`, `displayLocked`; persisted to the existing localStorage save blob alongside `activePreset`.
- New `applyChain()` helper builds merged params from the two slots + intensities, runs `syncPanelsToParams`, `animateToPreset`, and derives the OSD profile from the **capture** slot.
- `handleSelectCapture` / `handleSelectDisplay` update one slot, respect the other's lock, recompute the chain. Per-slot intensity change recomputes via the same path.
- `handleSelectPreset` (Classics) unchanged except it clears unlocked slots and sets a "Classic" mode flag so the Build tab shows it's overridden.
- Manual slider edits still mark dirty exactly as today.

## Effect retune/recategorize (renderer mostly unchanged)

Per your choice, focus on correct splitting + tuning rather than big new renderer code. Small additions only where a gap is obvious and cheap, reusing existing params:
- LED-billboard / jumbotron look from `pixelSize`+`maskScale`+`maskType:"dot"`+`bloom` (no new renderer param).
- E-ink/mono displays via existing `advancedCctvMonochrome`/grading + zeroed CRT params.
- Verify `scanlineProfile`, `subpixelLayoutOverride`, `chromaSubsamplingMode` (already rendered) respond correctly in combined output.
- Extend `src/test/preset-integrity.test.ts` to assert every `CAPTURE_PRESETS` entry only touches capture keys and every `DISPLAY_PRESETS` entry only touches display keys, and that combine() of any pair stays within `PARAM_RANGES`.

## Files

- **Edit** `src/lib/presets.js` — add `CAPTURE_PRESETS`, `DISPLAY_PRESETS`, axis key sets, `combineChain()` helper.
- **Edit** `src/components/PresetSelector.tsx` — Build/Classics/Custom tabs, two slots, per-slot intensity + lock, axis-scoped browsers.
- **Edit** `src/pages/Index.tsx` — chain state, apply logic, persistence, two macro-section panel grouping.
- **Edit** `src/components/WorkflowNav.tsx` — reflect Capture vs Display groups.
- **Edit** `src/test/preset-integrity.test.ts` — axis-purity + combine-range tests.
- **Update** memory (`mem://ui/layout`, index) to record the two-axis chain model.

## Notes / non-technical

Nothing existing breaks: all current looks remain under **Classics**, and manual panel control, pinning, export queue and persistence keep working. The new flow just lets you mix any *source format* with any *screen* to get accurate "X on a Y" combinations.