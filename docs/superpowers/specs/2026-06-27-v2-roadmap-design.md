# Lost Media Emulator — v2 Roadmap (design spec)

Date: 2026-06-27 · Status: **approved (brainstorm), not yet planned/started**
App: `~/Projects/build-together-desktop` (native macOS Electron arm64 CRT/VHS effects studio)
Related: `[[lost-media-emulator-desktop]]`, `[[lost-media-exporter-rebuild]]`,
`[[lost-media-design-system]]`, `[[lme-licensing-handoff]]`.

This is a **roadmap/portfolio spec**, not a single implementation plan. It defines what v2
means, the epics, the sequencing, and what's out. Each epic gets its OWN spec → plan →
implementation cycle. The next concrete step after this is to plan **Epic 0 (the reference
audit)** with the writing-plans skill.

---

## 1. What v2 is (north star)

**"Everything already here is excellent, complete, and provably correct — and the engine
runs it in real time."**

v2 is a **quality + completeness + performance** milestone. It is explicitly **not** a
packaging or platform-expansion release.

**Definition of done:**
1. Every shipped feature provably works, **including in export** (preview↔export parity).
2. Every effect/preset measured against **real reference footage** and brought to a defined
   authenticity bar.
3. **Audio** is a first-class authenticity surface, not just an export toggle.
4. **QoL** friction removed across the app.
5. The **engine leap** delivers real-time playback at the *audited* fidelity (may slip to
   v2.x without blocking the rest).

## 2. Why now (grounded reality)

- **Engine:** `docs/GPU-PORT-PLAN.md` measured 90 of 91 presets as materially different on
  the WebGL2 shader vs the authoritative CPU pipeline (mean err ≥20, up to 118). The
  `_gpuCanHandle` gate routes real presets to the ~525 ms/frame CPU path → playback stalls.
  The GPU path is "effectively decorative for real content." The fix is to author each
  effect as a tested shader **against a fidelity target** — which today does not exist.
- **Correctness:** two dormant/half-wired defects already surfaced this cycle — the export
  resolution bug (fixed, v1.1.2) and the OSD-export desync (spec'd, `OSD-REBUILD-HANDOFF.md`).
  Assume more lurk; a function-correctness sweep is cheap insurance.
- **Audio:** the exporter only does original/muted; degrade-to-match was never built
  (`docs/superpowers/EXPORTER-ROADMAP.md` item 2). Audio has no creative surface.
- **Surface:** 14 effect panels exist (`src/components/*Panel.tsx` / `*Controls.tsx`); the
  value is the effect suite, and its quality has never been reference-audited end to end.

## 3. Epics (ranked)

### Epic 0 — Reference ground-truth audit (foundational)
Gather **real reference footage/stills** per medium (VHS, S-VHS, Hi8/Video8, MiniDV/HDV,
Super 8 / 16mm, CCTV/security, broadcast/ENG, DSLR/digicam, LD/DVD, etc.). Define a
**per-effect authenticity rubric** (physical plausibility, parameter behaviour, artifact
correctness, sane defaults, era fit). Score every effect and every preset; produce a
**prioritized fix list** and a curated **reference corpus** stored in-repo (or a documented
external location if large). This artifact is **language-agnostic**: it is the quality spec
for the CPU-side fixes *and* the exact fidelity target the engine leap is missing. Deliverable
is a document + corpus, not code.

### Epic 1 — Function-correctness sweep ("function checks")
Audit every feature for dormant/half-wired behaviour, with emphasis on **preview↔export
parity** (the class that produced the resolution + OSD-export bugs). Output a defect list,
fix the high-value ones, add parity guards/tests. De-risks every later epic.

### Epic 2 — OSD rebuild
Already scoped in `docs/OSD-REBUILD-HANDOFF.md` (period-accurate hybrid fonts; thread OSD
into exports; restructure `render()` so OSD sits over capture, under display). First large
epic — it's both a correctness fix and an authenticity upgrade.

### Epic 3 — Effect/preset quality fixes
Work Epic 0's prioritized fix list on the **current CPU pipeline** for continuous, visible
quality wins. Each fix is verified against its reference.

### Epic 4 — Audio authenticity panel
A per-clip audio surface matching the app's identity: **waveform, level/gain, fade in/out,
sync to the video trim**, plus a **period-degradation suite** — tape hiss, wow/flutter,
bandwidth limiting, mains hum, dropout, mono fold-down, generation loss. Folds in the
unbuilt degrade-audio-to-match exporter item. **No multi-track, no import/replace** (that's
v3). Must render in both preview and the ffmpeg export path (avoid the OSD-style desync).

### Epic 5 — QoL + exporter finish
Friction removal across the 14 panels (the QoL backlog — gather during Epics 1–4), plus the
remaining exporter items: route the export **queue through ffmpeg** (today batch is
WebCodecs-only), **cancel during the encode phase** (today only aborts the JS controller),
and **NLE-style dialog polish**.

### Epic 6 — Engine leap (capstone, highest risk)
Build the **tested GPU shader core**: a fidelity harness (golden frames + parameter sweeps,
extending `tools/gpu-coverage.snippet.js`) that uses **Epic 0's ground truth as pass/fail**,
then port effects to shaders in audit-priority order until real-time playback is achieved and
the GPU path can become the default. Allowed to slip to **v2.x** without blocking v2's quality
+ audio + QoL deliverables.

## 4. Sequencing (two-track, audit-led)

```
Phase 0:  Epic 0 — reference audit  ──►  shared ground truth + rubric + fix list + corpus
                                          │
        ┌─────────────────────────────────┴───────────────────────────────┐
   Track Q (quality/features, current pipeline, ships continuously)   Track E (engine, interleaved)
        Epic 1 function sweep                                          shader-core scaffold + fidelity harness
        Epic 2 OSD rebuild                                             port effects in audit-priority order
        Epic 3 effect/preset fixes  ◄── reference corpus ──►          (audit is the pass/fail bar)
        Epic 4 audio panel                                            real-time playback → GPU default
        Epic 5 QoL + exporter finish
        └───────────────────────────────► CONVERGE = v2 ◄────────────────────┘
```

The audit is the connective tissue: Track Q fixes effects against it now; Track E ports
against the same bar later, so effects aren't fixed twice. Track Q ships visible wins
throughout; Track E de-risks the big engineering bet in parallel/interleaved (solo dev →
"interleaved" in practice, not literally concurrent).

## 5. Cross-cutting (ride along all epics — not standalone work)

- **Release gate — signing/notarization** (`docs/NOTARIZATION.md`, `SIGNING.md`): required
  for working auto-update + user trust. Not listed by Ben as a v2 theme, so it's a **flagged
  gate**, not an epic — recommend completing it once during v2 (Apple Developer enrolment is
  the blocker, per `[[lme-licensing-handoff]]`), but it's a commercial decision.
- **Test/CI discipline:** keep the 87 tests green; every parity-class fix lands with a guard.
- **Design-system consistency:** new surfaces (audio panel, OSD, exporter polish) follow the
  "Edit Bay" system (`[[lost-media-design-system]]`).
- **Ship rhythm:** Ben's style — small verified commits, push each, unsigned DMG to the R2
  shop via `lme-r2-release` `push.sh`, **stop before R2 push**, never bump the KV `versions`
  pointer/update feed while unsigned (`[[lme-licensing-handoff]]`).

## 6. Out of scope for v2 (YAGNI → v3/platform)

Windows build · Premiere/AE plugin parity · multi-track / import-replace audio (DAW-lite) ·
AI features · marketing-site work. (The engine leap's portable shader core is the enabler for
the plugin/Windows futures, but those builds are v3.)

## 7. First step after this spec

Plan **Epic 0 (reference audit)** with the writing-plans skill — it produces the ground truth
everything else depends on. Each subsequent epic gets its own spec → plan when reached.
