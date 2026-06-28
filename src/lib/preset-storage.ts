import { CRTParams, DEFAULT_PARAMS } from "@/hooks/useCRTRenderer";

const STORAGE_KEY = "lme-custom-presets";

export interface CustomPreset {
  name: string;
  params: Record<string, number | string>;
  createdAt: number;
  tags?: string[];
}

export function loadCustomPresets(): CustomPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveCustomPreset(preset: CustomPreset): CustomPreset[] {
  const presets = loadCustomPresets();
  const existing = presets.findIndex(p => p.name === preset.name);
  if (existing >= 0) presets[existing] = preset;
  else presets.push(preset);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return presets;
}

export function deleteCustomPreset(name: string): CustomPreset[] {
  const presets = loadCustomPresets().filter(p => p.name !== name);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return presets;
}

export function exportPresetsJSON(presets: CustomPreset[]): string {
  return JSON.stringify({ version: 1, presets }, null, 2);
}

export function importPresetsJSON(json: string): CustomPreset[] {
  try {
    const data = JSON.parse(json);
    if (data.version === 1 && Array.isArray(data.presets)) return data.presets;
    if (Array.isArray(data)) return data;
    return [];
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Single "full look" export/import — the complete current settings (every effect
// param incl. maskType / scanlineProfile / monochromeTint / OSD / advanced) as a
// portable JSON the user can save to disk and load back to reproduce the look.
// ---------------------------------------------------------------------------
export function exportLookJSON(params: Record<string, number | string>, name = "Custom Look"): string {
  return JSON.stringify({ schema: "lme-look", version: 1, name, exportedAt: Date.now(), params }, null, 2);
}

// Robustly parse a look file. Accepts: an lme-look single look, the bulk preset
// export ({version, presets:[…]} → first look), a bare {name, params} preset, or a
// raw params object (all values number|string). Returns null if it isn't a look.
export function parseLookJSON(json: string): { name: string; params: Record<string, number | string> } | null {
  try {
    const data = JSON.parse(json);
    if (!data || typeof data !== "object") return null;
    if (data.schema === "lme-look" && data.params && typeof data.params === "object") {
      return { name: String(data.name || "Imported Look"), params: data.params };
    }
    if (Array.isArray(data.presets) && data.presets[0] && typeof data.presets[0].params === "object") {
      return { name: String(data.presets[0].name || "Imported Look"), params: data.presets[0].params };
    }
    if (data.params && typeof data.params === "object") {
      return { name: String(data.name || "Imported Look"), params: data.params };
    }
    const vals = Object.values(data);
    if (vals.length > 0 && vals.every((v) => typeof v === "number" || typeof v === "string")) {
      return { name: "Imported Look", params: data as Record<string, number | string> };
    }
    return null;
  } catch { return null; }
}

// URL encoding: compact base64 of numeric params only
export function encodeParamsToURL(params: CRTParams): string {
  const numericParams: Record<string, number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "number" && v !== (DEFAULT_PARAMS as any)[k]) {
      numericParams[k] = Math.round(v * 1000) / 1000;
    }
  }
  if (params.maskType !== DEFAULT_PARAMS.maskType) {
    numericParams["_mt"] = 0; // placeholder
  }
  const json = JSON.stringify(numericParams);
  try {
    return btoa(json);
  } catch {
    return encodeURIComponent(json);
  }
}

export function decodeParamsFromURL(encoded: string): Partial<CRTParams> | null {
  try {
    let json: string;
    try {
      json = atob(encoded);
    } catch {
      json = decodeURIComponent(encoded);
    }
    const parsed = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) return parsed;
    return null;
  } catch { return null; }
}

export function encodeFullLookURL(params: CRTParams, maskType?: string): string {
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "number") {
      const def = (DEFAULT_PARAMS as any)[k];
      if (typeof def === "number" && Math.abs(v - def) > 0.001) {
        data[k] = Math.round(v * 1000) / 1000;
      }
    }
  }
  if (maskType && maskType !== DEFAULT_PARAMS.maskType) {
    data.maskType = maskType;
  }
  const json = JSON.stringify(data);
  return btoa(json);
}

export function generateShareURL(params: CRTParams): string {
  const encoded = encodeFullLookURL(params, params.maskType as string);
  const base = window.location.origin + window.location.pathname;
  return `${base}?look=${encoded}`;
}
