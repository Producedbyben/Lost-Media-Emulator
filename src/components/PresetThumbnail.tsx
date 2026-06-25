import { useRef, useEffect, memo } from "react";
import { DEFAULT_PARAMS } from "@/hooks/useCRTRenderer";

interface PresetThumbnailProps {
  values: Record<string, number>;
  width?: number;
  height?: number;
}

/**
 * Renders a tiny color-swatch preview of a preset's effect parameters.
 * Uses a 2D canvas to visualize key params as a stylized gradient/texture.
 */
const PresetThumbnail = memo(({ values, width = 48, height = 32 }: PresetThumbnailProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const w = width;
    const h = height;

    // Base gradient simulating a test image
    const brightness = values.imageBrightness ?? 1;
    const contrast = values.imageContrast ?? 1;
    const temp = values.imageTemperature ?? 0;
    const sat = values.advancedSaturation ?? 1;
    const scanlines = values.scanlineStrength ?? 0;
    const noise = values.noise ?? 0;
    const bloom = values.bloom ?? 0;
    const chromatic = values.chromaticAberration ?? 0;
    const grain = values.advancedFilmGrain ?? 0;
    const barrel = values.barrelDistortion ?? 0;

    // Draw base gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    const r = Math.min(255, Math.max(0, 80 + temp * 200));
    const b = Math.min(255, Math.max(0, 120 - temp * 200));
    const g = 100;
    grad.addColorStop(0, `rgb(${Math.round(r * brightness * contrast)}, ${Math.round(g * brightness * sat)}, ${Math.round(b * brightness)})`);
    grad.addColorStop(0.5, `rgb(${Math.round(180 * brightness * contrast)}, ${Math.round(160 * brightness * sat)}, ${Math.round(140 * brightness)})`);
    grad.addColorStop(1, `rgb(${Math.round(40 * brightness)}, ${Math.round(60 * brightness * sat)}, ${Math.round(80 * brightness * contrast)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Chromatic aberration hint
    if (chromatic > 0.1) {
      ctx.globalAlpha = Math.min(0.4, chromatic * 0.3);
      ctx.fillStyle = `rgba(255, 0, 0, 0.3)`;
      ctx.fillRect(1, 0, w, h);
      ctx.fillStyle = `rgba(0, 0, 255, 0.3)`;
      ctx.fillRect(-1, 0, w, h);
      ctx.globalAlpha = 1;
    }

    // Scanlines
    if (scanlines > 0.05) {
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(0.5, scanlines * 0.4)})`;
      for (let y = 0; y < h; y += 2) {
        ctx.fillRect(0, y, w, 1);
      }
    }

    // Bloom glow
    if (bloom > 0.05) {
      ctx.globalAlpha = Math.min(0.35, bloom * 0.25);
      ctx.filter = `blur(${Math.min(3, bloom * 2)}px)`;
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
    }

    // Noise / grain overlay
    const noiseAmount = noise + grain * 0.5;
    if (noiseAmount > 0.02) {
      const imageData = ctx.getImageData(0, 0, w, h);
      const d = imageData.data;
      const strength = Math.min(60, noiseAmount * 40);
      for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * strength;
        d[i] += n;
        d[i + 1] += n;
        d[i + 2] += n;
      }
      ctx.putImageData(imageData, 0, 0);
    }

    // Barrel distortion hint — darken corners
    if (barrel > 0.02) {
      const radGrad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      radGrad.addColorStop(0, "transparent");
      radGrad.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.5, barrel * 0.4)})`);
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, w, h);
    }
  }, [values, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded-sm border border-border/50 block"
      style={{ width, height, imageRendering: "pixelated" }}
    />
  );
});

PresetThumbnail.displayName = "PresetThumbnail";

export default PresetThumbnail;
