import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";
import { EFFECT_INFO, PANEL_INFO } from "@/lib/effect-info";

interface SensorLensPanelProps {
  params: Record<string, number>;
  onChange: (key: string, value: number) => void;
  enabled?: boolean;
  onToggleEnabled?: (on: boolean) => void;
}

const SensorLensPanel = ({ params, onChange, enabled = true, onToggleEnabled }: SensorLensPanelProps) => {
  return (
    <CollapsiblePanel title="Sensor & Lens" description={PANEL_INFO.sensorLens} defaultOpen={false} enabled={enabled} onToggleEnabled={onToggleEnabled} panelId="sensorLens">
      <div className="pt-2 space-y-2.5">
        <EffectSlider label="Rolling Shutter Skew" description={EFFECT_INFO.rollingShutterSkew} value={params.rollingShutterSkew ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("rollingShutterSkew", v)} />
        <EffectSlider label="Fixed Pattern Noise" description={EFFECT_INFO.fixedPatternNoise} value={params.fixedPatternNoise ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("fixedPatternNoise", v)} />
        <EffectSlider label="Hot Pixels" description={EFFECT_INFO.hotPixels} value={params.hotPixels ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("hotPixels", v)} />
        <EffectSlider label="Lens Smear" description={EFFECT_INFO.lensSmear} value={params.lensSmear ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("lensSmear", v)} />
        <EffectSlider label="Haze" description={EFFECT_INFO.haze} value={params.haze ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("haze", v)} />
        <EffectSlider label="Flare Ghosts" description={EFFECT_INFO.flareGhosts} value={params.flareGhosts ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("flareGhosts", v)} />
        <EffectSlider label="Vignette" description={EFFECT_INFO.vignette} value={params.vignette ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("vignette", v)} />
        <EffectSlider label="Corner Sharpness Falloff" description={EFFECT_INFO.cornerSharpnessFalloff} value={params.cornerSharpnessFalloff ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("cornerSharpnessFalloff", v)} />
      </div>
    </CollapsiblePanel>
  );
};

export default SensorLensPanel;
