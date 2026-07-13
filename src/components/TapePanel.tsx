import { memo } from "react";
import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";
import { EFFECT_INFO, PANEL_INFO } from "@/lib/effect-info";

interface TapePanelProps {
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
 * Tape & Dropouts — combines the classic video artifacts, the v2 temporal
 * instability controls and the v2 tape-mechanics controls into one panel that
 * covers everything magnetic-tape and timing related.
 */
const TapePanel = ({ params, onChange, enabled = true, onToggleEnabled }: TapePanelProps) => {
  return (
    <CollapsiblePanel title="Tape & Dropouts" description={PANEL_INFO.tape} defaultOpen={false} enabled={enabled} onToggleEnabled={onToggleEnabled} panelId="tape">
      <div className="pt-2 space-y-2.5">
        <Sub label="Video Artifacts" />
        <EffectSlider label="Pixel Size" description={EFFECT_INFO.pixelSize} value={params.pixelSize ?? 1} min={1} max={8} step={1} defaultValue={1} onChange={(v) => onChange("pixelSize", v)} />
        <EffectSlider label="Line Jitter" description={EFFECT_INFO.advancedLineJitter} value={params.advancedLineJitter ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedLineJitter", v)} />
        <EffectSlider label="Timebase Wobble" description={EFFECT_INFO.advancedTimebaseWobble} value={params.advancedTimebaseWobble ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedTimebaseWobble", v)} />
        <EffectSlider label="Head-Switching Noise" description={EFFECT_INFO.advancedHeadSwitching} value={params.advancedHeadSwitching ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedHeadSwitching", v)} />
        <EffectSlider label="Luma/Chroma Delay" description={EFFECT_INFO.advancedChromaDelay} value={params.advancedChromaDelay ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedChromaDelay", v)} />
        <EffectSlider label="Cross-Color Artifacts" description={EFFECT_INFO.advancedCrossColor} value={params.advancedCrossColor ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedCrossColor", v)} />
        <EffectSlider label="Dropouts/Tracking" description={EFFECT_INFO.advancedDropouts} value={params.advancedDropouts ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedDropouts", v)} />
        <EffectSlider label="Ghosting/Trailing" description={EFFECT_INFO.advancedGhosting} value={params.advancedGhosting ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedGhosting", v)} />
        <EffectSlider label="Interlacing" description={EFFECT_INFO.advancedInterlacing} value={params.advancedInterlacing ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedInterlacing", v)} />
        <EffectSlider label="Tape Crease Events" description={EFFECT_INFO.advancedTapeCrease} value={params.advancedTapeCrease ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedTapeCrease", v)} />

        <Sub label="Temporal Instability" />
        <EffectSlider label="Dropout Frequency" description={EFFECT_INFO.dropoutFrequency} value={params.dropoutFrequency ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("dropoutFrequency", v)} />
        <EffectSlider label="Dropout Length" description={EFFECT_INFO.dropoutLength} value={params.dropoutLength ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("dropoutLength", v)} />
        <EffectSlider label="Jitter Speed" description={EFFECT_INFO.jitterSpeed} value={params.jitterSpeed ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("jitterSpeed", v)} />
        <EffectSlider label="Jitter Randomness" description={EFFECT_INFO.jitterRandomness} value={params.jitterRandomness ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("jitterRandomness", v)} />
        <EffectSlider label="Wow/Flutter (Slow)" description={EFFECT_INFO.wowFlutterSlow} value={params.wowFlutterSlow ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("wowFlutterSlow", v)} />
        <EffectSlider label="Wow/Flutter (Fast)" description={EFFECT_INFO.wowFlutterFast} value={params.wowFlutterFast ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("wowFlutterFast", v)} />
        <EffectSlider label="Flicker Rate" description={EFFECT_INFO.flickerFrequencyHz} value={params.flickerFrequencyHz ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("flickerFrequencyHz", v)} />
        <EffectSlider label="Flicker Depth" description={EFFECT_INFO.flickerDepth} value={params.flickerDepth ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("flickerDepth", v)} />
        <EffectSlider label="Auto-Exposure Hunt" description={EFFECT_INFO.autoExposureHunt} value={params.autoExposureHunt ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("autoExposureHunt", v)} />

        <Sub label="Tape Mechanics" />
        <EffectSlider label="Head Clog Events" description={EFFECT_INFO.headClogEvents} value={params.headClogEvents ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("headClogEvents", v)} />
        <EffectSlider label="Tracking Error" description={EFFECT_INFO.trackingError} value={params.trackingError ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("trackingError", v)} />
        <EffectSlider label="Tape Skew" description={EFFECT_INFO.tapeSkew} value={params.tapeSkew ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("tapeSkew", v)} />
        <EffectSlider label="Chroma Streaking" description={EFFECT_INFO.chromaNoiseStreaking} value={params.chromaNoiseStreaking ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("chromaNoiseStreaking", v)} />
      </div>
    </CollapsiblePanel>
  );
};

export default memo(TapePanel);
