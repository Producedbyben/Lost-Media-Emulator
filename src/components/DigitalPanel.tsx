import { memo } from "react";
import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";
import EffectHelp from "./EffectHelp";
import { EFFECT_INFO, PANEL_INFO } from "@/lib/effect-info";

interface DigitalPanelProps {
  params: Record<string, number | string>;
  onChange: (key: string, value: number) => void;
  onStringChange: (key: string, value: string) => void;
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
 * Digital & Compression — combines the digital noise/quantization effects, the v2
 * codec-compression controls and the datamosh / true digital-decay effects into a
 * single panel covering all codec-era artifacts.
 */
const DigitalPanel = ({ params, onChange, onStringChange, enabled = true, onToggleEnabled }: DigitalPanelProps) => {
  return (
    <CollapsiblePanel title="Digital & Compression" description={PANEL_INFO.digital} defaultOpen={false} enabled={enabled} onToggleEnabled={onToggleEnabled} panelId="digital">
      <div className="pt-2 space-y-2.5">
        <Sub label="Digital Noise" />
        <EffectSlider label="Noise" description={EFFECT_INFO.noise} value={(params.noise as number) ?? 0.5} min={0} max={1} step={0.01} defaultValue={0.5} onChange={(v) => onChange("noise", v)} />
        <EffectSlider label="Frame Stutter/Drop" description={EFFECT_INFO.advancedFrameStutter} value={(params.advancedFrameStutter as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedFrameStutter", v)} />
        <EffectSlider label="RF Interference" description={EFFECT_INFO.advancedRfInterference} value={(params.advancedRfInterference as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedRfInterference", v)} />
        <EffectSlider label="CCTV Monochrome" description={EFFECT_INFO.advancedCctvMonochrome} value={(params.advancedCctvMonochrome as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedCctvMonochrome", v)} />
        <EffectSlider label="Quantization/Crush" description={EFFECT_INFO.advancedQuantization} value={(params.advancedQuantization as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedQuantization", v)} />
        <EffectSlider label="Generation Loss" description={EFFECT_INFO.advancedGenerationLoss} value={(params.advancedGenerationLoss as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedGenerationLoss", v)} />
        <EffectSlider label="Macroblocking" description={EFFECT_INFO.advancedMacroBlocking} value={(params.advancedMacroBlocking as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedMacroBlocking", v)} />

        <Sub label="Codec Compression" />
        <EffectSlider label="GOP Length" description={EFFECT_INFO.gopLength} value={(params.gopLength as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("gopLength", v)} />
        <EffectSlider label="Deblocking" description={EFFECT_INFO.deblockingStrength} value={(params.deblockingStrength as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("deblockingStrength", v)} />
        <EffectSlider label="Ringing" description={EFFECT_INFO.ringingStrength} value={(params.ringingStrength as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("ringingStrength", v)} />
        <div className="flex items-center gap-2 px-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">Chroma Subsampling <EffectHelp text={EFFECT_INFO.chromaSubsamplingMode} /></span>
          <select
            value={String(params.chromaSubsamplingMode ?? "444")}
            onChange={(e) => onStringChange("chromaSubsamplingMode", e.target.value)}
            className="flex-1 text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
          >
            <option value="444">4:4:4</option>
            <option value="422">4:2:2</option>
            <option value="420">4:2:0</option>
            <option value="411">4:1:1</option>
          </select>
        </div>
        <EffectSlider label="Packet Loss Burst" description={EFFECT_INFO.packetLossBurst} value={(params.packetLossBurst as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("packetLossBurst", v)} />
        <EffectSlider label="Upscale Halos" description={EFFECT_INFO.upscaleSharpenHalos} value={(params.upscaleSharpenHalos as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("upscaleSharpenHalos", v)} />

        <Sub label="Datamosh & Decay" />
        <EffectSlider label="P-Frame Bloom" description={EFFECT_INFO.datamoshBloom} value={(params.datamoshBloom as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("datamoshBloom", v)} />
        <EffectSlider label="Motion Displacement" description={EFFECT_INFO.datamoshDisplacement} value={(params.datamoshDisplacement as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("datamoshDisplacement", v)} />
        <EffectSlider label="Pixel Sort" description={EFFECT_INFO.pixelSort} value={(params.pixelSort as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("pixelSort", v)} />
        <EffectSlider label="Bit-Rot Corruption" description={EFFECT_INFO.bitrotCorruption} value={(params.bitrotCorruption as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("bitrotCorruption", v)} />
      </div>
    </CollapsiblePanel>
  );
};

export default memo(DigitalPanel);
