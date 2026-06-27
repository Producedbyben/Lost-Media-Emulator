// Twin of CPU seededNoise (crt-renderer-full.js) + seeded-noise-ref.ts. f32 here,
// f64 on CPU — values differ slightly but statistically match; CRT/display is the
// first family precisely because it is light on noise. WGSL has no #include, so
// this fn is pasted verbatim into crt-display.wgsl; keep the two in sync.
fn seededNoise(x: f32, y: f32, frame: f32) -> f32 {
  let v: f32 = sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - floor(v);
}
