// Contact-sheet comparison renderer (in-app devtools snippet).
//
// Paste into the app's devtools console while `npm run dev` / `npm run electron:dev`
// is running (the app must be on localhost so dynamic imports resolve to /src/lib/…).
//
// By default this renders every preset whose name matches FILTER onto a single tiled
// contact-sheet canvas and triggers a PNG download.  Edit FILTER below to change which
// family you're auditing.
//
// CROSS-ORIGIN CAVEAT — loading a remote reference image (archive.org, wikimedia, etc.)
// via loadImage() will TAINT the canvas.  getImageData / toDataURL both throw
// SecurityError on a tainted canvas, breaking the PNG download.  For cross-origin refs
// compare by eye in a separate tab; only use loadImage() with same-origin or data: URLs.

(async () => {

  // ── Config ──────────────────────────────────────────────────────────────────────────

  // Edit this regex to change which preset family is audited.
  const FILTER = /vhs|tape|consumer|rental|bootleg|camcorder|hi8|video8|ep |sp /i;

  // Cell size on the output sheet (pixels).  Rendering also happens at this size.
  const CELL_W = 320;
  const CELL_H = 240;

  // Label strip height below each cell (px).
  const LABEL_H = 22;

  // Download filename.
  const FILENAME = 'contact-vhs.png';

  // ── Optional: load a same-origin reference still ─────────────────────────────────
  // Usage:  const src = await loadImage('/path/to/still.png');
  //         Then replace `src` in the renderer call below.
  // WARNING: Do NOT pass a cross-origin URL here — it will taint the canvas and break
  //          the PNG download (toDataURL / getImageData throw SecurityError on tainted
  //          canvases).  Cross-origin references must be compared visually in a separate
  //          tab outside this sheet.
  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`loadImage failed: ${url} — ${e}`));
      img.src = url;
    });
  }

  // ── Load modules (same pattern as gpu-coverage.snippet.js) ──────────────────────

  const cpuMod     = await import('/src/lib/crt-renderer-full.js');
  const presetsMod = await import('/src/lib/presets.js');
  const PRESETS    = presetsMod.PRESETS || presetsMod.default || {};

  // ── Build synthetic test chart (verbatim from gpu-coverage.snippet.js) ──────────

  const img = document.createElement('canvas'); img.width = 480; img.height = 360;
  const ig = img.getContext('2d');
  const grd = ig.createLinearGradient(0, 0, 480, 360);
  grd.addColorStop(0, '#e8e8e8'); grd.addColorStop(1, '#203050');
  ig.fillStyle = grd; ig.fillRect(0, 0, 480, 360);
  ig.fillStyle = '#d04030'; ig.fillRect(60, 60, 160, 120);
  ig.fillStyle = '#30a060'; ig.fillRect(260, 180, 150, 120);
  ig.fillStyle = '#fff'; ig.font = 'bold 54px sans-serif'; ig.fillText('LME', 180, 240);

  // Swap `img` for `await loadImage('/path')` here to use a reference still instead.
  const src = img;

  // ── Filter presets ───────────────────────────────────────────────────────────────

  const names = Object.keys(PRESETS).filter(name => FILTER.test(name));
  console.log(`contact-sheet: ${names.length} presets matched FILTER ${FILTER}`);
  if (names.length === 0) {
    console.warn('contact-sheet: no presets matched — edit FILTER and re-run.');
    return;
  }

  // ── Layout: compute grid dimensions ─────────────────────────────────────────────

  const COLS   = Math.ceil(Math.sqrt(names.length));
  const ROWS   = Math.ceil(names.length / COLS);
  const SHEET_W = COLS * CELL_W;
  const SHEET_H = ROWS * (CELL_H + LABEL_H);

  const sheet  = document.createElement('canvas');
  sheet.width  = SHEET_W;
  sheet.height = SHEET_H;
  const sheetCtx = sheet.getContext('2d', { alpha: false });
  sheetCtx.fillStyle = '#111';
  sheetCtx.fillRect(0, 0, SHEET_W, SHEET_H);

  // ── Renderer setup (identical to gpu-coverage.snippet.js) ───────────────────────

  const cpu = new cpuMod.CRTRendererFull();

  // Per-cell offscreen canvas.
  const cell  = document.createElement('canvas');
  cell.width  = CELL_W;
  cell.height = CELL_H;
  const cellCtx = cell.getContext('2d', { alpha: false });

  // ── Render loop ──────────────────────────────────────────────────────────────────

  let rendered = 0;

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const col  = i % COLS;
    const row  = Math.floor(i / COLS);
    const ox   = col * CELL_W;
    const oy   = row * (CELL_H + LABEL_H);

    // Render one preset into the cell canvas.
    try {
      const p = PRESETS[name].params || PRESETS[name];
      if (typeof p !== 'object') throw new Error('preset value is not an object');

      cpu.setImage(src, 1);
      cpu.reset && cpu.reset();
      cpu.render(cellCtx, CELL_W, CELL_H, 0, p, 0, 30, {});

      sheetCtx.drawImage(cell, ox, oy);
      rendered++;
    } catch (err) {
      // Label the failed cell so the auditor can see which preset broke.
      sheetCtx.fillStyle = '#330000';
      sheetCtx.fillRect(ox, oy, CELL_W, CELL_H);
      sheetCtx.fillStyle = '#ff4444';
      sheetCtx.font = 'bold 13px monospace';
      sheetCtx.fillText('ERROR', ox + 8, oy + CELL_H / 2 - 8);
      sheetCtx.font = '11px monospace';
      sheetCtx.fillText(String(err.message).slice(0, 38), ox + 8, oy + CELL_H / 2 + 10);
      console.warn(`contact-sheet: "${name}" failed —`, err);
    }

    // Draw label strip.
    const labelY = oy + CELL_H;
    sheetCtx.fillStyle = '#1a1a1a';
    sheetCtx.fillRect(ox, labelY, CELL_W, LABEL_H);
    sheetCtx.fillStyle = '#ffffff';
    sheetCtx.font = 'bold 11px sans-serif';
    // Truncate long names so they fit in the cell width.
    const label = name.length > 36 ? name.slice(0, 34) + '…' : name;
    sheetCtx.fillText(label, ox + 4, labelY + 15);
  }

  console.log(`contact-sheet: rendered ${rendered}/${names.length} presets — downloading ${FILENAME}`);

  // ── Trigger PNG download ─────────────────────────────────────────────────────────

  const a = document.createElement('a');
  a.download = FILENAME;
  a.href = sheet.toDataURL('image/png');
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  return { total: names.length, rendered, filename: FILENAME };

})();
