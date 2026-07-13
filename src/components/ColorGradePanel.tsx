import { memo } from "react";
import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";
import ColorPad2D from "./ColorPad2D";
import { EFFECT_INFO, PANEL_INFO } from "@/lib/effect-info";

interface ColorGradePanelProps {
  params: Record<string, number>;
  onChange: (key: string, value: number) => void;
  enabled?: boolean;
  onToggleEnabled?: (on: boolean) => void;
}

const Sub = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 pt-1.5 first:pt-0">
    <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/60">{label}</span>
    <div className="flex-1 h-px bg-border/40" />
  </div>
);

/**
 * Color & Grade — combines the primary image grade (exposure / colour balance)
 * with the analog colour-signal degradation that used to live in a separate
 * "Color & Signal" panel.
 */
const ColorGradePanel = ({ params, onChange, enabled = true, onToggleEnabled }: ColorGradePanelProps) => {
  return (
    <CollapsiblePanel title="Color & Grade" description={PANEL_INFO.grading} defaultOpen={false} enabled={enabled} onToggleEnabled={onToggleEnabled} panelId="grading">
      <div className="pt-2 space-y-2.5">
        <Sub label="Primary Grade" />
        <EffectSlider label="Brightness" description={EFFECT_INFO.imageBrightness} value={params.imageBrightness ?? 1} min={0.5} max={1.5} step={0.01} defaultValue={1} onChange={(v) => onChange("imageBrightness", v)} />
        <EffectSlider label="Contrast" description={EFFECT_INFO.imageContrast} value={params.imageContrast ?? 1} min={0.5} max={1.6} step={0.01} defaultValue={1} onChange={(v) => onChange("imageContrast", v)} />
        <EffectSlider label="Saturation" description={EFFECT_INFO.advancedSaturation} value={params.advancedSaturation ?? 1} min={0} max={3} step={0.01} defaultValue={1} onChange={(v) => onChange("advancedSaturation", v)} />
        <EffectSlider label="Gamma" description={EFFECT_INFO.imageGamma} value={params.imageGamma ?? 1} min={0.6} max={1.8} step={0.01} defaultValue={1} onChange={(v) => onChange("imageGamma", v)} />
        <ColorPad2D
          tempValue={params.imageTemperature ?? 0}
          tintValue={params.imageTint ?? 0}
          onTempChange={(v) => onChange("imageTemperature", v)}
          onTintChange={(v) => onChange("imageTint", v)}
        />
        <EffectSlider label="Temperature" description={EFFECT_INFO.imageTemperature} value={params.imageTemperature ?? 0} min={-1} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("imageTemperature", v)} />
        <EffectSlider label="Tint" description={EFFECT_INFO.imageTint} value={params.imageTint ?? 0} min={-1} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("imageTint", v)} />

        <Sub label="Colour Signal" />
        <EffectSlider label="Luma Noise" description={EFFECT_INFO.lumaNoise} value={params.lumaNoise ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("lumaNoise", v)} />
        <EffectSlider label="Chroma Noise" description={EFFECT_INFO.chromaNoise} value={params.chromaNoise ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("chromaNoise", v)} />
        <EffectSlider label="Chroma Bleed H" description={EFFECT_INFO.chromaBleedHorizontal} value={params.chromaBleedHorizontal ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("chromaBleedHorizontal", v)} />
        <EffectSlider label="Chroma Bleed V" description={EFFECT_INFO.chromaBleedVertical} value={params.chromaBleedVertical ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("chromaBleedVertical", v)} />
        <EffectSlider label="Chroma Phase Error" description={EFFECT_INFO.chromaPhaseError} value={params.chromaPhaseError ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("chromaPhaseError", v)} />
        <EffectSlider label="Black Level Crush" description={EFFECT_INFO.blackLevelCrush} value={params.blackLevelCrush ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("blackLevelCrush", v)} />
        <EffectSlider label="Highlight Roll-Off" description={EFFECT_INFO.highlightRollOff} value={params.highlightRollOff ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("highlightRollOff", v)} />
        <EffectSlider label="Gamma Curve" description={EFFECT_INFO.gammaCurve} value={params.gammaCurve ?? 1} min={0.1} max={3} step={0.01} defaultValue={1} onChange={(v) => onChange("gammaCurve", v)} />
      </div>
    </CollapsiblePanel>
  );
};

export default memo(ColorGradePanel);
