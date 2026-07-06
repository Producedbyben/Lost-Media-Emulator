// Shared headless render flow. An offscreen BrowserWindow loads the app dist, waits for
// window.lmeHeadless (the CPU export pipeline), renders a still (PNG) or clip (MP4/MOV), writes
// the output, and exits. Used by BOTH the packaged app's `--lme-render` mode (electron/main.cjs)
// and the dev CLI (electron/lme-render.cjs). The caller has already applied gpu-flags + registered
// the ffmpeg IPC (with revealOnEncode:false for batch use).
//
// IMPORTANT: a packaged macOS .app is a GUI app — its stdout/stderr are NOT reliably delivered when
// launched from a shell. So results and diagnostics also go to FILES: a debug log (always) and an
// optional `--result-file` (the wrapper reads this instead of stdout). A watchdog guarantees the
// process always exits rather than hanging if the renderer never comes up.
// LME_HEADLESS_CORE_MARKER_v1 — capability sentinel. tools/lme-render.sh greps the app.asar for
// this exact string to know an installed app carries the headless mode (it only appears in THIS
// file's bundled content, never in main.cjs's require line). Do not remove or rename.
const path = require("path");
const fs = require("fs");
const os = require("os");

const LOG_PATH = process.env.LME_RENDER_LOG || path.join(os.tmpdir(), "lme-render.log");
function log(msg) {
  try { fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else { out[key] = next; i++; }
  }
  return out;
}

// B10 framing controls: --anchor "X,Y" (subject focus, source fractions; default = old centre-crop)
// and --view "x,y,w,h" (explicit crop window, wins over anchor). Batch jobs may carry per-job
// `anchor`/`view` (same string or object form) overriding the global flags.
function parseAnchor(v) {
  if (v == null || v === true) return null;
  if (typeof v === "object") return (Number.isFinite(v.x) && Number.isFinite(v.y)) ? { x: Number(v.x), y: Number(v.y) } : null;
  const p = String(v).split(",").map(Number);
  return (p.length === 2 && p.every(Number.isFinite)) ? { x: p[0], y: p[1] } : null;
}
function parseView(v) {
  if (v == null || v === true) return null;
  if (typeof v === "object") {
    const { x, y, width, height } = v;
    return [x, y, width, height].every(Number.isFinite) ? { x: Number(x), y: Number(y), width: Number(width), height: Number(height) } : null;
  }
  const p = String(v).split(",").map(Number);
  return (p.length === 4 && p.every(Number.isFinite)) ? { x: p[0], y: p[1], width: p[2], height: p[3] } : null;
}

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp" };
function fileToDataURL(p) {
  const mime = MIME[path.extname(p).toLowerCase()] || "image/png";
  return `data:${mime};base64,${fs.readFileSync(p).toString("base64")}`;
}

function runHeadlessRender({ app, BrowserWindow, distPath, preloadPath, argv }) {
  const args = parseArgs(argv);
  const resultFile = args["result-file"] ? path.resolve(String(args["result-file"])) : null;
  let settled = false;

  const writeResult = (obj) => { if (resultFile) { try { fs.writeFileSync(resultFile, JSON.stringify(obj) + "\n"); } catch (e) { log("result-file write failed: " + e); } } };
  const done = (code, payload) => {
    if (settled) return; settled = true;
    log(`done code=${code}`);
    if (payload !== undefined) { try { process.stdout.write(JSON.stringify(payload) + "\n"); } catch {} writeResult(payload); }
    app.exit(code);
  };
  const fail = (msg) => {
    if (settled) return; settled = true;
    log("FAIL: " + msg);
    try { process.stderr.write("lme-render: " + msg + "\n"); } catch {}
    writeResult({ ok: false, error: String(msg) });
    app.exit(1);
  };

  // Never hang: a hard watchdog (generous — video renders can take a while) always exits.
  const watchdogMs = Number(args["watchdog"]) || 120000;
  const watchdog = setTimeout(() => fail(`watchdog timeout after ${watchdogMs}ms (renderer never completed)`), watchdogMs);
  watchdog.unref && watchdog.unref();
  process.on("uncaughtException", (e) => fail("uncaughtException: " + ((e && e.stack) || e)));
  process.on("unhandledRejection", (e) => fail("unhandledRejection: " + ((e && e.stack) || e)));

  log(`start argv=${JSON.stringify(argv.slice(1))} distPath=${distPath} preload=${preloadPath}`);

  app.whenReady().then(async () => {
    log("app ready");
    if (!fs.existsSync(distPath)) return fail(`built dist not found at ${distPath}`);
    const win = new BrowserWindow({
      width: 16, height: 16, show: false,
      webPreferences: { preload: preloadPath, nodeIntegration: false, contextIsolation: true, offscreen: false },
    });
    win.webContents.on("console-message", (event) => {
      if (event && (event.level === "error" || event.level >= 3)) log("[renderer] " + (event.message || ""));
    });
    win.webContents.on("render-process-gone", (_e, d) => fail("render-process-gone: " + JSON.stringify(d)));
    win.webContents.on("did-fail-load", (_e, code, desc) => log(`did-fail-load ${code} ${desc}`));
    try {
      log("loadFile…");
      await win.loadFile(distPath);
      log("loadFile done");
      const deadline = Date.now() + 30000;
      let ready = false;
      while (Date.now() < deadline) {
        ready = await win.webContents.executeJavaScript("!!(window.lmeHeadless && window.lmeHeadless.renderStill)").catch(() => false);
        if (ready) break;
        await new Promise((r) => setTimeout(r, 100));
      }
      if (!ready) return fail("window.lmeHeadless never appeared (is this build current?)");
      log("lmeHeadless ready");

      if (args.list) return done(0, await win.webContents.executeJavaScript("window.lmeHeadless.listLooks()"));

      // --batch <manifest.json>: ONE app launch, loop renderStill over many frames (amortizes the
      // ~startup cost across a whole clip). Manifest = JSON array of {in,out,[look,width,height,frame]}.
      // Reuses the exact single-still path → output is byte-identical to per-call renders.
      if (args.batch) {
        const manifestPath = path.resolve(String(args.batch));
        if (!fs.existsSync(manifestPath)) return fail(`--batch manifest not found: ${manifestPath}`);
        const jobs = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        if (!Array.isArray(jobs) || !jobs.length) return fail("--batch manifest must be a non-empty JSON array");
        const fmt = !args["no-format"];
        const fps = Number(args.fps) || 30;
        const lookCache = {};
        const resolveLook = (lk) => {
          if (lk == null) return null;
          const s = String(lk);
          if (/\.json$/i.test(s) && fs.existsSync(s)) { if (!(s in lookCache)) lookCache[s] = JSON.parse(fs.readFileSync(s, "utf8")); return lookCache[s]; }
          return s;
        };
        let okCount = 0; const results = [];
        for (let j = 0; j < jobs.length; j++) {
          const job = jobs[j];
          try {
            const jobAnchor = parseAnchor(job.anchor != null ? job.anchor : args.anchor);
            const jobView = parseView(job.view != null ? job.view : args.view);
            const payload = {
              input: fileToDataURL(path.resolve(String(job.in))),
              look: resolveLook(job.look != null ? job.look : args.look),
              width: Number(job.width || args.width) || 1280,
              height: Number(job.height || args.height) || 720,
              frameIndex: Number(job.frame != null ? job.frame : j) || 0,
              fps, formatPipeline: fmt,
              ...(jobAnchor ? { anchor: jobAnchor } : {}),
              ...(jobView ? { view: jobView } : {}),
            };
            const dataURL = await win.webContents.executeJavaScript(`window.lmeHeadless.renderStill(${JSON.stringify(payload)})`);
            const outPath = path.resolve(String(job.out));
            fs.writeFileSync(outPath, Buffer.from(String(dataURL).replace(/^data:image\/png;base64,/, ""), "base64"));
            okCount++; results.push({ ok: true, out: outPath });
          } catch (e) {
            log(`batch job ${j} failed: ${(e && e.stack) || e}`);
            results.push({ ok: false, in: job.in, error: String(e) });
          }
          watchdog.refresh && watchdog.refresh(); // a long batch must not trip the watchdog
        }
        return done(okCount === jobs.length ? 0 : 1, { ok: okCount === jobs.length, type: "batch", total: jobs.length, ok_count: okCount, results });
      }

      if (!args.in) return fail("--in <image> required");
      if (!args.out) return fail("--out <path> required");

      const inputURL = fileToDataURL(path.resolve(String(args.in)));
      let look = args.look != null ? String(args.look) : null;
      if (look && /\.json$/i.test(look) && fs.existsSync(look)) look = JSON.parse(fs.readFileSync(look, "utf8"));

      const width = Number(args.width) || 1280;
      const height = Number(args.height) || 720;
      const fps = Number(args.fps) || 30;
      const formatPipeline = !args["no-format"];
      const anchor = parseAnchor(args.anchor);
      const view = parseView(args.view);
      const framing = { ...(anchor ? { anchor } : {}), ...(view ? { view } : {}) };
      const outPath = path.resolve(String(args.out));
      const isVideo = /\.(mp4|mov|m4v)$/i.test(outPath) || args.duration != null;

      if (isVideo) {
        log("renderVideo…");
        const payload = { input: inputURL, look, width, height, fps, durationSec: Number(args.duration) || 4, codec: args.codec ? String(args.codec) : "h264", outPath, formatPipeline, ...framing };
        const res = await win.webContents.executeJavaScript(`window.lmeHeadless.renderVideo(${JSON.stringify(payload)})`);
        return done(0, { ok: true, type: "video", bytes: fs.existsSync(outPath) ? fs.statSync(outPath).size : 0, ...res });
      }
      log("renderStill… framing=" + JSON.stringify(framing) + " rawAnchor=" + JSON.stringify(args.anchor));
      const payload = { input: inputURL, look, width, height, frameIndex: Number(args.frame) || 0, fps, formatPipeline, ...framing };
      const dataURL = await win.webContents.executeJavaScript(`window.lmeHeadless.renderStill(${JSON.stringify(payload)})`);
      fs.writeFileSync(outPath, Buffer.from(String(dataURL).replace(/^data:image\/png;base64,/, ""), "base64"));
      return done(0, { ok: true, type: "still", outPath, width, height, bytes: fs.statSync(outPath).size });
    } catch (e) {
      fail(String((e && e.stack) || e));
    }
  });

  app.on("window-all-closed", () => { /* CLI controls its own exit */ });
}

module.exports = { runHeadlessRender };
