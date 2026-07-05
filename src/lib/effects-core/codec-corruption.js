// Content-dependent codec-artefact helpers, shared by the CPU renderer
// (crt-renderer-full.js). Real codec corruption derives from the image and scales with
// local detail — it is NOT random rainbow noise or a uniform grid. These two functions
// encode that, fixing the B6 "confetti / uniform grid on smooth sources" cluster
// (NEEDS-BEN #13): MPEG-2 Satellite, YouTube 2007, Vine, TikTok, RealPlayer, LED Billboard.

/**
 * Corruption spawn gate: how likely a macroblock is allowed to corrupt, as a function of its
 * local contrast. PE re-gate finding (2026-07-05): isolated corrupted blocks peppering FLAT
 * regions (sky, plain walls) read as defects — real corruption hides in detail. Hard floor at
 * 0.08 (flat blocks NEVER corrupt), full spawn from 0.35 up, smoothstep ramp between.
 *
 * @param {number} contrast 0..1 (normalised luma range within the block)
 * @returns {number} 0..1 spawn-probability multiplier
 */
export function corruptionSpawnFactor(contrast) {
  const c = Math.max(0, Math.min(1, Number(contrast) || 0));
  if (c <= 0.08) return 0;
  if (c >= 0.35) return 1;
  const t = (c - 0.08) / 0.27;
  return t * t * (3 - 2 * t);
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
