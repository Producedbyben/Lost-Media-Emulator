// Pure ffmpeg argv builder for the export tiers: delivery H.264/HEVC (mp4) and
// editorial ProRes 422 HQ / 4444 (mov), encoding a PNG sequence with optional
// original-audio mux. Trim is added in a later phase.

// Per-codec encode profile: video flags, pixel format, container, and the audio
// codec the container conventionally carries (AAC for mp4, PCM for ProRes mov).
const CODECS = {
  h264:       { v: ["-c:v", "h264_videotoolbox", "-b:v", "20M"],                 pix: "yuv420p",     container: "mp4" },
  hevc:       { v: ["-c:v", "hevc_videotoolbox", "-b:v", "16M", "-tag:v", "hvc1"], pix: "yuv420p",   container: "mp4" },
  prores422:  { v: ["-c:v", "prores_ks", "-profile:v", "3"],                     pix: "yuv422p10le", container: "mov" },
  prores4444: { v: ["-c:v", "prores_ks", "-profile:v", "4"],                     pix: "yuv444p10le", container: "mov" },
};

/**
 * Build the ffmpeg argv (after the binary name) to encode a PNG sequence,
 * optionally muxing audio from a source file.
 * @param {{
 *   codec:"h264"|"hevc"|"prores422"|"prores4444",
 *   fps:number,
 *   framePattern:string,
 *   outPath:string,          // .mp4 for h264/hevc, .mov for ProRes
 *   totalFrames?:number,
 *   audioSourcePath?:string  // when set, mux its first audio track (if any)
 * }} req
 * @returns {string[]}
 */
function buildVideoArgs({ codec, fps, framePattern, outPath, audioSourcePath, totalFrames: _totalFrames }) {
  const spec = CODECS[codec];
  if (!spec) throw new Error(`unsupported codec: ${codec}`);

  // Frame sequence is input 0; the audio source (when present) is input 1.
  const input = ["-y", "-framerate", String(fps), "-i", framePattern];
  if (audioSourcePath) input.push("-i", audioSourcePath);

  const progress = ["-progress", "pipe:1", "-nostats"];
  const common = ["-pix_fmt", spec.pix, "-r", String(fps)];

  // Map the rendered video and, when an audio source is present, its first audio
  // track. `1:a:0?` is optional so a source with no audio never fails the encode;
  // `-shortest` trims audio to the (possibly shorter) rendered video length.
  const audioCodec = spec.container === "mov" ? ["-c:a", "pcm_s16le"] : ["-c:a", "aac", "-b:a", "192k"];
  const audio = audioSourcePath
    ? ["-map", "0:v:0", "-map", "1:a:0?", ...audioCodec, "-shortest"]
    : [];

  // +faststart only helps streaming mp4s; a ProRes master is for editing.
  const muxFlags = spec.container === "mp4" ? ["-movflags", "+faststart"] : [];

  return [...input, ...spec.v, ...common, ...audio, ...muxFlags, ...progress, outPath];
}

module.exports = { buildVideoArgs };
