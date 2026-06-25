import { useState } from "react";
import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";
import { PANEL_INFO } from "@/lib/effect-info";

const OSD_STYLES = [
  { value: 0, label: "Classic" },
  { value: 1, label: "Digital" },
  { value: 2, label: "Tape Cam" },
  { value: 3, label: "Broadcast" },
  { value: 4, label: "Early 00s Digital Still" },
  { value: 5, label: "Late 90s Film Cam" },
  { value: 6, label: "Police Recorder" },
  { value: 7, label: "Broadcast Timecode" },
  { value: 8, label: "Modern CCTV Screen" },
  { value: 9, label: "Custom Corners" },
];

const OSD_FONTS = [
  { value: "vhs", label: "VHS 80s/90s" },
  { value: "camcorder", label: "Camcorder 90s" },
  { value: "cctv", label: "CCTV/monitor" },
  { value: "broadcast", label: "Broadcast 2000s" },
  { value: "hdzeroDefault", label: "HDZero Default" },
  { value: "hdzeroConthrax", label: "HDZero Conthrax" },
  { value: "hdzeroVision", label: "HDZero Vision+" },
  { value: "led", label: "7-segment LED" },
  { value: "filmSegmentThin", label: "Film 7-seg Thin" },
  { value: "lcd", label: "Pocket LCD" },
  { value: "modern", label: "Modern UI" },
];

const CORNERS = [
  { id: "topLeft", label: "Top-left", defaultText: "CAM2" },
  { id: "topCenter", label: "Top-center", defaultText: "" },
  { id: "topRight", label: "Top-right", defaultText: "CTFID CHANNEL3" },
  { id: "bottomLeft", label: "Bottom-left", defaultText: "" },
  { id: "bottomCenter", label: "Bottom-center", defaultText: "" },
  { id: "bottomRight", label: "Bottom-right", defaultText: "" },
];

export interface OSDOptions {
  timestampOSD: number;
  osdStyle: number;
  osdBloom: number;
  osdFontScale: number;
  osdThickness: number;
  osdStartDateTime: string;
  osdCountWithExport: boolean;
  osdSeed: number;
  osdPrimaryColor: string;
  osdAccentColor: string;
  osdFontPreset: string;
  osdCornerConfig: Record<string, { enabled: boolean; text: string }>;
}

export const DEFAULT_OSD_OPTIONS: OSDOptions = {
  timestampOSD: 0,
  osdStyle: 0,
  osdBloom: 0.35,
  osdFontScale: 1,
  osdThickness: 1,
  osdStartDateTime: "1998-10-31T22:48:00",
  osdCountWithExport: true,
  osdSeed: 104729,
  osdPrimaryColor: "#ffa84a",
  osdAccentColor: "#ff3a3a",
  osdFontPreset: "vhs",
  osdCornerConfig: {
    topLeft: { enabled: true, text: "CAM2" },
    topCenter: { enabled: false, text: "" },
    topRight: { enabled: true, text: "CTFID CHANNEL3" },
    bottomLeft: { enabled: false, text: "" },
    bottomCenter: { enabled: false, text: "" },
    bottomRight: { enabled: false, text: "" },
  },
};

interface OSDControlsProps {
  options: OSDOptions;
  onChange: (options: OSDOptions) => void;
  onParamChange: (key: string, value: number) => void;
  timestampValue: number;
  enabled?: boolean;
  onToggleEnabled?: (on: boolean) => void;
}

const OSDControls = ({ options, onChange, onParamChange, timestampValue, enabled = true, onToggleEnabled }: OSDControlsProps) => {
  const update = (partial: Partial<OSDOptions>) => {
    onChange({ ...options, ...partial });
  };

  const updateCorner = (cornerId: string, partial: Partial<{ enabled: boolean; text: string }>) => {
    const current = options.osdCornerConfig[cornerId] || { enabled: false, text: "" };
    onChange({
      ...options,
      osdCornerConfig: {
        ...options.osdCornerConfig,
        [cornerId]: { ...current, ...partial },
      },
    });
  };

  const insertToken = (token: string) => {
    // Find first focused/active corner input and insert token
    const active = document.activeElement as HTMLInputElement;
    if (active?.dataset?.cornerId) {
      const cornerId = active.dataset.cornerId;
      const current = options.osdCornerConfig[cornerId]?.text || "";
      updateCorner(cornerId, { text: current + token });
    }
  };

  const rerollSeed = () => {
    update({ osdSeed: Math.floor(Math.random() * 999999999) });
  };

  return (
    <CollapsiblePanel title="Overlays & OSD" description={PANEL_INFO.osd} defaultOpen={false} panelId="osd" enabled={enabled} onToggleEnabled={onToggleEnabled}>
      <div className="pt-2 space-y-3">
        <EffectSlider
          label="Timestamp Intensity"
          value={timestampValue}
          min={0} max={1} step={0.01}
          onChange={(v) => onParamChange("advancedTimestampOSD", v)}
        />
        <EffectSlider label="OSD Bloom" value={options.osdBloom} min={0} max={1} step={0.01} onChange={(v) => update({ osdBloom: v })} />
        <EffectSlider label="OSD Font Scale" value={options.osdFontScale} min={0.6} max={2} step={0.01} onChange={(v) => update({ osdFontScale: v })} />
        <EffectSlider label="OSD Thickness" value={options.osdThickness} min={0.5} max={2} step={0.01} onChange={(v) => update({ osdThickness: v })} />

        {/* OSD Style */}
        <div>
          <span className="text-xs text-muted-foreground mb-1.5 block">OSD Style</span>
          <div className="flex flex-wrap gap-1">
            {OSD_STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => {
                  update({ osdStyle: s.value });
                  onParamChange("advancedOSDStyle", s.value);
                }}
                className={`px-2 py-0.5 text-[12px] rounded border transition-colors ${
                  options.osdStyle === s.value
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start date/time */}
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Start date/time</span>
          <input
            type="datetime-local"
            value={options.osdStartDateTime}
            onChange={(e) => update({ osdStartDateTime: e.target.value })}
            className="px-2.5 py-1.5 text-xs font-mono bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={options.osdCountWithExport}
            onChange={(e) => update({ osdCountWithExport: e.target.checked })}
            className="rounded border-border"
          />
          Timecode counts up with export/playback
        </label>

        {/* Metadata seed */}
        <div className="flex items-center gap-2">
          <label className="flex-1 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Metadata seed</span>
            <input
              type="number"
              value={options.osdSeed}
              min={0}
              max={999999999}
              onChange={(e) => update({ osdSeed: Number(e.target.value) })}
              className="px-2.5 py-1.5 text-xs font-mono bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </label>
          <button
            onClick={rerollSeed}
            className="mt-4 px-2.5 py-1.5 text-[12px] font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors border border-border"
          >
            Reroll
          </button>
        </div>

        {/* Colors */}
        <div className="flex gap-3">
          <label className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Primary</span>
            <input
              type="color"
              value={options.osdPrimaryColor}
              onChange={(e) => update({ osdPrimaryColor: e.target.value })}
              className="w-6 h-6 rounded border border-border cursor-pointer"
            />
          </label>
          <label className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Accent</span>
            <input
              type="color"
              value={options.osdAccentColor}
              onChange={(e) => update({ osdAccentColor: e.target.value })}
              className="w-6 h-6 rounded border border-border cursor-pointer"
            />
          </label>
        </div>

        {/* Corner labels */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground block">Custom labels</span>
          <p className="text-[11px] text-muted-foreground">
            Use {"{date}"}, {"{time}"}, {"{datetime}"}, {"{tc}"}, {"{frame}"}, or {"{fps}"}
          </p>
          <div className="flex flex-wrap gap-1 mb-2">
            {["{date}", "{time}", "{datetime}", "{tc}", "{frame}", "{fps}"].map((token) => (
              <button
                key={token}
                onClick={() => insertToken(token)}
                className="px-1.5 py-0.5 text-[11px] bg-secondary border border-border rounded text-muted-foreground hover:text-foreground transition-colors"
              >
                {token.replace(/[{}]/g, "")}
              </button>
            ))}
          </div>
          {CORNERS.map((corner) => {
            const cfg = options.osdCornerConfig[corner.id] || { enabled: false, text: "" };
            return (
              <div key={corner.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={cfg.enabled}
                  onChange={(e) => updateCorner(corner.id, { enabled: e.target.checked })}
                  className="rounded border-border shrink-0"
                />
                <span className="text-[12px] text-muted-foreground w-20 shrink-0">{corner.label}</span>
                <input
                  type="text"
                  value={cfg.text}
                  data-corner-id={corner.id}
                  maxLength={80}
                  placeholder="Optional"
                  onChange={(e) => updateCorner(corner.id, { text: e.target.value })}
                  className="flex-1 px-2 py-1 text-[12px] font-mono bg-secondary border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            );
          })}
        </div>

        {/* Era font */}
        <div>
          <span className="text-xs text-muted-foreground mb-1.5 block">Era font</span>
          <div className="flex flex-wrap gap-1">
            {OSD_FONTS.map((f) => (
              <button
                key={f.value}
                onClick={() => update({ osdFontPreset: f.value })}
                className={`px-2 py-0.5 text-[12px] rounded border transition-colors ${
                  options.osdFontPreset === f.value
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </CollapsiblePanel>
  );
};

export default OSDControls;
