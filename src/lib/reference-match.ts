/**
 * Reference match.
 * ----------------------------------------------------------------------------
 * Statistically tunes grade-style params so a source frame moves toward the
 * look of a dropped reference image (a screenshot of the footage the creator
 * is targeting). Produces *editable* param overrides, not a black box.
 *
 * Matches: exposure (brightness), contrast, white balance (temp/tint),
 * saturation, gamma, and estimates grain (noise) + softness/bloom from the
 * reference's high-frequency energy.
 */

export interface ImageStats {
  meanR: number;
  meanG: number;
  meanB: number;
  meanLuma: number;
  contrast: number; // luma std-dev, 0..1
  saturation: number; // mean chroma magnitude, 0..1
  highFreq: number; // normalized high-frequency energy, 0..1
}

export interface MatchOverrides {
  imageBrightness: number;
  imageContrast: number;
  imageTemperature: number;
  imageTint: number;
  advancedSaturation: number;
  imageGamma: number;
  noise: number;
  bloom: number;
}

/** Compute robust statistics from RGBA pixel data. */
export function computeImageStats(data: Uint8ClampedArray, width: number, height: number): ImageStats {
  let sumR = 0, sumG = 0, sumB = 0, sumL = 0, sumL2 = 0, sumSat = 0;
  let count = 0;
  // Sample on a stride for speed on large images.
  const stride = Math.max(1, Math.floor(Math.sqrt((width * height) / 90000)));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
      const l = 0.299 * r + 0.587 * g + 0.114 * b;
      sumR += r; sumG += g; sumB += b; sumL += l; sumL2 += l * l;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      sumSat += mx > 0 ? (mx - mn) / mx : 0;
      count++;
    }
  }
  count = Math.max(1, count);
  const meanL = sumL / count;
  const variance = Math.max(0, sumL2 / count - meanL * meanL);

  // High-frequency energy: mean absolute horizontal luma gradient.
  let gradSum = 0, gradCount = 0;
  for (let y = 0; y < height; y += stride) {
    let prev = -1;
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      const l = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      if (prev >= 0) { gradSum += Math.abs(l - prev); gradCount++; }
      prev = l;
    }
  }

  return {
    meanR: sumR / count,
    meanG: sumG / count,
    meanB: sumB / count,
    meanLuma: meanL,
    contrast: Math.min(1, Math.sqrt(variance) * 3.4),
    saturation: Math.min(1, sumSat / count),
    highFreq: Math.min(1, (gradCount ? gradSum / gradCount : 0) * 8),
  };
}

/** Convenience: stats straight from a canvas. */
export function statsFromCanvas(canvas: HTMLCanvasElement): ImageStats | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  if (!width || !height) return null;
  const img = ctx.getImageData(0, 0, width, height);
  return computeImageStats(img.data, width, height);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Derive grade overrides to move `src` toward `ref`, starting from baseline
 * param values (so the result stays editable & sensible).
 */
export function deriveMatchParams(
  ref: ImageStats,
  src: ImageStats,
  base: Partial<MatchOverrides> = {},
): MatchOverrides {
  // Exposure: ratio of mean luma (avoid div-by-zero, dampen extremes).
  const expRatio = ref.meanLuma / Math.max(0.04, src.meanLuma);
  const brightness = clamp((base.imageBrightness ?? 1) * Math.pow(expRatio, 0.6), 0.6, 1.6);

  // Contrast: ratio of luma std-dev.
  const contrastRatio = ref.contrast / Math.max(0.04, src.contrast);
  const contrast = clamp((base.imageContrast ?? 1) * Math.pow(contrastRatio, 0.5), 0.6, 1.6);

  // White balance from R/B and G/avg differences relative to source.
  const refRB = ref.meanR - ref.meanB;
  const srcRB = src.meanR - src.meanB;
  const temperature = clamp((base.imageTemperature ?? 0) + (refRB - srcRB) * 1.4, -1, 1);
  const refTint = ref.meanG - (ref.meanR + ref.meanB) / 2;
  const srcTint = src.meanG - (src.meanR + src.meanB) / 2;
  const tint = clamp((base.imageTint ?? 0) + (refTint - srcTint) * 1.6, -1, 1);

  // Saturation ratio.
  const satRatio = ref.saturation / Math.max(0.04, src.saturation);
  const saturation = clamp((base.advancedSaturation ?? 1) * Math.pow(satRatio, 0.7), 0, 2);

  // Gamma: nudge midtones toward reference mean luma.
  const gamma = clamp(
    (base.imageGamma ?? 1) * (src.meanLuma > 0.001 ? Math.log(Math.max(0.05, ref.meanLuma)) / Math.log(Math.max(0.05, src.meanLuma)) : 1),
    0.6, 1.8,
  );

  // Grain & softness estimated from reference high-frequency energy. Higher HF
  // with low contrast usually means grain/noise; very low HF means softness.
  const noise = clamp((base.noise ?? 0) + Math.max(0, ref.highFreq - 0.25) * 0.6, 0, 1);
  const bloom = clamp((base.bloom ?? 0) + Math.max(0, 0.18 - ref.highFreq) * 1.4, 0, 1);

  return {
    imageBrightness: round(brightness),
    imageContrast: round(contrast),
    imageTemperature: round(temperature),
    imageTint: round(tint),
    advancedSaturation: round(saturation),
    imageGamma: round(gamma),
    noise: round(noise),
    bloom: round(bloom),
  };
}

function round(v: number) {
  return Math.round(v * 1000) / 1000;
}

/** Load an image File into an offscreen canvas and return its stats. */
export async function statsFromFile(file: File, maxDim = 480): Promise<ImageStats> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    return computeImageStats(data.data, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}
