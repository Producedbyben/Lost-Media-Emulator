// Pure ffmpeg argv builder for Phase 1 (H.264 / HEVC from a PNG sequence).
// Audio, ProRes, and trim are added in later phases.
/**
 * Build the ffmpeg argv (after the binary name) to encode a PNG sequence to mp4.
 * @param {{codec:"h264"|"hevc",fps:number,framePattern:string,outPath:string,totalFrames?:number}} req
 * @returns {string[]}
 */
function buildVideoArgs({ codec, fps, framePattern, outPath, totalFrames: _totalFrames }) {
  const input = ["-y", "-framerate", String(fps), "-i", framePattern];
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

  return [...input, ...videoCodec, ...common, "-movflags", "+faststart", ...progress, outPath];
}

module.exports = { buildVideoArgs };
