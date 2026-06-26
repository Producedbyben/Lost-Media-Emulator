// End-to-end pipeline smoke: render a few frames, run the REAL bundled ffmpeg,
// and assert ffprobe sees a valid stream. Skips cleanly when ffmpeg/ffprobe are
// not installed, so it never false-fails on a machine without them.
import { describe, it, expect } from "vitest";
import { execFileSync } from "child_process";
import zlib from "zlib";
import fs from "fs";
import os from "os";
import path from "path";
import { createSession } from "../ffmpeg-session.cjs";
import { resolveFfmpeg } from "../ffmpeg-locate.cjs";

const { ffmpeg, ffprobe } = resolveFfmpeg({
  env: process.env, resourcesPath: "", isPackaged: false,
  exists: (p) => { try { return fs.existsSync(p); } catch { return false; } },
});

// Build a genuinely valid solid-colour PNG (8-bit RGB) at runtime. Hand-pasted
// base64 frames are easy to corrupt; generating the bytes guarantees ffmpeg can
// decode them. 64×64 stays safely above the VideoToolbox minimum encode size.
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}
function makeSolidPng(size, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, colour type 2 (RGB)
  const row = Buffer.alloc(1 + size * 3);
  for (let x = 0; x < size; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: size }, () => row));
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

const FRAME = makeSolidPng(64, [200, 40, 40]);

describe.skipIf(!ffmpeg || !ffprobe)("ffmpeg pipeline smoke", () => {
  for (const codec of ["h264", "hevc"]) {
    it(`encodes a ${codec} mp4 a real player can read`, async () => {
      const session = createSession({ width: 64, height: 64, fps: 10, tmpRoot: os.tmpdir() });
      for (let i = 0; i < 10; i++) session.writeFrame(i, FRAME);
      const out = path.join(os.tmpdir(), `lme-smoke-${codec}.mp4`);
      await session.encode({ ffmpegPath: ffmpeg, codec, outPath: out });
      session.cleanup();

      const probe = JSON.parse(execFileSync(ffprobe, [
        "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", out,
      ]).toString());
      const v = probe.streams.find((s) => s.codec_type === "video");
      expect(v).toBeTruthy();
      expect(v.codec_name).toBe(codec);
      expect(Number(probe.format.duration)).toBeGreaterThan(0.5);
      fs.rmSync(out, { force: true });
    }, 30000);
  }
});
