// Content-dependent codec-artefact helpers, shared by the CPU renderer
// (crt-renderer-full.js). Real codec corruption derives from the image and scales with
// local detail — it is NOT random rainbow noise or a uniform grid. These two functions
// encode that, fixing the B6 "confetti / uniform grid on smooth sources" cluster
// (NEEDS-BEN #13): MPEG-2 Satellite, YouTube 2007, Vine, TikTok, RealPlayer, LED Billboard.

/**
 * Channel-desync block corruption. The original bit-rot "mode 2" filled a corrupted block
 * with `hsl(randomHue, 90%, 50%)` — a fully-saturated random tile that blends into busy
 * footage but explodes into garish "confetti" on smooth/AI sources. A real chroma-channel
 * desync is a PERMUTATION of the block's own channels, so the corrupted colour is derived
 * from the image: a muted block stays muted, a vivid block glitches to a vivid (but related)
 * colour. Because the output is a permutation of the inputs, the chroma spread is preserved
 * and flat-grey blocks are left untouched — no rainbow on smooth areas.
 *
 * @param {number} r 0..255
 * @param {number} g 0..255
 * @param {number} b 0..255
 * @param {number} seed 0..1 (e.g. seededNoise) — selects the desync permutation
 * @returns {[number, number, number]}
 */
export function bitrotDesyncColor(r, g, b, seed) {
  const perm = Math.floor((Number(seed) || 0) * 3) % 3;
  if (perm === 0) return [g, b, r]; // RGB -> GBR
  if (perm === 1) return [b, r, g]; // RGB -> BRG
  return [r, b, g]; // RGB -> RBG (swap G/B)
}

/**
 * DCT block-edge visibility as a function of the block's local contrast (a proxy for AC
 * energy). Legacy low-bitrate codecs only show hard 8x8 block edges where a block carries
 * real high-frequency detail; a flat block has ~no AC coefficients to truncate, so its
 * edges stay invisible. The original implementation darkened EVERY block edge unconditionally,
 * which painted a uniform wireframe grid over smooth sources. Smoothstep so near-flat blocks
 * stay clean and detailed blocks block up hard.
 *
 * @param {number} contrast 0..1 (normalised luma range within the block)
 * @returns {number} 0..1 edge-strength multiplier
 */
export function dctEdgeFactor(contrast) {
  const c = Math.max(0, Math.min(1, Number(contrast) || 0));
  return c * c * (3 - 2 * c); // smoothstep(0,1,c)
}
