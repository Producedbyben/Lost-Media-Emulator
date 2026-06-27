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
import { computeExportSize } from "../../src/lib/export-size";

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
function makeSolidPngWH(w, h, [r, g, b]) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, colour type 2 (RGB)
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) { row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b; }
  const raw = Buffer.concat(Array.from({ length: h }, () => row));
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}
const makeSolidPng = (size, rgb) => makeSolidPngWH(size, size, rgb);

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

  it("encode is colour-faithful: a decoded frame matches the source within codec tolerance", async () => {
    const W = 64, H = 64, RGB = [200, 40, 40];
    const frame = makeSolidPngWH(W, H, RGB);
    const session = createSession({ width: W, height: H, fps: 10, tmpRoot: os.tmpdir() });
    for (let i = 0; i < 10; i++) session.writeFrame(i, frame);
    const out = path.join(os.tmpdir(), "lme-smoke-fidelity.mp4");
    await session.encode({ ffmpegPath: ffmpeg, codec: "h264", outPath: out });
    session.cleanup();

    // Decode the middle frame back to raw RGB and compare to the source colour.
    const raw = execFileSync(ffmpeg, [
      "-v", "error", "-i", out, "-vf", "select=eq(n\\,5)", "-frames:v", "1",
      "-f", "rawvideo", "-pix_fmt", "rgb24", "-",
    ], { maxBuffer: 1 << 24 });
    expect(raw.length).toBe(W * H * 3);
    let sum = 0;
    for (let i = 0; i < raw.length; i += 3) {
      sum += Math.abs(raw[i] - RGB[0]) + Math.abs(raw[i + 1] - RGB[1]) + Math.abs(raw[i + 2] - RGB[2]);
    }
    const meanDiff = sum / raw.length;
    // h264 4:2:0 introduces a few levels of chroma error; a faithful encode stays well under this.
    expect(meanDiff).toBeLessThan(10);
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

  // The resolution-bug regression guard: the dimensions computeExportSize()
  // resolves from the SOURCE + chosen resolution/aspect must survive verbatim
  // into the encoded file (they used to be silently replaced by the preview
  // canvas size). Drives the real frame-size math end-to-end through ffmpeg.
  const DIM_CASES = [
    { name: "Source keeps the source dims (1280x720)", in: { sourceW: 1280, sourceH: 720, resolution: 0, aspectRatio: "original" }, expect: { w: 1280, h: 720 } },
    { name: "1080p downscales a 4K source to 1920x1080", in: { sourceW: 3840, sourceH: 2160, resolution: 1080, aspectRatio: "original" }, expect: { w: 1920, h: 1080 } },
    { name: "9:16 crop of a 16:9 source at 1080p is 1080x1920", in: { sourceW: 1920, sourceH: 1080, resolution: 1080, aspectRatio: "9:16" }, expect: { w: 1080, h: 1920 } },
  ];
  for (const c of DIM_CASES) {
    it(`encodes at the computed export size — ${c.name}`, async () => {
      const { width, height } = computeExportSize(c.in);
      expect({ w: width, h: height }).toEqual(c.expect);
      const frame = makeSolidPngWH(width, height, [40, 120, 200]);
      const session = createSession({ width, height, fps: 10, tmpRoot: os.tmpdir() });
      for (let i = 0; i < 6; i++) session.writeFrame(i, frame);
      const out = path.join(os.tmpdir(), `lme-smoke-dims-${width}x${height}.mp4`);
      await session.encode({ ffmpegPath: ffmpeg, codec: "h264", outPath: out });
      session.cleanup();

      const probe = JSON.parse(execFileSync(ffprobe, [
        "-v", "quiet", "-print_format", "json", "-show_streams", out,
      ]).toString());
      const v = probe.streams.find((s) => s.codec_type === "video");
      expect(v.width).toBe(width);
      expect(v.height).toBe(height);
      fs.rmSync(out, { force: true });
    }, 30000);
  }
});
