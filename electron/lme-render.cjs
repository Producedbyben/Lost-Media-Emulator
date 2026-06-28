// Dev-mode headless render entry — runs the shared render core against the REPO's built dist.
// For normal use prefer the installed app's own `--lme-render` mode (self-contained); this entry
// is the fallback when running from the repo (tools/lme-render.sh picks whichever is available).
//   npx electron electron/lme-render.cjs --in src.png --look "Consumer TV" --out out.png
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const applyGpuFlags = require("./gpu-flags.cjs");
const { registerFfmpegIpc } = require("./ffmpeg-ipc.cjs");
const { runHeadlessRender } = require("./lme-render-core.cjs");

applyGpuFlags(app);
registerFfmpegIpc(ipcMain, { revealOnEncode: false });
runHeadlessRender({
  app,
  BrowserWindow,
  distPath: path.join(__dirname, "..", "dist", "index.html"),
  preloadPath: path.join(__dirname, "preload.cjs"),
  argv: process.argv,
});
