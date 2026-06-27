// Emulated-f64 twin of the CPU seededNoise (crt-renderer-full.js) + seeded-noise-ref.ts
// (f64) + seeded-noise-f32.ts (Math.fround-simulated f32 — the authority this transcribes).
// WGSL has no #include, so this fn is pasted verbatim into crt-display.wgsl; keep all four
// in sync.
//
// Naive f32 fails: the argument (up to ~8000 at 640x480) loses its low bits before sin(),
// and the hash coefficients are f64 on the CPU but f32 as shader literals. So both the
// argument AND the coefficients are carried as double-f32 (hi+lo) pairs through Dekker
// products + two-sum accumulation, then reduced mod 2pi in extended precision so the final
// f32 sin is of a small, accurate angle. (vec2: .x = hi, .y = lo.)

// Coefficient hi/lo splits (lo = f32-rounding residue of the f64 constant; see
// seeded-noise-f32.ts which computes these at load).
const C0_HI: f32 = 12.9898;
const C0_LO: f32 = -4.531860327006143e-7;
const C1_HI: f32 = 78.233;
const C1_LO: f32 = -0.0000017089844277506927;
const C2_HI: f32 = 19.17;
const C2_LO: f32 = -7.629394360719743e-8;
const TWO_PI_HI: f32 = 6.2831854820251465;
const TWO_PI_LO: f32 = -1.7484555314695172e-7;

fn twoProd(a: f32, b: f32) -> vec2<f32> {
  let p = a * b;
  let SPLIT: f32 = 4097.0; // 2^12 + 1
  let ca = SPLIT * a;
  let cb = SPLIT * b;
  let ah = ca - (ca - a);
  let al = a - ah;
  let bh = cb - (cb - b);
  let bl = b - bh;
  let err = ((ah * bh - p) + ah * bl + al * bh) + al * bl;
  return vec2<f32>(p, err);
}
fn twoSum(a: f32, b: f32) -> vec2<f32> {
  let s = a + b;
  let bb = s - a;
  let err = (a - (s - bb)) + (b - bb);
  return vec2<f32>(s, err);
}
fn addDD(a: vec2<f32>, b: vec2<f32>) -> vec2<f32> {
  let s = twoSum(a.x, b.x);
  let lo = s.y + (a.y + b.y);
  return twoSum(s.x, lo);
}
fn termDD(v: f32, cHi: f32, cLo: f32) -> vec2<f32> {
  let p = twoProd(v, cHi);
  let lo = p.y + v * cLo;
  return twoSum(p.x, lo);
}

fn seededNoise(x: f32, y: f32, frame: f32) -> f32 {
  // arg = x*12.9898 + y*78.233 + frame*19.17, carried as a double-f32 pair.
  var acc = addDD(termDD(x, C0_HI, C0_LO), termDD(y, C1_HI, C1_LO));
  acc = addDD(acc, termDD(frame, C2_HI, C2_LO));
  // Range-reduce mod 2pi: arg - round(arg/2pi)*2pi.
  let k = round(acc.x / TWO_PI_HI);
  let kp = twoProd(k, TWO_PI_HI);
  acc = addDD(acc, vec2<f32>(-kp.x, -kp.y));
  acc = addDD(acc, vec2<f32>(-(k * TWO_PI_LO), 0.0));
  let reduced = acc.x + acc.y; // small angle ~[-pi, pi]
  let s = sin(reduced) * 43758.5453;
  return s - floor(s);
}
