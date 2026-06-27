// ---------------------------------------------------------------------------
// Export engine
//
// Deterministic, frame-stepped video export built on the WebCodecs VideoEncoder
// with hardware acceleration (VideoToolbox on Apple Silicon) and locally
// bundled muxers. Design goals, in the spirit of a pro encoder:
//
//   • Offline & self-contained — muxers are bundled, never fetched at runtime.
//   • Frame-accurate & deterministic — every output frame is rendered explicitly
//     (no real-time capture / dropped frames); exact duration and frame count.
//   • Hardware first — probe VideoEncoder.isConfigSupported() and prefer the
//     hardware encoder, transparently falling back to software, then codecs,
//     then (last resort) a real-time MediaRecorder capture.
//   • Honest progress, cancellation, and cleanup on every path.
//
// Public API (unchanged): getVideoExportCapabilities, isMp4ExportAvailable,
// exportMp4, exportWebm.
// ---------------------------------------------------------------------------

import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from "mp4-muxer";
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from "webm-muxer";
import { saveBlob } from "./save-file.js";
import { computeExportSize } from "./export-size";

/**
 * Feature-detect the export encoders available in this runtime.
 * @returns {{ mp4: boolean, webm: boolean, webmRealtime: boolean }}
 */
export function getVideoExportCapabilities() {
  const hasWebCodecs =
    typeof window !== "undefined" && "VideoEncoder" in window && "VideoFrame" in window;
  let webmRealtime = false;
  try {
    webmRealtime =
      typeof window !== "undefined" &&
      typeof window.MediaRecorder === "function" &&
      typeof HTMLCanvasElement !== "undefined" &&
      typeof HTMLCanvasElement.prototype.captureStream === "function" &&
      (MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ||
        MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ||
        MediaRecorder.isTypeSupported("video/webm"));
  } catch {
    webmRealtime = false;
  }
  return { mp4: hasWebCodecs, webm: hasWebCodecs || webmRealtime, webmRealtime };
}

/** True when the WebCodecs MP4 path can run. */
export function isMp4ExportAvailable() {
  return getVideoExportCapabilities().mp4;
}

// --------------------------------------------------------------------------
// Small helpers
// --------------------------------------------------------------------------

function downloadBlob(blob, filename) {
  // In the desktop shell this anchor-download is intercepted by the main
  // process and routed through a native Save panel (see electron/main.cjs).
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Seek a video element and resolve once the target frame is actually presented,
 * so the canvas reads fresh pixels (no duplicate/stale frames). Watchdog-guarded
 * so a missing frame callback can never stall an export.
 */
function seekVideoToTime(video, time) {
  return new Promise((resolve) => {
    const hasRVFC = typeof video.requestVideoFrameCallback === "function";
    let settled = false;
    let watchdog = 0;
    const onSeeked = () => present();
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const present = () => requestAnimationFrame(() => finish());
    watchdog = setTimeout(finish, 500);
    if (Math.abs(video.currentTime - time) < 0.0005 && video.readyState >= 2) {
      present();
      return;
    }
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

/**
 * Choose a supported VideoEncoder config from a list of codec candidates,
 * preferring hardware acceleration and degrading gracefully:
 *   prefer-hardware → prefer-software → no-preference, across each codec.
 * @returns {Promise<{config: VideoEncoderConfig, hardware: boolean}>}
 */
async function pickSupportedConfig(codecCandidates, base) {
  if (typeof VideoEncoder?.isConfigSupported !== "function") {
    // Old runtime without the probe API — assume the first candidate works.
    return { config: { ...base, codec: codecCandidates[0] }, hardware: false };
  }
  const accelerations = ["prefer-hardware", "prefer-software", "no-preference"];
  let lastError = null;
  for (const acceleration of accelerations) {
    for (const codec of codecCandidates) {
      const config = { ...base, codec, hardwareAcceleration: acceleration };
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (support?.supported) {
          return { config: support.config || config, hardware: acceleration === "prefer-hardware" };
        }
      } catch (e) {
        lastError = e;
      }
    }
  }
  throw new Error(
    `No supported encoder configuration for ${codecCandidates.join(", ")}` +
      (lastError ? ` (${lastError.message})` : "")
  );
}

// H.264 High-profile codec strings, highest level first. The level caps
// resolution×fps; we let isConfigSupported pick the first the encoder accepts.
function h264Candidates() {
  return ["avc1.640034", "avc1.640033", "avc1.640032", "avc1.64002A", "avc1.640028", "avc1.42E01F"];
}

// --------------------------------------------------------------------------
// Audio (AAC) — extracted from the source and muxed alongside the video.
// --------------------------------------------------------------------------

async function extractAudioBuffer(videoElement) {
  const src = videoElement.currentSrc || videoElement.src;
  if (!src) return null;
  try {
    const response = await fetch(src);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    await audioCtx.close();
    return audioBuffer;
  } catch (err) {
    console.warn("[export] could not extract audio:", err);
    return null;
  }
}

async function encodeAudioToMuxer(audioBuffer, muxer, duration, signal) {
  if (!("AudioEncoder" in window)) {
    console.warn("[export] AudioEncoder unavailable — skipping audio track");
    return;
  }
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = Math.min(audioBuffer.numberOfChannels, 2);
  const totalSamples = Math.min(Math.floor(duration * sampleRate), audioBuffer.length);

  let encoderError = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (err) => { encoderError = err; },
  });
  encoder.configure({ codec: "mp4a.40.2", sampleRate, numberOfChannels, bitrate: 192_000 });

  const frameSize = 1024; // AAC frame
  const totalFrames = Math.ceil(totalSamples / frameSize);
  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) break;
    if (encoderError) throw encoderError;
    const offset = i * frameSize;
    const length = Math.min(frameSize, totalSamples - offset);
    // f32-planar layout: channel 0 samples, then channel 1 samples.
    const planar = new Float32Array(length * numberOfChannels);
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let s = 0; s < length; s++) planar[ch * length + s] = channelData[offset + s];
    }
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: length,
      numberOfChannels,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data: planar,
    });
    while (encoder.encodeQueueSize > 16) await new Promise((r) => setTimeout(r, 1));
    encoder.encode(audioData);
    audioData.close();
  }
  await encoder.flush();
  encoder.close();
}

// --------------------------------------------------------------------------
// Shared deterministic frame-stepping core
// --------------------------------------------------------------------------

/**
 * Render every output frame and feed it to a configured VideoEncoder. This is
 * the single code path all formats share — the only differences between MP4 and
 * WebM are the codec candidates and the muxer.
 *
 * @returns {Promise<void>} resolves when all frames are encoded + flushed.
 */
async function encodeVideoFrames({
  encoder, renderer, params, fps, duration, totalFrames, encodedSize,
  renderCanvas, renderCtx, isVideoSource, videoElement, sourceScale, renderOptions,
  onProgress, signal, getEncoderError,
}) {
  // Start from a clean temporal state so frame 0 is identical regardless of
  // whatever the live preview was doing beforehand (determinism).
  renderer.reset?.();

  const keyFrameInterval = Math.max(1, Math.round(fps * 2)); // ~2s GOP
  for (let frame = 0; frame < totalFrames; frame++) {
    if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError");
    const err = getEncoderError();
    if (err) throw err;

    const t = frame / fps;
    if (isVideoSource) {
      const seekTime = Math.min(t, videoElement.duration - 0.001);
      await seekVideoToTime(videoElement, seekTime);
      renderer.setImage(videoElement, sourceScale);
    }

    renderCtx.fillStyle = "#000";
    renderCtx.fillRect(0, 0, encodedSize.width, encodedSize.height);
    renderer.render(renderCtx, encodedSize.width, encodedSize.height, t, params, frame, fps, renderOptions);

    const videoFrame = new VideoFrame(renderCanvas, {
      timestamp: Math.round((frame * 1_000_000) / fps),
      duration: Math.round(1_000_000 / fps),
    });
    // Backpressure: don't outrun the encoder.
    while (encoder.encodeQueueSize > 8) await new Promise((r) => setTimeout(r, 1));
    encoder.encode(videoFrame, { keyFrame: frame % keyFrameInterval === 0 });
    videoFrame.close();

    onProgress?.((frame + 1) / totalFrames, frame + 1, totalFrames);
    if (frame % 5 === 0) await new Promise((r) => setTimeout(r, 0)); // keep UI responsive
  }
  await encoder.flush();
}

/**
 * Common setup shared by the MP4 and WebM WebCodecs paths: resolves render
 * dimensions, builds the offscreen render canvas, and pauses the source video.
 */
function prepareRender({ canvas, videoElement, duration, fps, resolution = 0, aspectRatio }) {
  const isVideoSource = videoElement instanceof HTMLVideoElement;
  // Size from the SOURCE dims + chosen resolution/aspect (shared with the native
  // ffmpeg path via computeExportSize), so the Resolution dropdown and aspect
  // crop work here too and both engines emit identical dimensions. The renderer
  // cover-crops the source into a non-source aspect (crop-to-fill); letterbox/
  // pillarbox padding is currently only applied on the native ffmpeg path.
  const sourceW = isVideoSource ? videoElement.videoWidth : canvas.width;
  const sourceH = isVideoSource ? videoElement.videoHeight : canvas.height;
  const encodedSize = computeExportSize({ sourceW, sourceH, resolution, aspectRatio });
  const totalFrames = Math.max(1, Math.floor(duration * fps));
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = encodedSize.width;
  renderCanvas.height = encodedSize.height;
  const renderCtx = renderCanvas.getContext("2d", { alpha: false });
  const wasPlaying = isVideoSource && !videoElement.paused;
  if (wasPlaying) videoElement.pause();
  return { isVideoSource, encodedSize, totalFrames, renderCanvas, renderCtx, wasPlaying };
}

// --------------------------------------------------------------------------
// MP4 (H.264 + AAC)
// --------------------------------------------------------------------------

export async function exportMp4({
  canvas, renderer, params, fps, duration, onProgress,
  videoElement, sourceScale = 1, bitrate = 8_000_000, signal,
  includeAudio = false, degradeAudio = false, audioProfile = null,
  renderOptions = {}, fileName, resolution = 0, aspectRatio,
}) {
  if (!("VideoEncoder" in window)) {
    throw new Error("WebCodecs VideoEncoder is unavailable in this context.");
  }

  const prep = prepareRender({ canvas, videoElement, duration, fps, resolution, aspectRatio });
  const { isVideoSource, encodedSize, totalFrames, renderCanvas, renderCtx, wasPlaying } = prep;
  const shouldMuxAudio = includeAudio && isVideoSource;

  // Extract (and optionally degrade) audio before we start seeking for frames.
  let audioBuffer = null;
  if (shouldMuxAudio) {
    onProgress?.(0, 0, 0, "Extracting audio…");
    audioBuffer = await extractAudioBuffer(videoElement);
    if (audioBuffer && degradeAudio && audioProfile) {
      try {
        onProgress?.(0, 0, 0, "Degrading audio…");
        const { degradeAudioBuffer } = await import("./audio-degrade.ts");
        audioBuffer = await degradeAudioBuffer(audioBuffer, audioProfile);
      } catch (err) {
        console.warn("[export] audio degradation skipped:", err);
      }
    }
  }

  // Probe for a hardware-accelerated H.264 config.
  const { config, hardware } = await pickSupportedConfig(h264Candidates(), {
    width: encodedSize.width,
    height: encodedSize.height,
    framerate: fps,
    bitrate,
    bitrateMode: "variable",
    latencyMode: "quality",
  });
  console.log(`[export] MP4 H.264 ${config.codec} · ${hardware ? "hardware" : "software"} · ${encodedSize.width}x${encodedSize.height}`);

  const muxerConfig = {
    target: new Mp4Target(),
    video: { codec: "avc", width: encodedSize.width, height: encodedSize.height },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  };
  if (audioBuffer) {
    muxerConfig.audio = {
      codec: "aac",
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2),
    };
  }
  const muxer = new Mp4Muxer(muxerConfig);

  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => { encoderError = err; },
  });
  encoder.configure(config);

  try {
    await encodeVideoFrames({
      encoder, renderer, params, fps, duration, totalFrames, encodedSize,
      renderCanvas, renderCtx, isVideoSource, videoElement, sourceScale, renderOptions,
      onProgress, signal, getEncoderError: () => encoderError,
    });
    encoder.close();

    if (audioBuffer) {
      onProgress?.(1, totalFrames, totalFrames, "Encoding audio…");
      await encodeAudioToMuxer(audioBuffer, muxer, duration, signal);
    }

    muxer.finalize();
    const blob = new Blob([muxerConfig.target.buffer], { type: "video/mp4" });
    await saveBlob(blob, fileName || `lme-export-${Date.now()}.mp4`, { mimeType: "video/mp4", extension: "mp4", description: "MP4 video" });
    return blob;
  } catch (err) {
    try { if (encoder.state !== "closed") encoder.close(); } catch (_) {}
    throw err;
  } finally {
    if (wasPlaying) videoElement.play().catch(() => {});
  }
}

// --------------------------------------------------------------------------
// WebM (VP9) — deterministic WebCodecs path, MediaRecorder last resort.
// --------------------------------------------------------------------------

export async function exportWebm(args) {
  const caps = getVideoExportCapabilities();
  if (caps.mp4) return exportWebmWebCodecs(args);
  if (caps.webmRealtime) return exportWebmMediaRecorder(args);
  throw new Error("No WebM encoder available in this context.");
}

async function exportWebmWebCodecs({
  canvas, renderer, params, fps, duration, onProgress,
  videoElement, sourceScale = 1, bitrate = 8_000_000, signal, renderOptions = {}, fileName,
  resolution = 0, aspectRatio,
}) {
  const prep = prepareRender({ canvas, videoElement, duration, fps, resolution, aspectRatio });
  const { isVideoSource, encodedSize, totalFrames, renderCanvas, renderCtx, wasPlaying } = prep;

  const { config, hardware } = await pickSupportedConfig(
    ["vp09.00.10.08", "vp09.00.40.08", "vp8"],
    {
      width: encodedSize.width,
      height: encodedSize.height,
      framerate: fps,
      bitrate,
      bitrateMode: "variable",
      latencyMode: "quality",
    }
  );
  const muxerCodec = config.codec.startsWith("vp09") ? "V_VP9" : "V_VP8";
  console.log(`[export] WebM ${config.codec} · ${hardware ? "hardware" : "software"} · ${encodedSize.width}x${encodedSize.height}`);

  const target = new WebmTarget();
  const muxer = new WebmMuxer({
    target,
    video: { codec: muxerCodec, width: encodedSize.width, height: encodedSize.height, frameRate: fps },
  });

  let encoderError = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => { encoderError = err; },
  });
  encoder.configure(config);

  try {
    await encodeVideoFrames({
      encoder, renderer, params, fps, duration, totalFrames, encodedSize,
      renderCanvas, renderCtx, isVideoSource, videoElement, sourceScale, renderOptions,
      onProgress, signal, getEncoderError: () => encoderError,
    });
    encoder.close();
    muxer.finalize();
    const blob = new Blob([target.buffer], { type: "video/webm" });
    await saveBlob(blob, fileName || `lme-export-${Date.now()}.webm`, { mimeType: "video/webm", extension: "webm", description: "WebM video" });
    return blob;
  } catch (err) {
    try { if (encoder.state !== "closed") encoder.close(); } catch (_) {}
    throw err;
  } finally {
    if (wasPlaying) videoElement.play().catch(() => {});
  }
}

/** Last-resort real-time WebM capture for runtimes without WebCodecs. */
async function exportWebmMediaRecorder({
  canvas, renderer, params, fps, duration, onProgress,
  videoElement, sourceScale = 1, bitrate = 8_000_000, signal, renderOptions = {}, fileName,
}) {
  const prep = prepareRender({ canvas, videoElement, duration, fps });
  const { isVideoSource, encodedSize, totalFrames, renderCanvas, renderCtx, wasPlaying } = prep;

  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find((m) => MediaRecorder.isTypeSupported(m)) || "video/webm";
  const stream = renderCanvas.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate });
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();
  renderer.reset?.();
  const frameDelay = 1000 / fps;

  try {
    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) {
        try { recorder.stop(); } catch (_) {}
        throw new DOMException("Export cancelled", "AbortError");
      }
      const t = frame / fps;
      if (isVideoSource) {
        await seekVideoToTime(videoElement, Math.min(t, videoElement.duration - 0.001));
        renderer.setImage(videoElement, sourceScale);
      }
      renderCtx.fillStyle = "#000";
      renderCtx.fillRect(0, 0, encodedSize.width, encodedSize.height);
      renderer.render(renderCtx, encodedSize.width, encodedSize.height, t, params, frame, fps, renderOptions);
      if (typeof track.requestFrame === "function") track.requestFrame();
      onProgress?.((frame + 1) / totalFrames, frame + 1, totalFrames);
      await new Promise((r) => setTimeout(r, frameDelay));
    }
    recorder.stop();
    await stopped;
    const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
    await saveBlob(blob, fileName || `lme-export-${Date.now()}.webm`, { mimeType: "video/webm", extension: "webm", description: "WebM video" });
    return blob;
  } catch (err) {
    try { if (recorder.state !== "inactive") recorder.stop(); } catch (_) {}
    throw err;
  } finally {
    try { track.stop(); } catch (_) {}
    if (wasPlaying) videoElement.play().catch(() => {});
  }
}
