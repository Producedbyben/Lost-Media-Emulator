// Headless LME render CLI — drives window.lmeHeadless (the CPU export pipeline) with no GUI, so
// assets can be created automatically. Run via tools/lme-render.sh, e.g.:
//   tools/lme-render.sh --in src.png --look "Consumer TV" --out out.png
//   tools/lme-render.sh --in src.png --look look.json --out clip.mp4 --duration 4 --fps 30
//   tools/lme-render.sh --list
// Loads the built dist (run `npm run build` first). Output is byte-identical to an app export.
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const applyGpuFlags = require("./gpu-flags.cjs");
const { registerFfmpegIpc } = require("./ffmpeg-ipc.cjs");

applyGpuFlags(app);
registerFfmpegIpc(ipcMain, { revealOnEncode: false });

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
// electron argv = [electron, scriptPath, ...appArgs]; parse everything after the script.
const scriptIdx = process.argv.findIndex((a) => a.endsWith("lme-render.cjs"));
const args = parseArgs(process.argv.slice(scriptIdx >= 0 ? scriptIdx + 1 : 2));

function done(code, payload) {
  if (payload !== undefined) process.stdout.write(JSON.stringify(payload) + "\n");
  app.exit(code);
}
function fail(msg) { process.stderr.write("lme-render: " + msg + "\n"); app.exit(1); }

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp" };
function fileToDataURL(p) {
  const mime = MIME[path.extname(p).toLowerCase()] || "image/png";
  return `data:${mime};base64,${fs.readFileSync(p).toString("base64")}`;
}

const DIST = path.join(__dirname, "..", "dist", "index.html");

app.whenReady().then(async () => {
  if (!fs.existsSync(DIST)) return fail(`built dist not found at ${DIST} — run 'npm run build' first`);
  const win = new BrowserWindow({
    width: 16, height: 16, show: false,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), nodeIntegration: false, contextIsolation: true },
  });
  win.webContents.on("console-message", (event) => {
    // Electron 42 passes a single event object ({ level, message }); only surface errors.
    if (event && (event.level === "error" || event.level >= 3)) {
      process.stderr.write("[renderer] " + (event.message || "") + "\n");
    }
  });
  try {
    await win.loadFile(DIST);
    const deadline = Date.now() + 20000;
    let ready = false;
    while (Date.now() < deadline) {
      ready = await win.webContents.executeJavaScript("!!(window.lmeHeadless && window.lmeHeadless.renderStill)").catch(() => false);
      if (ready) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!ready) return fail("window.lmeHeadless never appeared (is dist built from a current main.tsx?)");

    if (args.list) {
      const looks = await win.webContents.executeJavaScript("window.lmeHeadless.listLooks()");
      return done(0, looks);
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
    const outPath = path.resolve(String(args.out));
    const isVideo = /\.(mp4|mov|m4v)$/i.test(outPath) || args.duration != null;

    if (isVideo) {
      const payload = { input: inputURL, look, width, height, fps, durationSec: Number(args.duration) || 4, codec: args.codec ? String(args.codec) : "h264", outPath, formatPipeline };
      const res = await win.webContents.executeJavaScript(`window.lmeHeadless.renderVideo(${JSON.stringify(payload)})`);
      return done(0, { ok: true, type: "video", bytes: fs.existsSync(outPath) ? fs.statSync(outPath).size : 0, ...res });
    }
    const payload = { input: inputURL, look, width, height, frameIndex: Number(args.frame) || 0, fps, formatPipeline };
    const dataURL = await win.webContents.executeJavaScript(`window.lmeHeadless.renderStill(${JSON.stringify(payload)})`);
    fs.writeFileSync(outPath, Buffer.from(String(dataURL).replace(/^data:image\/png;base64,/, ""), "base64"));
    return done(0, { ok: true, type: "still", outPath, width, height, bytes: fs.statSync(outPath).size });
  } catch (e) {
    fail(String((e && e.stack) || e));
  }
});

app.on("window-all-closed", () => { /* CLI controls its own exit */ });
