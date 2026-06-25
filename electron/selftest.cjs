// Headless-ish self test: boots the real production bundle inside Electron with
// the production GPU flags, drives the renderer, and reports pixel stats so we
// can verify effects + GPU actually work in the desktop runtime (not just a
// browser). Run: npx electron electron/selftest.cjs
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");
const applyGpuFlags = require("./gpu-flags.cjs");

applyGpuFlags(app);

// Fresh profile each run so persisted sessions don't mask a real regression.
const tmpUserData = fs.mkdtempSync(path.join(require("os").tmpdir(), "bt-selftest-"));
app.setPath("userData", tmpUserData);

const RENDERER_TEST = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const out = {};
  out.isDesktop = !!(window.desktop && window.desktop.isDesktop);
  // dismiss tutorial if present
  const skip = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Skip');
  if (skip) skip.click();
  await sleep(300);
  // inject a synthetic test image through the file input
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 480;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0,0,640,480);
  grad.addColorStop(0,'#ff5050'); grad.addColorStop(.5,'#50ff90'); grad.addColorStop(1,'#5080ff');
  g.fillStyle = grad; g.fillRect(0,0,640,480);
  g.fillStyle = '#fff'; g.font = 'bold 80px sans-serif'; g.fillText('TEST',180,260);
  const blob = await new Promise(r => cv.toBlob(r,'image/png'));
  const file = new File([blob],'test.png',{type:'image/png'});
  const input = document.querySelector('input[type=file]');
  if (!input) return JSON.stringify({error:'no file input'});
  const dt = new DataTransfer(); dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await sleep(2500);
  const main = [...document.querySelectorAll('canvas')].find(c => c.width > 800);
  if (!main) return JSON.stringify({error:'no main canvas'});
  out.canvas = { w: main.width, h: main.height };
  const stats = () => {
    const c2 = document.createElement('canvas'); c2.width = main.width; c2.height = main.height;
    const cx = c2.getContext('2d'); cx.drawImage(main,0,0);
    const d = cx.getImageData(0,0,main.width,main.height).data;
    let sum=0,sumsq=0,nb=0,n=d.length/4;
    for (let i=0;i<d.length;i+=4){const v=(d[i]+d[i+1]+d[i+2])/3; if(d[i]+d[i+1]+d[i+2]>15)nb++; sum+=v; sumsq+=v*v;}
    const mean=sum/n; return {mean:+mean.toFixed(2), std:+Math.sqrt(sumsq/n-mean*mean).toFixed(2), nonBlackPct:+(100*nb/n).toFixed(1)};
  };
  out.imageLoaded = stats();
  // apply a strong preset (CPU pipeline)
  const preset = [...document.querySelectorAll('button')].find(b => /Late-80s Home VHS|Consumer TV|Security Camera/.test(b.textContent));
  out.presetApplied = preset ? preset.textContent.trim().slice(0,24) : null;
  preset && preset.click();
  await sleep(2500);
  out.afterPreset = stats();
  out.effectChanged = Math.abs(out.afterPreset.mean - out.imageLoaded.mean) > 1 || Math.abs(out.afterPreset.std - out.imageLoaded.std) > 1;
  // renderer mode badge WITHOUT manually toggling — proves desktop default
  out.rendererBadgeDefault = [...document.querySelectorAll('span,div')]
    .map(e => e.textContent.trim()).find(t => t === 'GPU' || t === 'Hybrid' || t === 'CPU') || null;
  // direct WebGL2 context + GPU->CPU read-back test (the path the broken flags broke)
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { preserveDrawingBuffer: true });
    out.webgl2 = !!gl;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      out.glRenderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'n/a';
      // minimal draw + readback to confirm GPU->CPU read path works
      gl.clearColor(0.2, 0.6, 0.9, 1.0); gl.clear(gl.COLOR_BUFFER_BIT);
      const px = new Uint8Array(4); gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);
      out.glReadback = [px[0],px[1],px[2],px[3]];
    }
  } catch (e) { out.glError = e.message; }
  // enable in-app GPU acceleration toggle and confirm it doesn't blank the canvas
  const adv = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Advanced');
  adv && adv.click(); await sleep(400);
  const cb = [...document.querySelectorAll('input[type=checkbox]')].find(x => { const l = x.closest('label'); return l && /GPU acceleration/i.test(l.textContent); });
  if (cb) { cb.click(); await sleep(1500); out.afterGpuToggle = stats(); }
  return JSON.stringify(out);
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.webContents.on("did-fail-load", (_e, c, d, u) => {
    console.log("SELFTEST_RESULT " + JSON.stringify({ error: "load failed", c, d, u }));
    app.exit(1);
  });
  await win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  await new Promise((r) => setTimeout(r, 1500));
  try {
    const result = await win.webContents.executeJavaScript(RENDERER_TEST, true);
    console.log("SELFTEST_RESULT " + result);
    const png = await win.webContents.capturePage();
    fs.writeFileSync("/tmp/bt-selftest.png", png.toPNG());
    console.log("SELFTEST_SCREENSHOT /tmp/bt-selftest.png");
  } catch (e) {
    console.log("SELFTEST_RESULT " + JSON.stringify({ error: e.message }));
  }
  app.exit(0);
});
