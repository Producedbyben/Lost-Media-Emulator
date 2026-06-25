// RAM-preview + timeline verification. Builds an After-Effects-style frame
// precache for a heavy CPU look, then plays it back. A pass means the cache
// builds at full resolution and plays back perfectly fluidly (cached bitmaps).
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const applyGpuFlags = require("./gpu-flags.cjs");

applyGpuFlags(app);
const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "bt-ramtest-"));
app.setPath("userData", tmp);

const TEST = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = {};
  const skip = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Skip');
  if (skip) skip.click();
  await sleep(300);
  // ~1s mp4
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d');
  const stream = cv.captureStream(30);
  const mime = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4;codecs=avc1' : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime }); const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r); rec.start();
  let f = 0; const t0 = performance.now();
  const draw = () => { f++; g.fillStyle = 'hsl(' + (f*9%360) + ',70%,50%)'; g.fillRect(0,0,640,360); g.fillStyle='#fff'; g.font='70px sans-serif'; g.fillText('F'+f,240,200); if (performance.now()-t0 < 500) requestAnimationFrame(draw); else rec.stop(); };
  draw(); await done;
  const file = new File([new Blob(chunks, { type: mime.split(';')[0] })], 'test.mp4', { type: 'video/mp4' });
  const input = document.querySelector('input[type=file]');
  const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(2500);
  const main = [...document.querySelectorAll('canvas')].find(c => c.width > 150);
  log.videoLoaded = !!main;
  // apply a heavy CPU preset
  const preset = [...document.querySelectorAll('button')].find(b => /Hi8 Camcorder|Home VHS|Security Camera/.test(b.textContent));
  log.preset = preset ? preset.textContent.trim().slice(0,22) : null;
  if (preset) preset.click();
  await sleep(500);
  // find + click RAM Preview build button
  const ramBtn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('title')||'').indexOf('Precache all frames') === 0);
  log.ramButtonFound = !!ramBtn;
  if (!ramBtn) return JSON.stringify(log);
  ramBtn.click();
  // poll until ready (max 100s); track progress to prove it isn't stuck
  const start = performance.now();
  let st = null; const progressTrail = [];
  while (performance.now() - start < 30000) {
    st = window.__btDebug ? window.__btDebug() : null;
    if (st) progressTrail.push(st.ramProgress);
    if (st && st.ramStatus === 'ready') break;
    await sleep(500);
  }
  log.progressTrail = progressTrail.filter((v,i)=>i%4===0 || v===1);
  log.ramStatus = st && st.ramStatus;
  log.ramFrames = st && st.ramFrames;
  log.ramFrameSize = st ? (st.ramFrameW + 'x' + st.ramFrameH) : null;
  log.ramBuildMs = Math.round(performance.now() - start);
  if (!st || st.ramStatus !== 'ready') return JSON.stringify(log);
  // play back from cache and measure fluidity
  const play = [...document.querySelectorAll('button')].find(b => (b.getAttribute('title')||'').indexOf('Play (') === 0);
  if (play) play.click();
  await sleep(400);
  const gaps = []; let last = performance.now(); let running = true;
  const tick = () => { const n = performance.now(); gaps.push(n - last); last = n; if (running) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  const hash = () => { const c = document.createElement('canvas'); c.width = 48; c.height = 27; const x = c.getContext('2d'); x.drawImage(main,0,0,48,27); const d = x.getImageData(0,0,48,27).data; let h = 0; for (let i=0;i<d.length;i+=8) h = (h*31+d[i])>>>0; return h; };
  const hashes = [];
  for (let i = 0; i < 20; i++) { hashes.push(hash()); await sleep(150); }
  running = false;
  const sorted = [...gaps].sort((a,b)=>a-b);
  log.playbackMedianGapMs = +sorted[sorted.length>>1].toFixed(1);
  log.playbackMaxGapMs = +Math.max(...gaps).toFixed(1);
  log.playbackUniqueFrames = new Set(hashes).size + '/' + hashes.length;
  log.usingRamDuringPlayback = window.__btDebug().ramStatus;
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
  win.webContents.on("console-message", (_e, level, message) => {
    if (/RAM|build|seek|error|Error|fail/i.test(message)) console.log("[renderer] " + message);
  });
  await win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const result = await win.webContents.executeJavaScript(TEST, true);
    console.log("RAMTEST_RESULT " + result);
  } catch (e) {
    console.log("RAMTEST_RESULT " + JSON.stringify({ error: e.message }));
  }
  app.exit(0);
});
