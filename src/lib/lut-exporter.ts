// LUT Export: Generate industry-standard .cube format

import type { CRTParams } from "@/hooks/useCRTRenderer";

export interface LUTExportOptions {
  size: number; // Typical: 17, 33, 65
  title?: string;
}

/**
 * Apply color grading transforms from params to a color
 */
function applyGrading(r: number, g: number, b: number, params: CRTParams): [number, number, number] {
  // Brightness
  r *= params.imageBrightness;
  g *= params.imageBrightness;
  b *= params.imageBrightness;

  // Contrast (around 0.5 midpoint)
  r = (r - 0.5) * params.imageContrast + 0.5;
  g = (g - 0.5) * params.imageContrast + 0.5;
  b = (b - 0.5) * params.imageContrast + 0.5;

  // Gamma
  const gamma = 1 / params.imageGamma;
  r = Math.pow(Math.max(0, r), gamma);
  g = Math.pow(Math.max(0, g), gamma);
  b = Math.pow(Math.max(0, b), gamma);

  // Saturation
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  r = luma + (r - luma) * params.advancedSaturation;
  g = luma + (g - luma) * params.advancedSaturation;
  b = luma + (b - luma) * params.advancedSaturation;

  // Temperature (shift red/blue)
  const temp = params.imageTemperature;
  r += temp * 0.1;
  b -= temp * 0.1;

  // Tint (shift green/magenta)
  const tint = params.imageTint;
  g += tint * 0.1;
  r -= tint * 0.05;
  b -= tint * 0.05;

  // Clamp
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  b = Math.max(0, Math.min(1, b));

  return [r, g, b];
}

/**
 * Generate a .cube LUT file from current color grading params
 */
export function generateCubeLUT(params: CRTParams, options: LUTExportOptions = { size: 33 }): string {
  const { size, title } = options;
  const lines: string[] = [];

  // Header
  lines.push(`TITLE "${title || "LME Color Grade"}"`);
  lines.push(`# Created by Lost Media Emulator`);
  lines.push(`# Brightness: ${params.imageBrightness.toFixed(3)}`);
  lines.push(`# Contrast: ${params.imageContrast.toFixed(3)}`);
  lines.push(`# Saturation: ${params.advancedSaturation.toFixed(3)}`);
  lines.push(`# Gamma: ${params.imageGamma.toFixed(3)}`);
  lines.push(`# Temperature: ${params.imageTemperature.toFixed(3)}`);
  lines.push(`# Tint: ${params.imageTint.toFixed(3)}`);
  lines.push("");
  lines.push(`LUT_3D_SIZE ${size}`);
  lines.push(`DOMAIN_MIN 0.0 0.0 0.0`);
  lines.push(`DOMAIN_MAX 1.0 1.0 1.0`);
  lines.push("");

  // Generate 3D LUT data (R varies fastest, then G, then B)
  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const ri = r / (size - 1);
        const gi = g / (size - 1);
        const bi = b / (size - 1);

        const [ro, go, bo] = applyGrading(ri, gi, bi, params);
        lines.push(`${ro.toFixed(6)} ${go.toFixed(6)} ${bo.toFixed(6)}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Download the LUT as a .cube file
 */
export function downloadCubeLUT(params: CRTParams, options?: LUTExportOptions): void {
  const cube = generateCubeLUT(params, options);
  const blob = new Blob([cube], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lme-grade-${Date.now()}.cube`;
  a.click();
  URL.revokeObjectURL(url);
}
