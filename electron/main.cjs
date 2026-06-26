// Lost Media Emulator — native macOS (Apple Silicon) shell.
// Runs the Vite/React effects studio inside a Metal-accelerated Chromium window.

const { app, BrowserWindow, Menu, shell, dialog, nativeTheme, ipcMain } = require("electron");
const path = require("path");
const applyGpuFlags = require("./gpu-flags.cjs");
const { locate } = require("./ffmpeg-locate.cjs");
const { createSession } = require("./ffmpeg-session.cjs");

const isDev = !app.isPackaged;

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

  // Avoid a white flash before the dark UI paints.
  mainWindow.once("ready-to-show", () => mainWindow.show());

  // BT_LOAD_DIST forces loading the production bundle even when unpackaged
  // (used for verification without spinning up the Vite dev server).
  const loadDist = !isDev || process.env.BT_LOAD_DIST === "1";
  if (loadDist) {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    mainWindow.loadURL("http://localhost:8080");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

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

// --- Native ffmpeg export pipeline -----------------------------------------
const ffmpegSessions = new Map();

ipcMain.handle("ffmpeg:available", () => !!locate().ffmpeg);

ipcMain.handle("ffmpeg:begin", (_e, { width, height, fps }) => {
  const session = createSession({ width, height, fps, tmpRoot: app.getPath("temp") });
  ffmpegSessions.set(session.id, session);
  return { sessionId: session.id };
});

ipcMain.handle("ffmpeg:frame", (_e, { sessionId, index, bytes }) => {
  const session = ffmpegSessions.get(sessionId);
  if (!session) throw new Error("unknown ffmpeg session");
  session.writeFrame(index, bytes);
  return { ok: true };
});

ipcMain.handle("ffmpeg:encode", async (e, { sessionId, codec, outPath }) => {
  const session = ffmpegSessions.get(sessionId);
  if (!session) throw new Error("unknown ffmpeg session");
  const { ffmpeg } = locate();
  if (!ffmpeg) throw new Error("ffmpeg binary not found");
  try {
    await session.encode({
      ffmpegPath: ffmpeg, codec, outPath,
      onProgress: (p) => e.sender.send("ffmpeg:progress", { sessionId, ...p }),
    });
    shell.showItemInFolder(outPath);
    return { ok: true, outPath };
  } finally {
    session.cleanup();
    ffmpegSessions.delete(sessionId);
  }
});

ipcMain.handle("ffmpeg:cancel", (_e, { sessionId }) => {
  const session = ffmpegSessions.get(sessionId);
  if (session) { session.cancel(); session.cleanup(); ffmpegSessions.delete(sessionId); }
});

function buildMenu() {
  const template = [
    {
      label: "Lost Media Emulator",
      submenu: [
        { role: "about", label: "About Lost Media Emulator" },
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
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
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
          label: "Lost Media Emulator — Project",
          click: () => shell.openExternal("https://lovable.dev"),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Single-instance lock so re-launching focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    nativeTheme.themeSource = "dark";
    buildMenu();
    createWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
