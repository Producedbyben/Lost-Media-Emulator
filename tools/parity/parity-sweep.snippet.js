// tools/parity/parity-sweep.snippet.js
// Epic 1 — frame-accurate export DETERMINISM sweep.
// Paste into the app's devtools console (or run via the preview tooling) while
// `npm run dev` is running. For every preset, at the temporally-sampled frames,
// it renders the forced-CPU export frame TWICE from a clean reset and checks the
// two are byte-identical. A mismatch means the export is not reproducible —
// unseeded temporal randomness or stale state — the class behind the OSD-export
// desync. Preview↔export PARITY (vs the live preview) is checked separately by
// the in-app "Validate export ↔ preview" tool on a representative subset.
(async () => {
  const cpuMod = await import('/src/lib/crt-renderer-full.js');
  const presetsMod = await import('/src/lib/presets.js');
  const valMod = await import('/src/lib/export-validator.js');
  const sweepMod = await import('/src/lib/parity/sweep.ts');
  const PRESETS = presetsMod.PRESETS || presetsMod.default || {};
  const { renderCpuFrame, comparePixels, readPixels } = valMod;
  const { SAMPLE_FRAMES, classifyParityResult } = sweepMod;

  // Neutral test source with detail in every region (gradient + saturated blocks + text).
  const W = 480, H = 360;
  const src = document.createElement('canvas'); src.width = W; src.height = H;
  const g = src.getContext('2d');
  const grd = g.createLinearGradient(0, 0, W, H); grd.addColorStop(0, '#e8e8e8'); grd.addColorStop(1, '#203050');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  g.fillStyle = '#d04030'; g.fillRect(60, 60, 160, 120);
  g.fillStyle = '#30a060'; g.fillRect(260, 180, 150, 120);
  g.fillStyle = '#fff'; g.font = 'bold 54px sans-serif'; g.fillText('LME', 180, 240);

  const renderer = new cpuMod.CRTRendererFull();
  renderer.setImage?.(src, 1);

  const results = [];
  for (const preset of Object.keys(PRESETS)) {
    const params = PRESETS[preset].params || PRESETS[preset];
    if (typeof params !== 'object') continue;
    for (const frame of SAMPLE_FRAMES) {
      const rec = { preset, frame, error: null, determinism: {}, parity: { meanDiff: 0, tolerance: 6 } };
      try {
        const seconds = frame / 30;
        const a = renderCpuFrame(renderer, W, H, seconds, params, frame, 30, {});
        const b = renderCpuFrame(renderer, W, H, seconds, params, frame, 30, {});
        const det = comparePixels(readPixels(a), readPixels(b));
        rec.determinism = { identical: det.identical, maxDiff: det.maxDiff, meanDiff: +det.meanDiff.toFixed(3) };
      } catch (e) { rec.error = e?.message || String(e); }
      rec.classification = classifyParityResult(rec);
      results.push(rec);
    }
  }
  const fails = results.filter((r) => r.classification.severity !== 'none');
  console.table(fails.map((r) => ({ preset: r.preset, frame: r.frame, severity: r.classification.severity, reason: r.classification.reason })));
  console.log(`parity determinism sweep: ${results.length - fails.length}/${results.length} clean (${Object.keys(PRESETS).length} presets × ${SAMPLE_FRAMES.length} frames); ${fails.length} failing`);
  window.__parityResults = results;
  return { total: results.length, clean: results.length - fails.length, failing: fails.length };
})();
