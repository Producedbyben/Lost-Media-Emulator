// Safe bridge between the renderer and main. Exposes a feature-detectable
// `window.desktop` surface: build identity, the native ffmpeg export pipeline,
// and a path resolver for dropped/opened files (needed by the audio phase).
const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
  arch: process.arch,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  // Real on-disk path for a dropped/opened File (Electron 32+ removed File.path).
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch { return null; }
  },
  // Native Save panel returning the chosen absolute path (or null if cancelled).
  saveDialog: (opts) => ipcRenderer.invoke("ffmpeg:save-dialog", opts),
  // Whether a source file carries an audio track (honest "Original audio" state).
  probeAudio: (opts) => ipcRenderer.invoke("ffmpeg:probe-audio", opts),
  // License activation. The main process owns the token + device id and does the
  // server calls; the renderer can only ask for status, activate, or deactivate.
  license: {
    status: () => ipcRenderer.invoke("license:status"),
    activate: (key) => ipcRenderer.invoke("license:activate", { key }),
    deactivate: () => ipcRenderer.invoke("license:deactivate"),
  },
  ffmpeg: {
    available: () => ipcRenderer.invoke("ffmpeg:available"),
    begin: (opts) => ipcRenderer.invoke("ffmpeg:begin", opts),
    frame: (opts) => ipcRenderer.invoke("ffmpeg:frame", opts),
    encode: (opts) => ipcRenderer.invoke("ffmpeg:encode", opts),
    cancel: (opts) => ipcRenderer.invoke("ffmpeg:cancel", opts),
    onProgress: (cb) => {
      const handler = (_e, data) => cb(data);
      ipcRenderer.on("ffmpeg:progress", handler);
      return () => ipcRenderer.removeListener("ffmpeg:progress", handler);
    },
  },
});
