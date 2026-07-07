// Full CRT Renderer extracted from app.js — includes all mask types, OSD, film effects, etc.

import { corruptionSpawnFactor, dctEdgeFactor } from "./effects-core/codec-corruption.js";

// 4x4 Bayer matrix (ordered dither) + the canonical DMG 4-shade green-olive ramp (1.1.6 looks).
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
const DMG_RAMP = [[15, 56, 15], [48, 98, 48], [139, 172, 15], [155, 188, 15]];

function seededNoise(x, y, frame) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - Math.floor(v);
}

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export class CRTRendererFull {
  constructor() {
    this.sourceCanvas = document.createElement("canvas");
    this.fitCanvas = document.createElement("canvas");
    this.workCanvas = document.createElement("canvas");
    this.tempCanvas = document.createElement("canvas");
    this.quantCanvas = document.createElement("canvas");
    this.subpixelTile = document.createElement("canvas");
    this._subpixelTileKey = "";
    // Datamosh / digital-decay inter-frame buffers.
    this.moshCanvas = document.createElement("canvas"); // P-frame feedback accumulator
    this.moshSnapCanvas = document.createElement("canvas"); // per-frame snapshot for block ops
    this._moshLastFrame = -999;
    this._moshLastW = 0;
    this._moshLastH = 0;
    this.sourceCtx = this.sourceCanvas.getContext("2d");
    this.fitCtx = this.fitCanvas.getContext("2d", { willReadFrequently: true });
    this.workCtx = this.workCanvas.getContext("2d", { willReadFrequently: true });
    this.tempCtx = this.tempCanvas.getContext("2d");
    this.quantCtx = this.quantCanvas.getContext("2d", { willReadFrequently: true });
    this.moshCtx = this.moshCanvas.getContext("2d");
    this.moshSnapCtx = this.moshSnapCanvas.getContext("2d", { willReadFrequently: true });
    this.cachedOutImageData = null;
    this.cachedOutImageWidth = 0;
    this.cachedOutImageHeight = 0;
    this.hasImage = false;
    // Procedural bitmap-font presets (HYBRID font plan, analog/low-res eras).
    // These render via getOSDPixelGlyph + drawPixelOSDText (5x7 cell grid) and are
    // the MOST period-accurate option for sub-720p burn-ins — they also dodge the
    // proprietary VCR-OSD/OCR-A/MS-Gothic licensing entirely. `stroke` ~ pen weight,
    // `spacing` ~ inter-glyph gap.
    this.osdPixelFontPresets = {
      // VHS VCR clock: chunky, heavy block caps with tight spacing.
      vhs: { stroke: 1.25, spacing: 1, heightCells: 7, widthCells: 5 },
      // Consumer camcorder (Sony/JVC): thinner pen, slightly looser tracking.
      camcorder: { stroke: 0.95, spacing: 1.4, heightCells: 7, widthCells: 5 },
      // Security/CCTV: even, OCR-ish monospace; medium weight, wide tracking.
      cctv: { stroke: 1.0, spacing: 1.8, heightCells: 7, widthCells: 5 },
      hdzeroDefault: { stroke: 1, spacing: 1, heightCells: 7, widthCells: 5 },
      hdzeroConthrax: { stroke: 1.15, spacing: 1, heightCells: 7, widthCells: 5 },
      hdzeroVision: { stroke: 1, spacing: 2, heightCells: 7, widthCells: 5 },
    };
  }

  getOSDPixelGlyph(char = " ") {
    const glyphs = {
      " ": ["00000","00000","00000","00000","00000","00000","00000"],
      "0": ["01110","10001","10001","10001","10001","10001","01110"],
      "1": ["00100","01100","00100","00100","00100","00100","01110"],
      "2": ["01110","10001","00001","00010","00100","01000","11111"],
      "3": ["11110","00001","00001","01110","00001","00001","11110"],
      "4": ["00010","00110","01010","10010","11111","00010","00010"],
      "5": ["11111","10000","11110","00001","00001","10001","01110"],
      "6": ["00111","01000","10000","11110","10001","10001","01110"],
      "7": ["11111","00001","00010","00100","01000","01000","01000"],
      "8": ["01110","10001","10001","01110","10001","10001","01110"],
      "9": ["01110","10001","10001","01111","00001","00010","11100"],
      "A": ["01110","10001","10001","11111","10001","10001","10001"],
      "B": ["11110","10001","10001","11110","10001","10001","11110"],
      "C": ["01111","10000","10000","10000","10000","10000","01111"],
      "D": ["11110","10001","10001","10001","10001","10001","11110"],
      "E": ["11111","10000","10000","11110","10000","10000","11111"],
      "F": ["11111","10000","10000","11110","10000","10000","10000"],
      "G": ["01111","10000","10000","10111","10001","10001","01110"],
      "H": ["10001","10001","10001","11111","10001","10001","10001"],
      "I": ["01110","00100","00100","00100","00100","00100","01110"],
      "J": ["00001","00001","00001","00001","10001","10001","01110"],
      "K": ["10001","10010","10100","11000","10100","10010","10001"],
      "L": ["10000","10000","10000","10000","10000","10000","11111"],
      "M": ["10001","11011","10101","10101","10001","10001","10001"],
      "N": ["10001","11001","10101","10011","10001","10001","10001"],
      "O": ["01110","10001","10001","10001","10001","10001","01110"],
      "P": ["11110","10001","10001","11110","10000","10000","10000"],
      "Q": ["01110","10001","10001","10001","10101","10010","01101"],
      "R": ["11110","10001","10001","11110","10100","10010","10001"],
      "S": ["01111","10000","10000","01110","00001","00001","11110"],
      "T": ["11111","00100","00100","00100","00100","00100","00100"],
      "U": ["10001","10001","10001","10001","10001","10001","01110"],
      "V": ["10001","10001","10001","10001","10001","01010","00100"],
      "W": ["10001","10001","10001","10101","10101","10101","01010"],
      "X": ["10001","10001","01010","00100","01010","10001","10001"],
      "Y": ["10001","10001","01010","00100","00100","00100","00100"],
      "Z": ["11111","00001","00010","00100","01000","10000","11111"],
      "/": ["00001","00010","00100","01000","10000","00000","00000"],
      ":": ["00000","00100","00100","00000","00100","00100","00000"],
      "-": ["00000","00000","00000","01110","00000","00000","00000"],
      ".": ["00000","00000","00000","00000","00000","00100","00100"],
      "%": ["11001","11010","00100","01000","10110","00110","00000"],
      "●": ["00000","01110","11111","11111","11111","01110","00000"],
    };
    return glyphs[String(char || " ").toUpperCase()] || glyphs["?"] || glyphs[" "];
  }

  // Width of a procedural bitmap string, matching drawPixelOSDText's advance so
  // right/centre-aligned OSD lines land correctly for every pixel-font preset.
  getPixelOSDWidth(text, size, preset) {
    const presetCfg = this.osdPixelFontPresets[preset];
    if (!presetCfg) return 0;
    const chars = String(text);
    if (!chars.length) return 0;
    const cellH = Math.max(1, size / presetCfg.heightCells);
    const cellW = Math.max(1, cellH * 0.9);
    const charW = presetCfg.widthCells * cellW;
    const charStep = charW + Math.max(1, presetCfg.spacing * cellW * 0.45);
    // n glyphs advance by charStep each; the last glyph still occupies charW.
    return (chars.length - 1) * charStep + charW;
  }

  drawPixelOSDText(ctx, text, x, y, size, color, preset, thicknessScale = 1) {
    const presetCfg = this.osdPixelFontPresets[preset];
    if (!presetCfg) return false;
    const cellH = Math.max(1, size / presetCfg.heightCells);
    const cellW = Math.max(1, cellH * 0.9);
    const stroke = Math.max(1, cellH * presetCfg.stroke * Math.max(0.4, thicknessScale));
    const charW = presetCfg.widthCells * cellW;
    const charStep = charW + Math.max(1, presetCfg.spacing * cellW * 0.45);
    let dx = Math.round(x);
    const top = Math.round(y - size);
    ctx.fillStyle = color;
    for (const raw of String(text)) {
      const glyph = this.getOSDPixelGlyph(raw);
      for (let gy = 0; gy < glyph.length; gy++) {
        const row = glyph[gy];
        for (let gx = 0; gx < row.length; gx++) {
          if (row[gx] !== "1") continue;
          ctx.fillRect(Math.round(dx + gx * cellW), Math.round(top + gy * cellH), Math.max(1, Math.round(stroke)), Math.max(1, Math.round(stroke)));
        }
      }
      dx += charStep;
    }
    return true;
  }

  getSevenSegmentOSDWidth(text, size, { gapScale = 0.16 } = {}) {
    const chars = String(text || "");
    if (!chars.length) return 0;
    const digitW = Math.max(6, Math.floor(size * 0.66));
    const gap = Math.max(3, Math.floor(size * gapScale));
    return chars.length * (digitW + gap) - gap;
  }

  drawSevenSegmentOSDText(ctx, text, x, y, size, color, { align = "left", glowColor = color, glowStrength = 1, weight = 0.12, gapScale = 0.16 } = {}) {
    const chars = String(text || "").toUpperCase();
    const digitW = Math.max(6, Math.floor(size * 0.66));
    const digitH = Math.max(10, Math.floor(size));
    const thickness = Math.max(1, Math.floor(size * weight));
    const gap = Math.max(3, Math.floor(size * gapScale));
    const segmentLen = Math.max(2, digitW - thickness * 2);
    const charStep = digitW + gap;
    const textWidth = this.getSevenSegmentOSDWidth(chars, size, { gapScale });
    const segmentDefs = {
      A: [thickness, 0, segmentLen, thickness],
      B: [digitW - thickness, thickness, thickness, Math.floor(digitH * 0.5) - thickness],
      C: [digitW - thickness, Math.floor(digitH * 0.5), thickness, Math.floor(digitH * 0.5) - thickness],
      D: [thickness, digitH - thickness, segmentLen, thickness],
      E: [0, Math.floor(digitH * 0.5), thickness, Math.floor(digitH * 0.5) - thickness],
      F: [0, thickness, thickness, Math.floor(digitH * 0.5) - thickness],
      G: [thickness, Math.floor(digitH * 0.5) - Math.floor(thickness * 0.5), segmentLen, thickness],
    };
    const charSegments = {
      "0": ["A","B","C","D","E","F"], "1": ["B","C"], "2": ["A","B","G","E","D"],
      "3": ["A","B","G","C","D"], "4": ["F","G","B","C"], "5": ["A","F","G","C","D"],
      "6": ["A","F","G","C","D","E"], "7": ["A","B","C"], "8": ["A","B","C","D","E","F","G"],
      "9": ["A","B","C","D","F","G"], "-": ["G"], " ": [],
    };
    const baseX = align === "center" ? Math.round(x - textWidth * 0.5) : align === "right" ? Math.round(x - textWidth) : Math.round(x);
    const top = Math.round(y - digitH);
    const drawPass = (fill, alpha = 1, blur = 0) => {
      ctx.save(); ctx.fillStyle = fill; ctx.globalAlpha = alpha; ctx.shadowColor = glowColor; ctx.shadowBlur = blur;
      chars.split("").forEach((char, i) => {
        const cx = baseX + i * charStep;
        (charSegments[char] || []).forEach((segKey) => {
          const [sx, sy, sw, sh] = segmentDefs[segKey];
          ctx.fillRect(cx + sx, top + sy, sw, sh);
        });
        if (char === ":") {
          const dot = Math.max(2, Math.floor(thickness * 0.9));
          ctx.fillRect(cx + Math.floor(digitW * 0.42), top + Math.floor(digitH * 0.3), dot, dot);
          ctx.fillRect(cx + Math.floor(digitW * 0.42), top + Math.floor(digitH * 0.66), dot, dot);
        } else if (char === ".") {
          const dot = Math.max(2, Math.floor(thickness * 0.9));
          ctx.fillRect(cx + Math.floor(digitW * 0.42), top + digitH - dot, dot, dot);
        }
      });
      ctx.restore();
    };
    drawPass(glowColor, Math.min(1, 0.42 * glowStrength), size * (0.38 + 0.2 * glowStrength));
    drawPass(glowColor, Math.min(1, 0.3 * glowStrength), size * (0.18 + 0.08 * glowStrength));
    drawPass(color, 1, 0);
    return textWidth;
  }

  ensureCanvasSize(canvas, width, height) {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  setImage(img, sourceScale = 1) {
    const inputWidth = img.naturalWidth || img.videoWidth || img.width;
    const inputHeight = img.naturalHeight || img.videoHeight || img.height;
    const scale = Math.max(0.1, Math.min(1, sourceScale || 1));
    this.ensureCanvasSize(this.sourceCanvas, Math.max(1, Math.round(inputWidth * scale)), Math.max(1, Math.round(inputHeight * scale)));
    this.sourceCtx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    this.sourceCtx.imageSmoothingEnabled = true;
    this.sourceCtx.imageSmoothingQuality = "high";
    this.sourceCtx.drawImage(img, 0, 0, inputWidth, inputHeight, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    this.hasImage = true;
  }

  // Clear any cached per-frame buffers so no stale state bleeds between sources.
  reset() {
    this.cachedOutImageData = null;
    this.cachedOutImageWidth = 0;
    this.cachedOutImageHeight = 0;
    // Clear datamosh / digital-decay inter-frame feedback so each render starts
    // from a clean, deterministic state. Without this, the P-frame accumulator
    // and last-frame index carry over between renders, making the glitch presets
    // (datamosh, bit-rot, satellite/macroblock corruption) non-reproducible and
    // dependent on whatever the preview rendered first — breaking export parity.
    this._moshLastFrame = -999;
    this._moshLastW = 0;
    this._moshLastH = 0;
    if (this.moshCtx && this.moshCanvas) {
      this.moshCtx.clearRect(0, 0, this.moshCanvas.width, this.moshCanvas.height);
    }
  }

  /**
   * Format authenticity pre-pass — runs on the fitted source BEFORE the main
   * effect loop. Two physically-grounded stages:
   *   1. Resolution reduction: downsample to the medium's native luma/chroma
   *      resolution then scale back up (the biggest "looks real" factor).
   *   2. Composite colour: gated NTSC/PAL chroma bandwidth limiting + dot crawl.
   * Both stages are no-ops for clean digital/film profiles.
   */
  applyFormatPrePass(fitCtx, width, height, fp, frameIndex) {
    if (!fp) return;
    const resScaleX = Number.isFinite(fp.resScaleX) ? fp.resScaleX : 1;
    const resScaleY = Number.isFinite(fp.resScaleY) ? fp.resScaleY : 1;
    const composite = Number.isFinite(fp.composite) ? fp.composite : 0;
    const isAnalog = fp.system === "NTSC" || fp.system === "PAL";

    // ---- Stage 1: luma resolution reduction (canvas-native, fast) ----
    if (resScaleX < 0.995 || resScaleY < 0.995) {
      if (!this._fmtCanvas) {
        this._fmtCanvas = document.createElement("canvas");
        this._fmtCtx = this._fmtCanvas.getContext("2d");
      }
      const lowW = Math.max(2, Math.round(width * Math.max(0.05, resScaleX)));
      const lowH = Math.max(2, Math.round(height * Math.max(0.05, resScaleY)));
      const fc = this._fmtCanvas;
      if (fc.width !== lowW || fc.height !== lowH) { fc.width = lowW; fc.height = lowH; }
      const fctx = this._fmtCtx;
      fctx.imageSmoothingEnabled = true;
      fctx.imageSmoothingQuality = "high";
      fctx.clearRect(0, 0, lowW, lowH);
      fctx.drawImage(fitCtx.canvas, 0, 0, width, height, 0, 0, lowW, lowH);
      fitCtx.imageSmoothingEnabled = true;
      fitCtx.imageSmoothingQuality = "high";
      fitCtx.drawImage(fc, 0, 0, lowW, lowH, 0, 0, width, height);
    }

    // ---- Stage 2: composite colour encode/decode (analog only) ----
    if (isAnalog && composite > 0.001) {
      this.applyComposite(fitCtx, width, height, fp, frameIndex, composite);
    }
  }

  /**
   * Approximate composite (NTSC/PAL) colour artifacts: convert to YIQ, limit the
   * chroma horizontal bandwidth (box blur sized by chromaScaleX), then add a
   * phase-alternating "dot crawl" pattern derived from chroma into luma. Output
   * back to RGB. Strength scales the whole effect.
   */
  applyComposite(fitCtx, width, height, fp, frameIndex, strength) {
    const img = fitCtx.getImageData(0, 0, width, height);
    const d = img.data;
    const n = width * height;
    // YIQ planes.
    const Y = new Float32Array(n);
    const I = new Float32Array(n);
    const Q = new Float32Array(n);
    for (let p = 0, j = 0; p < n; p++, j += 4) {
      const r = d[j] / 255, g = d[j + 1] / 255, b = d[j + 2] / 255;
      Y[p] = 0.299 * r + 0.587 * g + 0.114 * b;
      I[p] = 0.596 * r - 0.274 * g - 0.322 * b;
      Q[p] = 0.211 * r - 0.523 * g + 0.312 * b;
    }
    // Horizontal chroma blur — radius from chroma resolution (lower = wider).
    const chromaScaleX = Number.isFinite(fp.chromaScaleX) ? fp.chromaScaleX : 0.4;
    const radius = Math.max(1, Math.round((1 - chromaScaleX) * 9 * strength));
    if (radius >= 1) {
      this._boxBlurH(I, width, height, radius);
      this._boxBlurH(Q, width, height, radius);
    }
    // PAL averages chroma phase over line pairs → soften chroma vertically a touch.
    if (fp.system === "PAL") {
      this._boxBlurV(I, width, height, 1);
      this._boxBlurV(Q, width, height, 1);
    }
    // Dot crawl: chroma subcarrier beat injected into luma, phase alternates per
    // line and per frame so it shimmers like real composite.
    const dotAmt = strength * 0.08;
    const fparity = (frameIndex || 0) & 1;
    for (let y = 0; y < height; y++) {
      const lineParity = (y + fparity) & 1;
      const sign = lineParity ? 1 : -1;
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const p = row + x;
        const carrier = ((x & 1) ? 1 : -1) * sign;
        const chroma = Math.abs(I[p]) + Math.abs(Q[p]);
        Y[p] += carrier * chroma * dotAmt;
        // Back to RGB.
        const yy = Y[p], ii = I[p], qq = Q[p];
        const r = yy + 0.956 * ii + 0.621 * qq;
        const g = yy - 0.272 * ii - 0.647 * qq;
        const b = yy - 1.106 * ii + 1.703 * qq;
        const j = p * 4;
        d[j] = r * 255 < 0 ? 0 : r * 255 > 255 ? 255 : r * 255;
        d[j + 1] = g * 255 < 0 ? 0 : g * 255 > 255 ? 255 : g * 255;
        d[j + 2] = b * 255 < 0 ? 0 : b * 255 > 255 ? 255 : b * 255;
      }
    }
    fitCtx.putImageData(img, 0, 0);
  }

  _boxBlurH(plane, width, height, radius) {
    const tmp = new Float32Array(width);
    const inv = 1 / (radius * 2 + 1);
    for (let y = 0; y < height; y++) {
      const row = y * width;
      let acc = 0;
      for (let x = -radius; x <= radius; x++) acc += plane[row + Math.max(0, Math.min(width - 1, x))];
      for (let x = 0; x < width; x++) {
        tmp[x] = acc * inv;
        const addIdx = row + Math.min(width - 1, x + radius + 1);
        const subIdx = row + Math.max(0, x - radius);
        acc += plane[addIdx] - plane[subIdx];
      }
      for (let x = 0; x < width; x++) plane[row + x] = tmp[x];
    }
  }

  _boxBlurV(plane, width, height, radius) {
    const tmp = new Float32Array(height);
    const inv = 1 / (radius * 2 + 1);
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let y = -radius; y <= radius; y++) acc += plane[Math.max(0, Math.min(height - 1, y)) * width + x];
      for (let y = 0; y < height; y++) {
        tmp[y] = acc * inv;
        const addIdx = Math.min(height - 1, y + radius + 1) * width + x;
        const subIdx = Math.max(0, y - radius) * width + x;
        acc += plane[addIdx] - plane[subIdx];
      }
      for (let y = 0; y < height; y++) plane[y * width + x] = tmp[y];
    }
  }

  renderOriginal(outCtx, width, height) {
    outCtx.clearRect(0, 0, width, height);
    outCtx.fillStyle = "black";
    outCtx.fillRect(0, 0, width, height);
    if (!this.hasImage) return false;
    const src = this.sourceCanvas;
    const srcAspect = src.width / src.height;
    const dstAspect = width / height;
    let dw, dh, dx, dy;
    if (srcAspect > dstAspect) {
      dw = width; dh = width / srcAspect;
      dx = 0; dy = (height - dh) / 2;
    } else {
      dh = height; dw = height * srcAspect;
      dy = 0; dx = (width - dw) / 2;
    }
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = "high";
    outCtx.drawImage(src, 0, 0, src.width, src.height, dx, dy, dw, dh);
    return true;
  }

  sampleBilinear(data, width, height, u, v, channel) {
    const x = Math.max(0, Math.min(width - 1, u * (width - 1)));
    const y = Math.max(0, Math.min(height - 1, v * (height - 1)));
    const x0 = Math.floor(x);
    const x1 = Math.min(width - 1, x0 + 1);
    const y0 = Math.floor(y);
    const y1 = Math.min(height - 1, y0 + 1);
    const tx = x - x0;
    const ty = y - y0;
    const i00 = (y0 * width + x0) * 4 + channel;
    const i10 = (y0 * width + x1) * 4 + channel;
    const i01 = (y1 * width + x0) * 4 + channel;
    const i11 = (y1 * width + x1) * 4 + channel;
    const a = data[i00] * (1 - tx) + data[i10] * tx;
    const b = data[i01] * (1 - tx) + data[i11] * tx;
    return a * (1 - ty) + b * ty;
  }

  render(outCtx, width, height, seconds, params, frameIndex, fps, renderOptions = {}) {
    outCtx.clearRect(0, 0, width, height);
    outCtx.fillStyle = "black";
    outCtx.fillRect(0, 0, width, height);
    if (!this.hasImage) return;

    this.ensureCanvasSize(this.fitCanvas, width, height);
    const fitCtx = this.fitCtx;
    fitCtx.clearRect(0, 0, width, height);
    fitCtx.imageSmoothingEnabled = true;
    fitCtx.imageSmoothingQuality = "high";

    const src = this.sourceCanvas;
    const sourceView = renderOptions?.sourceView || null;
    let sw = src.width, sh = src.height, sx = 0, sy = 0;

    if (sourceView && Number.isFinite(sourceView.width) && Number.isFinite(sourceView.height)) {
      const viewW = Math.max(0.05, Math.min(1, Number(sourceView.width) || 1));
      const viewH = Math.max(0.05, Math.min(1, Number(sourceView.height) || 1));
      sw = Math.max(1, Math.round(src.width * viewW));
      sh = Math.max(1, Math.round(src.height * viewH));
      sx = Math.max(0, Math.min(src.width - sw, Math.round(src.width * (Number(sourceView.x) || 0))));
      sy = Math.max(0, Math.min(src.height - sh, Math.round(src.height * (Number(sourceView.y) || 0))));
    } else {
      const srcAspect = src.width / src.height;
      const dstAspect = width / height;
      if (srcAspect > dstAspect) {
        sw = src.height * dstAspect;
        sx = (src.width - sw) / 2;
      } else {
        sh = src.width / dstAspect;
        sy = (src.height - sh) / 2;
      }
    }
    fitCtx.drawImage(src, sx, sy, sw, sh, 0, 0, width, height);

    // Format authenticity pre-pass (native resolution + composite colour).
    if (renderOptions && renderOptions.formatProfile) {
      this.applyFormatPrePass(fitCtx, width, height, renderOptions.formatProfile, frameIndex);
    }

    // ============================================================
    // STAGE A — CAPTURE SIGNAL: grade (colour/tone) then burn in the OSD, LAST,
    // into the signal buffer (fitCtx). Doing this BEFORE the per-pixel display loop
    // (Stage B) below means the display optics — barrel/curvature resample,
    // scanlines, shadow/aperture/slot mask, bloom — naturally ride OVER the OSD,
    // exactly like watching a tape that already had the timestamp burned in. The
    // OSD also sits AFTER the grade, so the scene grade does not colour-shift the
    // OSD's own phosphor colour (handoff defect #4). The grade math is unchanged;
    // only WHERE it runs moved (it used to run last on the output canvas).
    // ============================================================
    this.renderGrade(fitCtx, width, height, params, frameIndex);
    this.renderOSD(fitCtx, width, height, seconds, params, frameIndex, fps, renderOptions);

    // ============================================================
    // STAGE B — DISPLAY OPTICS: the fused warp loop + post passes below resample
    // and modulate the captured signal buffer (fitCtx) into the output.
    // ============================================================
    this.ensureCanvasSize(this.workCanvas, width, height);
    const wctx = this.workCtx;
    const srcPixels = fitCtx.getImageData(0, 0, width, height);
    if (!this.cachedOutImageData || this.cachedOutImageWidth !== width || this.cachedOutImageHeight !== height) {
      this.cachedOutImageData = wctx.createImageData(width, height);
      this.cachedOutImageWidth = width;
      this.cachedOutImageHeight = height;
    }
    const outPixels = this.cachedOutImageData;
    const srcData = srcPixels.data;
    const dstData = outPixels.data;

    const barrel = Math.max(-0.3, Math.min(0.3, params.barrelDistortion || 0));
    const barrelCornerWarp = Math.max(0.35, 1 + barrel * (0.22 + 0.78 * 2));
    const barrelOverscan = barrel < 0 ? barrelCornerWarp : 1;
    const ca = params.chromaticAberration || 0;
    const scan = params.scanlineStrength || 0;
    const mask = params.phosphorMask || 0;
    const maskType = typeof params.maskType === "string" ? params.maskType : "phosphor";
    const pixelSize = Math.max(1, Number(params.pixelSize) || 1);
    const maskScale = Math.max(0.25, Number(params.maskScale) || 1);
    const maskScaleDeviation = Math.min(1, Math.abs(maskScale - 1) / 2);
    const maskScaleBoost = 1 + maskScaleDeviation * 0.35;
    const pixelInfluence = 1 + (pixelSize - 1) * 0.22;
    const pixelStepX = width > 1 ? 1 / (width - 1) : 0;
    const pixelStepY = height > 1 ? 1 / (height - 1) : 0;
    const frameSeconds = frameIndex / fps;

    const lineJitter = Math.max(0, Math.min(1, Number(params.advancedLineJitter) || 0));
    const timebaseWobble = Math.max(0, Math.min(1, Number(params.advancedTimebaseWobble) || 0));
    const headSwitching = Math.max(0, Math.min(1, Number(params.advancedHeadSwitching) || 0));
    const chromaDelay = Math.max(0, Math.min(1, Number(params.advancedChromaDelay) || 0));
    const crossColor = Math.max(0, Math.min(1, Number(params.advancedCrossColor) || 0));
    const dropouts = Math.max(0, Math.min(1, Number(params.advancedDropouts) || 0));
    const ghosting = Math.max(0, Math.min(1, Number(params.advancedGhosting) || 0));
    const interlacing = Math.max(0, Math.min(1, Number(params.advancedInterlacing) || 0));
    const frameStutter = Math.max(0, Math.min(1, Number(params.advancedFrameStutter) || 0));
    const rfInterference = Math.max(0, Math.min(1, Number(params.advancedRfInterference) || 0));
    const exposurePump = Math.max(0, Math.min(1, Number(params.advancedExposurePump) || 0));
    const whiteBalanceDrift = Math.max(0, Math.min(1, Number(params.advancedWhiteBalanceDrift) || 0));
    const focusBreathing = Math.max(0, Math.min(1, Number(params.advancedFocusBreathing) || 0));
    const tapeCrease = Math.max(0, Math.min(1, Number(params.advancedTapeCrease) || 0));
    const cctvMonochrome = Math.max(0, Math.min(1, Number(params.advancedCctvMonochrome) || 0));
    // Phosphor / plasma burn-in: faint retained ghost of the persistent image,
    // independent of the live picture. Driven by burnInGhost (0–1).
    const burnInGhost = Math.max(0, Math.min(1, Number(params.burnInGhost) || 0));
    // Sync-suppression scrambling (cable de-scrambler required): horizontal
    // tearing/rolling, suppressed/inverted luma bands. Driven by syncSuppression (0–1).
    const syncSuppression = Math.max(0, Math.min(1, Number(params.syncSuppression) || 0));
    // brightness/contrast/saturation/gamma/temperature/tint moved to renderGrade().
    const quantization = Math.max(0, Math.min(1, Number(params.advancedQuantization) || 0));
    const generationLoss = Math.max(0, Math.min(1, Number(params.advancedGenerationLoss) || 0));
    const macroBlocking = Math.max(0, Math.min(1, Number(params.advancedMacroBlocking) || 0));
    // ---- Datamosh / true digital-decay params ----
    const datamoshBloom = Math.max(0, Math.min(1, Number(params.datamoshBloom) || 0));
    const datamoshDisplacement = Math.max(0, Math.min(1, Number(params.datamoshDisplacement) || 0));
    const pixelSort = Math.max(0, Math.min(1, Number(params.pixelSort) || 0));
    const bitrotCorruption = Math.max(0, Math.min(1, Number(params.bitrotCorruption) || 0));
    // ---- Media Aging stage params (physical degradation over time / dubbing / restoration) ----
    const mediaAgeYears = Math.max(0, Math.min(100, Number(params.mediaAgeYears) || 0));
    const copyGenerationCount = Math.max(0, Math.min(20, Math.round(Number(params.copyGenerationCount) || 0)));
    const restorationPassLevel = Math.max(0, Math.min(1, Number(params.restorationPassLevel) || 0));
    const storageSeverity = ({ ideal: 0.45, dry: 0.55, humid: 0.95, hot: 1.1, moldRisk: 1.45 })[String(params.storageCondition || "ideal")] ?? 0.45;
    const ageNorm = (mediaAgeYears / 100) * storageSeverity;
    const filmGrain = Math.max(0, Math.min(1, Number(params.advancedFilmGrain) || 0));
    const filmDust = Math.max(0, Math.min(1, Number(params.advancedFilmDust) || 0));
    const filmScratches = Math.max(0, Math.min(1, Number(params.advancedFilmScratches) || 0));
    const filmGateWeave = Math.max(0, Math.min(1, Number(params.advancedFilmGateWeave) || 0));
    const filmHalation = Math.max(0, Math.min(1, Number(params.advancedFilmHalation) || 0));
    const neonPhosphorBleed = Math.max(0, Math.min(1, Number(params.advancedNeonPhosphorBleed) || 0));
    // 1.1.5 look signatures (PE-specced): RealVideo watercolour smear, LED-wall capture, plasma burn-in graphic.
    const watercolorSmear = Math.max(0, Math.min(1, Number(params.advancedWatercolorSmear) || 0));
    const ledWall = Math.max(0, Math.min(1, Number(params.advancedLedWall) || 0));
    const burnInStyle = String(params.burnInStyle || "none");
    // 1.1.6 display-type looks (PE-specced): all default 0/neutral; the hybrid dispatcher's
    // catch-all routes any active look to this CPU path automatically.
    const n01 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; };
    const crtProjConvergence = n01(params.crtProjConvergence);
    const crtProjEdgeSoftness = n01(params.crtProjEdgeSoftness);
    const crtProjBloom = n01(params.crtProjBloom);
    const crtProjBlackLift = n01(params.crtProjBlackLift);
    const crtProjCenterX = n01(params.crtProjCenterX) || 0.5; // 0 = auto-centre
    const crtProjCenterY = n01(params.crtProjCenterY) || 0.5;
    const stnDither = n01(params.stnDither);
    const stnLevels = Math.max(0, Math.round(Number(params.stnLevels) || 0)); // 0 = off (auto 6 when dithering)
    const stnTint = n01(params.stnTint);
    const stnContrast = n01(params.stnContrast);
    const stnGhostTrail = n01(params.stnGhostTrail);
    const stnGhostDir = Number(params.stnGhostDir) || 0; // degrees
    const stnCrosstalk = n01(params.stnCrosstalk);
    const dlpRainbow = n01(params.dlpRainbow);
    const dlpRainbowThreshold = n01(params.dlpRainbowThreshold) || 0.7; // 0 = default gate
    const dlpScreenDoor = n01(params.dlpScreenDoor);
    const dlpDither = n01(params.dlpDither);
    const einkGrey = n01(params.einkGrey);
    const einkLevels = Math.max(0, Math.round(Number(params.einkLevels) || 0)); // 0 = auto 16
    const einkGhost = n01(params.einkGhost);
    const einkDither = n01(params.einkDither);
    const einkFlash = n01(params.einkFlash);
    const dmgGreen = n01(params.dmgGreen);
    const dmgPixelate = n01(params.dmgPixelate);
    const dmgReflectiveShadow = n01(params.dmgReflectiveShadow);
    const dmgShadowAngle = Number(params.dmgShadowAngle) || 135; // degrees; 0 = auto 135
    const dmgGhost = n01(params.dmgGhost);
    // ---- v2 film / sensor / signal params (now consumed) ----
    const c01 = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0; };
    const grainSize = c01(params.grainSize);
    const grainChromaticity = c01(params.grainChromaticity);
    const gateJitterX = c01(params.gateJitterX);
    const gateJitterY = c01(params.gateJitterY);
    const gateRotation = c01(params.gateRotation);
    const shutterJudder = c01(params.shutterJudder);
    // NOTE: the colour-grade params (printFade*, blackLevelCrush, highlightRollOff,
    // haze, infraredFalseColor, saturation, gamma, temperature, tint, brightness,
    // contrast, monochromeTint) moved into renderGrade() (Stage A), which reads them
    // from `params` directly — so they are no longer extracted here.
    const vignetteAmt = c01(params.vignette);
    const bandingHorizontal = c01(params.bandingHorizontal);
    const hanoverBars = c01(params.hanoverBars);
    // ---- Epic 3 LOW effect params ----
    // Nitrate decay: chemical blotches, edge fog, mottled emulsion damage.
    const nitrateDecay = c01(params.nitrateDecay);
    // Technicolor 3-strip registration fringe: slight R/G/B mis-registration coloured edges.
    const technicolorFringe = c01(params.technicolorFringe);
    // IR illuminator central hotspot bloom (near-field blow-out, rapid edge falloff).
    const irHotspot = c01(params.irHotspot);
    // Polaroid SX-70 colour crossover (greenish/yellow shadows, warm highlights).
    const polaroidCrossover = c01(params.polaroidCrossover);
    // Per-frame film-gate displacement (random translation + small rotation +
    // occasional shutter "judder" jump) — deterministic from the frame index.
    const judderHit = shutterJudder > 0 && seededNoise(frameIndex, 3, 51) < shutterJudder * 0.5;
    const gateOffX = (seededNoise(frameIndex, 11, 7) - 0.5) * gateJitterX * 0.03 + (judderHit ? (seededNoise(frameIndex, 5, 9) - 0.5) * 0.05 : 0);
    const gateOffY = (seededNoise(frameIndex, 17, 13) - 0.5) * gateJitterY * 0.03 + (judderHit ? (seededNoise(frameIndex, 7, 3) - 0.5) * 0.06 : 0);
    const gateRot = (seededNoise(frameIndex, 23, 19) - 0.5) * gateRotation * 0.05;

    const stutterHoldFrames = Math.floor(frameStutter * frameStutter * 6);
    const stutteredFrame = stutterHoldFrames > 0 ? frameIndex - (frameIndex % (stutterHoldFrames + 1)) : frameIndex;
    const temporalFrame = stutterHoldFrames > 0 ? stutteredFrame : frameIndex;
    const temporalSeconds = temporalFrame / fps;

    const bloomAmt = params.bloom || 0;
    const noiseAmt = params.noise || 0;
    const maskActive = mask > 0 && maskType !== "none";
    // Soft taps (extra bilinear samples) are only needed when softening/halation is active.
    const needSoftTaps = bloomAmt > 0 || maskActive || filmHalation > 0;
    // Whether the per-pixel geometric/sampling loop is needed at all. When every
    // per-pixel effect is neutral we can skip the loop entirely (e.g. True Zero).
    const needsPerPixel =
      barrel !== 0 || ca !== 0 || scan !== 0 || maskActive ||
      pixelSize > 1 || lineJitter > 0 || timebaseWobble > 0 || headSwitching > 0 ||
      chromaDelay > 0 || crossColor > 0 || tapeCrease > 0 || filmGateWeave > 0 ||
      filmHalation > 0 || neonPhosphorBleed > 0 || bloomAmt > 0 ||
      filmGrain > 0 || filmDust > 0 || filmScratches > 0 || dropouts > 0 ||
      interlacing > 0 || noiseAmt > 0 ||
      gateJitterX > 0 || gateJitterY > 0 || gateRotation > 0 || shutterJudder > 0;

    if (needsPerPixel) {
    for (let y = 0; y < height; y++) {

      const ny = (y / (height - 1)) * 2 - 1;
      const maskY = Math.floor(y / maskScale);
      const scanPhase = Math.sin((maskY + 0.5) * Math.PI);
      const scanlineGain = 1 - scan * (0.35 + 0.65 * (0.5 + 0.5 * scanPhase));

      for (let x = 0; x < width; x++) {
        const nx = (x / (width - 1)) * 2 - 1;
        const r2 = nx * nx + ny * ny;
        const warpCurve = 0.22 + 0.78 * r2;
        const warp = Math.max(0.35, 1 + barrel * warpCurve);
        const wobble = Math.sin((ny + temporalSeconds * 0.9) * Math.PI * 6) * timebaseWobble * 0.012;
        const perLineJitter = (seededNoise(y, temporalFrame * 0.07, 7) - 0.5) * lineJitter * 0.018;
        // Head-switching: a torn, noisy band at the very bottom few scanlines
        // (the video heads change during the overrun of the vertical blanking).
        // Per-line horizontal tear that grows toward the bottom; noise/darkening
        // is added at the pixel level below so the band reads as disrupted signal,
        // not a smooth skew.
        const headBandTop = 1 - (0.06 + headSwitching * 0.10);
        const inHeadBand = headSwitching > 0 && ny > headBandTop;
        const headBandP = inHeadBand ? (ny - headBandTop) / (1 - headBandTop) : 0;
        const baseHeadSwitching = inHeadBand
          ? headSwitching * (0.05 + headBandP * 0.18) * (seededNoise(y, temporalFrame, 71) - 0.3)
          : 0;
        const creaseCenter = seededNoise(Math.floor(temporalSeconds * 0.67), 19, 11);
        const creaseDistance = Math.abs(y / Math.max(1, height - 1) - creaseCenter);
        const creaseWarp = tapeCrease > 0 ? Math.max(0, 1 - creaseDistance / 0.045) * tapeCrease * (0.015 + seededNoise(temporalFrame, y, 41) * 0.02) : 0;

        const weaveX = filmGateWeave * Math.sin(temporalSeconds * 1.7 + y * 0.013) * 0.01;
        const weaveY = filmGateWeave * Math.cos(temporalSeconds * 1.9 + x * 0.009) * 0.008;
        const srcNx = (nx / warp) * barrelOverscan + wobble + perLineJitter + baseHeadSwitching + creaseWarp + weaveX + gateOffX + ny * gateRot;
        const srcNy = (ny / warp) * barrelOverscan + weaveY + gateOffY - nx * gateRot;
        const u = Math.max(0, Math.min(1, srcNx * 0.5 + 0.5));
        const v = Math.max(0, Math.min(1, srcNy * 0.5 + 0.5));

        const outIndex = (y * width + x) * 4;
        const edgeShift = ca * (0.0012 + r2 * 0.0045) * (0.8 + (pixelSize - 1) * 0.22);
        const qx = Math.floor((u * width) / pixelSize) * pixelSize + pixelSize * 0.5;
        const qy = Math.floor((v * height) / pixelSize) * pixelSize + pixelSize * 0.5;
        const qu = Math.max(0, Math.min(1, qx / width));
        const qv = Math.max(0, Math.min(1, qy / height));

        const delayShift = chromaDelay * 0.02 * (seededNoise(y, temporalSeconds * 1.3, 23) - 0.2);
        const crossColorShift = crossColor * 0.012 * Math.sin((y + temporalSeconds * 60) * 0.08);
        const ru = qu + edgeShift * (0.7 + Math.abs(nx)) + delayShift;
        const gu = qu + crossColorShift * 0.45;
        const bu = qu - edgeShift * (0.7 + Math.abs(nx)) - delayShift;

        const red = this.sampleBilinear(srcData, width, height, ru, qv, 0);
        const green = this.sampleBilinear(srcData, width, height, gu, qv, 1);
        const blue = this.sampleBilinear(srcData, width, height, bu, qv, 2);

        let redHoriz = red, greenHoriz = green, blueHoriz = blue;
        let redVert = red, greenVert = green, blueVert = blue;
        if (needSoftTaps) {
          redHoriz = this.sampleBilinear(srcData, width, height, ru - pixelStepX, qv, 0) * 0.5 + this.sampleBilinear(srcData, width, height, ru + pixelStepX, qv, 0) * 0.5;
          greenHoriz = this.sampleBilinear(srcData, width, height, gu - pixelStepX, qv, 1) * 0.5 + this.sampleBilinear(srcData, width, height, gu + pixelStepX, qv, 1) * 0.5;
          blueHoriz = this.sampleBilinear(srcData, width, height, bu - pixelStepX, qv, 2) * 0.5 + this.sampleBilinear(srcData, width, height, bu + pixelStepX, qv, 2) * 0.5;
          redVert = this.sampleBilinear(srcData, width, height, ru, qv - pixelStepY, 0) * 0.5 + this.sampleBilinear(srcData, width, height, ru, qv + pixelStepY, 0) * 0.5;
          greenVert = this.sampleBilinear(srcData, width, height, gu, qv - pixelStepY, 1) * 0.5 + this.sampleBilinear(srcData, width, height, gu, qv + pixelStepY, 1) * 0.5;
          blueVert = this.sampleBilinear(srcData, width, height, bu, qv - pixelStepY, 2) * 0.5 + this.sampleBilinear(srcData, width, height, bu, qv + pixelStepY, 2) * 0.5;
        }

        const luminance = Math.max(red, green, blue) / 255;
        // Softening/bleed only contributes when bloom or phosphor mask is active —
        // no baseline blur, so neutral presets stay sharp.
        const bleed = (bloomAmt * 0.26 + mask * 0.08) * pixelInfluence * Math.pow(luminance, 0.75);

        const blend = Math.min(0.45, bleed);

        const maskX = Math.floor(x / maskScale);
        const maskStrength = Math.min(1, mask * maskScaleBoost);
        const boost = 1 + maskStrength * 0.52;
        const dim = 1 - maskStrength * 0.32;
        let rMask = 1, gMask = 1, bMask = 1;

        if (maskType === "phosphor") {
          const triad = maskX % 3;
          rMask = triad === 0 ? boost : dim;
          gMask = triad === 1 ? boost : dim;
          bMask = triad === 2 ? boost : dim;
        } else if (maskType === "aperture") {
          const stripe = maskX % 3;
          const stripeBoost = 1 + maskStrength * 0.34;
          const stripeDim = 1 - maskStrength * 0.2;
          rMask = stripe === 0 ? stripeBoost : stripeDim;
          gMask = stripe === 1 ? stripeBoost : stripeDim;
          bMask = stripe === 2 ? stripeBoost : stripeDim;
        } else if (maskType === "slot") {
          const slotX = maskX % 6;
          const slotY = maskY % 4;
          const slotOpen = slotX < 2 || (slotY & 1 ? slotX >= 2 && slotX < 4 : slotX >= 4);
          const slotGain = slotOpen ? (1 + maskStrength * 0.28) : (1 - maskStrength * 0.24);
          rMask = slotGain; gMask = slotGain; bMask = slotGain;
        } else if (maskType === "dot") {
          const dotX = (maskX % 6) - 2.5;
          const dotY = (maskY % 6) - 2.5;
          const dotDist = Math.sqrt(dotX * dotX + dotY * dotY);
          const dotGain = 1 + maskStrength * (0.34 - Math.min(0.34, dotDist * 0.08));
          rMask = dotGain; gMask = dotGain; bMask = dotGain;
        } else if (maskType === "shadowMask") {
          const cellX = maskX % 6;
          const cellY = maskY % 4;
          const subpixelRow = cellY < 2;
          const subpixel = Math.floor(cellX / 2);
          const apertureOpen = cellX % 2 === 0;
          const bright = 1 + maskStrength * 0.36;
          const dark = 1 - maskStrength * 0.26;
          rMask = subpixelRow && apertureOpen && subpixel === 0 ? bright : dark;
          gMask = subpixelRow && apertureOpen && subpixel === 1 ? bright : dark;
          bMask = subpixelRow && apertureOpen && subpixel === 2 ? bright : dark;
        } else if (maskType === "lcdStripeRGB") {
          const stripe = maskX % 3;
          const columnLeak = 1 - maskStrength * 0.08;
          const active = 1 + maskStrength * 0.28;
          const inactive = 1 - maskStrength * 0.2;
          rMask = (stripe === 0 ? active : inactive) * columnLeak;
          gMask = (stripe === 1 ? active : inactive) * columnLeak;
          bMask = (stripe === 2 ? active : inactive) * columnLeak;
        } else if (maskType === "oledPentile") {
          const pentileX = maskX % 4;
          const pentileY = maskY % 2;
          const hot = 1 + maskStrength * 0.3;
          const cool = 1 - maskStrength * 0.16;
          const greenShare = pentileY === 0 ? (pentileX === 1 || pentileX === 3) : (pentileX === 0 || pentileX === 2);
          rMask = pentileX === 0 || pentileX === 2 ? hot : cool;
          gMask = greenShare ? hot : cool;
          bMask = pentileX === 1 || pentileX === 3 ? hot : cool;
        } else if (maskType === "plasmaCell") {
          const cellXp = Math.floor(maskX / 2);
          const cellYp = Math.floor(maskY / 2);
          const pulse = 0.9 + 0.1 * Math.sin(temporalSeconds * 9 + (cellXp + cellYp) * 0.3);
          const gasNoise = seededNoise(cellXp * 0.19, cellYp * 0.19, temporalFrame * 0.2) - 0.5;
          const cellGain = 1 + maskStrength * (gasNoise * 0.24 + (pulse - 1) * 0.38);
          rMask = cellGain * (1 + maskStrength * 0.02); gMask = cellGain; bMask = cellGain * (1 - maskStrength * 0.02);
        } else if (maskType === "filmSuper8") {
          const edgeX = Math.min(x / Math.max(1, width), (width - x) / Math.max(1, width));
          const edgeY = Math.min(y / Math.max(1, height), (height - y) / Math.max(1, height));
          const edgeVignette = Math.min(edgeX, edgeY);
          const perforationBand = x < width * 0.04 || x > width * 0.96;
          const perfPulse = 0.86 + 0.14 * Math.sin((y / Math.max(1, height)) * Math.PI * 12 + temporalSeconds * 4);
          const super8Gain = 1 - mask * (0.22 * (1 - edgeVignette));
          rMask = super8Gain * (perforationBand ? perfPulse : 1); gMask = rMask; bMask = rMask;
        } else if (maskType === "film16mm") {
          const gateEdge = Math.min(x / Math.max(1, width), (width - x) / Math.max(1, width), y / Math.max(1, height), (height - y) / Math.max(1, height));
          const gateDarken = 1 - mask * (0.16 * (1 - gateEdge));
          const weaveTexture = 1 + mask * 0.08 * (seededNoise(x * 0.03, y * 0.03, temporalFrame) - 0.5);
          rMask = gateDarken * weaveTexture; gMask = rMask; bMask = rMask;
        } else if (maskType === "instantDyeCloud") {
          const radial = Math.hypot((x / Math.max(1, width)) - 0.5, (y / Math.max(1, height)) - 0.5);
          const cloud = seededNoise(x * 0.09, y * 0.09, temporalFrame * 0.22);
          const density = 1 + mask * ((cloud - 0.5) * 0.22 - radial * 0.18);
          rMask = density * (1 + mask * 0.04); gMask = density; bMask = density * (1 - mask * 0.03);
        } else if (maskType === "irBloomSpeckle") {
          const radial = Math.hypot((x / Math.max(1, width)) - 0.5, (y / Math.max(1, height)) - 0.5);
          const hotspot = 1 + mask * Math.max(0, 0.2 - radial) * 1.2;
          const speckle = 1 + mask * (seededNoise(x * 0.31, y * 0.31, temporalFrame * 0.12) - 0.5) * 0.32;
          const irGain = hotspot * speckle;
          rMask = irGain; gMask = irGain; bMask = irGain;
        } else if (maskType === "cmosRollingColumn") {
          const col = (x % 8) / 8;
          const row = (y % 12) / 12;
          const colFpn = 1 + mask * ((col - 0.5) * 0.14 + (seededNoise(x * 0.07, 0.14, 0.03) - 0.5) * 0.2);
          const rowFpn = 1 + mask * ((row - 0.5) * 0.08);
          const cmosGain = colFpn * rowFpn;
          rMask = cmosGain * (1 + mask * 0.01); gMask = cmosGain; bMask = cmosGain * (1 - mask * 0.01);
        } else if (maskType === "lowBitrateBlockGrid") {
          const blockSize = 12;
          const localX = x % blockSize;
          const localY = y % blockSize;
          const edge = localX <= 1 || localY <= 1 || localX >= blockSize - 1 || localY >= blockSize - 1;
          const blockNoise = seededNoise(Math.floor(x / blockSize) * 0.63, Math.floor(y / blockSize) * 0.63, temporalFrame * 0.05);
          const blockGain = 1 + mask * ((blockNoise - 0.5) * 0.12 - (edge ? 0.14 : 0));
          rMask = blockGain; gMask = blockGain; bMask = blockGain;
        } else if (maskType === "fisheyeMicrolens") {
          const fnx = (x / Math.max(1, width)) * 2 - 1;
          const fny = (y / Math.max(1, height)) * 2 - 1;
          const radius = Math.min(1.6, Math.sqrt(fnx * fnx + fny * fny));
          const vignette = 1 - mask * Math.max(0, radius - 0.55) * 0.28;
          const micro = 1 + mask * (seededNoise(x * 0.18, y * 0.18, 0.21) - 0.5) * Math.max(0, radius - 0.35) * 0.2;
          const fisheyeGain = vignette * micro;
          rMask = fisheyeGain * (1 + mask * 0.015); gMask = fisheyeGain; bMask = fisheyeGain * (1 - mask * 0.015);
        }

        // Ordered dithering only when noise is requested — no baseline dither.
        const dither = noiseAmt > 0 ? (BAYER_4X4[maskY & 3][maskX & 3] / 15 - 0.5) * (noiseAmt * 2.2) : 0;

        let redSoft = red * (1 - blend) + (redHoriz * 0.62 + redVert * 0.38) * blend;
        let greenSoft = green * (1 - blend) + (greenHoriz * 0.62 + greenVert * 0.38) * blend;
        let blueSoft = blue * (1 - blend) + (blueHoriz * 0.62 + blueVert * 0.38) * blend;

        if (filmHalation > 0) {
          const haloMix = Math.min(0.45, filmHalation * (0.12 + luminance * 0.5));
          redSoft = redSoft * (1 - haloMix) + redHoriz * haloMix;
          greenSoft = greenSoft * (1 - haloMix) + greenHoriz * haloMix;
          blueSoft = blueSoft * (1 - haloMix) + blueHoriz * haloMix;
        }

        if (neonPhosphorBleed > 0.001) {
          const hotCore = Math.max(0, Math.min(1, (luminance - 0.36) / 0.52));
          const neonMix = neonPhosphorBleed * (0.12 + hotCore * hotCore * 0.88) * (0.45 + (params.bloom || 0) * 0.55);
          const wideShift = 2.4 + pixelSize * 0.5;
          const wideR = this.sampleBilinear(srcData, width, height, ru - pixelStepX * wideShift, qv, 0) * 0.5 + this.sampleBilinear(srcData, width, height, ru + pixelStepX * wideShift, qv, 0) * 0.5;
          const wideG = this.sampleBilinear(srcData, width, height, gu - pixelStepX * wideShift, qv, 1) * 0.5 + this.sampleBilinear(srcData, width, height, gu + pixelStepX * wideShift, qv, 1) * 0.5;
          const wideB = this.sampleBilinear(srcData, width, height, bu - pixelStepX * wideShift, qv, 2) * 0.5 + this.sampleBilinear(srcData, width, height, bu + pixelStepX * wideShift, qv, 2) * 0.5;
          redSoft += (wideR * 0.78 + wideB * 0.22) * neonMix;
          greenSoft += wideG * neonMix * 0.2;
          blueSoft += (wideB * 0.78 + wideR * 0.22) * neonMix;
        }

        // Film grain — grainSize scales the spatial frequency (bigger grain = lower
        // freq / chunkier), grainChromaticity adds per-channel colour speckle.
        if (filmGrain > 0) {
          const gf = 1.91 / (1 + grainSize * 2.2); // larger grainSize → coarser grain
          const gfy = 1.37 / (1 + grainSize * 2.2);
          const grain = (seededNoise(x * gf, y * gfy, temporalFrame * 1.3) - 0.5) * 255 * (filmGrain * 0.34);
          if (grainChromaticity > 0.001) {
            const cAmt = filmGrain * grainChromaticity * 0.26 * 255;
            redSoft += grain + (seededNoise(x * gf + 3.3, y * gfy, temporalFrame * 1.7) - 0.5) * cAmt;
            greenSoft += grain + (seededNoise(x * gf, y * gfy + 5.1, temporalFrame * 1.9) - 0.5) * cAmt;
            blueSoft += grain + (seededNoise(x * gf + 7.7, y * gfy + 2.2, temporalFrame * 2.3) - 0.5) * cAmt;
          } else {
            redSoft += grain; greenSoft += grain; blueSoft += grain;
          }
        }

        const dustHit = seededNoise(x * 0.19 + temporalFrame * 0.03, y * 0.23, 83);
        if (filmDust > 0 && dustHit > 0.995 - filmDust * 0.03) {
          const dustShade = 1 - filmDust * (0.3 + seededNoise(x, y, temporalFrame) * 0.5);
          redSoft *= dustShade; greenSoft *= dustShade; blueSoft *= dustShade;
        }

        const scratchSeed = seededNoise(Math.floor(x * 0.07), temporalFrame * 0.11, 97);
        if (filmScratches > 0 && scratchSeed > 0.982 - filmScratches * 0.045) {
          const scratchBright = 1 + filmScratches * 0.6;
          redSoft *= scratchBright; greenSoft *= scratchBright; blueSoft *= scratchBright;
        }

        // Tape dropouts: brief HORIZONTAL streaks a few scanlines tall (~20–80px
        // wide), irregularly clustered, with a bright flash at the head and a dark
        // recovery — the real VHS signal-loss shape, not per-pixel speckle. Keyed
        // on a 3-line band so each dropout spans 2–4 scanlines; a low-frequency
        // term groups several bands so dropouts cluster rather than scatter.
        let dropoutMul = 1;
        if (dropouts > 0) {
          const band = (y / 3) | 0;
          const occur = seededNoise(band, temporalFrame * 0.37, 31) * 0.7
                      + seededNoise((band / 6) | 0, temporalFrame * 0.21, 67) * 0.3;
          if (occur > 0.93 - dropouts * 0.13) {
            const streakW = 20 + seededNoise(band, temporalFrame, 17) * 60;
            const streakX = seededNoise(band, temporalFrame * 1.7, 43) * width;
            if (x >= streakX && x < streakX + streakW) {
              const p = (x - streakX) / streakW; // 0 = head, 1 = tail
              const bright = seededNoise(band, temporalFrame, 7) > 0.45;
              if (bright && p < 0.18) dropoutMul = 1 + dropouts * 1.6;           // leading flash
              else dropoutMul = 1 - dropouts * (0.55 + 0.4 * (1 - p));           // dark recovery, deepest at head
            }
          }
        }
        if (inHeadBand) {
          // Disrupted signal in the head-switch band: heavy per-pixel noise +
          // darkening that deepens toward the very bottom line.
          const bn = seededNoise(x * 0.7, y * 3.1, temporalFrame * 0.5 + 13);
          dropoutMul *= (1 - headSwitching * 0.30 * headBandP) * (0.65 + bn * 0.7);
        }
        const interlaceGate = interlacing > 0 ? 1 - interlacing * (((y + temporalFrame) & 1) ? 0.14 : 0.02) : 1;
        const level = scanlineGain * dropoutMul * interlaceGate;

        dstData[outIndex] = Math.min(255, Math.max(0, redSoft * level * rMask + dither));
        dstData[outIndex + 1] = Math.min(255, Math.max(0, greenSoft * level * gMask + dither));
        dstData[outIndex + 2] = Math.min(255, Math.max(0, blueSoft * level * bMask + dither));
        dstData[outIndex + 3] = 255;
      }
    }
    } // end if (needsPerPixel) — per-pixel loop



    if (needsPerPixel) {
      wctx.putImageData(outPixels, 0, 0);
    } else {
      // Fast path: no per-pixel effect active — copy the fitted source directly.
      wctx.clearRect(0, 0, width, height);
      wctx.drawImage(this.fitCanvas, 0, 0);
    }
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = "high";
    outCtx.drawImage(this.workCanvas, 0, 0);


    // Post-processing passes
    if (ghosting > 0) {
      const ghostShift = Math.round((0.5 + ghosting * 3.5) * Math.sin(temporalSeconds * 1.7));
      outCtx.save(); outCtx.globalAlpha = Math.min(0.42, ghosting * 0.45);
      outCtx.drawImage(this.workCanvas, ghostShift, 0); outCtx.restore();
    }

    // ---- Phosphor/plasma burn-in: a faint PERSISTENT retained ghost drawn from
    // the source image (workCanvas), independent of the live picture. Real burn-in
    // is a permanent luminance impression baked into the phosphor/pixel layer so it
    // underlies the live signal at all times. We simulate this with a desaturated,
    // slightly brightened copy of the source at very low opacity using screen blend
    // (so it is only visible in darker areas of the live image, matching real
    // burn-in which is most visible during dark scenes). No Math.random() used. ----
    if (burnInGhost > 0.001 && burnInStyle !== "none") {
      // Real burn-in is a STATIC retained impression of PREVIOUS on-screen graphics that does
      // NOT match the live picture (PE 1.1.5): corner station-logo, lower-third ticker, channel
      // box, menu/HUD frame or bezel. Draw a synthetic period graphic independent of the source.
      // Plasma = faint bright retention (screen); phosphor wear = faint dark impression (multiply).
      const plasmaRetain = /plasma|bright|led/.test(burnInStyle);
      outCtx.save();
      outCtx.globalCompositeOperation = plasmaRetain ? "screen" : "multiply";
      const a = Math.min(0.5, 0.12 + burnInGhost * 0.4);
      outCtx.globalAlpha = a;
      outCtx.fillStyle = plasmaRetain ? "rgba(240,238,225,1)" : "rgba(6,6,10,1)";
      const bm = Math.round(Math.min(width, height) * 0.04);
      const burnRoundRect = (x, y, w, h, r) => {
        outCtx.beginPath();
        outCtx.moveTo(x + r, y);
        outCtx.arcTo(x + w, y, x + w, y + h, r);
        outCtx.arcTo(x + w, y + h, x, y + h, r);
        outCtx.arcTo(x, y + h, x, y, r);
        outCtx.arcTo(x, y, x + w, y, r);
        outCtx.closePath();
        outCtx.fill();
      };
      if (/ticker|lower/.test(burnInStyle)) {
        outCtx.fillRect(0, Math.round(height * 0.84), width, Math.round(height * 0.09));
      } else if (/channel|box|number/.test(burnInStyle)) {
        const bw = Math.round(width * 0.09);
        burnRoundRect(width - bm - bw, bm, bw, Math.round(height * 0.08), Math.round(height * 0.015));
      } else if (/hud|menu|frame/.test(burnInStyle)) {
        outCtx.globalAlpha = a * 0.8;
        outCtx.lineWidth = Math.max(2, Math.round(height * 0.006));
        outCtx.strokeStyle = outCtx.fillStyle;
        outCtx.beginPath();
        outCtx.rect(bm * 2, bm * 2, width - bm * 4, height - bm * 4);
        outCtx.stroke();
      } else if (/bezel/.test(burnInStyle)) {
        const bw = Math.round(Math.min(width, height) * 0.05);
        outCtx.fillRect(0, 0, width, bw);
        outCtx.fillRect(0, height - bw, width, bw);
        outCtx.fillRect(0, 0, bw, height);
        outCtx.fillRect(width - bw, 0, bw, height);
      } else {
        // Default: rounded corner station-logo box, top-left.
        burnRoundRect(bm, bm, Math.round(width * 0.16), Math.round(height * 0.11), Math.round(height * 0.02));
      }
      outCtx.restore();
    } else if (burnInGhost > 0.001) {
      // Legacy aligned-ghost fallback (no style chosen) — kept for backward compatibility.
      outCtx.save();
      outCtx.globalCompositeOperation = "screen";
      outCtx.globalAlpha = Math.min(0.22, burnInGhost * 0.24);
      outCtx.filter = `grayscale(${(0.6 + burnInGhost * 0.3).toFixed(3)}) brightness(${(0.9 + burnInGhost * 0.15).toFixed(3)}) contrast(0.85)`;
      outCtx.drawImage(this.workCanvas, 0, 0);
      outCtx.restore();
    }

    if (focusBreathing > 0) {
      const breathWave = Math.sin(temporalSeconds * 1.17 + 1.3) * 0.5 + 0.5;
      const blurPx = (0.2 + breathWave * 1.8) * focusBreathing;
      outCtx.save(); outCtx.globalAlpha = Math.min(0.55, focusBreathing * 0.6);
      outCtx.filter = `blur(${blurPx.toFixed(2)}px)`;
      outCtx.drawImage(outCtx.canvas, 0, 0); outCtx.restore();
    }

    if (generationLoss > 0) {
      const dubPasses = Math.max(1, Math.floor(1 + generationLoss * 3));
      for (let i = 0; i < dubPasses; i++) {
        const shift = Math.round((i + 1) * (0.5 + generationLoss * 1.8));
        const sat = Math.max(0.25, 1 - generationLoss * (0.26 + i * 0.07));
        const con = Math.max(0.65, 1 - generationLoss * (0.12 + i * 0.04));
        outCtx.save(); outCtx.globalAlpha = Math.min(0.34, 0.11 + generationLoss * 0.2);
        outCtx.filter = `blur(${(generationLoss * (0.9 + i * 0.45)).toFixed(2)}px) saturate(${sat.toFixed(3)}) contrast(${con.toFixed(3)})`;
        outCtx.drawImage(outCtx.canvas, shift, 0); outCtx.drawImage(outCtx.canvas, -shift, 0); outCtx.restore();
      }
    }

    // ---- Copy generation dubbing (integer N-pass tape-to-tape duplication) ----
    // Distinct from advancedGenerationLoss (a continuous slider); this models discrete dub
    // generations so "3rd Gen Dub" / "4th Gen Bootleg" presets compound real per-pass loss.
    if (copyGenerationCount > 0) {
      const passes = Math.min(6, copyGenerationCount); // visually saturates; avoid runaway cost
      for (let i = 0; i < passes; i++) {
        const g = (i + 1) / Math.max(passes, copyGenerationCount); // later passes for high counts
        const shift = 0.6 + g * 1.6 + copyGenerationCount * 0.06;
        const sat = Math.max(0.2, 1 - copyGenerationCount * 0.05 - i * 0.015);
        const con = Math.max(0.6, 1 - copyGenerationCount * 0.018 - i * 0.01);
        const blurPx = (copyGenerationCount * 0.12 + i * 0.18);
        outCtx.save();
        outCtx.globalAlpha = Math.min(0.32, 0.08 + copyGenerationCount * 0.02);
        outCtx.filter = `blur(${blurPx.toFixed(2)}px) saturate(${sat.toFixed(3)}) contrast(${con.toFixed(3)})`;
        outCtx.drawImage(outCtx.canvas, shift, 0);
        outCtx.drawImage(outCtx.canvas, -shift, 0);
        outCtx.restore();
      }
    }

    // ---- Media aging (years in storage) — color fade, yellowing, lifted blacks, dust ----
    if (ageNorm > 0.001) {
      // Yellowing / dye fade: warm multiply tint that strengthens with age.
      outCtx.save();
      outCtx.globalCompositeOperation = "multiply";
      outCtx.globalAlpha = Math.min(0.4, ageNorm * 0.42);
      const yellow = Math.round(235 - ageNorm * 40);
      outCtx.fillStyle = `rgb(${Math.min(255, 245)} ${yellow} ${Math.max(150, 205 - ageNorm * 70)})`;
      outCtx.fillRect(0, 0, width, height);
      outCtx.restore();

      // Desaturation + faded contrast (lifted blacks) as a self-composite filter pass.
      const fadeSat = Math.max(0.35, 1 - ageNorm * 0.55);
      const fadeCon = Math.max(0.7, 1 - ageNorm * 0.28);
      const lift = Math.min(0.18, ageNorm * 0.2);
      outCtx.save();
      outCtx.globalAlpha = Math.min(0.85, 0.5 + ageNorm * 0.5);
      outCtx.filter = `saturate(${fadeSat.toFixed(3)}) contrast(${fadeCon.toFixed(3)}) brightness(${(1 + lift * 0.5).toFixed(3)})`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();
      if (lift > 0.001) {
        outCtx.save();
        outCtx.globalCompositeOperation = "screen";
        outCtx.globalAlpha = lift;
        outCtx.fillStyle = "rgb(70 64 52)";
        outCtx.fillRect(0, 0, width, height);
        outCtx.restore();
      }

      // Age dust / speckle — deterministic per-frame so preview matches export.
      const speckles = Math.floor(ageNorm * 140);
      if (speckles > 0) {
        let seed = (frameIndex * 2654435761) >>> 0;
        const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        outCtx.save();
        for (let s = 0; s < speckles; s++) {
          const x = rnd() * width;
          const y = rnd() * height;
          const r = 0.4 + rnd() * (1 + ageNorm * 1.6);
          const dark = rnd() > 0.5;
          outCtx.globalAlpha = (dark ? 0.35 : 0.5) * Math.min(1, 0.4 + ageNorm);
          outCtx.fillStyle = dark ? "rgb(20 16 12)" : "rgb(238 232 214)";
          outCtx.beginPath();
          outCtx.arc(x, y, r, 0, Math.PI * 2);
          outCtx.fill();
        }
        outCtx.restore();
      }
    }

    // ---- Restoration pass — partially recovers an aged/dubbed image (sharpen + color revive) ----
    if (restorationPassLevel > 0.001) {
      const rp = restorationPassLevel;
      // Unsharp-style recovery: high-frequency add-back via screen of a blurred-difference proxy.
      outCtx.save();
      outCtx.globalAlpha = Math.min(0.6, rp * 0.6);
      outCtx.filter = `saturate(${(1 + rp * 0.4).toFixed(3)}) contrast(${(1 + rp * 0.22).toFixed(3)}) brightness(${(1 - rp * 0.04).toFixed(3)})`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();
      // Subtle local sharpening using difference of a softened copy.
      outCtx.save();
      outCtx.globalCompositeOperation = "overlay";
      outCtx.globalAlpha = Math.min(0.4, rp * 0.4);
      outCtx.filter = `blur(${(0.6 + rp * 0.8).toFixed(2)}px) invert(1) brightness(1.0)`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();
    }



    if (cctvMonochrome > 0) {
      const fullMono = cctvMonochrome >= 0.999;
      outCtx.save(); outCtx.globalAlpha = fullMono ? 1 : Math.min(0.9, 0.2 + cctvMonochrome * 0.7);
      outCtx.filter = `grayscale(1) saturate(0) contrast(${(1 + cctvMonochrome * 0.22).toFixed(3)}) brightness(${(0.95 + cctvMonochrome * 0.08).toFixed(3)})`;
      outCtx.drawImage(outCtx.canvas, 0, 0); outCtx.restore();
      if (!fullMono) {
        outCtx.save(); outCtx.globalCompositeOperation = "multiply"; outCtx.globalAlpha = cctvMonochrome * 0.25;
        outCtx.fillStyle = "rgb(145 182 148)"; outCtx.fillRect(0, 0, width, height); outCtx.restore();
      }
    }

    const bloom = params.bloom || 0;
    if (bloom > 0) {
      outCtx.save(); outCtx.globalCompositeOperation = "screen";
      outCtx.globalAlpha = Math.min(0.8, (0.16 + bloom * 0.34) * pixelInfluence);
      outCtx.filter = `blur(${(0.8 + bloom * 5.6) * (1 + (pixelSize - 1) * 0.12)}px) brightness(${1 + bloom * 0.55})`;
      outCtx.drawImage(this.workCanvas, 0, 0); outCtx.restore();

      outCtx.save(); outCtx.globalCompositeOperation = "lighter";
      outCtx.globalAlpha = Math.min(0.7, (0.08 + bloom * 0.24) * pixelInfluence);
      outCtx.filter = `blur(${(0.4 + bloom * 2.4) * (1 + (pixelSize - 1) * 0.1)}px)`;
      outCtx.drawImage(this.workCanvas, 1, 0); outCtx.drawImage(this.workCanvas, -1, 0); outCtx.restore();

      if (neonPhosphorBleed > 0.001) {
        const neonGlowAlpha = Math.min(0.82, (0.12 + neonPhosphorBleed * 0.5) * (0.7 + bloom * 0.5));
        const neonBlur = (2.4 + neonPhosphorBleed * 12.5) * (1 + (pixelSize - 1) * 0.14);
        outCtx.save(); outCtx.globalCompositeOperation = "lighter"; outCtx.globalAlpha = neonGlowAlpha;
        outCtx.filter = `blur(${neonBlur.toFixed(2)}px) saturate(${(1.3 + neonPhosphorBleed * 1.3).toFixed(3)}) brightness(${(1.02 + neonPhosphorBleed * 0.34).toFixed(3)})`;
        outCtx.drawImage(this.workCanvas, 2, 0); outCtx.drawImage(this.workCanvas, -2, 0); outCtx.restore();
      }
    }

    // Vignette — driven purely by tube curvature, so a flat image gets none.
    const vignette = Math.min(0.35, Math.abs(barrel) * 0.48);
    if (vignette > 0.001) {
      const grad = outCtx.createRadialGradient(width * 0.5, height * 0.5, Math.min(width, height) * 0.22, width * 0.5, height * 0.5, Math.max(width, height) * 0.6);
      grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, `rgba(0,0,0,${vignette.toFixed(3)})`);
      outCtx.fillStyle = grad; outCtx.fillRect(0, 0, width, height);
    }


    // Flicker
    const flickerWaveA = Math.sin(temporalSeconds * Math.PI * 2 * 1.94) * 0.5 + 0.5;
    const flickerWaveB = Math.sin(temporalSeconds * Math.PI * 2 * 0.61 + 1.7) * 0.5 + 0.5;
    const flicker = (params.flicker || 0) * (0.4 + 0.6 * (0.65 * flickerWaveA + 0.35 * flickerWaveB));
    outCtx.fillStyle = `rgba(255,255,255,${(flicker * 0.2).toFixed(3)})`; outCtx.fillRect(0, 0, width, height);

    // RF interference
    if (rfInterference > 0) {
      const bandCount = Math.max(1, Math.floor(1 + rfInterference * 5));
      for (let i = 0; i < bandCount; i++) {
        const bandPos = seededNoise(i + temporalFrame * 0.17, temporalSeconds, 77);
        const bandY = Math.floor(bandPos * height);
        const bandH = Math.max(2, Math.floor(height * (0.004 + rfInterference * 0.018)));
        const alpha = (0.03 + seededNoise(i, temporalFrame, 78) * 0.12) * rfInterference;
        outCtx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`; outCtx.fillRect(0, bandY, width, bandH);
      }
    }

    // Exposure pump & white balance drift
    if (exposurePump > 0 || whiteBalanceDrift > 0) {
      const exposureWave = 1 + (Math.sin(temporalSeconds * 1.53) * 0.5 + 0.5) * exposurePump * 0.28;
      const warmShift = (Math.sin(temporalSeconds * 0.37 + 2.4) * 0.5 + 0.5) * whiteBalanceDrift;
      outCtx.save(); outCtx.globalAlpha = Math.min(0.35, exposurePump * 0.35);
      outCtx.filter = `brightness(${exposureWave.toFixed(3)})`; outCtx.drawImage(outCtx.canvas, 0, 0); outCtx.restore();
      if (whiteBalanceDrift > 0) {
        outCtx.save(); outCtx.globalAlpha = Math.min(0.22, 0.05 + whiteBalanceDrift * 0.2);
        const r = Math.round(30 + warmShift * 70); const g = Math.round(18 + warmShift * 28); const b = Math.round(40 + (1 - warmShift) * 80);
        outCtx.fillStyle = `rgb(${r} ${g} ${b})`; outCtx.globalCompositeOperation = "screen";
        outCtx.fillRect(0, 0, width, height); outCtx.restore();
      }
    }

    // Noise
    if ((params.noise || 0) > 0) {
      const count = Math.floor(width * height * 0.008 * params.noise);
      for (let i = 0; i < count; i++) {
        const nx2 = Math.floor(seededNoise(i, seconds, frameIndex) * width);
        const ny2 = Math.floor(seededNoise(i * 2, seconds + 3.1, frameIndex) * height);
        const grn = seededNoise(nx2 + temporalFrame * 0.3, ny2, temporalFrame);
        const a = (0.02 + grn * 0.28) * params.noise;
        outCtx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`; outCtx.fillRect(nx2, ny2, 1, 1);
      }
    }

    // Macroblocking
    if (macroBlocking > 0.01) {
      const pixelCount = Math.max(1, width * height);
      const perfBudget = Math.min(1, 921600 / pixelCount);
      const resolutionPenalty = Math.min(1, 2073600 / pixelCount);
      const effectiveMacro = macroBlocking * (0.3 + perfBudget * 0.45 + resolutionPenalty * 0.25);
      const blockSize = Math.max(6, Math.round(6 + effectiveMacro * 22 + (1 - resolutionPenalty) * 14));
      const lowW = Math.max(1, Math.floor(width / blockSize));
      const lowH = Math.max(1, Math.floor(height / blockSize));
      this.ensureCanvasSize(this.tempCanvas, lowW, lowH);
      const tctx = this.tempCtx;
      tctx.imageSmoothingEnabled = true; tctx.imageSmoothingQuality = "low";
      tctx.drawImage(outCtx.canvas, 0, 0, lowW, lowH);
      outCtx.save(); outCtx.imageSmoothingEnabled = false;
      outCtx.globalAlpha = Math.min(0.72, 0.12 + effectiveMacro * 0.44);
      outCtx.drawImage(this.tempCanvas, 0, 0, lowW, lowH, 0, 0, width, height); outCtx.restore();
    }

    // Quantization
    if (quantization > 0.01) {
      const perfBudget = Math.min(1, 921600 / Math.max(1, width * height));
      const sampleScale = Math.max(1, Math.round(1 + quantization * (2 + (1 - perfBudget) * 4)));
      const qW = Math.max(1, Math.floor(width / sampleScale));
      const qH = Math.max(1, Math.floor(height / sampleScale));
      this.ensureCanvasSize(this.quantCanvas, qW, qH);
      const qctx = this.quantCtx;
      qctx.clearRect(0, 0, qW, qH); qctx.imageSmoothingEnabled = true; qctx.imageSmoothingQuality = "low";
      qctx.drawImage(outCtx.canvas, 0, 0, qW, qH);
      const levels = Math.max(6, Math.round(72 - quantization * 60));
      const imageData = qctx.getImageData(0, 0, qW, qH);
      const data = imageData.data; const inv = 255 / (levels - 1);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round((data[i] / 255) * (levels - 1)) * inv;
        data[i + 1] = Math.round((data[i + 1] / 255) * (levels - 1)) * inv;
        data[i + 2] = Math.round((data[i + 2] / 255) * (levels - 1)) * inv;
      }
      qctx.putImageData(imageData, 0, 0);
      outCtx.save(); outCtx.imageSmoothingEnabled = false;
      outCtx.globalAlpha = Math.min(0.92, 0.35 + quantization * 0.55);
      outCtx.drawImage(this.quantCanvas, 0, 0, qW, qH, 0, 0, width, height); outCtx.restore();

      // ---- DCT block-edge structure: hard 8×8 grid lines at block boundaries
      // (the defining visual of legacy low-bitrate codecs — RealPlayer 240p, Video CD,
      // early web encodes). The grid alpha varies per-block via seededNoise so adjacent
      // blocks read at slightly different brightness, matching real DCT coefficient
      // truncation. Also adds mosquito ringing: thin oscillating luma halos on the
      // two pixels adjacent to a high-luma-contrast crossing. ----
      if (quantization > 0.18) {
        const blockPx = 8; // DCT block is always 8×8
        const edgeAlpha = Math.min(0.55, (quantization - 0.18) * 0.85);
        const ringAmt = Math.min(0.38, (quantization - 0.18) * 0.52);
        const qImg = outCtx.getImageData(0, 0, width, height);
        const qd = qImg.data;
        // Pre-pass: per-block luma contrast (proxy for DCT AC energy). Block edges + ringing
        // only show where a block carries real high-frequency detail — a flat block has ~no
        // coefficients to truncate. Unconditional edges painted a uniform wireframe grid over
        // smooth/AI sources (NEEDS-BEN #13); gating by contrast keeps smooth areas clean and
        // blocks up only where there is detail.
        const blocksW = Math.ceil(width / blockPx);
        const bMin = new Float32Array(blocksW * Math.ceil(height / blockPx)).fill(255);
        const bMax = new Float32Array(bMin.length);
        for (let y = 0; y < height; y++) {
          const brow = Math.floor(y / blockPx) * blocksW;
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const luma = 0.299 * qd[i] + 0.587 * qd[i + 1] + 0.114 * qd[i + 2];
            const bi = brow + Math.floor(x / blockPx);
            if (luma < bMin[bi]) bMin[bi] = luma;
            if (luma > bMax[bi]) bMax[bi] = luma;
          }
        }
        for (let y = 0; y < height; y++) {
          const localY = y % blockPx;
          const blockRow = Math.floor(y / blockPx);
          for (let x = 0; x < width; x++) {
            const localX = x % blockPx;
            const blockCol = Math.floor(x / blockPx);
            const i = (y * width + x) * 4;
            const bi = blockRow * blocksW + blockCol;
            const edgeFactor = dctEdgeFactor((bMax[bi] - bMin[bi]) / 255);
            if (edgeFactor < 0.002) continue; // flat block → no visible blocking at all
            // Block-edge darkening: activate on first/last row or column of a block
            const onHorizEdge = localY === 0;
            const onVertEdge = localX === 0;
            if (onHorizEdge || onVertEdge) {
              // Per-block noise varies the edge shade slightly (different blocks have
              // different DC-coefficient truncation, so edge jumps differ in magnitude).
              const blockNoise = seededNoise(blockCol * 0.41, blockRow * 0.37, frameIndex * 0.0);
              const alpha = edgeAlpha * (0.6 + blockNoise * 0.4) * edgeFactor;
              qd[i]     = Math.max(0, qd[i]     - qd[i]     * alpha);
              qd[i + 1] = Math.max(0, qd[i + 1] - qd[i + 1] * alpha);
              qd[i + 2] = Math.max(0, qd[i + 2] - qd[i + 2] * alpha);
            }
            // Mosquito ringing: on the pixel adjacent to a block boundary, add a faint
            // noise-modulated brightness oscillation proportional to luma contrast
            // across the boundary (high-frequency overshoot from quantised AC coeff).
            if (ringAmt > 0.01 && (localX === 1 || localX === blockPx - 1 ||
                                    localY === 1 || localY === blockPx - 1)) {
              const luma = 0.299 * qd[i] + 0.587 * qd[i + 1] + 0.114 * qd[i + 2];
              // Ringing oscillates with a spatial frequency close to the 8-px DCT period.
              const ring = Math.sin((localX + localY) * Math.PI * 0.25) *
                           ringAmt * (luma / 255) * 28 * edgeFactor;
              qd[i]     = Math.max(0, Math.min(255, qd[i]     + ring));
              qd[i + 1] = Math.max(0, Math.min(255, qd[i + 1] + ring));
              qd[i + 2] = Math.max(0, Math.min(255, qd[i + 2] + ring));
            }
          }
        }
        outCtx.putImageData(qImg, 0, 0);
      }
    }

    // ============================================================
    // DATAMOSH / TRUE DIGITAL DECAY
    // These model real inter-frame codec failure rather than spatial
    // grain: P-frame bloom (deleted I-frames), motion-vector block
    // displacement, pixel sorting and DCT block corruption.
    // ============================================================
    const datamoshActive = datamoshBloom > 0.01 || datamoshDisplacement > 0.01 || pixelSort > 0.01 || bitrotCorruption > 0.01;
    if (datamoshActive) {
      const perfBudget = Math.min(1, 921600 / Math.max(1, width * height));

      // ---- P-frame bloom: deleted I-frames let the previous frame persist
      // and "melt" as residual motion vectors keep applying. We feed the prior
      // accumulator back, displaced + slightly scaled, then store the result. ----
      if (datamoshBloom > 0.01) {
        this.ensureCanvasSize(this.moshCanvas, width, height);
        const mctx = this.moshCtx;
        const continuous =
          this._moshLastW === width && this._moshLastH === height &&
          frameIndex === this._moshLastFrame + 1;
        if (!continuous) {
          // Seek / size change / first frame: reset accumulator to current frame.
          mctx.setTransform(1, 0, 0, 1, 0, 0);
          mctx.globalAlpha = 1;
          mctx.clearRect(0, 0, width, height);
          mctx.drawImage(outCtx.canvas, 0, 0);
        }
        // Residual motion vectors: scale + drift of the persisted frame.
        const drift = 1 + datamoshBloom * 0.006;
        const dx = Math.sin(frameIndex * 0.27) * datamoshBloom * 7;
        const dy = Math.cos(frameIndex * 0.19) * datamoshBloom * 5;
        const sw = width * drift, sh = height * drift;
        outCtx.save();
        outCtx.globalAlpha = Math.min(0.96, 0.5 + datamoshBloom * 0.46);
        outCtx.drawImage(this.moshCanvas, dx - (sw - width) / 2, dy - (sh - height) / 2, sw, sh);
        outCtx.restore();
        // Persist the new blended frame for the next pass.
        mctx.setTransform(1, 0, 0, 1, 0, 0);
        mctx.globalAlpha = 1;
        mctx.clearRect(0, 0, width, height);
        mctx.drawImage(outCtx.canvas, 0, 0);
        this._moshLastFrame = frameIndex;
        this._moshLastW = width;
        this._moshLastH = height;
      }

      // ---- Motion-vector block displacement: macroblocks slide as if their
      // motion vectors were applied to the wrong reference frame. ----
      if (datamoshDisplacement > 0.01) {
        this.ensureCanvasSize(this.moshSnapCanvas, width, height);
        const sctx = this.moshSnapCtx;
        sctx.clearRect(0, 0, width, height);
        sctx.drawImage(outCtx.canvas, 0, 0);
        const block = Math.max(8, Math.round(12 + (1 - perfBudget) * 20));
        const maxShift = datamoshDisplacement * block * 1.4;
        outCtx.save();
        outCtx.imageSmoothingEnabled = false;
        for (let by = 0; by < height; by += block) {
          for (let bx = 0; bx < width; bx += block) {
            const r = seededNoise(bx * 0.7, by * 0.7, frameIndex * 0.5);
            if (r > datamoshDisplacement * 0.85) continue;
            const ox = (seededNoise(bx, by, frameIndex) - 0.5) * 2 * maxShift;
            const oy = (seededNoise(by, bx, frameIndex + 11) - 0.5) * 2 * maxShift * 0.6;
            const bw = Math.min(block, width - bx);
            const bh = Math.min(block, height - by);
            outCtx.drawImage(this.moshSnapCanvas, bx, by, bw, bh, bx + ox, by + oy, bw, bh);
          }
        }
        outCtx.restore();
      }

      // ---- Pixel sorting: contiguous horizontal runs above a luma threshold
      // get sorted by brightness — the signature "smeared" glitch streaks. ----
      if (pixelSort > 0.01) {
        const img = outCtx.getImageData(0, 0, width, height);
        const d = img.data;
        const lowThresh = 235 - pixelSort * 205; // higher amount → longer runs
        const rowStep = pixelSort > 0.66 ? 1 : pixelSort > 0.33 ? 2 : 3;
        const lum = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        for (let y = 0; y < height; y += rowStep) {
          const rowOff = y * width;
          let x = 0;
          while (x < width) {
            const baseI = (rowOff + x) * 4;
            if (lum(baseI) < lowThresh) { x++; continue; }
            let end = x;
            while (end < width && lum((rowOff + end) * 4) >= lowThresh) end++;
            const runLen = end - x;
            if (runLen > 2) {
              const span = [];
              for (let k = x; k < end; k++) {
                const i = (rowOff + k) * 4;
                span.push([d[i], d[i + 1], d[i + 2], d[i + 3]]);
              }
              span.sort((a, b) => (0.299 * a[0] + 0.587 * a[1] + 0.114 * a[2]) - (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]));
              for (let k = 0; k < runLen; k++) {
                const i = (rowOff + x + k) * 4;
                d[i] = span[k][0]; d[i + 1] = span[k][1]; d[i + 2] = span[k][2]; d[i + 3] = span[k][3];
              }
            }
            x = end + 1;
          }
        }
        outCtx.putImageData(img, 0, 0);
      }

      // ---- DCT macroblock corruption: real codec corruption forms CONTIGUOUS CLUSTERS of
      // SCENE-COLOURED blocks (errors propagate spatially) — displaced reference blocks, smears,
      // or DC-only blocks that collapse to their region's AVERAGE colour. NOT an isolated
      // sprinkle of random-hue tiles, which read as salt-and-pepper confetti (NEEDS-BEN #13). ----
      if (bitrotCorruption > 0.01) {
        this.ensureCanvasSize(this.moshSnapCanvas, width, height);
        const sctx = this.moshSnapCtx;
        sctx.clearRect(0, 0, width, height);
        sctx.drawImage(outCtx.canvas, 0, 0);
        const snapData = sctx.getImageData(0, 0, width, height).data;
        const block = Math.max(8, Math.round(10 + (1 - perfBudget) * 18));
        // Corruption clusters: a coarse low-frequency field (several blocks across) thresholded
        // by the strength gives contiguous corrupted regions; a fine term breaks up the patch
        // edges so they read organic rather than as a hard rectangle.
        const clusterScale = block * 3;
        const clusterThresh = 1 - Math.min(0.55, 0.05 + bitrotCorruption * 0.32);
        outCtx.save();
        outCtx.imageSmoothingEnabled = false;
        for (let by = 0; by < height; by += block) {
          for (let bx = 0; bx < width; bx += block) {
            const coarse = seededNoise(Math.floor(bx / clusterScale) * 1.7, Math.floor(by / clusterScale) * 1.3, frameIndex + 23);
            const fine = seededNoise(bx * 0.09, by * 0.11, frameIndex + 41);
            if (coarse * 0.82 + fine * 0.18 < clusterThresh) continue; // not in a corrupted cluster
            const bw = Math.min(block, width - bx);
            const bh = Math.min(block, height - by);
            // Flat-region gate (PE re-gate 2026-07-05): corruption hides in detail — a lone
            // block on a flat sky/wall reads as a defect. Sample the block's luma range and
            // collapse spawn probability on low-variance blocks.
            let lMin = 255, lMax = 0;
            for (let yy = 0; yy < bh; yy += 3) {
              const row = (by + yy) * width;
              for (let xx = 0; xx < bw; xx += 3) {
                const si = (row + bx + xx) * 4;
                const l = 0.299 * snapData[si] + 0.587 * snapData[si + 1] + 0.114 * snapData[si + 2];
                if (l < lMin) lMin = l;
                if (l > lMax) lMax = l;
              }
            }
            const spawn = corruptionSpawnFactor((lMax - lMin) / 255);
            if (spawn <= 0) continue; // flat block — never corrupt
            if (spawn < 1 && seededNoise(bx + 13, by + 29, frameIndex + 57) > spawn) continue;
            const mode = Math.floor(seededNoise(bx, by, frameIndex) * 3) % 3;
            if (mode === 0) {
              // Displaced reference block (wrong motion vector) — the scene's own colours, moved.
              const sx = Math.floor(seededNoise(by, bx, frameIndex + 1) * (width - bw));
              const sy = Math.floor(seededNoise(bx, by, frameIndex + 2) * (height - bh));
              outCtx.drawImage(this.moshSnapCanvas, sx, sy, bw, bh, bx, by, bw, bh);
            } else if (mode === 1) {
              // Horizontal smear: stretch the block's first column across it.
              outCtx.drawImage(this.moshSnapCanvas, bx, by, 1, bh, bx, by, bw, bh);
            } else {
              // DC-only block: AC coefficients lost, so the block collapses to the AVERAGE colour
              // of its own region — the defining macroblock smear (scene-coloured, contiguous).
              let rs = 0, gs = 0, bs = 0, n = 0;
              for (let yy = 0; yy < bh; yy += 2) {
                const row = (by + yy) * width;
                for (let xx = 0; xx < bw; xx += 2) {
                  const si = (row + bx + xx) * 4;
                  rs += snapData[si]; gs += snapData[si + 1]; bs += snapData[si + 2]; n++;
                }
              }
              outCtx.fillStyle = `rgb(${Math.round(rs / n)}, ${Math.round(gs / n)}, ${Math.round(bs / n)})`;
              outCtx.fillRect(bx, by, bw, bh);
            }
          }
        }
        outCtx.restore();
      }
    }



    // ---- DV block-error concealment: DV dropouts manifest as SHARP rectangular
    // macroblocks (DV uses 8×8 DCT blocks grouped into 5-block macroblocks) that
    // are either frozen at a previous value, filled with a flat DC colour, or
    // copied from an adjacent block (decoder error-concealment strategies).
    // Unlike analog horizontal streaks, DV errors are always block-aligned and
    // hard-edged. Driven by dvBlockError (0–1). ----
    const dvBlockError = Math.max(0, Math.min(1, Number(params.dvBlockError) || 0));
    if (dvBlockError > 0.005) {
      const dvBlock = 16; // DV macroblock (4 × 8×8 luma macroblocks)
      const errProb = dvBlockError * dvBlockError * 0.35; // quadratic: sparse at low values
      const dvImg = outCtx.getImageData(0, 0, width, height);
      const dvd = dvImg.data;
      for (let by = 0; by < height; by += dvBlock) {
        for (let bx = 0; bx < width; bx += dvBlock) {
          // Probability gate — seeded on block position + frame so errors move
          // frame to frame (LP mode errors are NOT sticky — they flicker).
          if (seededNoise(bx * 0.31, by * 0.31, frameIndex * 0.5 + 7) > errProb) continue;
          const bw = Math.min(dvBlock, width - bx);
          const bh = Math.min(dvBlock, height - by);
          // Error concealment mode: seeded per block+frame.
          const errMode = seededNoise(bx, by, frameIndex + 13);
          if (errMode < 0.45) {
            // Frozen DC: fill with the average luma of the block (DC-only = no AC).
            let rSum = 0, gSum = 0, bSum = 0, n = 0;
            for (let yy = 0; yy < bh; yy++) {
              const row = (by + yy) * width;
              for (let xx = 0; xx < bw; xx++) {
                const i = (row + bx + xx) * 4;
                rSum += dvd[i]; gSum += dvd[i + 1]; bSum += dvd[i + 2]; n++;
              }
            }
            const rDC = Math.round(rSum / n), gDC = Math.round(gSum / n), bDC = Math.round(bSum / n);
            for (let yy = 0; yy < bh; yy++) {
              const row = (by + yy) * width;
              for (let xx = 0; xx < bw; xx++) {
                const i = (row + bx + xx) * 4;
                dvd[i] = rDC; dvd[i + 1] = gDC; dvd[i + 2] = bDC;
              }
            }
          } else if (errMode < 0.80) {
            // Adjacent-block copy: copy the block immediately above (or below if at top).
            const srcBy = by > 0 ? by - dvBlock : by + dvBlock;
            if (srcBy >= 0 && srcBy + bh <= height) {
              for (let yy = 0; yy < bh; yy++) {
                const srcRow = (srcBy + yy) * width;
                const dstRow = (by + yy) * width;
                for (let xx = 0; xx < bw; xx++) {
                  const si = (srcRow + bx + xx) * 4;
                  const di = (dstRow + bx + xx) * 4;
                  dvd[di] = dvd[si]; dvd[di + 1] = dvd[si + 1]; dvd[di + 2] = dvd[si + 2];
                }
              }
            }
          } else {
            // Full black error block (lost packet — decoder outputs silence/zero).
            for (let yy = 0; yy < bh; yy++) {
              const row = (by + yy) * width;
              for (let xx = 0; xx < bw; xx++) {
                const i = (row + bx + xx) * 4;
                dvd[i] = 0; dvd[i + 1] = 0; dvd[i + 2] = 0;
              }
            }
          }
        }
      }
      outCtx.putImageData(dvImg, 0, 0);
    }

    // ---- Chroma subsampling (4:4:4 / 4:2:2 / 4:2:0 / 4:1:1) ----
    // Box-averages the Cb/Cr planes over the mode's block size while keeping
    // full-resolution luma — the classic colour-bleed signature of broadcast,
    // DV and consumer codecs. 4:4:4 is a true no-op.
    const chromaMode = String(params.chromaSubsamplingMode || "444");
    if (chromaMode === "422" || chromaMode === "420" || chromaMode === "411") {
      const [sx, sy] = ({ "422": [2, 1], "420": [2, 2], "411": [4, 1] })[chromaMode];
      const img = outCtx.getImageData(0, 0, width, height);
      const d = img.data;
      for (let by = 0; by < height; by += sy) {
        const bh = Math.min(sy, height - by);
        for (let bx = 0; bx < width; bx += sx) {
          const bw = Math.min(sx, width - bx);
          let cbSum = 0, crSum = 0, n = 0;
          for (let yy = 0; yy < bh; yy++) {
            const row = (by + yy) * width;
            for (let xx = 0; xx < bw; xx++) {
              const i = (row + bx + xx) * 4;
              const r = d[i], g = d[i + 1], b = d[i + 2];
              cbSum += -0.168736 * r - 0.331264 * g + 0.5 * b;
              crSum += 0.5 * r - 0.418688 * g - 0.081312 * b;
              n++;
            }
          }
          const cb = cbSum / n, cr = crSum / n;
          for (let yy = 0; yy < bh; yy++) {
            const row = (by + yy) * width;
            for (let xx = 0; xx < bw; xx++) {
              const i = (row + bx + xx) * 4;
              const r = d[i], g = d[i + 1], b = d[i + 2];
              const y0 = 0.299 * r + 0.587 * g + 0.114 * b;
              d[i]     = Math.max(0, Math.min(255, y0 + 1.402 * cr));
              d[i + 1] = Math.max(0, Math.min(255, y0 - 0.344136 * cb - 0.714136 * cr));
              d[i + 2] = Math.max(0, Math.min(255, y0 + 1.772 * cb));
            }
          }
        }
      }
      outCtx.putImageData(img, 0, 0);
    }

    // ---- Scanline profile (categorical shape, independent of scanlineStrength) ----
    const scanlineProfile = String(params.scanlineProfile || "off");
    if (scanlineProfile === "soft" || scanlineProfile === "hard" || scanlineProfile === "triadAware") {
      outCtx.save();
      outCtx.globalCompositeOperation = "multiply";
      if (scanlineProfile === "soft") {
        outCtx.fillStyle = "rgba(0,0,0,0.18)";
        for (let y = 0; y < height; y += 2) outCtx.fillRect(0, y, width, 1);
      } else if (scanlineProfile === "hard") {
        outCtx.fillStyle = "rgba(0,0,0,0.45)";
        for (let y = 1; y < height; y += 3) outCtx.fillRect(0, y, width, 2);
      } else {
        // Triad-aware: horizontal scanlines plus faint vertical phosphor columns.
        outCtx.fillStyle = "rgba(0,0,0,0.24)";
        for (let y = 0; y < height; y += 2) outCtx.fillRect(0, y, width, 1);
        outCtx.fillStyle = "rgba(0,0,0,0.14)";
        for (let x = 2; x < width; x += 3) outCtx.fillRect(x, 0, 1, height);
      }
      outCtx.restore();
    }

    // ---- Subpixel layout override (RGB / BGR stripe or PenTile RGBG) ----
    const subpixelLayout = String(params.subpixelLayoutOverride || "none");
    if (subpixelLayout === "RGB" || subpixelLayout === "BGR" || subpixelLayout === "PenTile") {
      const cols = subpixelLayout === "RGB"
        ? ["#ff0000", "#00ff00", "#0000ff"]
        : subpixelLayout === "BGR"
          ? ["#0000ff", "#00ff00", "#ff0000"]
          : ["#ff0000", "#00ff00", "#0000ff", "#00ff00"];
      if (this._subpixelTileKey !== subpixelLayout) {
        this.subpixelTile.width = cols.length;
        this.subpixelTile.height = 1;
        const tctx = this.subpixelTile.getContext("2d");
        for (let i = 0; i < cols.length; i++) { tctx.fillStyle = cols[i]; tctx.fillRect(i, 0, 1, 1); }
        this._subpixelTileKey = subpixelLayout;
      }
      const pattern = outCtx.createPattern(this.subpixelTile, "repeat");
      if (pattern) {
        outCtx.save();
        outCtx.globalCompositeOperation = "multiply";
        outCtx.globalAlpha = 0.5;
        outCtx.fillStyle = pattern;
        outCtx.fillRect(0, 0, width, height);
        outCtx.restore();
        // Recover some of the brightness the colour mask removes.
        outCtx.save();
        outCtx.globalCompositeOperation = "screen";
        outCtx.globalAlpha = 0.2;
        outCtx.drawImage(outCtx.canvas, 0, 0);
        outCtx.restore();
      }
    }


    // ---- RealVideo watercolour smear (PE 1.1.5): gradients collapse into rounded, bleeding
    // posterized blobs — soft, muddy, low-res upscaled; NOT sharp DCT blocks. Downsample small,
    // blur (rounded bleed), posterize the chroma, then bilinear-upscale for the smeared look. ----
    if (watercolorSmear > 0.001) {
      const s = watercolorSmear;
      const smallW = Math.max(8, Math.round(width * (0.16 - s * 0.10)));   // heavier smear -> smaller
      const smallH = Math.max(8, Math.round(height * (0.16 - s * 0.10)));
      this.ensureCanvasSize(this.tempCanvas, smallW, smallH);
      const wctx = this.tempCtx;
      wctx.clearRect(0, 0, smallW, smallH);
      wctx.imageSmoothingEnabled = true; wctx.imageSmoothingQuality = "high";
      wctx.filter = `blur(${(0.6 + s * 1.2).toFixed(2)}px) saturate(${(1 - s * 0.35).toFixed(2)})`;
      wctx.drawImage(outCtx.canvas, 0, 0, smallW, smallH);
      wctx.filter = "none";
      // Rounded posterization: quantise into few levels so gradients band into blobs.
      const wimg = wctx.getImageData(0, 0, smallW, smallH);
      const wd = wimg.data;
      const levels = Math.max(4, Math.round(10 - s * 5));
      const inv = 255 / (levels - 1);
      for (let i = 0; i < wd.length; i += 4) {
        wd[i] = Math.round((wd[i] / 255) * (levels - 1)) * inv;
        wd[i + 1] = Math.round((wd[i + 1] / 255) * (levels - 1)) * inv;
        wd[i + 2] = Math.round((wd[i + 2] / 255) * (levels - 1)) * inv;
      }
      wctx.putImageData(wimg, 0, 0);
      outCtx.save();
      outCtx.imageSmoothingEnabled = true; outCtx.imageSmoothingQuality = "high"; // bilinear upscale = the bleed
      outCtx.globalAlpha = Math.min(0.95, 0.5 + s * 0.45);
      outCtx.drawImage(this.tempCanvas, 0, 0, smallW, smallH, 0, 0, width, height);
      outCtx.restore();
    }

    // ---- LED-billboard capture (PE 1.1.5): the scene as if shown on a large LED wall and
    // photographed — coarse RGB subpixel lattice with dark inter-pixel gaps, a drifting
    // horizontal refresh band, and bloom on bright LEDs. Deterministic (temporalSeconds). ----
    if (ledWall > 0.001) {
      const w = ledWall;
      const cell = Math.max(4, Math.round(6 + (1 - w) * 10)); // LED pitch in px
      // Subpixel lattice tile: three vertical R/G/B stripes with a dark gap row/col.
      if (this._ledTileKey !== cell) {
        const tile = document.createElement("canvas");
        tile.width = cell; tile.height = cell;
        const tctx = tile.getContext("2d");
        tctx.fillStyle = "#000"; tctx.fillRect(0, 0, cell, cell);
        const sub = Math.max(1, Math.floor((cell - 1) / 3));
        const gap = 1;
        tctx.fillStyle = "#f00"; tctx.fillRect(0, gap, sub, cell - gap * 2);
        tctx.fillStyle = "#0f0"; tctx.fillRect(sub, gap, sub, cell - gap * 2);
        tctx.fillStyle = "#00f"; tctx.fillRect(sub * 2, gap, sub, cell - gap * 2);
        this._ledTile = tile; this._ledTileKey = cell;
        this._ledPattern = outCtx.createPattern(tile, "repeat");
      }
      // Bloom: a brightened, blurred copy screened back so bright LEDs glow.
      outCtx.save();
      outCtx.globalCompositeOperation = "screen";
      outCtx.globalAlpha = w * 0.35;
      outCtx.filter = `blur(${(1 + w * 2).toFixed(2)}px) brightness(1.3)`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();
      // Subpixel lattice multiply (the RGB-dot grid + dark gaps = moiré against scene detail).
      if (this._ledPattern) {
        outCtx.save();
        outCtx.globalCompositeOperation = "multiply";
        outCtx.globalAlpha = Math.min(0.9, 0.45 + w * 0.45);
        outCtx.fillStyle = this._ledPattern;
        outCtx.fillRect(0, 0, width, height);
        outCtx.restore();
        // Restore some brightness the lattice removes.
        outCtx.save();
        outCtx.globalCompositeOperation = "screen";
        outCtx.globalAlpha = w * 0.25;
        outCtx.drawImage(outCtx.canvas, 0, 0);
        outCtx.restore();
      }
      // Rolling refresh band: a bright horizontal band the camera catches scanning the panel.
      const bandH = Math.round(height * 0.12);
      const bandY = ((temporalSeconds * 0.35) % 1) * (height + bandH) - bandH;
      const grad = outCtx.createLinearGradient(0, bandY, 0, bandY + bandH);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(255,255,255,${(w * 0.12).toFixed(3)})`);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      outCtx.save();
      outCtx.globalCompositeOperation = "screen";
      outCtx.fillStyle = grad;
      outCtx.fillRect(0, bandY, width, bandH);
      outCtx.restore();
    }

    // ---- STN passive-matrix laptop LCD (PE 1.1.6): ordered dither to a tiny blue-grey
    // palette, milky low contrast, passive-matrix row/column crosstalk, and a directional
    // response ghost (subtle edge-echo on stills; trails on motion). ----
    const stnActive = stnDither > 0.001 || stnLevels >= 2 || stnTint > 0.001 || stnContrast > 0.001 || stnCrosstalk > 0.001;
    if (stnActive) {
      const img = outCtx.getImageData(0, 0, width, height);
      const d = img.data;
      const levels = stnLevels >= 2 ? stnLevels : 6;
      const step = 255 / (levels - 1);
      const lo = stnContrast * 54, hi = 255 - stnContrast * 64, span = (hi - lo) / 255;
      const rowBright = stnCrosstalk > 0.001 ? new Float32Array(height) : null;
      const colBright = stnCrosstalk > 0.001 ? new Float32Array(width) : null;
      for (let y = 0; y < height; y++) {
        const by = y & 3;
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          let r = d[i], g = d[i + 1], b = d[i + 2];
          // Milky floor/ceiling: STN cells never reach true black or white.
          if (stnContrast > 0.001) { r = lo + r * span; g = lo + g * span; b = lo + b * span; }
          // STN fluid cast: collapse chroma toward a blue-grey ramp of the luma.
          if (stnTint > 0.001) {
            const l = r * 0.299 + g * 0.587 + b * 0.114;
            const tt = stnTint * 0.7;
            r = r * (1 - tt) + l * 0.90 * tt;
            g = g * (1 - tt) + l * 0.96 * tt;
            b = b * (1 - tt) + l * 1.10 * tt;
          }
          // Ordered (Bayer 4x4) dither into the quantized palette.
          const th = ((BAYER4[by][x & 3] + 0.5) / 16 - 0.5) * step * (0.25 + stnDither * 0.9);
          r = Math.round(Math.max(0, Math.min(255, r + th)) / step) * step;
          g = Math.round(Math.max(0, Math.min(255, g + th)) / step) * step;
          b = Math.round(Math.max(0, Math.min(255, b + th)) / step) * step;
          d[i] = r; d[i + 1] = g; d[i + 2] = b;
          if (rowBright) {
            const lum = r * 0.299 + g * 0.587 + b * 0.114;
            if (lum > 170) { rowBright[y] += 1; colBright[x] += 1; }
          }
        }
      }
      // Passive-matrix crosstalk: rows/columns holding strong cells shadow their whole line.
      if (rowBright) {
        for (let y = 0; y < height; y++) rowBright[y] /= width;
        for (let x = 0; x < width; x++) colBright[x] /= height;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const shade = (rowBright[y] * 0.6 + colBright[x] * 0.4) * stnCrosstalk * 26;
            d[i] -= shade; d[i + 1] -= shade; d[i + 2] -= shade;
          }
        }
      }
      outCtx.putImageData(img, 0, 0);
      // Response ghost: a faint darker echo displaced along stnGhostDir (edge-echo on a
      // still; on motion each frame's echo reads as the classic cursor smear).
      if (stnGhostTrail > 0.001) {
        const rad = (stnGhostDir * Math.PI) / 180;
        const dist = 3 + stnGhostTrail * 5;
        this.ensureCanvasSize(this.tempCanvas, width, height);
        this.tempCtx.clearRect(0, 0, width, height);
        this.tempCtx.drawImage(outCtx.canvas, 0, 0);
        outCtx.save();
        outCtx.globalCompositeOperation = "darken";
        outCtx.globalAlpha = Math.min(0.45, stnGhostTrail * 0.35);
        outCtx.drawImage(this.tempCanvas, Math.round(Math.cos(rad) * dist), Math.round(Math.sin(rad) * dist));
        outCtx.restore();
      }
    }

    // ---- E-Ink / EPD reader (PE 1.1.6): reflective matte paper — warm-grey white point,
    // quantized greys, microcapsule grain, and a faint dark-neutral refresh-ghost of
    // offset content. No glow, ever (reflective, not emissive). ----
    if (einkGrey > 0.001) {
      const img = outCtx.getImageData(0, 0, width, height);
      const d = img.data;
      const levels = einkLevels >= 2 ? einkLevels : 16;
      const step = 255 / (levels - 1);
      // Paper ramp: warm near-black ink -> warm paper white (never blue-white).
      const inkR = 30, inkG = 28, inkB = 26, papR = 238, papG = 234, papB = 222;
      for (let y = 0; y < height; y++) {
        const by = y & 3;
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          let l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
          // Microcapsule grain: STATIC spatial noise (paper texture), not temporal shimmer.
          if (einkDither > 0.001) {
            const noise = (seededNoise(x, y, 977) - 0.5) * einkDither * 26
              + ((BAYER4[by][x & 3] + 0.5) / 16 - 0.5) * step * einkDither * 0.8;
            l += noise;
          }
          l = Math.round(Math.max(0, Math.min(255, l)) / step) * step;
          const ln = l / 255;
          d[i] = d[i] * (1 - einkGrey) + (inkR + ln * (papR - inkR)) * einkGrey;
          d[i + 1] = d[i + 1] * (1 - einkGrey) + (inkG + ln * (papG - inkG)) * einkGrey;
          d[i + 2] = d[i + 2] * (1 - einkGrey) + (inkB + ln * (papB - inkB)) * einkGrey;
        }
      }
      outCtx.putImageData(img, 0, 0);
      // Refresh ghost: faint dark-neutral residue of OFFSET content, full-frame, multiply —
      // recreates the previous-page echo (copy honesty rule: "recreates the residue",
      // never "shows your last page").
      if (einkGhost > 0.001) {
        this.ensureCanvasSize(this.tempCanvas, width, height);
        this.tempCtx.clearRect(0, 0, width, height);
        this.tempCtx.filter = "grayscale(1) contrast(1.5) brightness(1.45)";
        this.tempCtx.drawImage(outCtx.canvas, 0, 0);
        this.tempCtx.filter = "none";
        outCtx.save();
        outCtx.globalCompositeOperation = "multiply";
        outCtx.globalAlpha = Math.min(0.4, einkGhost * 0.3);
        outCtx.drawImage(this.tempCanvas, Math.round(width * 0.012), Math.round(height * 0.02));
        outCtx.restore();
      }
      // Optional full-refresh flash: one inverted frame every few seconds (video, opt-in).
      if (einkFlash > 0.001 && fps > 0) {
        const period = 3.5;
        if ((temporalSeconds % period) < (1 / fps)) {
          outCtx.save();
          outCtx.globalCompositeOperation = "difference";
          outCtx.globalAlpha = einkFlash;
          outCtx.fillStyle = "#fff";
          outCtx.fillRect(0, 0, width, height);
          outCtx.restore();
        }
      }
    }

    // ---- Reflective handheld "DMG green" LCD (PE 1.1.6): 4-shade olive-green ramp,
    // chunky pixels with a visible gap grid, and the reflective (unbacklit) diagonal
    // ambient shadow. Distinct from the generic Retro Pixel LCD by green + reflectivity. ----
    if (dmgGreen > 0.001) {
      // Chunky downsample FIRST so the 4-shade quantize happens on fat pixels.
      const block = dmgPixelate > 0.001 ? Math.max(2, Math.round(2 + dmgPixelate * 7)) : 1;
      if (block > 1) {
        const sw = Math.max(16, Math.round(width / block));
        const sh = Math.max(16, Math.round(height / block));
        this.ensureCanvasSize(this.tempCanvas, sw, sh);
        this.tempCtx.imageSmoothingEnabled = true;
        this.tempCtx.imageSmoothingQuality = "high";
        this.tempCtx.clearRect(0, 0, sw, sh);
        this.tempCtx.drawImage(outCtx.canvas, 0, 0, sw, sh);
        outCtx.save();
        outCtx.imageSmoothingEnabled = false; // nearest-neighbour = hard chunky pixels
        outCtx.drawImage(this.tempCanvas, 0, 0, sw, sh, 0, 0, width, height);
        outCtx.restore();
      }
      const img = outCtx.getImageData(0, 0, width, height);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        const shade = DMG_RAMP[Math.min(3, Math.floor(l / 64))];
        d[i] = d[i] * (1 - dmgGreen) + shade[0] * dmgGreen;
        d[i + 1] = d[i + 1] * (1 - dmgGreen) + shade[1] * dmgGreen;
        d[i + 2] = d[i + 2] * (1 - dmgGreen) + shade[2] * dmgGreen;
      }
      outCtx.putImageData(img, 0, 0);
      // Pixel-gap grid over the chunky blocks.
      if (block > 1) {
        if (this._dmgGridKey !== block) {
          const tile = document.createElement("canvas");
          tile.width = block; tile.height = block;
          const gctx = tile.getContext("2d");
          gctx.fillStyle = "#fff"; gctx.fillRect(0, 0, block, block);
          gctx.fillStyle = "#c8d4c0";
          gctx.fillRect(block - 1, 0, 1, block);
          gctx.fillRect(0, block - 1, block, 1);
          this._dmgGrid = tile; this._dmgGridKey = block;
          this._dmgGridPattern = outCtx.createPattern(tile, "repeat");
        }
        if (this._dmgGridPattern) {
          outCtx.save();
          outCtx.globalCompositeOperation = "multiply";
          outCtx.globalAlpha = Math.min(0.85, (0.3 + dmgPixelate * 0.4) * dmgGreen);
          outCtx.fillStyle = this._dmgGridPattern;
          outCtx.fillRect(0, 0, width, height);
          outCtx.restore();
        }
      }
      // Light directional response blur (edge softness of the slow LCD).
      if (dmgGhost > 0.001) {
        this.ensureCanvasSize(this.tempCanvas, width, height);
        this.tempCtx.imageSmoothingEnabled = true;
        this.tempCtx.clearRect(0, 0, width, height);
        this.tempCtx.drawImage(outCtx.canvas, 0, 0);
        outCtx.save();
        outCtx.globalCompositeOperation = "darken";
        outCtx.globalAlpha = Math.min(0.35, dmgGhost * 0.3);
        outCtx.drawImage(this.tempCanvas, Math.max(1, Math.round(1 + dmgGhost * 2)), 0);
        outCtx.restore();
      }
      // Reflective ambient shadow: no backlight — luminance falls off along the shadow
      // angle like a screen lit from one side of the room.
      if (dmgReflectiveShadow > 0.001) {
        const rad = (dmgShadowAngle * Math.PI) / 180;
        const dx = Math.cos(rad), dy = Math.sin(rad);
        const cx = width / 2, cy = height / 2, ext = Math.max(width, height) * 0.72;
        const grad = outCtx.createLinearGradient(cx - dx * ext, cy - dy * ext, cx + dx * ext, cy + dy * ext);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.55, "rgba(0,0,0,0)");
        grad.addColorStop(1, `rgba(18,30,16,${Math.min(0.6, dmgReflectiveShadow * 0.55).toFixed(3)})`);
        outCtx.save();
        outCtx.fillStyle = grad;
        outCtx.fillRect(0, 0, width, height);
        outCtx.restore();
      }
    }

    // ---- CRT front projector, tri-tube (PE 1.1.6): RADIAL per-channel convergence splay
    // (zero at the sweet-spot, growing toward corners — a pure per-channel scale about the
    // convergence centre), lens focus falloff at the edges, screen-gain bloom, lifted blacks. ----
    if (crtProjConvergence > 0.001 || crtProjEdgeSoftness > 0.001 || crtProjBloom > 0.001 || crtProjBlackLift > 0.001) {
      const pcx = crtProjCenterX * width, pcy = crtProjCenterY * height;
      if (crtProjConvergence > 0.001) {
        // R scaled up / B scaled down about the sweet-spot: displacement is exactly radial
        // and proportional to distance (0px at centre, max at corners). G anchors geometry.
        const k = crtProjConvergence * 0.009;
        if (!this._projCanvas) {
          this._projCanvas = document.createElement("canvas");
          this._projCtx = this._projCanvas.getContext("2d");
          this._projChan = document.createElement("canvas");
          this._projChanCtx = this._projChan.getContext("2d");
        }
        this.ensureCanvasSize(this._projCanvas, width, height);
        this.ensureCanvasSize(this._projChan, width, height);
        const pctx = this._projCtx, cctx = this._projChanCtx;
        pctx.save();
        pctx.globalCompositeOperation = "source-over";
        pctx.fillStyle = "#000"; pctx.fillRect(0, 0, width, height);
        const CHANNELS = [["#f00", 1 + k], ["#0f0", 1], ["#00f", 1 - k]];
        for (const [color, scale] of CHANNELS) {
          cctx.save();
          cctx.globalCompositeOperation = "source-over";
          cctx.drawImage(outCtx.canvas, 0, 0);
          cctx.globalCompositeOperation = "multiply";
          cctx.fillStyle = color; cctx.fillRect(0, 0, width, height);
          cctx.restore();
          pctx.globalCompositeOperation = "lighter";
          pctx.setTransform(scale, 0, 0, scale, pcx * (1 - scale), pcy * (1 - scale));
          pctx.imageSmoothingEnabled = true; pctx.imageSmoothingQuality = "high";
          pctx.drawImage(this._projChan, 0, 0);
          pctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        pctx.restore();
        outCtx.drawImage(this._projCanvas, 0, 0);
      }
      // Projection-lens focus falloff: blurred copy masked to the edges only.
      if (crtProjEdgeSoftness > 0.001) {
        this.ensureCanvasSize(this.tempCanvas, width, height);
        const sctx = this.tempCtx;
        sctx.save();
        sctx.globalCompositeOperation = "source-over";
        sctx.clearRect(0, 0, width, height);
        sctx.filter = `blur(${(1.5 + crtProjEdgeSoftness * 5).toFixed(2)}px)`;
        sctx.drawImage(outCtx.canvas, 0, 0);
        sctx.filter = "none";
        sctx.globalCompositeOperation = "destination-in";
        const mgrad = sctx.createRadialGradient(pcx, pcy, Math.min(width, height) * 0.22, pcx, pcy, Math.max(width, height) * 0.7);
        mgrad.addColorStop(0, "rgba(0,0,0,0)");
        mgrad.addColorStop(1, `rgba(0,0,0,${Math.min(1, 0.35 + crtProjEdgeSoftness * 0.65).toFixed(3)})`);
        sctx.fillStyle = mgrad; sctx.fillRect(0, 0, width, height);
        sctx.restore();
        outCtx.drawImage(this.tempCanvas, 0, 0);
      }
      // Screen-gain bloom: highlights halate on the projection screen.
      if (crtProjBloom > 0.001) {
        outCtx.save();
        outCtx.globalCompositeOperation = "screen";
        outCtx.globalAlpha = crtProjBloom * 0.45;
        outCtx.filter = `blur(${(2 + crtProjBloom * 8).toFixed(2)}px) brightness(1.25)`;
        outCtx.drawImage(outCtx.canvas, 0, 0);
        outCtx.restore();
      }
      // Lit-room contrast: projected blacks are only as dark as the screen.
      if (crtProjBlackLift > 0.001) {
        const lift = Math.round(crtProjBlackLift * 58);
        outCtx.save();
        outCtx.globalCompositeOperation = "lighten";
        outCtx.fillStyle = `rgb(${lift},${lift},${lift})`;
        outCtx.fillRect(0, 0, width, height);
        outCtx.restore();
      }
    }

    // ---- DLP single-chip projector (PE 1.1.6): colour-wheel rainbow — an R->G->B
    // sequential fringe trailing off BRIGHT-ON-DARK edges only (never a global split) —
    // plus the fine inter-mirror screen-door and micromirror mid-tone shimmer. ----
    if (dlpRainbow > 0.001 || dlpScreenDoor > 0.001 || dlpDither > 0.001) {
      if (dlpRainbow > 0.001) {
        const thr = dlpRainbowThreshold * 255;
        if (!this._dlpMask) {
          this._dlpMask = document.createElement("canvas");
          this._dlpMaskCtx = this._dlpMask.getContext("2d");
          this._dlpFringe = document.createElement("canvas");
          this._dlpFringeCtx = this._dlpFringe.getContext("2d");
          this._dlpChan = document.createElement("canvas");
          this._dlpChanCtx = this._dlpChan.getContext("2d");
        }
        this.ensureCanvasSize(this._dlpMask, width, height);
        this.ensureCanvasSize(this._dlpFringe, width, height);
        this.ensureCanvasSize(this._dlpChan, width, height);
        // Bright mask: only pixels above the luma gate (the colour-wheel tell needs
        // bright-on-dark; mid-tone edges never fringe).
        const src = outCtx.getImageData(0, 0, width, height);
        const sd = src.data;
        const mask = this._dlpMaskCtx.createImageData(width, height);
        const md = mask.data;
        for (let i = 0; i < sd.length; i += 4) {
          const l = sd[i] * 0.299 + sd[i + 1] * 0.587 + sd[i + 2] * 0.114;
          if (l > thr) { md[i] = 255; md[i + 1] = 255; md[i + 2] = 255; md[i + 3] = 255; }
        }
        this._dlpMaskCtx.putImageData(mask, 0, 0);
        // Sequential fringe: R, G, B copies of the mask at increasing trail offsets,
        // additive, then punch out the source-bright region so only the TRAIL remains.
        const fctx = this._dlpFringeCtx;
        fctx.save();
        fctx.globalCompositeOperation = "source-over";
        fctx.clearRect(0, 0, width, height);
        const dstep = Math.max(1, Math.round(1.5 + dlpRainbow * 3.5));
        const SEQ = [["#f00", dstep], ["#0f0", dstep * 2], ["#00f", dstep * 3]];
        for (const [color, off] of SEQ) {
          const cctx = this._dlpChanCtx;
          cctx.save();
          cctx.globalCompositeOperation = "source-over";
          cctx.clearRect(0, 0, width, height);
          cctx.drawImage(this._dlpMask, 0, 0);
          cctx.globalCompositeOperation = "source-in";
          cctx.fillStyle = color; cctx.fillRect(0, 0, width, height);
          cctx.restore();
          fctx.globalCompositeOperation = "lighter";
          fctx.drawImage(this._dlpChan, off, 0);
        }
        fctx.globalCompositeOperation = "destination-out";
        fctx.drawImage(this._dlpMask, 0, 0);
        fctx.restore();
        outCtx.save();
        outCtx.globalCompositeOperation = "screen";
        outCtx.globalAlpha = Math.min(0.75, dlpRainbow * 0.55);
        outCtx.drawImage(this._dlpFringe, 0, 0);
        outCtx.restore();
      }
      // Fine inter-mirror lattice: lower duty-cycle (thinner gaps) than an LCD grid.
      if (dlpScreenDoor > 0.001) {
        const cell = 3;
        if (this._dlpDoorKey !== cell) {
          const tile = document.createElement("canvas");
          tile.width = cell; tile.height = cell;
          const gctx = tile.getContext("2d");
          gctx.fillStyle = "#fff"; gctx.fillRect(0, 0, cell, cell);
          gctx.fillStyle = "#b8b8b8";
          gctx.fillRect(cell - 1, 0, 1, cell);
          gctx.fillRect(0, cell - 1, cell, 1);
          this._dlpDoor = tile; this._dlpDoorKey = cell;
          this._dlpDoorPattern = outCtx.createPattern(tile, "repeat");
        }
        if (this._dlpDoorPattern) {
          outCtx.save();
          outCtx.globalCompositeOperation = "multiply";
          outCtx.globalAlpha = Math.min(0.7, 0.2 + dlpScreenDoor * 0.4);
          outCtx.fillStyle = this._dlpDoorPattern;
          outCtx.fillRect(0, 0, width, height);
          outCtx.restore();
          outCtx.save();
          outCtx.globalCompositeOperation = "screen";
          outCtx.globalAlpha = dlpScreenDoor * 0.15;
          outCtx.drawImage(outCtx.canvas, 0, 0);
          outCtx.restore();
        }
      }
      // Micromirror temporal dither: a faint shimmer strongest in the mid-tones.
      if (dlpDither > 0.001) {
        const img = outCtx.getImageData(0, 0, width, height);
        const d = img.data;
        const amp = dlpDither * 10;
        const fseed = (temporalFrame % 4) * 131;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            const mid = 1 - Math.abs(l - 128) / 128; // 1 at mid-tones, 0 at extremes
            if (mid <= 0.05) continue;
            const nz = (seededNoise(x, y, 401 + fseed) - 0.5) * amp * mid;
            d[i] += nz; d[i + 1] += nz; d[i + 2] += nz;
          }
        }
        outCtx.putImageData(img, 0, 0);
      }
    }

    // ---- Lens/optics vignette (independent of tube curvature) ----
    if (vignetteAmt > 0.001) {
      const cx = width * 0.5, cy = height * 0.5;
      const grad = outCtx.createRadialGradient(cx, cy, Math.min(width, height) * 0.32, cx, cy, Math.max(width, height) * 0.62);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${Math.min(0.7, vignetteAmt * 0.7).toFixed(3)})`);
      outCtx.fillStyle = grad; outCtx.fillRect(0, 0, width, height);
    }

    // ---- 2" Quadruplex "venetian-blind" banding: periodic horizontal luminance
    // bands from the four-head segment switching, slowly drifting up the frame. ----
    if (bandingHorizontal > 0.001) {
      const bands = 14;
      const bandH = height / bands;
      const drift = (temporalSeconds * 0.5) % 1;
      outCtx.save(); outCtx.globalCompositeOperation = "multiply";
      for (let bi = 0; bi < bands + 1; bi++) {
        const yy = (bi - drift) * bandH;
        const a = bandingHorizontal * 0.24 * (0.5 + 0.5 * Math.sin(bi * 1.7));
        outCtx.fillStyle = `rgba(0,0,0,${Math.max(0, a).toFixed(3)})`;
        outCtx.fillRect(0, yy, width, bandH * 0.55);
      }
      outCtx.restore();
    }

    // ---- PAL Hanover bars: uncorrected half-line chroma phase error makes
    // alternate scan lines drift toward complementary hues (venetian-blind colour). ----
    if (hanoverBars > 0.001) {
      const img = outCtx.getImageData(0, 0, width, height);
      const d = img.data;
      const amt = hanoverBars * 20;
      for (let y = 0; y < height; y++) {
        const s = (y & 1) ? 1 : -1;
        const row = y * width * 4;
        for (let x = 0; x < width; x++) {
          const i = row + x * 4;
          d[i] = Math.max(0, Math.min(255, d[i] + s * amt * 0.5));
          d[i + 1] = Math.max(0, Math.min(255, d[i + 1] - s * amt));
          d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + s * amt * 0.5));
        }
      }
      outCtx.putImageData(img, 0, 0);
    }

    // ---- Sync-suppression scrambling: real cable scrambling suppresses the
    // horizontal sync pulse so the TV cannot lock; the picture tears and rolls.
    // Three interlocking effects modelled here:
    //   1. Horizontal tearing: seeded per-band random scanline horizontal shift
    //      (different bands offset by different amounts, rapidly changing).
    //   2. Rolling: the whole image scrolls vertically (sync pulse interval varies).
    //   3. Luma suppression / inversion bands: some horizontal bands have their
    //      luma crushed or partially inverted (suppressed-carrier artefact).
    // All randomness via seededNoise keyed on temporalFrame + y — deterministic. ----
    if (syncSuppression > 0.01) {
      // --- Pass 1: horizontal tearing per-band ---
      // Snapshot the current output, then re-draw each band with a horizontal offset.
      this.ensureCanvasSize(this.tempCanvas, width, height);
      const tearCtx = this.tempCtx;
      tearCtx.clearRect(0, 0, width, height);
      tearCtx.drawImage(outCtx.canvas, 0, 0);
      // Rolling: the whole picture slides down by a time-varying fraction of height.
      // In sync-suppressed TV the vertical sync is also lost, so the picture rolls.
      const rollPx = Math.round(((temporalFrame * (0.3 + syncSuppression * 0.6)) % 1) * height);
      outCtx.clearRect(0, 0, width, height);
      // Draw wrapped roll: draw [rollPx..height] at top, then [0..rollPx] below.
      if (rollPx > 0) {
        outCtx.drawImage(this.tempCanvas, 0, rollPx, width, height - rollPx, 0, 0, width, height - rollPx);
        outCtx.drawImage(this.tempCanvas, 0, 0, width, rollPx, 0, height - rollPx, width, rollPx);
      } else {
        outCtx.drawImage(this.tempCanvas, 0, 0);
      }
      // Horizontal band tearing: divide the image into seeded bands of ~8–20 lines
      // and shift each band by a random horizontal offset.
      const tearImg = outCtx.getImageData(0, 0, width, height);
      const tData = tearImg.data;
      const bandH = Math.max(6, Math.round(8 + (1 - syncSuppression) * 14));
      for (let band = 0; band < Math.ceil(height / bandH); band++) {
        const yStart = band * bandH;
        const yEnd = Math.min(height, yStart + bandH);
        // Per-band horizontal shift: higher syncSuppression → wider tears, faster.
        const tearNoise = seededNoise(band * 0.53, temporalFrame * (0.5 + syncSuppression), 37);
        const maxTear = Math.round(syncSuppression * width * 0.55);
        const tearX = Math.round((tearNoise - 0.5) * 2 * maxTear);
        if (tearX === 0) continue;
        for (let y = yStart; y < yEnd; y++) {
          const rowBase = y * width;
          for (let x = 0; x < width; x++) {
            const srcX = ((x - tearX) % width + width) % width;
            const si = (rowBase + srcX) * 4;
            const di = (rowBase + x) * 4;
            tData[di]     = tData[si];
            tData[di + 1] = tData[si + 1];
            tData[di + 2] = tData[si + 2];
          }
        }
      }
      // Luma suppression bands: in sync-suppressed video the blanking pedestal is
      // wrong, so some horizontal regions look crushed or partially inverted.
      const suppressBands = Math.max(1, Math.round(syncSuppression * 5));
      for (let sb = 0; sb < suppressBands; sb++) {
        const bandPos = seededNoise(sb * 1.7, temporalFrame * 0.13 + sb, 53);
        const bandTop = Math.floor(bandPos * height);
        const bandThickness = Math.floor((0.04 + syncSuppression * 0.12) * height);
        const invertStrength = syncSuppression * (0.4 + seededNoise(sb, temporalFrame * 0.07, 59) * 0.4);
        for (let y = bandTop; y < Math.min(height, bandTop + bandThickness); y++) {
          const rowBase = y * width;
          for (let x = 0; x < width; x++) {
            const i = (rowBase + x) * 4;
            const luma = 0.299 * tData[i] + 0.587 * tData[i + 1] + 0.114 * tData[i + 2];
            const invLuma = 255 - luma;
            tData[i]     = Math.max(0, Math.min(255, luma * (1 - invertStrength) + invLuma * invertStrength * 0.4));
            tData[i + 1] = Math.max(0, Math.min(255, luma * (1 - invertStrength) + invLuma * invertStrength * 0.4));
            tData[i + 2] = Math.max(0, Math.min(255, luma * (1 - invertStrength) + invLuma * invertStrength * 0.4));
          }
        }
      }
      outCtx.putImageData(tearImg, 0, 0);
    }
  }

  // Scene grade / colour pass (Stage A — capture signal). Operates on the given
  // context in place: brightness/contrast → film & sensor colour/tone → saturation/
  // gamma/temperature/tint → monochrome phosphor tint. The math is identical to the
  // historical inline grade; it was lifted into a method so the grade can run on the
  // SIGNAL buffer BEFORE the display optics (and before the OSD burn-in) rather than
  // last on the output — see render()'s two-stage structure. Reads params directly so
  // it has no dependency on render()'s local consts.
  renderGrade(outCtx, width, height, params, frameIndex = 0) {
    const brightness = Math.max(0.5, Math.min(1.5, Number(params.imageBrightness) || 1));
    const contrast = Math.max(0.5, Math.min(1.6, Number(params.imageContrast) || 1));
    const saturationRaw = Number(params.advancedSaturation);
    const saturation = Math.max(0, Math.min(3, Number.isFinite(saturationRaw) ? saturationRaw : 1));
    const gamma = Math.max(0.6, Math.min(1.8, Number(params.imageGamma) || 1));
    const temperature = Math.max(-1, Math.min(1, Number(params.imageTemperature) || 0));
    const tint = Math.max(-1, Math.min(1, Number(params.imageTint) || 0));
    const c01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
    const infraredFalseColor = c01(params.infraredFalseColor);
    const printFadeCyan = c01(params.printFadeCyan);
    const printFadeMagenta = c01(params.printFadeMagenta);
    const printFadeYellow = c01(params.printFadeYellow);
    const blackLevelCrush = c01(params.blackLevelCrush);
    const highlightRollOff = c01(params.highlightRollOff);
    const haze = c01(params.haze);
    // A-effect grade passes (moved into renderGrade by the Stage-A restructure).
    const polaroidCrossover = c01(params.polaroidCrossover);
    const nitrateDecay = c01(params.nitrateDecay);
    const technicolorFringe = c01(params.technicolorFringe);
    const irHotspot = c01(params.irHotspot);

    // Image grading — brightness & contrast via the fast canvas filter.
    if (Math.abs(brightness - 1) > 0.001 || Math.abs(contrast - 1) > 0.001) {
      outCtx.save(); outCtx.globalAlpha = 1;
      outCtx.filter = `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
      outCtx.drawImage(outCtx.canvas, 0, 0); outCtx.restore();
    }

    // ---- Film / sensor colour & tone pass (IR false-colour, print dye-fade,
    // black crush, highlight roll-off, atmospheric haze, Polaroid crossover).
    // One gated per-pixel loop; every term is a no-op at 0. ----
    if (infraredFalseColor > 0.001 || printFadeCyan > 0.001 || printFadeMagenta > 0.001 ||
        printFadeYellow > 0.001 || blackLevelCrush > 0.001 || highlightRollOff > 0.001 ||
        haze > 0.001 || polaroidCrossover > 0.001) {
      const image = outCtx.getImageData(0, 0, width, height);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        // Aerochrome IR false-colour (FIXED: stronger green→red/magenta remap).
        // Kodak Aerochrome: IR-reflective foliage maps to vivid RED/MAGENTA;
        // reds shift toward green; sky stays blue. Previous render was green→olive.
        if (infraredFalseColor > 0.001) {
          const r0 = r, g0 = g, b0 = b;
          const sky = Math.max(0, (b0 - Math.max(r0, g0)) / 255);
          const veg = Math.max(0, (g0 - Math.max(r0, b0)) / 255);
          const t = infraredFalseColor * (1 - sky * 0.75);
          // Full Aerochrome channel rotation: green → red, red → green, blue stays.
          // The strong magenta lift on vegetated (high-veg) pixels is the signature.
          const nr = g0 * 1.1 + veg * infraredFalseColor * 80;   // green → vivid red
          const ng = r0 * 0.45 + b0 * 0.15;                       // red → muted green
          const nb = b0 * 0.82 + r0 * 0.08;
          // Also add magenta/pink lift proportional to veg (foliage → pink in Aerochrome).
          r = r0 * (1 - t) + nr * t;
          g = g0 * (1 - t) + ng * t;
          b = b0 * (1 - t) + nb * t - veg * infraredFalseColor * 30 + sky * infraredFalseColor * 14;
        }
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (haze > 0.001) {
          const lift = haze * 0.28;
          r += (185 - r) * lift; g += (185 - g) * lift; b += (188 - b) * lift;
        }
        if (printFadeCyan > 0.001 || printFadeMagenta > 0.001 || printFadeYellow > 0.001) {
          const sh = Math.pow(1 - Math.min(1, luma / 255), 0.7);
          r += printFadeCyan * (16 + sh * 26);
          g += printFadeMagenta * (12 + sh * 20);
          b += printFadeYellow * (16 + sh * 26);
        }
        if (blackLevelCrush > 0.001) {
          const k = blackLevelCrush * 0.55 * Math.max(0, 1 - luma / 95);
          r -= r * k; g -= g * k; b -= b * k;
        }
        if (highlightRollOff > 0.001) {
          const knee = 205, soft = 1 + highlightRollOff * 2.2;
          if (r > knee) r = knee + (r - knee) / soft;
          if (g > knee) g = knee + (g - knee) / soft;
          if (b > knee) b = knee + (b - knee) / soft;
        }
        // Polaroid SX-70 colour crossover: SX-70 integral film has a greenish/
        // yellow cast in shadows that crosses over to a warmer pinkish tone in
        // highlights — characteristic of the integral dye chemistry.
        if (polaroidCrossover > 0.001) {
          const lumaFrac = Math.min(1, luma / 255);
          // Shadow regime (lumaFrac < 0.45): push green + yellow, desaturate slightly.
          const shadowW = Math.max(0, 1 - lumaFrac / 0.45);
          // Highlight regime (lumaFrac > 0.6): warm pinkish shift.
          const highlightW = Math.max(0, (lumaFrac - 0.6) / 0.4);
          const p = polaroidCrossover;
          r += shadowW  * p * (-8) + highlightW * p * 18;
          g += shadowW  * p * 14   + highlightW * p * (-4);
          b += shadowW  * p * (-18) + highlightW * p * (-10);
        }
        data[i] = Math.max(0, Math.min(255, r));
        data[i + 1] = Math.max(0, Math.min(255, g));
        data[i + 2] = Math.max(0, Math.min(255, b));
      }
      outCtx.putImageData(image, 0, 0);
    }

    // Saturation, gamma, temperature and tint as an authoritative per-pixel pass.
    if (Math.abs(saturation - 1) > 0.001 || Math.abs(gamma - 1) > 0.001 || Math.abs(temperature) > 0.001 || Math.abs(tint) > 0.001) {
      const image = outCtx.getImageData(0, 0, width, height);
      const data = image.data; const invGamma = 1 / gamma;
      const tempShift = temperature * 28; const tintShift = tint * 24;
      const applySat = Math.abs(saturation - 1) > 0.001;
      const applyGamma = Math.abs(gamma - 1) > 0.001;
      for (let i = 0; i < data.length; i += 4) {
        let r = data[i], g = data[i + 1], b = data[i + 2];
        if (applySat) {
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          r = luma + (r - luma) * saturation;
          g = luma + (g - luma) * saturation;
          b = luma + (b - luma) * saturation;
        }
        if (applyGamma) {
          r = Math.pow(Math.max(0, r) / 255, invGamma) * 255;
          g = Math.pow(Math.max(0, g) / 255, invGamma) * 255;
          b = Math.pow(Math.max(0, b) / 255, invGamma) * 255;
        }
        r += tempShift + tintShift * 0.33; g -= tintShift; b -= tempShift + tintShift * 0.33;
        data[i] = Math.max(0, Math.min(255, r)); data[i + 1] = Math.max(0, Math.min(255, g)); data[i + 2] = Math.max(0, Math.min(255, b));
      }
      outCtx.putImageData(image, 0, 0);
    }

    // ---- Monochrome phosphor tint (night-vision green, amber terminal, etc.) ----
    const monoTint = String(params.monochromeTint || "none");
    if (monoTint !== "none") {
      const TINTS = {
        green: [0.42, 1.0, 0.30],
        amber: [1.0, 0.72, 0.16],
        blue: [0.38, 0.6, 1.0],
        white: [1.0, 1.0, 1.0],
      };
      const col = TINTS[monoTint];
      if (col) {
        const strength = Math.max(0, Math.min(1, Number.isFinite(Number(params.monochromeTintStrength)) ? Number(params.monochromeTintStrength) : 1));
        const image = outCtx.getImageData(0, 0, width, height);
        const d = image.data;
        for (let i = 0; i < d.length; i += 4) {
          const luma = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
          d[i] = d[i] * (1 - strength) + luma * col[0] * strength;
          d[i + 1] = d[i + 1] * (1 - strength) + luma * col[1] * strength;
          d[i + 2] = d[i + 2] * (1 - strength) + luma * col[2] * strength;
        }
        outCtx.putImageData(image, 0, 0);
      }
    }

    // ---- Nitrate decay: chemical decomposition blotches, edge fogging,
    // and mottled emulsion damage — distinguishes Nitrate Newsreel from
    // generic B&W grain. All positions seeded on frameIndex so they drift
    // slowly per frame (chemistry is time-varying, not per-pixel static). ----
    if (nitrateDecay > 0.001) {
      // Radial chemical blotches: semi-transparent bright halos at seeded positions.
      const blotchCount = Math.max(2, Math.round(nitrateDecay * 9));
      for (let b = 0; b < blotchCount; b++) {
        const cx = seededNoise(b * 1.3, frameIndex * 0.07 + b * 0.41, 83) * width;
        const cy = seededNoise(b * 0.87, frameIndex * 0.11 + b * 0.53, 97) * height;
        const radius = (0.04 + seededNoise(b * 2.1, frameIndex * 0.05, 107) * 0.12) * Math.min(width, height);
        const alpha = nitrateDecay * (0.18 + seededNoise(b, frameIndex * 0.09, 113) * 0.22);
        const grad = outCtx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grad.addColorStop(0, `rgba(255,248,220,${Math.min(0.55, alpha).toFixed(3)})`);
        grad.addColorStop(0.5, `rgba(240,230,180,${Math.min(0.28, alpha * 0.5).toFixed(3)})`);
        grad.addColorStop(1, "rgba(200,190,150,0)");
        outCtx.save();
        outCtx.globalCompositeOperation = "screen";
        outCtx.fillStyle = grad;
        outCtx.fillRect(0, 0, width, height);
        outCtx.restore();
      }
      // Edge fogging: nitrate decomposes at the film edge first — bright fog band.
      const fogAlpha = nitrateDecay * 0.28;
      const fogGrad = outCtx.createLinearGradient(0, 0, width * 0.2, 0);
      fogGrad.addColorStop(0, `rgba(255,250,220,${Math.min(0.45, fogAlpha).toFixed(3)})`);
      fogGrad.addColorStop(1, "rgba(255,250,220,0)");
      outCtx.save(); outCtx.globalCompositeOperation = "screen";
      outCtx.fillStyle = fogGrad; outCtx.fillRect(0, 0, width, height);
      outCtx.restore();
      // Mottled emulsion damage: per-region noise-modulated brightness variation.
      outCtx.save(); outCtx.globalCompositeOperation = "multiply";
      outCtx.globalAlpha = nitrateDecay * 0.3;
      outCtx.filter = `blur(${Math.round(Math.min(width, height) * 0.015)}px) contrast(1.4) brightness(0.85)`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();
    }

    // ---- Technicolor 3-strip registration fringe: slight R/G/B mis-registration
    // (coloured edges at high-contrast boundaries). The 3-strip process printed each
    // colour record on a separate strip; slight dimensional misalignment = fringing.
    // Implemented as three faint offset copies of the image blended per-channel. ----
    if (technicolorFringe > 0.001) {
      const shift = Math.max(0.5, technicolorFringe * 2.8); // px mis-registration
      outCtx.save();
      outCtx.globalCompositeOperation = "screen";
      outCtx.globalAlpha = Math.min(0.28, technicolorFringe * 0.32);
      // Red record: shift right + slight up.
      outCtx.filter = "saturate(0) brightness(1.2)";
      outCtx.drawImage(outCtx.canvas, shift, -shift * 0.3);
      outCtx.restore();
      outCtx.save();
      outCtx.globalCompositeOperation = "multiply";
      outCtx.globalAlpha = Math.min(0.18, technicolorFringe * 0.22);
      // Cyan (blue+green) record: shift left.
      outCtx.filter = "hue-rotate(180deg) saturate(1.4) brightness(0.9)";
      outCtx.drawImage(outCtx.canvas, -shift * 0.7, shift * 0.2);
      outCtx.restore();
    }

    // ---- IR illuminator central hotspot: near-field IR-LED bloom with rapid
    // radial falloff. Ring doorbell / CCTV IR cameras overexpose the near field
    // (whitewash within ~1–2 metres) while the background stays dark. ----
    if (irHotspot > 0.001) {
      const cx = width * 0.5, cy = height * 0.5;
      const r0 = Math.min(width, height) * (0.08 + irHotspot * 0.10);
      const r1 = Math.min(width, height) * (0.35 + irHotspot * 0.20);
      const hotGrad = outCtx.createRadialGradient(cx, cy, r0, cx, cy, r1);
      hotGrad.addColorStop(0, `rgba(255,255,255,${Math.min(0.85, irHotspot * 0.9).toFixed(3)})`);
      hotGrad.addColorStop(0.4, `rgba(240,245,255,${Math.min(0.45, irHotspot * 0.5).toFixed(3)})`);
      hotGrad.addColorStop(1, "rgba(200,210,230,0)");
      outCtx.save();
      outCtx.globalCompositeOperation = "screen";
      outCtx.fillStyle = hotGrad;
      outCtx.fillRect(0, 0, width, height);
      outCtx.restore();
    }
  }

  renderOSD(outCtx, width, height, seconds, params, frameIndex, fps, renderOptions = {}) {
    const timestampOSD = Math.max(0, Math.min(1, Number(params.advancedTimestampOSD) || 0));
    if (timestampOSD < 0.01) return;

    const osdStyle = Math.max(0, Math.min(9, Math.round(Number(params.advancedOSDStyle) || 0)));
    const osdStartDate = Number.isFinite(Date.parse(renderOptions.osdStartDateTime || "")) 
      ? new Date(renderOptions.osdStartDateTime) 
      : new Date("1998-10-31T22:48:00");
    const osdCountWithExport = renderOptions.osdCountWithExport !== false;
    const frameSeconds = frameIndex / fps;
    const osdElapsedSeconds = osdCountWithExport ? Math.max(0, Number(renderOptions.osdElapsedSeconds ?? frameSeconds) || 0) : 0;
    const osdSeed = Number.isFinite(Number(renderOptions.osdSeed)) ? Number(renderOptions.osdSeed) : 104729;
    const osdPrimaryColor = renderOptions.osdPrimaryColor || "#ffa84a";
    const osdAccentColor = renderOptions.osdAccentColor || "#ff3a3a";
    const osdFontPreset = renderOptions.osdFontPreset || "vhs";
    const osdBloom = Math.max(0, Math.min(1, Number(renderOptions.osdBloom) || 0));
    const osdFontScale = Math.max(0.6, Math.min(2, Number(renderOptions.osdFontScale) || 1));
    const osdThickness = Math.max(0.5, Math.min(2, Number(renderOptions.osdThickness) || 1));
    
    // Corner config (flat format from original)
    const osdCornerConfig = {
      topLeft: { enabled: renderOptions.osdCornerTopLeftEnabled !== false, text: String(renderOptions.osdCornerTopLeftText || "").trim() || "CAM2" },
      topRight: { enabled: renderOptions.osdCornerTopRightEnabled !== false, text: String(renderOptions.osdCornerTopRightText || "").trim() || "CTFID CHANNEL3" },
      topCenter: { enabled: renderOptions.osdCornerTopCenterEnabled === true, text: String(renderOptions.osdCornerTopCenterText || "").trim() },
      bottomLeft: { enabled: renderOptions.osdCornerBottomLeftEnabled === true, text: String(renderOptions.osdCornerBottomLeftText || "").trim() },
      bottomRight: { enabled: renderOptions.osdCornerBottomRightEnabled === true, text: String(renderOptions.osdCornerBottomRightText || "").trim() },
      bottomCenter: { enabled: renderOptions.osdCornerBottomCenterEnabled === true, text: String(renderOptions.osdCornerBottomCenterText || "").trim() },
    };

    // HYBRID font plan. Analog/low-res eras (vhs, camcorder, cctv, hdzero*) are
    // drawn with PROCEDURAL bitmap glyphs (osdPixelFontPresets / drawPixelOSDText)
    // and never reach these CSS stacks. led / filmSegmentThin use the 7-segment
    // renderer. The digital eras use the two BUNDLED OFL faces:
    //   "LME Digital OSD"   = Share Tech Mono  (digicam / DSLR / phone menus / lcd)
    //   "LME Broadcast OSD" = Saira Condensed  (broadcast condensed grotesque)
    // (loaded via loadOSDFonts() before the first render and before each export).
    const osdFontByPreset = {
      vhs: '"LME Digital OSD", "VCR OSD Mono", "Lucida Console", "Courier New", monospace',
      camcorder: '"LME Digital OSD", "MS Gothic", "Small Fonts", "Tahoma", sans-serif',
      cctv: '"LME Digital OSD", "OCR A Std", "Consolas", "Lucida Console", monospace',
      broadcast: '"LME Broadcast OSD", "Arial Narrow", "Arial", sans-serif',
      hdzeroDefault: '"LME Digital OSD", "VCR OSD Mono", "Lucida Console", monospace',
      hdzeroConthrax: '"LME Digital OSD", "VCR OSD Mono", "Lucida Console", monospace',
      hdzeroVision: '"LME Digital OSD", "VCR OSD Mono", "Lucida Console", monospace',
      led: '"LME Digital OSD", "Digital-7 Mono", "DS-Digital", "Consolas", monospace',
      filmSegmentThin: '"LME Digital OSD", "Digital-7 Mono", "DS-Digital", "Consolas", monospace',
      lcd: '"LME Digital OSD", "MS Sans Serif", "Geneva", "Tahoma", sans-serif',
      modern: '"LME Digital OSD", "Inter", "Segoe UI", "Arial", sans-serif',
    };

    // Compute date/time
    const stampDate = new Date(osdStartDate.getTime());
    stampDate.setSeconds(stampDate.getSeconds() + Math.floor(osdElapsedSeconds));
    const mm = String(stampDate.getMonth() + 1).padStart(2, "0");
    const dd = String(stampDate.getDate()).padStart(2, "0");
    const yyyy = String(stampDate.getFullYear());
    const yy = yyyy.slice(-2);
    const hh = String(stampDate.getHours()).padStart(2, "0");
    const min = String(stampDate.getMinutes()).padStart(2, "0");
    const sec = String(stampDate.getSeconds()).padStart(2, "0");
    const stampClassic = `${mm}/${dd}/${yy} ${hh}:${min}:${sec}`;
    const stampIso = `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
    const stampDigital = `${dd}-${mm}-${yyyy} ${hh}:${min}:${sec}`;
    
    const temporalFrame = frameIndex;
    const temporalSeconds = seconds;
    const recBlink = seededNoise(Math.floor(temporalSeconds * 2), 0, 121) > 0.27;
    const timecodeFps = Math.max(1, Math.min(120, Math.round(Number(fps) || 30)));
    const frameCode = String(Math.min(timecodeFps - 1, Math.floor((temporalSeconds % 1) * timecodeFps))).padStart(2, "0");
    const canonicalTimecode = `${hh}:${min}:${sec}:${frameCode}`;
    const noisePulse = seededNoise(temporalFrame, temporalSeconds * 0.5, 127);
    const flickerAlpha = 0.32 + noisePulse * 0.52;
    const osdAlpha = Math.min(0.92, timestampOSD * flickerAlpha);
    
    const padX = Math.floor(width * 0.03);
    const padY = Math.floor(height * 0.95);
    const topY = Math.floor(height * 0.07);
    const rightX = Math.floor(width * 0.96);
    const baseSize = Math.max(11, Math.floor(height * (osdStyle === 3 ? 0.023 : 0.027) * osdFontScale));
    const fontFamily = osdFontByPreset[osdFontPreset] || osdFontByPreset.vhs;
    const hasPixelFont = Boolean(this.osdPixelFontPresets[osdFontPreset]);
    const hasSevenSegmentFont = osdFontPreset === "filmSegmentThin";

    const measureOsdWidth = (text) => {
      if (hasPixelFont) return this.getPixelOSDWidth(String(text), baseSize, osdFontPreset);
      if (hasSevenSegmentFont) return this.getSevenSegmentOSDWidth(String(text), baseSize, { gapScale: 0.18 });
      return outCtx.measureText(String(text)).width;
    };
    
    const drawOsdLine = (text, x, y, color = osdPrimaryColor) => {
      if (hasPixelFont) {
        const drawn = this.drawPixelOSDText(outCtx, String(text), x, y, baseSize, color, osdFontPreset, osdThickness);
        if (drawn) return;
      }
      if (hasSevenSegmentFont) {
        this.drawSevenSegmentOSDText(outCtx, String(text), x, y, baseSize, color, {
          glowColor: color, glowStrength: 0.4 + osdBloom * 0.8, weight: 0.09 * osdThickness, gapScale: 0.18,
        });
        return;
      }
      if (osdThickness > 0.55) {
        outCtx.lineWidth = Math.max(0.4, osdThickness * Math.max(0.8, baseSize * 0.04));
        outCtx.strokeStyle = "rgb(0 0 0 / 0.7)";
        outCtx.strokeText(String(text), x, y);
      }
      outCtx.fillStyle = color;
      outCtx.fillText(String(text), x, y);
    };

    outCtx.save();
    outCtx.font = `${baseSize}px ${fontFamily}`;
    outCtx.textBaseline = "bottom";
    outCtx.globalAlpha = osdAlpha;
    outCtx.shadowColor = osdBloom > 0.01 ? osdPrimaryColor : "rgb(0 0 0 / 0.6)";
    outCtx.shadowBlur = Math.max(0.5, baseSize * (0.06 + osdBloom * 0.42));
    outCtx.shadowOffsetX = Math.max(1, Math.floor(baseSize * 0.08));
    outCtx.shadowOffsetY = Math.max(1, Math.floor(baseSize * 0.08));

    if (osdStyle === 0) {
      drawOsdLine(stampClassic, padX, padY, osdPrimaryColor);
      drawOsdLine("SP", rightX - measureOsdWidth("SP"), topY, osdPrimaryColor);
      drawOsdLine("CH 03", padX, topY, osdPrimaryColor);
    } else if (osdStyle === 1) {
      drawOsdLine(stampDigital, padX, padY, "rgb(237 244 255)");
      if (recBlink) drawOsdLine("● REC", padX, topY, osdAccentColor);
      const batt = `${Math.max(5, Math.floor(92 - seededNoise(temporalSeconds, 3, 133) * 24))}%`;
      drawOsdLine(`BAT ${batt}`, rightX - measureOsdWidth(`BAT ${batt}`), topY, "rgb(237 244 255)");
    } else if (osdStyle === 2) {
      drawOsdLine(stampClassic, padX, padY, osdPrimaryColor);
      drawOsdLine("TBC", padX, topY, osdPrimaryColor);
      const zoomLabel = `Z${(1 + seededNoise(temporalSeconds, 8, 137) * 7).toFixed(1)}x`;
      drawOsdLine(zoomLabel, Math.floor(width * 0.44), topY, osdPrimaryColor);
      drawOsdLine("SP", rightX - measureOsdWidth("SP"), topY, osdPrimaryColor);
    } else if (osdStyle === 3) {
      const lineHeight = Math.max(12, Math.floor(baseSize * 1.18));
      drawOsdLine(stampIso, padX, padY, osdPrimaryColor);
      const camLabel = `CAM ${1 + Math.floor(seededNoise(osdSeed, 0.2, 149) * 8)}`;
      drawOsdLine(camLabel, rightX - measureOsdWidth(camLabel), topY, osdPrimaryColor);
      const status = recBlink ? "LIVE" : "MOTION";
      drawOsdLine(status, padX, topY, osdPrimaryColor);
      drawOsdLine(`GAIN ${Math.floor(8 + seededNoise(osdSeed, temporalSeconds * 0.15, 151) * 16)}dB`, padX, topY + lineHeight, osdPrimaryColor);
    } else if (osdStyle === 4) {
      const shotNum = `${Math.max(1, Math.floor(seededNoise(temporalFrame, 0.4, 171) * 999))}`.padStart(3, "0");
      drawOsdLine(stampDigital, padX, padY, "rgb(239 247 255)");
      drawOsdLine(`IMG_${yy}${mm}${dd}_${shotNum}`, padX, topY, "rgb(239 247 255)");
      drawOsdLine("FINE 5M", rightX - measureOsdWidth("FINE 5M"), topY, "rgb(239 247 255)");
    } else if (osdStyle === 5) {
      const filmDate = `${Number(dd)} ${Number(mm)} ${Number(yy)}`;
      const filmSize = Math.max(20, Math.floor(height * 0.048));
      outCtx.save();
      outCtx.globalAlpha = Math.min(1, osdAlpha * 1.25);
      this.drawSevenSegmentOSDText(outCtx, filmDate, padX, padY, filmSize, "rgb(255 184 92)", {
        glowColor: "rgb(255 90 18)", glowStrength: 1.1 + osdBloom * 0.8, weight: 0.09 * osdThickness, gapScale: 0.18,
      });
      outCtx.restore();
    } else if (osdStyle === 6) {
      const tcSep = recBlink ? ":" : ";";
      const policeTimecode = `${hh}${tcSep}${min}${tcSep}${sec}${tcSep}${frameCode}`;
      drawOsdLine(policeTimecode, padX, topY, "#f8f8f8");
      drawOsdLine(stampIso, padX, padY, "#f8f8f8");
      const unitLabel = `UNIT ${100 + Math.floor(seededNoise(osdSeed, 2.2, 177) * 900)}`;
      drawOsdLine(unitLabel, rightX - measureOsdWidth(unitLabel), topY, "#f8f8f8");
    } else if (osdStyle === 7 || osdStyle === 9) {
      const tokenMap = {
        "{date}": stampClassic.split(" ")[0],
        "{time}": `${hh}:${min}:${sec}`,
        "{datetime}": stampClassic,
        "{tc}": canonicalTimecode,
        "{frame}": String(Math.floor(temporalSeconds * timecodeFps)).padStart(6, "0"),
        "{fps}": String(timecodeFps),
      };
      const expandLabelTokens = (value) => String(value || "").replace(/\{date\}|\{time\}|\{datetime\}|\{tc\}|\{frame\}|\{fps\}/gi, (token) => tokenMap[token.toLowerCase()] || token);
      const drawCorner = (corner, fallbackText, x, y, align = "left") => {
        const cfg = osdCornerConfig[corner];
        if (!cfg?.enabled) return;
        const label = expandLabelTokens(cfg.text || fallbackText);
        if (!label) return;
        const lines = String(label).split(/\n|\|/).filter(Boolean);
        const lineHeight = Math.max(12, Math.floor(baseSize * 1.12));
        lines.forEach((line, index) => {
          const lineWidth = measureOsdWidth(line);
          const drawX = align === "right" ? x - lineWidth : align === "center" ? x - Math.floor(lineWidth * 0.5) : x;
          drawOsdLine(line, drawX, y + index * lineHeight, "#f5f5f5");
        });
      };
      drawCorner("topLeft", `CAM${1 + Math.floor(seededNoise(osdSeed, 2, 179) * 4)}`, padX, topY, "left");
      drawCorner("topCenter", "", Math.floor(width * 0.5), topY, "center");
      drawCorner("topRight", "CTFID\nCHANNEL3", rightX, topY, "right");
      drawCorner("bottomLeft", "", padX, padY, "left");
      drawCorner("bottomCenter", "", Math.floor(width * 0.5), padY, "center");
      drawCorner("bottomRight", "", rightX, padY, "right");
      if (osdStyle === 7) {
        const dropFrame = canonicalTimecode;
        const tcWidth = measureOsdWidth(dropFrame);
        const tcX = Math.floor((width - tcWidth) * 0.5);
        const tcBaseline = Math.floor(height * 0.95);
        const boxPadX = Math.max(5, Math.floor(baseSize * 0.35));
        const boxPadY = Math.max(3, Math.floor(baseSize * 0.25));
        outCtx.save();
        outCtx.globalAlpha = Math.min(1, osdAlpha * 1.15);
        outCtx.fillStyle = "rgb(0 0 0 / 0.82)";
        outCtx.fillRect(tcX - boxPadX, tcBaseline - baseSize - boxPadY, tcWidth + boxPadX * 2, baseSize + boxPadY * 2);
        outCtx.restore();
        drawOsdLine(dropFrame, tcX, tcBaseline, "#f5f5f5");
      }
    } else {
      const lineHeight = Math.max(12, Math.floor(baseSize * 1.18));
      drawOsdLine(stampIso, padX, padY, osdPrimaryColor);
      const camLabel = `CAM ${1 + Math.floor(seededNoise(7, temporalSeconds * 0.2, 149) * 8)}`;
      drawOsdLine(camLabel, rightX - measureOsdWidth(camLabel), topY, osdPrimaryColor);
      const status = recBlink ? "REC" : "MOTION";
      drawOsdLine(status, padX, topY, osdPrimaryColor);
      drawOsdLine(`H.265 ${Math.floor(1 + seededNoise(temporalFrame, 6, 181) * 3)}.0Mbps`, padX, topY + lineHeight, osdPrimaryColor);
    }

    outCtx.restore();
  }
}
