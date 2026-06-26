// electron/ffmpeg-session.cjs
// One export session: a temp PNG sequence + an ffmpeg child process.
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const { buildVideoArgs } = require("./ffmpeg-args.cjs");

function createSession({ width, height, fps, tmpRoot }) {
  const id = `lme-export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const dir = path.join(tmpRoot || os.tmpdir(), id);
  fs.mkdirSync(dir, { recursive: true });
  let child = null;
  let frameCount = 0;

  const framePattern = path.join(dir, "frame_%06d.png");
  const framePath = (index) => path.join(dir, `frame_${String(index + 1).padStart(6, "0")}.png`);

  return {
    id, dir, width, height, fps,
    get frameCount() { return frameCount; },

    writeFrame(index, buffer) {
      fs.writeFileSync(framePath(index), Buffer.from(buffer));
      frameCount = Math.max(frameCount, index + 1);
    },

    encode({ ffmpegPath, codec, outPath, onProgress, audioSourcePath }) {
      const args = buildVideoArgs({ codec, fps, framePattern, outPath, totalFrames: frameCount, audioSourcePath });
      return new Promise((resolve, reject) => {
        child = spawn(ffmpegPath, args);
        let stderrTail = "";
        child.stdout.on("data", (d) => {
          // -progress pipe:1 emits "frame=N" lines.
          const m = String(d).match(/frame=\s*(\d+)/g);
          if (m && onProgress) {
            const last = m[m.length - 1];
            onProgress({ frame: Number(last.replace(/\D/g, "")), totalFrames: frameCount });
          }
        });
        child.stderr.on("data", (d) => { stderrTail = (stderrTail + d).slice(-2000); });
        child.on("error", (err) => reject(err));
        child.on("close", (code) => {
          child = null;
          if (code === 0) resolve({ outPath });
          else reject(new Error(`ffmpeg exited ${code}\n${stderrTail}`));
        });
      });
    },

    cancel() { if (child) { child.kill("SIGKILL"); child = null; } },

    cleanup() {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
    },
  };
}

module.exports = { createSession };
