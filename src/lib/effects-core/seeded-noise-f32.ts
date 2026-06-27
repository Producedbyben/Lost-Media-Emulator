// Emulated-f64 twin of the CPU seededNoise, computed entirely in Math.fround-simulated
// f32 so it faithfully predicts what the WGSL f32 shader produces. Naive f32 fails on two
// fronts: the argument (up to ~8000 at 640x480) loses its low bits before sin(), AND the
// hash coefficients (12.9898, 78.233, 19.17) are f64 on the CPU but only f32 as shader
// literals — a ~8e-7 coefficient error times a 640-px coord is enough to scramble the
// hash. So we carry BOTH the argument and the coefficients as double-f32 (hi+lo) pairs
// through Dekker-split products and two-sum accumulation, then reduce mod 2pi in extended
// precision so the final f32 sin is of a small, accurate angle.
// Twin of seeded-noise-ref.ts (f64) and noise.wgsl (real f32).
const f = Math.fround;

// Hash coefficients split into double-f32 (hi + lo) so the f32 path reproduces the f64
// products. The lo parts are the f32-rounding residue of each f64 constant.
const C0_HI = f(12.9898), C0_LO = f(12.9898 - C0_HI);
const C1_HI = f(78.233), C1_LO = f(78.233 - C1_HI);
const C2_HI = f(19.17), C2_LO = f(19.17 - C2_HI);
const TWO_PI = f(2 * Math.PI), TWO_PI_LO = f(2 * Math.PI - TWO_PI);

// Dekker split product: a*b as an exact (hi, lo) f32 pair.
function twoProd(a: number, b: number): [number, number] {
  const p = f(a * b);
  const SPLIT = 4097; // 2^12 + 1 (f32 mantissa = 24 bits -> split at 12)
  const ca = f(SPLIT * a), cb = f(SPLIT * b);
  const ah = f(ca - f(ca - a)), al = f(a - ah);
  const bh = f(cb - f(cb - b)), bl = f(b - bh);
  const err = f(f(f(f(ah * bh - p) + f(ah * bl)) + f(al * bh)) + f(al * bl));
  return [p, err];
}
// Error-free sum of two f32s as (hi, lo).
function twoSum(a: number, b: number): [number, number] {
  const s = f(a + b);
  const bb = f(s - a);
  const err = f(f(a - f(s - bb)) + f(b - bb));
  return [s, err];
}
// (ah,al) + (bh,bl) -> renormalised (hi, lo).
function addDD(ah: number, al: number, bh: number, bl: number): [number, number] {
  const [sh, sl] = twoSum(ah, bh);
  const lo = f(sl + f(al + bl));
  return twoSum(sh, lo);
}
// v * (cHi + cLo) as a double-f32 pair (v is an exact-ish small int coord).
function termDD(v: number, cHi: number, cLo: number): [number, number] {
  const [p, e] = twoProd(v, cHi);
  const lo = f(e + f(v * cLo));
  return twoSum(p, lo);
}

export function seededNoiseF32(x: number, y: number, frame: number): number {
  // arg = x*12.9898 + y*78.233 + frame*19.17, carried as a double-f32 pair.
  const [xh, xl] = termDD(f(x), C0_HI, C0_LO);
  const [yh, yl] = termDD(f(y), C1_HI, C1_LO);
  const [fh, fl] = termDD(f(frame), C2_HI, C2_LO);
  let [h, l] = addDD(xh, xl, yh, yl);
  [h, l] = addDD(h, l, fh, fl);
  // Range-reduce mod 2pi in extended precision: arg - round(arg/2pi)*2pi.
  const k = Math.round(f(h / TWO_PI));
  const [kh, kl] = twoProd(k, TWO_PI);
  [h, l] = addDD(h, l, f(-kh), f(-kl));
  [h, l] = addDD(h, l, f(-(k * TWO_PI_LO)), 0);
  const reduced = f(h + l); // small angle, ~[-pi, pi]
  const s = f(Math.sin(reduced) * 43758.5453);
  return s - Math.floor(s);
}
