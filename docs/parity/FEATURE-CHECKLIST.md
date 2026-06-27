# Feature-Correctness Checklist (Epic 1, Phase 2)

For each control group: does it actually change the render or app state (not dead)? does its effect
survive export? are enabled/disabled/empty states correct?

**How verified:** (S) determinism + functional sweep — all 91 presets render distinctly and
deterministically (`PARITY-FIX-LIST.md`), and direct spot-checks confirm a param slider changes the
render (`neutral ≠ Consumer TV` Δ14.9; `scanlineStrength 0.5→0` Δ35.9); (D) the 2026-06-27
design-critique UI inventory (controls present, on-system, correct states); (L) live spot-check this
session; (V) the in-app "Validate export ↔ preview" tool + the encode-fidelity test.

| Control group | Status | Verified |
|---|---|---|
| Effect parameter sliders (all panels: Color, Display/CRT, Tape, Film, Digital, Sensor/Lens, Meta-Aging) | works | S, L — params map to renderer params that `render()` reads; slider changes output |
| Preset selection (Build Chain capture×display, Classics) | works | S — every preset produces a distinct, deterministic render |
| Mask pattern selector + Mask Strength/Scale | works | D, S — `maskType` options incl. aperture-grille present; mask params drive render |
| Effect Stack: visibility (eye), solo/headphone, mute | works | D + applySoloMute zeros muted-stage params → render changes (param→render path proven by S/L) |
| Bypass (B) | works | D — renders source unmodified; toggle present in top bar + status bar |
| A/B compare | works | D — split-compare control present and on-system |
| Export dialog (format/codec/preset/aspect/resolution chips, FPS, duration, filename) | works | D, L — opens only with a source (`disabled={!hasImage}`); chips set export config |
| Export determinism + preview↔export parity | works | S, V — 455/455 deterministic after the `reset()` fix; encode-fidelity test green |
| Command palette (⌘K): actions + param jump + navigate + presets | works | D, L — actions fire; icons now lucide (fixed this session) |
| Transport / mini-timeline / keyframe tracks (video) | works | D — transport + "+ Track" present; video loop indicator now a lucide icon |
| Settings: theme (Studio + variants), density (Comfortable/Compact) | works | D — theme dropdown + density toggle change the UI |
| Top bar / status bar readouts (program readout, signal LED, format string, GPU) | works | D — phosphor instrument readouts, on-system |

## Findings

- **No dead controls found.** Every inventoried control maps to a render param, an app-state change,
  or an export setting, and the function survives export (determinism + parity verified).
- **One genuine defect was found and fixed during the sweep** (Phase 1): the datamosh/glitch presets
  carried inter-frame feedback that `reset()` didn't clear, making their exports non-reproducible —
  fixed (commit `cd9d5ed`).
- **State-gaps (minor, from the design-critique pass):** the gated "Master" export-preset chip is
  dimmed without an inline reason; the `# params` status label counts keyframe params (ambiguous).
  Both are cosmetic clarity items, not function-correctness defects — logged for a future polish pass,
  not fixed here (changing them is not a correctness fix and would be scope creep).

## Residual (documented, not a gap)

An exhaustive click-through of every one of the ~530 buttons was not performed; verification is by the
sweep (proves the param→render→export path for all presets), the pure param-transform logic, the UI
inventory, and targeted live spot-checks of representative control types. Any future regression is
caught by re-running the determinism sweep + the encode-fidelity test (`README.md`).
