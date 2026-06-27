# Reference Corpus — License Policy

This directory holds `manifest.json`: the ground-truth reference corpus for the
Lost Media Emulator audit system. It contains **metadata only** — URLs and
provenance records. No asset bytes are committed to the repository.

---

## Core Rule: Commercial Product = Redistribute-True Only

Lost Media Emulator is a **commercial product**. Any reference asset that may be
bundled into the application binary, included in the repository, or shipped to
customers **must** be licensed for commercial redistribution without restriction.

Concretely:

| `redistribute` | Permitted licenses | How it is stored |
|---|---|---|
| `true` | Public Domain, CC0 (Creative Commons Zero), Public Domain Mark 1.0, or any license explicitly permitting commercial redistribution | `source` URL + provenance in manifest only; bytes are **not** committed |
| `false` | Fair use, CC-BY, CC-BY-NC, proprietary, or any license that restricts redistribution or commercial use | `source` URL + provenance in manifest only; bytes are **never** downloaded into the repo or shipped |

**References marked `redistribute: false` are cited by URL and provenance for
internal comparison during development only.** They must never be downloaded into
the repository, embedded in builds, or distributed in any form.

---

## What the Manifest Stores

`manifest.json` is a JSON array of `ReferenceEntry` objects (schema defined in
`src/lib/audit/schema.ts`). Each entry records:

- `id` — unique slug used in scorecard `referenceRefs` fields
- `medium` — the tape/film/broadcast medium (e.g. `"vhs"`, `"s-vhs"`, `"betamax"`)
- `source` — human-readable URL to the original file page or archive item
- `license` — the exact SPDX identifier or canonical name of the license
- `redistribute` — `true` if commercial redistribution is permitted; `false` otherwise
- `demonstrates` — description of which specific artifacts this reference proves

The manifest does **not** store file paths or downloaded bytes. Direct download
URLs (for use in Task 7 frame extraction scripts) may be noted in task briefs
but must not appear as the `source` field — `source` should always be the
human-readable file or item page.

---

## Seeded References

Two CC0 / Public Domain VHS references are already in the manifest:

| id | license | demonstrates |
|---|---|---|
| `vhs-static-cc0` | CC0-1.0 | Noise floor, snow, dropout speckle, head-switching texture (no-signal tape) |
| `vhs-palace-cartoons-1989` | Public Domain Mark 1.0 | Chroma bleed, tracking error, head-switching band, dropouts, generational loss over picture content |

Direct download URL for `vhs-static-cc0` (for frame-extraction scripts only, not
the `source` field): `https://upload.wikimedia.org/wikipedia/commons/b/b3/FREE_real_VHS_static.webm`

---

## Acquisition Checklist — Adding a New Reference

Before adding any entry to `manifest.json`, verify all of the following:

1. **Medium and era** — what format is this (VHS, S-VHS, Betamax, U-matic, 8mm,
   Hi8, LaserDisc, broadcast composite, …) and what approximate production year
   or generation is the tape?

2. **Artifact specificity** — list the exact artifacts this reference proves (e.g.
   "Y/C separation breakup", "dropout streaks at frame edge", "chroma smear on
   sharp edges"). The `demonstrates` field must be specific, not generic.

3. **License verification** — name the license precisely. Confirm:
   - Is this Public Domain, CC0, or Public Domain Mark? → `redistribute: true`
   - Does the license explicitly grant commercial use and redistribution? → `redistribute: true`
   - Any other license → `redistribute: false`; cite URL only; never download

4. **Add the manifest entry** — add a `ReferenceEntry`-shaped object to
   `manifest.json` with all six fields (`id`, `medium`, `source`, `license`,
   `redistribute`, `demonstrates`). Follow the existing ID naming convention:
   `<medium>-<descriptor>-<year-or-era>`.

5. **Validate** — the entry must pass `validateReference` (exported from
   `src/lib/audit/schema.ts`) with zero errors. Run:
   ```bash
   node -e "
     const {validateReference} = require('./src/lib/audit/schema.ts');
     const m = JSON.parse(require('fs').readFileSync('docs/audit/references/manifest.json','utf8'));
     const last = m[m.length-1];
     const errs = validateReference(last);
     if(errs.length) { console.error('INVALID', errs); process.exit(1); }
     console.log('OK', last.id);
   "
   ```
   (If running without ts-node, use the compiled output or the plain-JS
   equivalent that checks the six required fields manually.)

---

## Scoring Gate

**No medium may receive a rubric score until it has at least one
`redistribute: true` reference entry in this manifest** that is relevant to the
artifact being scored. Scorecards with `referenceRefs` pointing to IDs not
present in this manifest will fail `validateScorecard` validation.
