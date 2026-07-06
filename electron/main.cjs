// Lost Media Emulator — native macOS (Apple Silicon) shell.
// Runs the Vite/React effects studio inside a Metal-accelerated Chromium window.

const { app, BrowserWindow, Menu, shell, dialog, nativeTheme, ipcMain } = require("electron");
const path = require("path");
const applyGpuFlags = require("./gpu-flags.cjs");
const { locate } = require("./ffmpeg-locate.cjs");
const { registerFfmpegIpc } = require("./ffmpeg-ipc.cjs");
const { getDeviceId, getDeviceName } = require("./license/identity.cjs");
const licenseStore = require("./license/store.cjs");
const licenseApi = require("./license/api.cjs");
const { initAutoUpdate } = require("./updater.cjs");

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 940,
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
