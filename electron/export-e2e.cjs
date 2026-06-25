// End-to-end export test in the REAL packaged bundle (the user's failing case).
// Loads dist, drives the export UI, auto-saves the download to a temp file
// (no dialog), and validates the resulting MP4 is a well-formed, sized file.
const { app, BrowserWindow, session } = require("electron");
const path = require("path");
const fs = require("fs");
const applyGpuFlags = require("./gpu-flags.cjs");

applyGpuFlags(app);
const tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "bt-export-"));
app.setPath("userData", tmp);
const savePath = path.join(tmp, "export.mp4");

const DRIVE = `(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = {};
  const skip = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Skip');
  if (skip) skip.click();
  await sleep(300);
  // load a synthetic still image
  const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360; const g = cv.getContext('2d');
  const grd = g.createLinearGradient(0,0,640,360); grd.addColorStop(0,'#e040a0'); grd.addColorStop(1,'#3060ff');
  g.fillStyle = grd; g.fillRect(0,0,640,360); g.fillStyle='#fff'; g.font='bold 70px sans-serif'; g.fillText('LME',240,210);
  const blob = await new Promise(r => cv.toBlob(r,'image/png'));
  const file = new File([blob],'src.png',{type:'image/png'});
  const input = document.querySelector('input[type=file]');
  const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await sleep(2000);
  // go to the Export view
  const nav = [...document.querySelectorAll('button')].find(b => b.textContent.replace(/\\s+/g,' ').trim() === 'Export' && b.querySelector('svg'));
  if (nav) nav.click();
  await sleep(600);
  // set a short duration so the test is fast
  const durInput = [...document.querySelectorAll('input')].find(i => {
    const lbl = i.closest('div')?.textContent || ''; return /Duration/i.test(lbl) || i.previousElementSibling?.textContent?.includes('Duration');
  }) || [...document.querySelectorAll('input[type=number]')].find(i => i.value === '4');
  if (durInput) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(durInput, '0.3');
    durInput.dispatchEvent(new Event('input', { bubbles: true }));
    durInput.dispatchEvent(new Event('change', { bubbles: true }));
    log.durationSetTo = durInput.value;
  }
  await sleep(300);
  // click the main Export MP4 button
  const exportBtn = [...document.querySelectorAll('button')].find(b => /Export MP4|Export WEBM|Export GIF/.test(b.textContent));
  log.exportButton = exportBtn ? exportBtn.textContent.trim() : null;
  if (exportBtn) exportBtn.click();
  return JSON.stringify(log);
})()`;

app.whenReady().then(async () => {
  const ses = session.defaultSession;
  let downloadDone = null;
  const downloadComplete = new Promise((res) => { downloadDone = res; });
  ses.on("will-download", (_e, item) => {
    item.setSavePath(savePath); // auto-save, no dialog
    item.once("done", (_ev, state) => downloadDone({ state, file: item.getSavePath() }));
  });

  const win = new BrowserWindow({
    width: 1400, height: 880, show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false,
      backgroundThrottling: false, autoplayPolicy: "no-user-gesture-required",
    },
  });
  win.webContents.on("console-message", (_e, _l, m) => { if (/\[export\]|error|fail/i.test(m)) console.log("[renderer] " + m); });
  await win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  await new Promise((r) => setTimeout(r, 1500));

  try {
    const driven = await win.webContents.executeJavaScript(DRIVE, true);
    console.log("DRIVE " + driven);
    const result = await Promise.race([
      downloadComplete,
      new Promise((res) => setTimeout(() => res({ state: "timeout" }), 25000)),
    ]);
    // validate the saved file
    let validation = { state: result.state };
    if (result.state === "completed" && fs.existsSync(savePath)) {
      const buf = fs.readFileSync(savePath);
      const boxAt = (o) => buf.toString("latin1", o + 4, o + 8);
      validation.bytes = buf.length;
      validation.firstBox = boxAt(0);
      validation.hasFtyp = buf.toString("latin1", 4, 8) === "ftyp";
      // scan top-level boxes
      const boxes = []; let off = 0;
      while (off + 8 <= buf.length && boxes.length < 10) {
        const size = buf.readUInt32BE(off); boxes.push(boxAt(off));
        if (size < 8) break; off += size;
      }
      validation.boxes = boxes;
      validation.validMP4 = boxes.includes("ftyp") && boxes.includes("moov") && boxes.includes("mdat");
    }
    console.log("EXPORT_E2E " + JSON.stringify(validation));
  } catch (e) {
    console.log("EXPORT_E2E " + JSON.stringify({ error: e.message }));
  }
  app.exit(0);
});
