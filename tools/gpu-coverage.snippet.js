// GPU↔CPU fidelity / coverage harness.
//
// Paste into the app's devtools console while `npm run dev` is running (or run
// via the preview tooling). For each preset it renders the SAME frame on the
// authoritative CPU pipeline and the WebGL2 GPU shader, then reports the mean
// per-channel difference. Low diff = the GPU faithfully reproduces the look and
// can safely carry it at ~0.3 ms/frame; high diff = effect math still missing
// from the shader. This is the safety net for the all-GPU port: port an effect,
// re-run this, watch the diff fall below the match threshold (~6).
(async () => {
  const gpuMod = await import('/src/lib/crt-renderer-gpu.js');
  const cpuMod = await import('/src/lib/crt-renderer-full.js');
  const presetsMod = await import('/src/lib/presets.js');
  const PRESETS = presetsMod.PRESETS || presetsMod.default || {};

  const img = document.createElement('canvas'); img.width = 480; img.height = 360;
  const ig = img.getContext('2d');
  const grd = ig.createLinearGradient(0, 0, 480, 360);
  grd.addColorStop(0, '#e8e8e8'); grd.addColorStop(1, '#203050');
  ig.fillStyle = grd; ig.fillRect(0, 0, 480, 360);
  ig.fillStyle = '#d04030'; ig.fillRect(60, 60, 160, 120);
  ig.fillStyle = '#30a060'; ig.fillRect(260, 180, 150, 120);
  ig.fillStyle = '#fff'; ig.font = 'bold 54px sans-serif'; ig.fillText('LME', 180, 240);

  const W = 640, H = 480;
  const cpu = new cpuMod.CRTRendererFull();
  const gpu = new gpuMod.CRTRendererGPU();
  const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
  const ox = oc.getContext('2d', { alpha: false });
  const gc = document.createElement('canvas'); gc.width = W; gc.height = H;
  const gx = gc.getContext('2d', { alpha: false });
  const px = (ctx) => ctx.getImageData(0, 0, W, H).data;
  const diff = (a, b) => {
    let sum = 0, n = 0, over = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
      sum += d; n++; if (d > 12) over++;
    }
    return { meanAbs: +(sum / n).toFixed(1), pctOver: +(100 * over / n).toFixed(1) };
  };

  const results = [];
  for (const name of Object.keys(PRESETS)) {
    const p = PRESETS[name].params || PRESETS[name];
    if (typeof p !== 'object') continue;
    try {
      cpu.setImage(img, 1); cpu.reset && cpu.reset(); cpu.render(ox, W, H, 0, p, 0, 30, {});
      gpu.setImage(img, 1); gpu.render(gx, W, H, 0, p, 0, 30, {});
      const d = diff(px(ox), px(gx));
      results.push({ name, meanAbs: d.meanAbs, pctOver: d.pctOver });
    } catch (e) {
      results.push({ name, err: e.message });
    }
  }
  results.sort((a, b) => (a.meanAbs ?? 999) - (b.meanAbs ?? 999));
  console.table(results);
  const matched = results.filter(r => r.meanAbs != null && r.meanAbs < 6).length;
  console.log(`GPU-faithful presets: ${matched}/${results.length}`);
  return results;
})();

// ============================================================================
// WebGPU fidelity sweep (Epic 6.1) — CRT/display family.
//
// Diffs the portable WGSL/WebGPU backend (effects-core/webgpu-backend.ts) against the
// authoritative CPU render() for every DISPLAY preset, reporting mean per-channel err.
// A family flips to WebGPU only when EVERY targeted preset is < 6. Run it live (WebGPU
// needs the GPU + canvas); paste/eval while `npm run dev` is up. Returns the results.
//
// window.__crtSweep(opts?) — opts: { size?: [w,h], names?: string[] }.
// ============================================================================
window.__crtSweep = async (opts = {}) => {
  const [W, H] = opts.size || [640, 480];
  const cpuMod = await import('/src/lib/crt-renderer-full.js');
  const beMod = await import('/src/lib/effects-core/webgpu-backend.ts');
  const presetsMod = await import('/src/lib/presets.js');
  const DISPLAY = presetsMod.DISPLAY_PRESETS || {};

  const img = document.createElement('canvas'); img.width = 480; img.height = 360;
  const ig = img.getContext('2d');
  const grd = ig.createLinearGradient(0, 0, 480, 360);
  grd.addColorStop(0, '#e8e8e8'); grd.addColorStop(1, '#203050');
  ig.fillStyle = grd; ig.fillRect(0, 0, 480, 360);
  ig.fillStyle = '#d04030'; ig.fillRect(60, 60, 160, 120);
  ig.fillStyle = '#30a060'; ig.fillRect(260, 180, 150, 120);
  ig.fillStyle = '#fff'; ig.font = 'bold 54px sans-serif'; ig.fillText('LME', 180, 240);

  const backend = await beMod.WebGPUBackend.create();
  if (!backend) { console.error('WebGPU backend unavailable'); return { error: 'no-webgpu' }; }

  const cpu = new cpuMod.CRTRendererFull();
  cpu.setImage(img, 1);
  const oc = document.createElement('canvas'); oc.width = W; oc.height = H;
  const ox = oc.getContext('2d', { alpha: false });
  const gc = document.createElement('canvas'); gc.width = W; gc.height = H;
  const gx = gc.getContext('2d', { alpha: false });
  const px = (ctx) => ctx.getImageData(0, 0, W, H).data;
  const diff = (a, b) => {
    let sum = 0, n = 0, over = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
      sum += d; n++; if (d > 12) over++;
    }
    return { meanAbs: +(sum / n).toFixed(2), pctOver: +(100 * over / n).toFixed(1) };
  };

  const names = opts.names || Object.keys(DISPLAY);
  const results = [];
  for (const name of names) {
    const p = DISPLAY[name];
    if (!p || typeof p !== 'object') continue;
    try {
      cpu.reset && cpu.reset();
      cpu.render(ox, W, H, 0, p, 0, 30, {});
      backend.render(gx, img, W, H, 0, p, 0, 30);
      await backend.flush();
      gx.drawImage(backend.outputCanvas, 0, 0, W, H); // ensure the completed frame is read
      const d = diff(px(ox), px(gx));
      results.push({ name, meanAbs: d.meanAbs, pctOver: d.pctOver, pass: d.meanAbs < 6 });
    } catch (e) {
      results.push({ name, err: e.message });
    }
  }
  results.sort((a, b) => (a.meanAbs ?? 999) - (b.meanAbs ?? 999));
  console.table(results);
  const ok = results.filter(r => r.pass).length;
  console.log(`WebGPU-faithful display presets: ${ok}/${results.length}`);
  return results;
};
