// Pure ffmpeg argv builder (H.264 / HEVC from a PNG sequence, with optional
// original-audio mux). ProRes and trim are added in later phases.
/**
 * Build the ffmpeg argv (after the binary name) to encode a PNG sequence to mp4,
 * optionally muxing audio from a source file.
 * @param {{
 *   codec:"h264"|"hevc",
 *   fps:number,
 *   framePattern:string,
 *   outPath:string,
 *   totalFrames?:number,
 *   audioSourcePath?:string   // when set, mux its first audio track (if any)
 * }} req
 * @returns {string[]}
 */
function buildVideoArgs({ codec, fps, framePattern, outPath, audioSourcePath, totalFrames: _totalFrames }) {
  // Frame sequence is input 0; the audio source (when present) is input 1.
  const input = ["-y", "-framerate", String(fps), "-i", framePattern];
  if (audioSourcePath) input.push("-i", audioSourcePath);

  const progress = ["-progress", "pipe:1", "-nostats"];
  const common = ["-pix_fmt", "yuv420p", "-r", String(fps)];

  let videoCodec;
  if (codec === "h264") {
    videoCodec = ["-c:v", "h264_videotoolbox", "-b:v", "20M"];
  } else if (codec === "hevc") {
    videoCodec = ["-c:v", "hevc_videotoolbox", "-b:v", "16M", "-tag:v", "hvc1"];
  } else {
    throw new Error(`unsupported codec: ${codec}`);
  }

  // Map the rendered video and, when an audio source is present, its first audio
  // track. `1:a:0?` is optional so a source with no audio never fails the encode;
  // `-shortest` trims audio to the (possibly shorter) rendered video length.
  const audio = audioSourcePath
    ? ["-map", "0:v:0", "-map", "1:a:0?", "-c:a", "aac", "-b:a", "192k", "-shortest"]
    : [];

  return [...input, ...videoCodec, ...common, ...audio, "-movflags", "+faststart", ...progress, outPath];
}

module.exports = { buildVideoArgs };
