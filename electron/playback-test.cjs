// Playback freeze regression test. Boots the real bundle in a VISIBLE window
// (so requestAnimationFrame runs at full rate, unlike a hidden/offscreen one),
// synthesizes an mp4 in-renderer, plays it while cycling heavy CPU presets, and
// measures frame-update continuity + the adaptive resolution governor. A pass
// means playback never froze (canvas kept updating, rAF gaps stayed bounded).
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const applyGpuFlags = require("./gpu-flags.cjs");

applyGpuFlags(app);
const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "bt-playtest-"));
app.setPath("userData", tmp);

const TEST = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = {};
  const skip = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Skip');
  if (skip) skip.click();
  await sleep(300);
  // synthesize an mp4
  const cv = document.createElement('canvas'); cv.width = 960; cv.height = 540; const g = cv.getContext('2d');
  const stream = cv.captureStream(30);
  const mime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1' : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime }); const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r); rec.start();
  let f = 0; const t0 = performance.now();
  const draw = () => { f++; g.fillStyle = 'hsl(' + (f*6%360) + ',70%,50%)'; g.fillRect(0,0,960,540); g.fillStyle='#fff'; g.font='90px sans-serif'; g.fillText('F'+f,360,300); if (performance.now()-t0 < 3000) requestAnimationFrame(draw); else rec.stop(); };
  draw(); await done;
  const blob = new Blob(chunks, { type: mime.split(';')[0] });
  const file = new File([blob], 'test.mp4', { type: 'video/mp4' });
  const input = document.querySelector('input[type=file]');
  if (!input) return JSON.stringify({ error: 'no file input' });
  const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(2500);
  const main = [...document.querySelectorAll('canvas')].find(c => c.width > 300);
  log.videoLoaded = !!main;
  // helper to click a preset by name fragment
  const clickPreset = frag => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.replace(/\\s+/g,' ').includes(frag)); if (b) { b.click(); return b.textContent.trim().slice(0,22); } return null; };
  // apply a heavy CPU preset first
  log.firstPreset = clickPreset('Home VHS') || clickPreset('Security Camera') || clickPreset('Hi8');
  await sleep(500);
  // start playback (the play button identifies itself via title="Play (K)")
  const play = [...document.querySelectorAll('button')].find(b => (b.getAttribute('title')||'').indexOf('Play (') === 0);
  log.playButtonFound = !!play;
  if (play) play.click();
  await sleep(800);
  log.playingAfterClick = window.__btDebug ? window.__btDebug().isVideoPlaying : 'n/a';
  // measure rAF gaps + canvas continuity while switching presets
  const gaps = []; let last = performance.now(); let running = true;
  const tick = () => { const n = performance.now(); gaps.push(n - last); last = n; if (running) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const hash = () => { const c = document.createElement('canvas'); c.width = 48; c.height = 27; const x = c.getContext('2d'); x.drawImage(main,0,0,48,27); const d = x.getImageData(0,0,48,27).data; let h = 0; for (let i=0;i<d.length;i+=8) h = (h*31 + d[i]) >>> 0; return h; };
  const heavy = ['Hi8 Camcorder','Security Camera','Betamax','PVM/BVM','Silent B&W Film'];
  const widths = []; const hashes = []; const dbg = [];
  for (let i = 0; i < 25; i++) {
    widths.push(main.width); hashes.push(hash());
    if (window.__btDebug) dbg.push(window.__btDebug());
    if (i % 4 === 0) clickPreset(heavy[(i/4|0) % heavy.length]);
    await sleep(160);
  }
  running = false;
  log.debugFirst = dbg[2] || null;
  log.debugMid = dbg[12] || null;
  log.debugLast = dbg[dbg.length-1] || null;
  const sorted = [...gaps].sort((a,b)=>a-b);
  log.frameSamples = gaps.length;
  log.medianRafGapMs = +sorted[sorted.length>>1].toFixed(1);
  log.p95RafGapMs = +sorted[Math.floor(sorted.length*0.95)].toFixed(1);
  log.maxRafGapMs = +Math.max(...gaps).toFixed(1);
  log.startWidth = widths[0];
  log.minWidth = Math.min(...widths);
  log.governorEngaged = Math.min(...widths) < widths[0];
  log.uniqueFrameStates = new Set(hashes).size + '/' + hashes.length;
  return JSON.stringify(log);
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 880,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      autoplayPolicy: "no-user-gesture-required",
    },
  });
  await win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const result = await win.webContents.executeJavaScript(TEST, true);
    console.log("PLAYTEST_RESULT " + result);
  } catch (e) {
    console.log("PLAYTEST_RESULT " + JSON.stringify({ error: e.message }));
  }
  app.exit(0);
});
