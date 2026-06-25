// Minimal, safe bridge. The web app runs unchanged; this just exposes a tiny
// read-only surface a renderer can feature-detect to know it's the desktop build.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  platform: process.platform,
  arch: process.arch,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
