// Offline icon generator (no native deps): renders a CRT/retro-signal icon to PNG.
// Supersamples 2x and box-downsamples for clean edges. Output: build/icon_1024.png
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const OUT = 1024;
const SS = 2; // supersample factor
const W = OUT * SS;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Continuous rounded-rect (squircle-ish) signed coverage at pixel (x,y).
function roundedRectCoverage(x, y, x0, y0, x1, y1, r) {
  // distance outside the rounded rect (negative inside)
  const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
  const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
  const cornerDist = Math.sqrt(dx * dx + dy * dy);
  // inside straight edges:
  if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
    if ((x < x0 + r || x > x1 - r) && (y < y0 + r || y > y1 - r)) {
      return r - cornerDist; // corner region
    }
    return 1; // solidly inside
  }
  return r - cornerDist; // outside; >0 means within corner radius
}

const buf = new Float32Array(W * W * 4); // RGBA premultiplied accumulation

function setPx(i, r, g, b, a) {
  // simple over-composite onto existing
  const o = i * 4;
  const ia = 1 - a;
  buf[o] = r * a + buf[o] * ia;
  buf[o + 1] = g * a + buf[o + 1] * ia;
  buf[o + 2] = b * a + buf[o + 2] * ia;
  buf[o + 3] = a + buf[o + 3] * ia;
}

const R = W * 0.225; // outer corner radius
const pad = W * 0.17;
const sx0 = pad,
  sy0 = pad + W * 0.02,
  sx1 = W - pad,
  sy1 = W - pad - W * 0.02;
const sR = W * 0.06;
const midY = (sy0 + sy1) / 2;
const amp = W * 0.085;

// three signal waves (R, G, B) with phase + vertical offset
const waves = [
  { col: [255, 60, 80], ph: 0.0, off: -W * 0.012 },
  { col: [70, 255, 140], ph: 0.6, off: 0 },
  { col: [80, 130, 255], ph: 1.2, off: W * 0.012 },
];
const waveHalf = W * 0.013; // half thickness

for (let y = 0; y < W; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    // outer mask
    const outCov = Math.max(0, Math.min(1, roundedRectCoverage(x + 0.5, y + 0.5, 0, 0, W - 1, W - 1, R)));
    if (outCov <= 0) continue;

    // background gradient indigo -> near black
    const t = y / W;
    let r = lerp(30, 8, t),
      g = lerp(26, 8, t),
      b = lerp(58, 12, t);
    // place into buffer (start opaque within mask)
    const o = i * 4;
    buf[o] = r;
    buf[o + 1] = g;
    buf[o + 2] = b;
    buf[o + 3] = 1;

    // screen panel
    const scrCov = Math.max(0, Math.min(1, roundedRectCoverage(x + 0.5, y + 0.5, sx0, sy0, sx1, sy1, sR)));
    if (scrCov > 0) {
      setPx(i, 12, 14, 22, scrCov);
      // soft glow ring just inside the screen edge
      // scanlines
      if (scrCov > 0.95) {
        const band = Math.floor((y - sy0) / (W * 0.012));
        if (band % 2 === 0) setPx(i, 120, 150, 210, 0.05);
      }
      // RGB waves (only inside screen)
      if (scrCov > 0.9 && x > sx0 + W * 0.06 && x < sx1 - W * 0.06) {
        const tt = (x - (sx0 + W * 0.06)) / (sx1 - sx0 - W * 0.12);
        for (const wv of waves) {
          const wy = midY + wv.off + Math.sin(tt * Math.PI * 2.2 + wv.ph) * amp;
          const dd = Math.abs(y - wy);
          if (dd < waveHalf + 2) {
            const a = Math.max(0, Math.min(1, (waveHalf - dd) / 3 + 0.4)) * 0.85;
            setPx(i, wv.col[0], wv.col[1], wv.col[2], a);
          }
        }
      }
    }

    // top sheen highlight
    if (t < 0.5) {
      setPx(i, 255, 255, 255, (0.5 - t) * 0.06);
    }

    // apply outer mask as final alpha
    buf[o + 3] *= outCov;
  }
}

// Downsample SS -> OUT with box filter, encode straight RGBA8
const out = Buffer.alloc(OUT * OUT * 4);
for (let y = 0; y < OUT; y++) {
  for (let x = 0; x < OUT; x++) {
    let r = 0,
      g = 0,
      b = 0,
      a = 0;
    for (let dy = 0; dy < SS; dy++) {
      for (let dx = 0; dx < SS; dx++) {
        const si = ((y * SS + dy) * W + (x * SS + dx)) * 4;
        r += buf[si];
        g += buf[si + 1];
        b += buf[si + 2];
        a += buf[si + 3];
      }
    }
    const n = SS * SS;
    const o = (y * OUT + x) * 4;
    out[o] = Math.round(r / n);
    out[o + 1] = Math.round(g / n);
    out[o + 2] = Math.round(b / n);
    out[o + 3] = Math.round((a / n) * 255);
  }
}

// --- Minimal PNG encoder (truecolor + alpha) ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
// add filter byte (0) per scanline
const raw = Buffer.alloc(OUT * (OUT * 4 + 1));
for (let y = 0; y < OUT; y++) {
  raw[y * (OUT * 4 + 1)] = 0;
  out.copy(raw, y * (OUT * 4 + 1) + 1, y * OUT * 4, (y + 1) * OUT * 4);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(OUT, 0);
ihdr.writeUInt32BE(OUT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
const dest = path.join(__dirname, "icon_1024.png");
fs.writeFileSync(dest, png);
console.log("wrote", dest, png.length, "bytes");
