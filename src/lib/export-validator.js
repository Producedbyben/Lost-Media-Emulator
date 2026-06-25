// Export validator
// -----------------
// Verifies that the export pipeline produces deterministic, CPU-only output and
// that it faithfully matches what the user sees in the live preview.
//
// Two checks are performed:
//   1. Determinism — the same frame rendered twice (from a clean reset) on the
//      forced CPU path must be byte-for-byte identical. This guarantees exports
//      are reproducible and free of GPU/driver variance or stale temporal state.
//   2. Preview parity — an export-path CPU render of the currently-displayed
//      frame is compared against the live preview canvas pixels. Small
//      differences are expected when the preview is running on the GPU; large
//      ones indicate the export will not look like the preview.

function readPixels(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
}

function renderCpuFrame(renderer, width, height, seconds, params, frameIndex, fps, renderOptions) {
  const off = document.createElement("canvas");
  off.width = Math.max(1, width);
  off.height = Math.max(1, height);
  const ctx = off.getContext("2d", { alpha: false, willReadFrequently: true });
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, off.width, off.height);
  renderer.reset?.();
  renderer.render(ctx, off.width, off.height, seconds, params, frameIndex, fps, renderOptions);
  return off;
}

function comparePixels(a, b) {
  const len = Math.min(a.length, b.length);
  let identical = a.length === b.length;
  let maxDiff = 0;
  let sum = 0;
  let changed = 0;
  for (let i = 0; i < len; i++) {
    const d = Math.abs(a[i] - b[i]);
    if (d !== 0) {
      changed++;
      if (d > maxDiff) maxDiff = d;
    }
    sum += d;
  }
  return {
    identical: identical && maxDiff === 0,
    maxDiff,
    meanDiff: len > 0 ? sum / len : 0,
    changedRatio: len > 0 ? changed / (len / 4) : 0,
  };
}

/**
 * Validate the export pipeline for the currently-shown frame.
 *
 * @param {Object} opts
 * @param {Object} opts.renderer       CRTRendererHybrid instance.
 * @param {HTMLCanvasElement} opts.previewCanvas  Live preview canvas.
 * @param {Object} opts.params         Current effect parameters.
 * @param {number} opts.seconds        Frame time in seconds.
 * @param {number} opts.frameIndex     Frame index.
 * @param {number} opts.fps            Frames per second.
 * @param {Object} [opts.renderOptions] OSD / sourceView render options.
 * @returns {Promise<Object>} validation report
 */
export async function validateExportAgainstPreview({
  renderer, previewCanvas, params, seconds = 0, frameIndex = 0, fps = 30, renderOptions,
}) {
  if (!renderer || !previewCanvas) {
    return { ok: false, error: "Renderer or preview canvas unavailable." };
  }

  const width = previewCanvas.width;
  const height = previewCanvas.height;
  if (width < 2 || height < 2) {
    return { ok: false, error: "Preview is not ready." };
  }

  // Capture the live preview pixels BEFORE we touch the renderer mode.
  const previewPixels = readPixels(previewCanvas);
  const previewMode = renderer.activeMode || "cpu";

  // Force the deterministic CPU pipeline.
  const prevPreferGPU = renderer.preferGPU;
  if (prevPreferGPU && renderer.setPreferGPU) renderer.setPreferGPU(false);

  try {
    // Determinism: render the same frame twice from a clean reset.
    const passA = renderCpuFrame(renderer, width, height, seconds, params, frameIndex, fps, renderOptions);
    const passB = renderCpuFrame(renderer, width, height, seconds, params, frameIndex, fps, renderOptions);
    const determinism = comparePixels(readPixels(passA), readPixels(passB));

    // Parity: compare the CPU export frame against the live preview pixels.
    const parity = comparePixels(readPixels(passA), previewPixels);

    // Tolerances (mean per-channel delta, 0–255). Parity compares the export
    // render against the live preview, which is usually shown at a *different*
    // resolution — so resampling/filtering alone yields a few levels of delta on
    // a perfectly correct export. Determinism (byte-identical re-render) is the
    // hard guarantee; parity is a soft "looks like the preview" check, so its
    // threshold is forgiving. GPU previews diverge a little more than CPU.
    const parityTolerance = previewMode === "gpu" ? 12 : 6;
    const parityOk = parity.meanDiff <= parityTolerance;

    return {
      ok: determinism.identical && parityOk,
      width,
      height,
      previewMode,
      determinism: {
        identical: determinism.identical,
        maxDiff: determinism.maxDiff,
        meanDiff: Number(determinism.meanDiff.toFixed(3)),
      },
      parity: {
        ok: parityOk,
        maxDiff: parity.maxDiff,
        meanDiff: Number(parity.meanDiff.toFixed(3)),
        changedRatio: Number(parity.changedRatio.toFixed(3)),
        tolerance: parityTolerance,
      },
    };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  } finally {
    if (prevPreferGPU && renderer.setPreferGPU) renderer.setPreferGPU(true);
  }
}
