import { CRTParams } from "@/hooks/useCRTRenderer";
import CollapsiblePanel from "./CollapsiblePanel";
import EffectSlider from "./EffectSlider";

interface EffectControlsProps {
  params: CRTParams;
  onChange: (key: string, value: number) => void;
}

const EffectControls = ({ params, onChange }: EffectControlsProps) => {
  return (
    <div className="space-y-2">
      <CollapsiblePanel title="CRT Effects" badge="1" defaultOpen={true}>
        <div className="pt-2 space-y-2.5">
          <EffectSlider label="Scanline Strength" value={params.scanlineStrength} min={0} max={1} step={0.01} onChange={(v) => onChange("scanlineStrength", v)} />
          <EffectSlider label="Barrel Distortion" value={params.barrelDistortion} min={-0.3} max={0.3} step={0.005} onChange={(v) => onChange("barrelDistortion", v)} />
          <EffectSlider label="Chromatic Aberration" value={params.chromaticAberration} min={0} max={1} step={0.01} onChange={(v) => onChange("chromaticAberration", v)} />
          <EffectSlider label="Bloom" value={params.bloom} min={0} max={1} step={0.01} onChange={(v) => onChange("bloom", v)} />
          <EffectSlider label="Flicker" value={params.flicker} min={0} max={1} step={0.01} onChange={(v) => onChange("flicker", v)} />
          <EffectSlider label="Phosphor Mask" value={params.phosphorMask} min={0} max={1} step={0.01} onChange={(v) => onChange("phosphorMask", v)} />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Signal & Noise" badge="2" defaultOpen={true}>
        <div className="pt-2 space-y-2.5">
          <EffectSlider label="Noise" value={params.noise} min={0} max={1} step={0.01} onChange={(v) => onChange("noise", v)} />
          <EffectSlider label="Line Jitter" value={params.advancedLineJitter} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedLineJitter", v)} />
          <EffectSlider label="Timebase Wobble" value={params.advancedTimebaseWobble} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedTimebaseWobble", v)} />
          <EffectSlider label="RF Interference" value={params.advancedRfInterference} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedRfInterference", v)} />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Tape Artifacts" badge="3" defaultOpen={false}>
        <div className="pt-2 space-y-2.5">
          <EffectSlider label="Head Switching" value={params.advancedHeadSwitching} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedHeadSwitching", v)} />
          <EffectSlider label="Chroma Delay" value={params.advancedChromaDelay} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedChromaDelay", v)} />
          <EffectSlider label="Cross-Color" value={params.advancedCrossColor} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedCrossColor", v)} />
          <EffectSlider label="Dropouts" value={params.advancedDropouts} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedDropouts", v)} />
          <EffectSlider label="Ghosting" value={params.advancedGhosting} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedGhosting", v)} />
          <EffectSlider label="Interlacing" value={params.advancedInterlacing} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedInterlacing", v)} />
          <EffectSlider label="Tape Crease" value={params.advancedTapeCrease} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedTapeCrease", v)} />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Temporal" badge="4" defaultOpen={false}>
        <div className="pt-2 space-y-2.5">
          <EffectSlider label="Frame Stutter" value={params.advancedFrameStutter} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedFrameStutter", v)} />
          <EffectSlider label="Exposure Pump" value={params.advancedExposurePump} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedExposurePump", v)} />
          <EffectSlider label="White Balance Drift" value={params.advancedWhiteBalanceDrift} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedWhiteBalanceDrift", v)} />
          <EffectSlider label="Focus Breathing" value={params.advancedFocusBreathing} min={0} max={1} step={0.01} onChange={(v) => onChange("advancedFocusBreathing", v)} />
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title="Pixel & Resolution" badge="5" defaultOpen={false}>
        <div className="pt-2 space-y-2.5">
          <EffectSlider label="Pixel Size" value={params.pixelSize} min={1} max={8} step={1} onChange={(v) => onChange("pixelSize", v)} />
        </div>
      </CollapsiblePanel>
    </div>
  );
};

export default EffectControls;
