// Decide which ffmpeg/ffprobe binary to use. Pure core (resolveFfmpeg) so it is
// unit-testable; locate() wires the real process/runtime values.
const DEV_FALLBACKS = {
  ffmpeg: ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"],
  ffprobe: ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", "/usr/bin/ffprobe"],
};

function pick(candidates, exists) {
  for (const c of candidates) if (c && exists(c)) return c;
  return null;
}

function resolveFfmpeg({ env, resourcesPath, isPackaged, exists }) {
  const ffmpegCandidates = [
    env.LME_FFMPEG_PATH,
    ...(isPackaged ? [`${resourcesPath}/ffmpeg`] : DEV_FALLBACKS.ffmpeg),
  ];
  const ffprobeCandidates = [
    env.LME_FFPROBE_PATH,
    ...(isPackaged ? [`${resourcesPath}/ffprobe`] : DEV_FALLBACKS.ffprobe),
  ];
  return {
    ffmpeg: pick(ffmpegCandidates, exists),
    ffprobe: pick(ffprobeCandidates, exists),
  };
}

function locate() {
  const fs = require("fs");
  const { app } = require("electron");
  return resolveFfmpeg({
    env: process.env,
    resourcesPath: process.resourcesPath || "",
    isPackaged: app.isPackaged,
    exists: (p) => { try { return fs.existsSync(p); } catch { return false; } },
  });
}

module.exports = { resolveFfmpeg, locate };
