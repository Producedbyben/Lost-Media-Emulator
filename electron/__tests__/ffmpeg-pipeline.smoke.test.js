// End-to-end pipeline smoke: render a few frames, run the REAL bundled ffmpeg,
// and assert ffprobe sees a valid stream. Skips cleanly when ffmpeg/ffprobe are
// not installed, so it never false-fails on a machine without them.
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { createSession } from "../ffmpeg-session.cjs";
import { resolveFfmpeg } from "../ffmpeg-locate.cjs";

const { ffmpeg, ffprobe } = resolveFfmpeg({
  env: process.env, resourcesPath: "", isPackaged: false,
  exists: (p) => { try { return fs.existsSync(p); } catch { return false; } },
});

// 4x4 red PNG, base64 — a deterministic test frame.
const RED_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAEUlEQVR42mP8z8BQz0AEYBxVSF8AGfwC/Yj7H2gAAAAASUVORK5CYII=",
  "base64"
);

describe.skipIf(!ffmpeg || !ffprobe)("ffmpeg pipeline smoke", () => {
  for (const codec of ["h264", "hevc"]) {
    it(`encodes a ${codec} mp4 a real player can read`, async () => {
      const session = createSession({ width: 4, height: 4, fps: 10, tmpRoot: os.tmpdir() });
      for (let i = 0; i < 10; i++) session.writeFrame(i, RED_PNG.buffer.slice(0));
      const out = path.join(os.tmpdir(), `lme-smoke-${codec}.mp4`);
      await session.encode({ ffmpegPath: ffmpeg, codec, outPath: out });
      session.cleanup();

      const probe = JSON.parse(execFileSync(ffprobe, [
        "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", out,
      ]).toString());
      const v = probe.streams.find((s) => s.codec_type === "video");
      expect(v).toBeTruthy();
      expect(["h264", "hevc"]).toContain(v.codec_name);
      expect(Number(probe.format.duration)).toBeGreaterThan(0.5);
      fs.rmSync(out, { force: true });
    }, 30000);
  }
});
