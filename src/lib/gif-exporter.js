/**
 * GIF exporter with full video source support.
 * Seeks video element frame-by-frame for actual animated output.
 */

import { saveBlob } from "./save-file.js";

function seekVideoToTime(video, time) {
  return new Promise((resolve) => {
    const hasRVFC = typeof video.requestVideoFrameCallback === "function";
    if (Math.abs(video.currentTime - time) < 0.0005 && video.readyState >= 2) {
      if (hasRVFC) video.requestVideoFrameCallback(() => resolve());
      else requestAnimationFrame(() => resolve());
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onSeeked = () => {
      if (hasRVFC) video.requestVideoFrameCallback(() => finish());
      else requestAnimationFrame(() => finish());
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

/**
 * @param {Object} options
 * @param {HTMLCanvasElement} options.canvas
 * @param {Object} options.renderer
 * @param {Object} options.params
 * @param {number} options.fps
 * @param {number} options.duration
 * @param {Function} options.onProgress
 * @param {number} [options.maxWidth=480]
 * @param {Function} [options.evaluateParams]
 * @param {HTMLVideoElement} [options.videoElement]
 * @param {number} [options.sourceScale=1]
 */
export async function exportGif({
  canvas, renderer, params, fps, duration, onProgress,
  maxWidth = 480, evaluateParams, videoElement, sourceScale = 1,
  renderOptions = {}, signal, fileName,
}) {
  const isVideoSource = videoElement instanceof HTMLVideoElement;

  const sourceWidth = isVideoSource ? videoElement.videoWidth : canvas.width;
  const sourceHeight = isVideoSource ? videoElement.videoHeight : canvas.height;

  const width = Math.min(sourceWidth, maxWidth);
  const scale = width / sourceWidth;
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const totalFrames = Math.max(1, Math.floor(duration * fps));
  const delay = Math.round(1000 / fps);

  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = sourceWidth;
  renderCanvas.height = sourceHeight;
  const renderCtx = renderCanvas.getContext("2d", { alpha: false });

  const gifCanvas = document.createElement("canvas");
  gifCanvas.width = width;
  gifCanvas.height = height;
  const gifCtx = gifCanvas.getContext("2d", { alpha: false });

  const wasPlaying = isVideoSource && !videoElement.paused;
  if (isVideoSource && wasPlaying) videoElement.pause();

  const frames = [];

  // Start from a clean temporal state for deterministic output.
  renderer.reset?.();

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) {
        const err = new Error("Export aborted");
        err.name = "AbortError";
        throw err;
      }
      const t = frame / fps;


      if (isVideoSource) {
        const seekTime = Math.min(t, videoElement.duration - 0.001);
        await seekVideoToTime(videoElement, seekTime);
        renderer.setImage(videoElement, sourceScale);
      }

      const frameParams = evaluateParams ? evaluateParams(t, params) : params;
      renderCtx.fillStyle = "#000";
      renderCtx.fillRect(0, 0, sourceWidth, sourceHeight);
      renderer.render(renderCtx, sourceWidth, sourceHeight, t, frameParams, frame, fps, renderOptions);

      gifCtx.fillStyle = "#000";
      gifCtx.fillRect(0, 0, width, height);
      gifCtx.drawImage(renderCanvas, 0, 0, width, height);

      frames.push(gifCtx.getImageData(0, 0, width, height));
      onProgress?.((frame + 1) / totalFrames, frame + 1, totalFrames);

      if (frame % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    const gifBytes = encodeGif(frames, width, height, delay);
    const blob = new Blob([gifBytes], { type: "image/gif" });
    await saveBlob(blob, fileName || `crt-export-${Date.now()}.gif`, { mimeType: "image/gif", extension: "gif", description: "GIF animation" });
    return blob;
  } finally {
    if (isVideoSource && wasPlaying) videoElement.play().catch(() => {});
  }
}

// ── Minimal GIF89a encoder ──

function encodeGif(frames, width, height, delay) {
  const buf = [];
  const write = (b) => buf.push(b);
  const writeStr = (s) => { for (let i = 0; i < s.length; i++) write(s.charCodeAt(i)); };
  const writeLE16 = (v) => { write(v & 0xFF); write((v >> 8) & 0xFF); };

  const { palette, indexedFrames } = quantizeFrames(frames, width, height);

  writeStr("GIF89a");
  writeLE16(width);
  writeLE16(height);
  write(0xF7);
  write(0);
  write(0);

  for (let i = 0; i < 256; i++) {
    write(palette[i * 3] || 0);
    write(palette[i * 3 + 1] || 0);
    write(palette[i * 3 + 2] || 0);
  }

  write(0x21); write(0xFF); write(11);
  writeStr("NETSCAPE2.0");
  write(3); write(1);
  writeLE16(0);
  write(0);

  for (let f = 0; f < indexedFrames.length; f++) {
    write(0x21); write(0xF9); write(4);
    write(0x00);
    writeLE16(Math.round(delay / 10));
    write(0);
    write(0);

    write(0x2C);
    writeLE16(0); writeLE16(0);
    writeLE16(width); writeLE16(height);
    write(0);

    const minCodeSize = 8;
    write(minCodeSize);
    const compressed = lzwEncode(indexedFrames[f], minCodeSize);
    let offset = 0;
    while (offset < compressed.length) {
      const blockSize = Math.min(255, compressed.length - offset);
      write(blockSize);
      for (let i = 0; i < blockSize; i++) write(compressed[offset + i]);
      offset += blockSize;
    }
    write(0);
  }

  write(0x3B);
  return new Uint8Array(buf);
}

function quantizeFrames(frames, width, height) {
  const palette = new Uint8Array(256 * 3);
  const allPixels = [];
  const step = Math.max(1, Math.floor(frames.length / 4));

  for (let f = 0; f < frames.length; f += step) {
    const data = frames[f].data;
    const pxStep = Math.max(1, Math.floor(data.length / (4 * 2000)));
    for (let i = 0; i < data.length; i += 4 * pxStep) {
      allPixels.push([data[i], data[i + 1], data[i + 2]]);
    }
  }

  const colorMap = new Map();
  for (const [r, g, b] of allPixels) {
    const key = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
    colorMap.set(key, [r, g, b]);
  }

  const uniqueColors = Array.from(colorMap.values()).slice(0, 256);
  for (let i = 0; i < uniqueColors.length; i++) {
    palette[i * 3] = uniqueColors[i][0];
    palette[i * 3 + 1] = uniqueColors[i][1];
    palette[i * 3 + 2] = uniqueColors[i][2];
  }

  const indexedFrames = frames.map(frame => {
    const data = frame.data;
    const indexed = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < uniqueColors.length; c++) {
        const dr = r - palette[c * 3];
        const dg = g - palette[c * 3 + 1];
        const db = b - palette[c * 3 + 2];
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) { bestDist = dist; best = c; }
        if (dist === 0) break;
      }
      indexed[i] = best;
    }
    return indexed;
  });

  return { palette, indexedFrames };
}

function lzwEncode(indexedPixels, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  const output = [];
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const maxCode = 4096;

  const dict = new Map();
  for (let i = 0; i < clearCode; i++) dict.set(String(i), i);

  let bits = 0;
  let bitCount = 0;

  function writeBits(code, size) {
    bits |= (code << bitCount);
    bitCount += size;
    while (bitCount >= 8) {
      output.push(bits & 0xFF);
      bits >>= 8;
      bitCount -= 8;
    }
  }

  writeBits(clearCode, codeSize);

  let w = String(indexedPixels[0]);
  for (let i = 1; i < indexedPixels.length; i++) {
    const k = String(indexedPixels[i]);
    const wk = w + "," + k;
    if (dict.has(wk)) {
      w = wk;
    } else {
      writeBits(dict.get(w), codeSize);
      if (nextCode < maxCode) {
        dict.set(wk, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        writeBits(clearCode, codeSize);
        dict.clear();
        for (let j = 0; j < clearCode; j++) dict.set(String(j), j);
        codeSize = minCodeSize + 1;
        nextCode = eoiCode + 1;
      }
      w = k;
    }
  }

  writeBits(dict.get(w), codeSize);
  writeBits(eoiCode, codeSize);

  if (bitCount > 0) output.push(bits & 0xFF);

  return output;
}
