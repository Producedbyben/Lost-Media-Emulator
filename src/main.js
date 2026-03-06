import { CRTRenderer } from "./crt-renderer.js";
import { exportMp4 } from "./exporter.js";

const OFF_ADVANCED = {
  advancedLineJitter: 0,
  advancedTimebaseWobble: 0,
  advancedHeadSwitching: 0,
  advancedChromaDelay: 0,
  advancedCrossColor: 0,
  advancedDropouts: 0,
  advancedGhosting: 0,
  advancedInterlacing: 0,
};

const FALLBACK_PRESETS = {
  "Consumer TV": {
    scanlineStrength: 0.45,
    phosphorMask: 0.36,
    barrelDistortion: -0.109,
    bloom: 0.45,
    flicker: 0.1,
    chromaticAberration: 0.3,
    noise: 0.2,
    ...OFF_ADVANCED,
  },
  "RF Broadcast": {
    scanlineStrength: 0.42,
    phosphorMask: 0.38,
    barrelDistortion: -0.094,
    bloom: 0.48,
    flicker: 0.14,
    chromaticAberration: 0.36,
    noise: 0.24,
    advancedLineJitter: 0.18,
    advancedTimebaseWobble: 0.24,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0.2,
    advancedCrossColor: 0.25,
    advancedDropouts: 0.12,
    advancedGhosting: 0.14,
    advancedInterlacing: 0.18,
  },
  "VHS EP": {
    scanlineStrength: 0.5,
    phosphorMask: 0.24,
    barrelDistortion: -0.086,
    bloom: 0.62,
    flicker: 0.16,
    chromaticAberration: 0.5,
    noise: 0.3,
    advancedLineJitter: 0.26,
    advancedTimebaseWobble: 0.36,
    advancedHeadSwitching: 0.44,
    advancedChromaDelay: 0.35,
    advancedCrossColor: 0.4,
    advancedDropouts: 0.34,
    advancedGhosting: 0.32,
    advancedInterlacing: 0.3,
  },
  "Hi8 Camcorder": {
    scanlineStrength: 0.38,
    phosphorMask: 0.3,
    barrelDistortion: -0.055,
    bloom: 0.42,
    flicker: 0.1,
    chromaticAberration: 0.22,
    noise: 0.18,
    advancedLineJitter: 0.08,
    advancedTimebaseWobble: 0.14,
    advancedHeadSwitching: 0.18,
    advancedChromaDelay: 0.22,
    advancedCrossColor: 0.2,
    advancedDropouts: 0.14,
    advancedGhosting: 0.22,
    advancedInterlacing: 0.24,
  },
  "Arcade Cabinet": {
    scanlineStrength: 0.44,
    phosphorMask: 0.56,
    barrelDistortion: -0.078,
    bloom: 0.58,
    flicker: 0.07,
    chromaticAberration: 0.18,
    noise: 0.11,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0.12,
    advancedInterlacing: 0,
  },
};

const renderer = new CRTRenderer();
const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d");

const statusEl = document.getElementById("status");
const progressEl = document.getElementById("progress");
const exportBtn = document.getElementById("exportBtn");
const presetSelect = document.getElementById("presetSelect");

const controlIds = [
  "scanlineStrength",
  "phosphorMask",
  "barrelDistortion",
  "bloom",
  "flicker",
  "chromaticAberration",
  "noise",
  "advancedLineJitter",
  "advancedTimebaseWobble",
  "advancedHeadSwitching",
  "advancedChromaDelay",
  "advancedCrossColor",
  "advancedDropouts",
  "advancedGhosting",
  "advancedInterlacing",
];

let hasLoadedImage = false;
let presets = { ...FALLBACK_PRESETS };

function setStatus(message, mode = "info") {
  statusEl.textContent = message;
  statusEl.dataset.mode = mode;
}

function setExportAvailability() {
  exportBtn.disabled = !hasLoadedImage;
}

async function loadPresets() {
  try {
    const module = await import("./presets.js");
    if (module?.PRESETS && Object.keys(module.PRESETS).length > 0) {
      presets = module.PRESETS;
      setStatus("Presets loaded successfully.", "success");
      return;
    }
    setStatus("Preset file loaded but empty. Using built-in presets.", "warn");
  } catch (error) {
    setStatus("Could not load presets.js. Using built-in presets.", "warn");
    console.warn("Preset loading failed", error);
  }
}

function initializePresets() {
  const names = Object.keys(presets);
  presetSelect.innerHTML = "";

  if (names.length === 0) {
    const opt = document.createElement("option");
    opt.textContent = "No presets available";
    opt.disabled = true;
    opt.selected = true;
    presetSelect.appendChild(opt);
    return;
  }

  for (const name of names) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    presetSelect.appendChild(opt);
  }

  const defaultPreset = presets["Consumer TV"] ? "Consumer TV" : names[0];
  presetSelect.value = defaultPreset;
  applyPreset(defaultPreset);
}

function readParams() {
  return Object.fromEntries(controlIds.map((id) => [id, Number(document.getElementById(id).value)]));
}

function applyPreset(name) {
  const values = presets[name];
  if (!values) return;
  for (const id of controlIds) {
    if (typeof values[id] === "number") {
      document.getElementById(id).value = values[id];
    }
  }
  return img;
}

async function loadImageFromFile(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch (error) {
      console.warn("createImageBitmap failed; falling back to Image.decode", error);
    }
  }

  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;
  try {
    await img.decode();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
  return img;
}

presetSelect.addEventListener("change", () => {
  applyPreset(presetSelect.value);
  progressEl.value = 0;
  setStatus(`Preset applied: ${presetSelect.value}`, "success");
});

const fpsInput = document.getElementById("fps");
const durationInput = document.getElementById("duration");
let start = performance.now();

function animate(now) {
  const fps = Math.max(1, Number(fpsInput.value) || 60);
  const elapsed = (now - start) / 1000;
  const frame = Math.floor(elapsed * fps);
  renderer.render(ctx, canvas.width, canvas.height, frame / fps, readParams(), frame, fps);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

const imageInput = document.getElementById("imageInput");
imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0];
  if (!file) return;

  progressEl.value = 0.05;
  setStatus(`Processing ${file.name} (${Math.round(file.size / 1024)} KB)...`, "info");

  try {
    const imageSource = await loadImageFromFile(file);
    progressEl.value = 0.4;
    renderer.setImage(imageSource);
    if (typeof imageSource.close === "function") imageSource.close();
    progressEl.value = 1;
    hasLoadedImage = true;
    setExportAvailability();
    start = performance.now();
    setStatus(`Loaded ${file.name}. Ready to export.`, "success");
  } catch (error) {
    hasLoadedImage = false;
    progressEl.value = 0;
    setExportAvailability();
    setStatus(`Couldn't load image: ${error.message}`, "error");
    console.error(error);
  }
});

for (const id of [...controlIds, "fps", "duration"]) {
  document.getElementById(id).addEventListener("input", () => {
    progressEl.value = 0;
  });
}

exportBtn.addEventListener("click", async () => {
  if (!hasLoadedImage) {
    setStatus("Load an image before exporting.", "warn");
    return;
  }

  try {
    exportBtn.disabled = true;
    progressEl.value = 0;
    setStatus("Preparing export...", "info");
    await exportMp4({
      canvas,
      renderer,
      params: readParams(),
      fps: Math.max(1, Number(fpsInput.value) || 60),
      duration: Math.max(0.5, Number(durationInput.value) || 4),
      onProgress: (value, current, total) => {
        progressEl.value = value;
        setStatus(`Encoding frame ${current}/${total}`, "info");
      },
    });
    setStatus("Export finished. Download should begin automatically.", "success");
  } catch (error) {
    setStatus(`Export failed: ${error.message}`, "error");
    console.error(error);
  } finally {
    setExportAvailability();
  }
});

(async function init() {
  setExportAvailability();
  setStatus("Starting renderer and loading presets...", "info");
  await loadPresets();
  initializePresets();
  if (!hasLoadedImage) {
    setStatus("Load an image to begin.", "info");
  }
})();
