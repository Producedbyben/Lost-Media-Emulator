// Centralized GPU configuration for the Apple Silicon build.
//
// IMPORTANT: on Apple Silicon, Chromium ALREADY selects the Metal-backed ANGLE
// renderer by default (verified: "ANGLE Metal Renderer: Apple M1 Max"). The
// effects engine renders WebGL2 to an offscreen canvas and then composites it
// onto a 2D canvas via drawImage(). Experimental flags like
// CanvasOopRasterization / zero-copy / unsafe-webgpu break exactly that
// GPU->2D read-back path (black or garbage frames). So we keep this MINIMAL:
// make the Metal backend explicit (it's the proven-good path) and otherwise
// trust Chromium's defaults.
module.exports = function applyGpuFlags(app) {
  // Make the (already-default) Metal ANGLE backend explicit and intentional.
  app.commandLine.appendSwitch("use-angle", "metal");
  // Ignore the GPU blocklist so WebGL2 is always hardware-accelerated, even on
  // unusual display/driver combos. Safe on Apple Silicon (single Metal GPU).
  app.commandLine.appendSwitch("ignore-gpu-blocklist");
};
