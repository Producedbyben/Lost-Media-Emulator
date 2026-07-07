// Shared ffmpeg session IPC, registered by both the main app (electron/main.cjs) and the
// headless render CLI (electron/lme-render.cjs) so the headless video path uses the EXACT same
// session + encode pipeline as a normal export. The GUI-only handlers (save-dialog, probe-audio)
// stay in main.cjs.
//
// options.revealOnEncode — reveal the finished file in Finder after encode. The interactive app
// does; the batch CLI does not.
const path = require("path");
const { app, shell } = require("electron");
const { locate } = require("./ffmpeg-locate.cjs");
const { createSession } = require("./ffmpeg-session.cjs");

function registerFfmpegIpc(ipcMain, { revealOnEncode = true } = {}) {
  const ffmpegSessions = new Map();

  ipcMain.handle("ffmpeg:available", () => !!locate().ffmpeg);

  ipcMain.handle("ffmpeg:begin", (_e, { width, height, fps, estimateBytes }) => {
    // Disk preflight (audit): exports write a multi-GB temp PNG sequence; fail EARLY with a
    // clear message instead of dying at 97% on a cryptic write error. 15% headroom; skipped
    // when statfs is unavailable or no estimate was provided.
    if (Number(estimateBytes) > 0) {
      try {
        const fs = require("fs");
        const st = fs.statfsSync(app.getPath("temp"));
        const free = Number(st.bavail) * Number(st.bsize);
        const need = Number(estimateBytes) * 1.15;
        if (free > 0 && free < need) {
          const gb = (n) => (n / 1e9).toFixed(1);
          throw new Error(`Not enough disk space for this export: needs ~${gb(need)} GB free for temporary frames, ${gb(free)} GB available. Free up space or shorten/trim the export.`);
        }
      } catch (err) {
        if (err && /Not enough disk space/.test(String(err.message))) throw err;
        /* statfs unavailable — skip the preflight */
      }
    }
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

  ipcMain.handle("ffmpeg:encode", async (e, { sessionId, codec, outPath, audioSourcePath, inSec, outSec }) => {
    const session = ffmpegSessions.get(sessionId);
    if (!session) throw new Error("unknown ffmpeg session");
    const { ffmpeg } = locate();
    if (!ffmpeg) throw new Error("ffmpeg binary not found");
    try {
      await session.encode({
        ffmpegPath: ffmpeg, codec, outPath, audioSourcePath, inSec, outSec,
        onProgress: (p) => e.sender.send("ffmpeg:progress", { sessionId, ...p }),
      });
      if (revealOnEncode) shell.showItemInFolder(outPath);
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

  ipcMain.handle("ffmpeg:write-temp-audio", (_e, { bytes }) => {
    const fs = require("fs");
    const file = path.join(app.getPath("temp"), `lme-degraded-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    fs.writeFileSync(file, Buffer.from(bytes));
    return { path: file };
  });
}

module.exports = { registerFfmpegIpc };
