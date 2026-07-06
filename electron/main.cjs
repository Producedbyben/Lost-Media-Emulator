// Lost Media Emulator — native macOS (Apple Silicon) shell.
// Runs the Vite/React effects studio inside a Metal-accelerated Chromium window.

const { app, BrowserWindow, Menu, shell, dialog, nativeTheme, ipcMain, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const applyGpuFlags = require("./gpu-flags.cjs");
const { locate } = require("./ffmpeg-locate.cjs");
const { registerFfmpegIpc } = require("./ffmpeg-ipc.cjs");
const { getDeviceId, getDeviceName } = require("./license/identity.cjs");
const licenseStore = require("./license/store.cjs");
const licenseApi = require("./license/api.cjs");
const { initAutoUpdate, checkForUpdatesInteractive } = require("./updater.cjs");

const isDev = !app.isPackaged;
// Headless asset-render mode: `… --lme-render --in img --look "Consumer TV" --out out.png`.
// Skips the window/menu/license/updater/single-instance and renders via the CPU export pipeline,
// so the installed app is self-contained for automated asset creation. See electron/lme-render-core.cjs.
const HEADLESS = process.argv.includes("--lme-render");

// Activation state, resolved before the window shows. The main process is the
// only writer of the stored token, so the gate can't be bypassed from the page.
let license = { activated: false, record: null };

// Apple Silicon GPU config (Metal ANGLE). Must run before app-ready.
applyGpuFlags(app);

app.setName("Lost Media Emulator");

let mainWindow = null;

// --- Recent files (File ▸ Open Recent, audit #8) -----------------------------
// Last 5 successfully-opened on-disk paths, persisted to userData so the menu
// survives relaunches. The renderer reports opens via `recent-files:add`;
// clicking an item reads the file here and hands the bytes back as a data URL.

const RECENT_LIMIT = 5;
const RECENT_MAX_BYTES = 300 * 1024 * 1024; // data-URL round-trip cap

const MIME_BY_EXT = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
  webp: "image/webp", bmp: "image/bmp", avif: "image/avif", tif: "image/tiff", tiff: "image/tiff",
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};

let recentFiles = [];

function recentFilesPath() {
  return path.join(app.getPath("userData"), "recent-files.json");
}

function loadRecentFiles() {
  try {
    const parsed = JSON.parse(fs.readFileSync(recentFilesPath(), "utf8"));
    if (Array.isArray(parsed)) {
      recentFiles = parsed.filter((p) => typeof p === "string" && p).slice(0, RECENT_LIMIT);
    }
  } catch {
    recentFiles = [];
  }
}

function saveRecentFiles() {
  try {
    fs.writeFileSync(recentFilesPath(), JSON.stringify(recentFiles, null, 2));
  } catch {
    /* non-fatal: the in-memory list still drives the menu this session */
  }
}

function addRecentFile(filePath) {
  if (typeof filePath !== "string" || !filePath || !path.isAbsolute(filePath)) return;
  recentFiles = [filePath, ...recentFiles.filter((p) => p !== filePath)].slice(0, RECENT_LIMIT);
  saveRecentFiles();
  try {
    app.addRecentDocument(filePath); // macOS Dock / system-level Recent Items too
  } catch { /* cosmetic */ }
  buildMenu(); // rebuild so Open Recent reflects the new list
}

function clearRecentFiles() {
  recentFiles = [];
  saveRecentFiles();
  try {
    app.clearRecentDocuments();
  } catch { /* cosmetic */ }
  buildMenu();
}

// Menu click → read the file in main, ship it to the renderer as a data URL.
// The renderer rebuilds a File and runs the exact same import path as a pick.
function openRecentFile(filePath) {
  if (!mainWindow) return;
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    dialog.showMessageBox(mainWindow, {
      type: "error",
      message: "File not found",
      detail: `${filePath} no longer exists, so it was removed from Open Recent.`,
    });
    recentFiles = recentFiles.filter((p) => p !== filePath);
    saveRecentFiles();
    buildMenu();
    return;
  }
  if (stat.size > RECENT_MAX_BYTES) {
    dialog.showMessageBox(mainWindow, {
      type: "error",
      message: "File too large to reopen from the menu",
      detail: "Files over 300 MB can't be reopened from Open Recent. Use File ▸ Open Media… instead.",
    });
    return;
  }
  let data;
  try {
    data = fs.readFileSync(filePath);
  } catch (e) {
    dialog.showMessageBox(mainWindow, {
      type: "error",
      message: "Couldn't read file",
      detail: e.message,
    });
    return;
  }
  const ext = path.extname(filePath).replace(".", "").toLowerCase();
  const mime = MIME_BY_EXT[ext] || "application/octet-stream";
  // JSON.stringify makes the payload a safe JS object-literal to inline.
  const payload = JSON.stringify({
    dataURL: `data:${mime};base64,${data.toString("base64")}`,
    name: path.basename(filePath),
  });
  mainWindow.webContents
    .executeJavaScript(`window.dispatchEvent(new CustomEvent("menu:open-recent", { detail: ${payload} }))`)
    .catch(() => {});
  addRecentFile(filePath); // bump to the front, like every mac app
}

ipcMain.handle("recent-files:add", (_e, args) => {
  const p = args && args.path;
  if (typeof p === "string" && p) addRecentFile(p);
  return { ok: true };
});

// Menu → renderer bridge (same pattern as the Help menu's shortcuts/tutorial).
function sendMenuEvent(name) {
  mainWindow?.webContents
    .executeJavaScript(`window.dispatchEvent(new Event("${name}"))`)
    .catch(() => {});
}

// --- Window state restore (audit #13) ----------------------------------------
// Bounds + maximized flag persisted to userData (debounced on resize/move, and
// once more on close). Restored with a display-bounds sanity check so a window
// last seen on a disconnected monitor comes back centred instead of off-screen.

const DEFAULT_WINDOW_SIZE = { width: 1480, height: 940 };
const MIN_WINDOW_SIZE = { width: 1080, height: 720 };
let windowStateSaveTimer = null;

function windowStatePath() {
  return path.join(app.getPath("userData"), "window-state.json");
}

function readWindowState() {
  try {
    const s = JSON.parse(fs.readFileSync(windowStatePath(), "utf8"));
    if (s && [s.x, s.y, s.width, s.height].every(Number.isFinite)) return s;
  } catch { /* first run / corrupt file → defaults */ }
  return null;
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.getNormalBounds(); // un-maximized bounds, even while maximized
    fs.writeFileSync(
      windowStatePath(),
      JSON.stringify({ ...bounds, isMaximized: win.isMaximized() }, null, 2),
    );
  } catch { /* non-fatal */ }
}

function scheduleWindowStateSave(win) {
  clearTimeout(windowStateSaveTimer);
  windowStateSaveTimer = setTimeout(() => saveWindowState(win), 400);
}

// Resolve the BrowserWindow constructor bounds from the saved state.
// Returns { width, height, x?, y?, maximize } — x/y omitted means "center".
function restoreWindowState() {
  const saved = readWindowState();
  if (!saved) return { ...DEFAULT_WINDOW_SIZE, maximize: false };

  const width = Math.max(MIN_WINDOW_SIZE.width, Math.round(saved.width));
  const height = Math.max(MIN_WINDOW_SIZE.height, Math.round(saved.height));

  // The saved rect must meaningfully overlap a *current* display's work area
  // (≥100px in each axis) or we drop the position and let Electron center it.
  const rect = { x: saved.x, y: saved.y, width, height };
  const visible = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    const overlapW = Math.min(rect.x + rect.width, a.x + a.width) - Math.max(rect.x, a.x);
    const overlapH = Math.min(rect.y + rect.height, a.y + a.height) - Math.max(rect.y, a.y);
    return overlapW >= 100 && overlapH >= 100;
  });

  return {
    width,
    height,
    ...(visible ? { x: Math.round(saved.x), y: Math.round(saved.y) } : {}),
    maximize: saved.isMaximized === true,
  };
}

function createWindow() {
  const state = restoreWindowState();
  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    ...(state.x !== undefined ? { x: state.x, y: state.y } : {}),
    minWidth: 1080,
    minHeight: 720,
    title: "Lost Media Emulator",
    backgroundColor: "#0a0a0b",
    // Native mac feel: traffic lights inset over the app's own dark chrome.
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 18 },
    vibrancy: "under-window",
    visualEffectState: "active",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      // The effects engine leans on WebGL / Web Workers / canvas — keep them hot.
      backgroundThrottling: false,
      webgl: true,
      // Let muted source video begin without a synthetic user gesture.
      autoplayPolicy: "no-user-gesture-required",
    },
  });

  // Never navigate away from the app document (audit #4): a stray file drop or
  // window.open must not replace the workspace.
  mainWindow.webContents.on("will-navigate", (e) => e.preventDefault());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // window.open of an https link (e.g. the licence gate's buy link) goes to the
    // system browser; everything else (incl. dropped file:// URLs) is denied.
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  // Restore maximized state before first paint so it doesn't visibly jump.
  if (state.maximize) mainWindow.maximize();

  // Persist bounds/maximized as the user arranges the window (debounced), plus
  // a final synchronous save on close.
  mainWindow.on("resize", () => scheduleWindowStateSave(mainWindow));
  mainWindow.on("move", () => scheduleWindowStateSave(mainWindow));
  mainWindow.on("close", () => {
    clearTimeout(windowStateSaveTimer);
    saveWindowState(mainWindow);
  });

  // Avoid a white flash before the dark UI paints.
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // Show the studio if activated, otherwise the license gate.
  routeWindow();

  // Load diagnostics (surface in the main-process console).
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[LostMedia] renderer loaded:", mainWindow.webContents.getURL());
  });
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("[LostMedia] load FAILED", code, desc, url);
  });
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    console.error("[LostMedia] renderer gone:", details.reason);
  });

  // Open target="_blank" / external links in the user's browser, not a new window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  // Route in-app exports (Blob downloads) through a real macOS save panel so
  // rendered videos/GIFs/LUTs land where the user wants them.
  mainWindow.webContents.session.on("will-download", (_event, item) => {
    const suggested = item.getFilename();
    const ext = path.extname(suggested).replace(".", "") || "bin";
    item.setSaveDialogOptions({
      title: "Export",
      defaultPath: path.join(app.getPath("downloads"), suggested),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }, { name: "All Files", extensions: ["*"] }],
    });
    item.once("done", (_e, state) => {
      if (state === "completed") {
        shell.showItemInFolder(item.getSavePath());
      }
    });
  });
}

// --- License gate ----------------------------------------------------------

function loadAppContent() {
  // BT_LOAD_DIST forces the production bundle even when unpackaged (used for
  // verification without spinning up the Vite dev server).
  const loadDist = !isDev || process.env.BT_LOAD_DIST === "1";
  if (loadDist) {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    mainWindow.loadURL("http://localhost:8080");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function loadGateContent() {
  mainWindow.loadFile(path.join(__dirname, "license.html"));
}

function routeWindow() {
  // Rebuild the menu so "Deactivate License…" reflects the current state.
  if (mainWindow) buildMenu();
  if (license.activated) loadAppContent();
  else loadGateContent();
}

// Resolve activation before the window paints. A non-expired cached token lets
// the app open offline; an expired one (or none) requires an online re-check.
async function evaluateLicense() {
  const deviceId = getDeviceId(app);
  const record = licenseStore.read(app);

  if (record && typeof record.exp === "number" && record.exp * 1000 > Date.now()) {
    license = { activated: true, record };
    // Best-effort online refresh; a revoke/invalid sends the window back to the gate.
    refreshLicense(deviceId, record.key).catch(() => {});
    return;
  }

  if (record && record.key) {
    try {
      const r = await licenseApi.validate({ key: record.key, deviceId });
      if (r && r.valid) {
        const next = persistRecord(record.key, deviceId, r);
        license = { activated: true, record: next };
        return;
      }
    } catch {
      /* offline with an expired token → must re-activate */
    }
  }

  license = { activated: false, record: null };
}

function persistRecord(key, deviceId, r) {
  const record = {
    key,
    deviceId,
    plan: r.plan,
    productId: r.productId,
    maxDevices: r.maxDevices,
    token: r.token,
    exp: r.exp,
  };
  licenseStore.write(app, record);
  return record;
}

async function refreshLicense(deviceId, key) {
  const r = await licenseApi.validate({ key, deviceId });
  if (r && r.valid) {
    license = { activated: true, record: persistRecord(key, deviceId, r) };
  } else if (r && (r.reason === "revoked" || r.reason === "invalid")) {
    licenseStore.clear(app);
    license = { activated: false, record: null };
    if (mainWindow) routeWindow();
  }
}

async function deactivateLicense() {
  const deviceId = getDeviceId(app);
  const key = license.record && license.record.key;
  if (key) {
    try {
      await licenseApi.deactivate({ key, deviceId });
    } catch {
      /* offline: still clear locally so this device stops opening */
    }
  }
  licenseStore.clear(app);
  license = { activated: false, record: null };
  if (mainWindow) routeWindow();
}

ipcMain.handle("license:status", () => ({
  activated: license.activated,
  plan: license.record ? license.record.plan : null,
  productId: license.record ? license.record.productId : null,
  deviceName: getDeviceName(),
}));

ipcMain.handle("license:activate", async (_e, { key }) => {
  const trimmed = (key || "").trim();
  if (!trimmed) return { valid: false, reason: "bad_request" };
  const deviceId = getDeviceId(app);
  const deviceName = getDeviceName();
  let r;
  try {
    r = await licenseApi.activate({ key: trimmed, deviceId, deviceName });
  } catch {
    return { valid: false, reason: "network" };
  }
  if (r && r.valid) {
    license = { activated: true, record: persistRecord(trimmed, deviceId, r) };
    routeWindow(); // swap the gate for the studio (and refresh the menu)
    return { valid: true, plan: r.plan };
  }
  return r || { valid: false, reason: "unknown" };
});

ipcMain.handle("license:deactivate", async () => {
  await deactivateLicense();
  return { ok: true };
});

// --- Native ffmpeg export pipeline -----------------------------------------
// Session + encode handlers live in ffmpeg-ipc.cjs so the headless render CLI shares them.
// The interactive app reveals the finished file in Finder; the GUI-only save-dialog / probe-audio
// handlers below stay here (they need mainWindow / dialog).
registerFfmpegIpc(ipcMain, { revealOnEncode: !HEADLESS });

// ffmpeg writes the file itself, so the renderer needs a real destination path
// before encoding. Return the chosen absolute path (or null if cancelled).
ipcMain.handle("ffmpeg:save-dialog", async (_e, { defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export",
    defaultPath: path.join(app.getPath("downloads"), defaultName || "export.mp4"),
    filters: [{ name: "Video", extensions: ["mp4", "mov"] }, { name: "All Files", extensions: ["*"] }],
  });
  return result.canceled ? null : result.filePath;
});

// Honest audio availability: does this source file actually carry an audio
// track? Lets the UI enable/disable the "Original audio" option with a real
// reason instead of silently producing a silent file.
ipcMain.handle("ffmpeg:probe-audio", async (_e, { sourcePath }) => {
  const { ffprobe } = locate();
  if (!ffprobe || !sourcePath) return { hasAudio: false, probed: false };
  const { execFile } = require("child_process");
  return new Promise((resolve) => {
    execFile(
      ffprobe,
      ["-v", "quiet", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", sourcePath],
      (err, stdout) => resolve({ hasAudio: !err && stdout.trim().length > 0, probed: true }),
    );
  });
});

function buildMenu() {
  const template = [
    {
      label: "Lost Media Emulator",
      submenu: [
        { role: "about", label: "About Lost Media Emulator" },
        { label: `Version ${app.getVersion()}`, enabled: false },
        {
          label: "Check for Updates…",
          click: () => checkForUpdatesInteractive(mainWindow),
        },
        { type: "separator" },
        {
          label: "Deactivate License…",
          enabled: license.activated,
          click: async () => {
            const { response } = await dialog.showMessageBox(mainWindow, {
              type: "warning",
              buttons: ["Cancel", "Deactivate"],
              defaultId: 0,
              cancelId: 0,
              message: "Deactivate this device?",
              detail:
                "This frees a seat on your license. You'll need to re-enter your key to use Lost Media Emulator on this Mac again.",
            });
            if (response === 1) await deactivateLicense();
          },
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit", label: "Quit Lost Media Emulator" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "Open Media…",
          accelerator: "CmdOrCtrl+O",
          // Same flow as the in-app import button / Cmd+I: the renderer clicks
          // its hidden file input, so validation + proxy logic stay in one place.
          click: () => sendMenuEvent("menu:open-media"),
        },
        {
          label: "Open Recent",
          submenu: [
            ...recentFiles.map((p) => ({
              label: path.basename(p),
              click: () => openRecentFile(p),
            })),
            ...(recentFiles.length ? [{ type: "separator" }] : []),
            {
              label: "Clear Menu",
              enabled: recentFiles.length > 0,
              click: () => clearRecentFiles(),
            },
          ],
        },
        { type: "separator" },
        {
          label: "Export…",
          accelerator: "CmdOrCtrl+E",
          // Renderer opens the export dialog only when media is loaded (same
          // gate as the disabled Export button).
          click: () => sendMenuEvent("menu:export"),
        },
        { type: "separator" },
        { role: "close", label: "Close Window" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        // Reload/DevTools are development tools: Cmd+R silently wipes a customer's session
        // (undo history, unsaved look), so they only appear in unpackaged dev builds.
        ...(app.isPackaged ? [] : [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
        ]),
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Lost Media Emulator Help",
          click: () => shell.openExternal("https://lostmediaemulator.com"),
        },
        {
          label: "Looks Library",
          click: () => shell.openExternal("https://lostmediaemulator.com/looks"),
        },
        { type: "separator" },
        {
          label: "Keyboard Shortcuts",
          click: () => mainWindow?.webContents.executeJavaScript('window.dispatchEvent(new Event("shortcuts:open"))').catch(() => {}),
        },
        {
          label: "Show Tutorial",
          click: () => mainWindow?.webContents.executeJavaScript('window.dispatchEvent(new Event("tutorial:open"))').catch(() => {}),
        },
        { type: "separator" },
        {
          label: "Contact Support…",
          click: () => shell.openExternal("https://lostmediaemulator.com/docs"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (HEADLESS) {
  // Headless render: no window/menu/license/updater, and skip the single-instance lock so it
  // works even while the GUI app is open. ffmpeg IPC was registered above with revealOnEncode:false.
  const { runHeadlessRender } = require("./lme-render-core.cjs");
  runHeadlessRender({
    app,
    BrowserWindow,
    distPath: path.join(__dirname, "..", "dist", "index.html"),
    preloadPath: path.join(__dirname, "preload.cjs"),
    argv: process.argv,
  });
} else if (!app.requestSingleInstanceLock()) {
  // Single-instance lock so re-launching focuses the existing window.
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    nativeTheme.themeSource = "dark";
    loadRecentFiles();
    await evaluateLicense();
    buildMenu();
    createWindow();
    initAutoUpdate(app, (...a) => console.log(...a));

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
