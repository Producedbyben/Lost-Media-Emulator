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

  it("encodes a ProRes 422 HQ .mov a real NLE can read", async () => {
    const session = createSession({ width: 64, height: 64, fps: 10, tmpRoot: os.tmpdir() });
    for (let i = 0; i < 10; i++) session.writeFrame(i, FRAME);
    const out = path.join(os.tmpdir(), "lme-smoke-prores.mov");
    await session.encode({ ffmpegPath: ffmpeg, codec: "prores422", outPath: out });
    session.cleanup();

    const probe = JSON.parse(execFileSync(ffprobe, [
      "-v", "quiet", "-print_format", "json", "-show_streams", out,
    ]).toString());
    const v = probe.streams.find((s) => s.codec_type === "video");
    expect(v.codec_name).toBe("prores");
    expect(v.profile).toMatch(/HQ/);
    fs.rmSync(out, { force: true });
  }, 30000);

  it("muxes the source's original audio track into the encoded mp4", () => {
    // A 1s source clip that actually carries an audio track (sine tone).
    const src = path.join(os.tmpdir(), "lme-smoke-src.mp4");
    execFileSync(ffmpeg, [
      "-y",
      "-f", "lavfi", "-i", "color=c=blue:s=64x64:d=1",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
      "-c:v", "h264_videotoolbox", "-c:a", "aac", "-shortest", src,
    ]);

    const session = createSession({ width: 64, height: 64, fps: 10, tmpRoot: os.tmpdir() });
    for (let i = 0; i < 10; i++) session.writeFrame(i, FRAME);
    const out = path.join(os.tmpdir(), "lme-smoke-audio.mp4");
    return session.encode({ ffmpegPath: ffmpeg, codec: "h264", outPath: out, audioSourcePath: src })
      .then(() => {
        session.cleanup();
        const probe = JSON.parse(execFileSync(ffprobe, [
          "-v", "quiet", "-print_format", "json", "-show_streams", out,
        ]).toString());
        const a = probe.streams.find((s) => s.codec_type === "audio");
        expect(a).toBeTruthy();
        expect(a.codec_name).toBe("aac");
        fs.rmSync(out, { force: true });
        fs.rmSync(src, { force: true });
      });
  }, 30000);

  it("trims to an in/out window: encoded duration ≈ out − in", () => {
    // 4s source with audio; we export only the [1s, 3s) window (2s).
    const src = path.join(os.tmpdir(), "lme-smoke-trim-src.mp4");
    execFileSync(ffmpeg, [
      "-y",
      "-f", "lavfi", "-i", "color=c=green:s=64x64:d=4",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=4",
      "-c:v", "h264_videotoolbox", "-c:a", "aac", "-shortest", src,
    ]);

    const fps = 10, inSec = 1, outSec = 3, windowFrames = fps * (outSec - inSec); // 20
    const session = createSession({ width: 64, height: 64, fps, tmpRoot: os.tmpdir() });
    for (let i = 0; i < windowFrames; i++) session.writeFrame(i, FRAME);
    const out = path.join(os.tmpdir(), "lme-smoke-trim.mp4");
    return session.encode({ ffmpegPath: ffmpeg, codec: "h264", outPath: out, audioSourcePath: src, inSec, outSec })
      .then(() => {
        session.cleanup();
        const probe = JSON.parse(execFileSync(ffprobe, [
          "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", out,
        ]).toString());
        // The encoded clip should be ~2s (out − in), not the source's 4s.
        expect(Number(probe.format.duration)).toBeGreaterThan(1.6);
        expect(Number(probe.format.duration)).toBeLessThan(2.4);
        // Audio came along and was trimmed to the window too.
        const a = probe.streams.find((s) => s.codec_type === "audio");
        expect(a).toBeTruthy();
        expect(Number(a.duration)).toBeLessThan(2.4);
        fs.rmSync(out, { force: true });
        fs.rmSync(src, { force: true });
      });
  }, 30000);
});
