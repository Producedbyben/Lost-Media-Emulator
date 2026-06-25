function seededNoise(x, y, frame) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - Math.floor(v);
}

export class CRTRenderer {
  constructor() {
    this.sourceCanvas = document.createElement("canvas");
    this.baseCanvas = document.createElement("canvas");
    this.workCanvas = document.createElement("canvas");
    this.effectCanvas = document.createElement("canvas");
    this.tempCanvas = document.createElement("canvas");
    this.maskCanvas = document.createElement("canvas");
    this.luminanceCanvas = document.createElement("canvas");
    this.maskPattern = null;
    this.hasImage = false;
  }

  setImage(img) {
    this.sourceCanvas.width = img.naturalWidth || img.videoWidth || img.width;
    this.sourceCanvas.height = img.naturalHeight || img.videoHeight || img.height;
    const ctx = this.sourceCanvas.getContext("2d");
    ctx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    ctx.drawImage(img, 0, 0);
    this.hasImage = true;
  }

  ensureSize(canvas, width, height) {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }

  sampleFittedSource(targetCtx, width, height) {
    const src = this.sourceCanvas;
    const srcAspect = src.width / src.height;
    const dstAspect = width / height;
    let sw = src.width;
    let sh = src.height;
    let sx = 0;
    let sy = 0;

    if (srcAspect > dstAspect) {
      sw = src.height * dstAspect;
      sx = (src.width - sw) / 2;
    } else {
      sh = src.width / dstAspect;
      sy = (src.height - sh) / 2;
    }

    targetCtx.drawImage(src, sx, sy, sw, sh, 0, 0, width, height);
  }

  passGeometry(width, height, params, seconds) {
    this.ensureSize(this.baseCanvas, width, height);
    this.ensureSize(this.workCanvas, width, height);

    const bctx = this.baseCanvas.getContext("2d");
    bctx.clearRect(0, 0, width, height);
    this.sampleFittedSource(bctx, width, height);

    const wctx = this.workCanvas.getContext("2d");
    wctx.clearRect(0, 0, width, height);

    const barrel = params.barrelDistortion;
    const jitterStrength = params.advancedLineJitter || 0;
    const wobbleStrength = params.advancedTimebaseWobble || 0;

    for (let y = 0; y < height; y++) {
      const ny = (y / Math.max(1, height - 1)) * 2 - 1;
      const curve = 1 + barrel * ny * ny;
      const lineW = width / curve;
      const dx = (width - lineW) / 2;

      let jitterX = 0;
      if (jitterStrength > 0 || wobbleStrength > 0) {
        const lineNoise = (seededNoise(y, seconds * 7.1, y) - 0.5) * 2;
        const wobble = Math.sin(seconds * 22 + y * 0.06) * wobbleStrength * 2.2;
        jitterX = lineNoise * jitterStrength * 2.8 + wobble;
      }

      wctx.drawImage(this.baseCanvas, 0, y, width, 1, dx + jitterX, y, lineW, 1);
    }
  }

  passColorSeparation(width, height, params) {
    const wctx = this.workCanvas.getContext("2d");
    const chroma = params.chromaticAberration;
    const lumaChromaDelay = params.advancedChromaDelay || 0;
    const crossColor = params.advancedCrossColor || 0;

    if (chroma <= 0 && lumaChromaDelay <= 0 && crossColor <= 0) return;

    const shift = 1 + chroma * 4 + lumaChromaDelay * 5;
    const crossShift = Math.max(0, crossColor * 3);

    wctx.save();
    wctx.globalCompositeOperation = "screen";
    wctx.globalAlpha = Math.min(0.75, chroma * 0.55 + lumaChromaDelay * 0.4);
    wctx.filter = "sepia(1) saturate(6) hue-rotate(-35deg)";
    wctx.drawImage(this.workCanvas, shift, 0);
    wctx.filter = "sepia(1) saturate(6) hue-rotate(180deg)";
    wctx.drawImage(this.workCanvas, -shift, 0);

    if (crossColor > 0) {
      wctx.globalAlpha = 0.2 * crossColor;
      wctx.filter = "none";
      wctx.drawImage(this.workCanvas, crossShift, 0);
      wctx.drawImage(this.workCanvas, -crossShift * 0.7, 0);
    }

    wctx.restore();
  }

  buildLuminanceMask(width, height) {
    this.ensureSize(this.luminanceCanvas, width, height);
    const lctx = this.luminanceCanvas.getContext("2d", { willReadFrequently: true });
    lctx.clearRect(0, 0, width, height);
    lctx.drawImage(this.workCanvas, 0, 0);

    const data = lctx.getImageData(0, 0, width, height);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      const maxChannel = Math.max(px[i], px[i + 1], px[i + 2]) / 255;
      const alpha = Math.round(Math.pow(maxChannel, 1.35) * 255);
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
      px[i + 3] = alpha;
    }
    lctx.putImageData(data, 0, 0);
  }

  applyLuminanceEffect(outCtx, width, height, drawEffect) {
    this.ensureSize(this.effectCanvas, width, height);
    const ectx = this.effectCanvas.getContext("2d");
    ectx.clearRect(0, 0, width, height);

    drawEffect(ectx);

    ectx.globalCompositeOperation = "destination-in";
    ectx.drawImage(this.luminanceCanvas, 0, 0);
    ectx.globalCompositeOperation = "source-over";

    outCtx.drawImage(this.effectCanvas, 0, 0);
  }

  ensureMaskPattern(ctx, strength) {
    this.maskCanvas.width = 3;
    this.maskCanvas.height = 1;
    const mctx = this.maskCanvas.getContext("2d");
    const alpha = Math.min(0.6, strength * 0.8);
    mctx.clearRect(0, 0, 3, 1);
    mctx.fillStyle = `rgba(255, 80, 80, ${alpha})`;
    mctx.fillRect(0, 0, 1, 1);
    mctx.fillStyle = `rgba(80, 255, 80, ${alpha})`;
    mctx.fillRect(1, 0, 1, 1);
    mctx.fillStyle = `rgba(80, 150, 255, ${alpha})`;
    mctx.fillRect(2, 0, 1, 1);
    this.maskPattern = ctx.createPattern(this.maskCanvas, "repeat");
  }

  passScanlineAndMask(outCtx, width, height, params, frameIndex = 0) {
    const scan = params.scanlineStrength;
    const mask = params.phosphorMask;

    this.applyLuminanceEffect(outCtx, width, height, (ctx) => {
      ctx.fillStyle = `rgba(0,0,0,${0.06 + scan * 0.5})`;
      for (let y = 0; y < height; y += 2) ctx.fillRect(0, y, width, 1);
    });

    this.ensureMaskPattern(outCtx, mask);
    this.applyLuminanceEffect(outCtx, width, height, (ctx) => {
      ctx.globalAlpha = mask;
      ctx.fillStyle = this.maskPattern;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    });

    const interlace = params.advancedInterlacing || 0;
    if (interlace > 0) {
      this.applyLuminanceEffect(outCtx, width, height, (ctx) => {
        const parity = frameIndex % 2;
        ctx.fillStyle = `rgba(0,0,0,${(0.18 * interlace).toFixed(3)})`;
        for (let y = parity; y < height; y += 2) ctx.fillRect(0, y, width, 1);
      });
    }
  }

  passBloom(outCtx, width, height, params) {
    const bloom = params.bloom;
    if (bloom <= 0) return;

    this.applyLuminanceEffect(outCtx, width, height, (ctx) => {
      ctx.globalAlpha = bloom * 0.5;
      ctx.filter = `blur(${1 + bloom * 6}px) brightness(${1 + bloom * 0.45})`;
      ctx.drawImage(outCtx.canvas, 0, 0);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
    });
  }

  passTemporalNoise(outCtx, width, height, params, seconds, frameIndex, fps) {
    const flickerWave = Math.sin((frameIndex / fps) * Math.PI * 2 * 2.1) * 0.5 + 0.5;
    const flicker = params.flicker * (0.35 + flickerWave * 0.65);
    this.applyLuminanceEffect(outCtx, width, height, (ctx) => {
      ctx.fillStyle = `rgba(255,255,255,${flicker * 0.12})`;
      ctx.fillRect(0, 0, width, height);
    });

    if (params.noise <= 0) return;
    this.applyLuminanceEffect(outCtx, width, height, (ctx) => {
      const count = Math.floor(width * height * 0.003 * params.noise);
      for (let i = 0; i < count; i++) {
        const x = Math.floor(seededNoise(i, seconds, frameIndex) * width);
        const y = Math.floor(seededNoise(i * 2, seconds + 3.1, frameIndex) * height);
        const a = seededNoise(x, y, frameIndex) * 0.2 * params.noise;
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    });
  }

  passPostProcessing(outCtx, width, height, params, seconds, frameIndex) {
    const headSwitch = params.advancedHeadSwitching || 0;
    if (headSwitch > 0) {
      const bandHeight = Math.max(5, Math.floor(height * 0.07));
      const bandY = height - bandHeight - Math.floor(seededNoise(frameIndex, seconds, 9) * 4);
      const grad = outCtx.createLinearGradient(0, bandY, 0, bandY + bandHeight);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(0.5, `rgba(255,255,255,${(headSwitch * 0.16).toFixed(3)})`);
      grad.addColorStop(1, `rgba(0,0,0,${(headSwitch * 0.2).toFixed(3)})`);
      outCtx.fillStyle = grad;
      outCtx.fillRect(0, bandY, width, bandHeight);
    }

    const dropouts = params.advancedDropouts || 0;
    if (dropouts > 0) {
      const streaks = Math.floor(2 + dropouts * 8);
      for (let i = 0; i < streaks; i++) {
        const y = Math.floor(seededNoise(frameIndex, i * 13, seconds) * height);
        const streakW = Math.floor(width * (0.05 + seededNoise(i, frameIndex, 2.4) * 0.25));
        const x = Math.floor(seededNoise(i, seconds, frameIndex) * Math.max(1, width - streakW));
        outCtx.fillStyle = `rgba(255,255,255,${(0.08 + dropouts * 0.22).toFixed(3)})`;
        outCtx.fillRect(x, y, streakW, 1);
      }
    }

    const ghosting = params.advancedGhosting || 0;
    if (ghosting > 0) {
      this.ensureSize(this.tempCanvas, width, height);
      const tctx = this.tempCanvas.getContext("2d");
      tctx.clearRect(0, 0, width, height);
      tctx.globalAlpha = Math.min(0.45, ghosting * 0.4);
      tctx.filter = `blur(${(ghosting * 2.4).toFixed(2)}px)`;
      tctx.drawImage(outCtx.canvas, 0, 0);
      tctx.filter = "none";
      tctx.globalAlpha = 1;

      outCtx.save();
      outCtx.globalAlpha = Math.min(0.35, ghosting * 0.3);
      outCtx.drawImage(this.tempCanvas, 2 + ghosting * 6, 0);
      outCtx.restore();
    }
  }

  render(outCtx, width, height, seconds, params, frameIndex, fps) {
    outCtx.clearRect(0, 0, width, height);
    outCtx.fillStyle = "black";
    outCtx.fillRect(0, 0, width, height);
    if (!this.hasImage) return;

    this.passGeometry(width, height, params, seconds);
    this.passColorSeparation(width, height, params);

    outCtx.drawImage(this.workCanvas, 0, 0);
    this.buildLuminanceMask(width, height);

    this.passScanlineAndMask(outCtx, width, height, params, frameIndex);
    this.passBloom(outCtx, width, height, params);
    this.passTemporalNoise(outCtx, width, height, params, seconds, frameIndex, fps);
    this.passPostProcessing(outCtx, width, height, params, seconds, frameIndex);
  }
}
