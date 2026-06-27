// Exact JS twin of CPU seededNoise (crt-renderer-full.js) — used to prove the WGSL
// port (noise.wgsl) transcribes the same formula. GPU runs this in f32 and so its
// values differ slightly; the fidelity sweep is the runtime proof. This keeps the
// FORMULA honest (the two can't silently diverge).
export function seededNoiseRef(x: number, y: number, frame: number): number {
  const v = Math.sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - Math.floor(v);
}
