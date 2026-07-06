import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";

const MASK_TYPES = [
  { value: "phosphor", label: "Phosphor triad" },
  { value: "aperture", label: "Aperture grille" },
  { value: "slot", label: "Slot mask" },
  { value: "dot", label: "Dot mask" },
  { value: "shadowMask", label: "Shadow mask" },
  { value: "lcdStripeRGB", label: "LCD stripe RGB" },
  { value: "oledPentile", label: "OLED pentile" },
  { value: "plasmaCell", label: "Plasma cell" },
  { value: "filmSuper8", label: "Super 8 stock" },
  { value: "film16mm", label: "16mm stock" },
  { value: "instantDyeCloud", label: "Instant dye cloud" },
  { value: "irBloomSpeckle", label: "IR bloom speckle" },
  { value: "cmosRollingColumn", label: "CMOS rolling column" },
  { value: "lowBitrateBlockGrid", label: "Low-bitrate block" },
  { value: "fisheyeMicrolens", label: "Fisheye microlens" },
  { value: "none", label: "None" },
];

interface MaskSelectorProps {
  maskType: string;
  maskStrength: number;
  maskScale: number;
  onMaskTypeChange: (type: string) => void;
  onMaskStrengthChange: (value: number) => void;
  onMaskScaleChange: (value: number) => void;
  enabled?: boolean;
  onToggleEnabled?: (on: boolean) => void;
}

const MaskSelector = ({ maskType, maskStrength, maskScale, onMaskTypeChange, onMaskStrengthChange, onMaskScaleChange, enabled = true, onToggleEnabled }: MaskSelectorProps) => {
  return (
    <CollapsiblePanel title="Mask Effects" defaultOpen={false} panelId="masks" enabled={enabled} onToggleEnabled={onToggleEnabled}>
      <div className="pt-2 space-y-3">
        <div>
          <span className="text-xs text-muted-foreground mb-1.5 block">Mask pattern</span>
          <div className="flex flex-wrap gap-1">
            {MASK_TYPES.map((m) => (
              <button
                key={m.value}
                onClick={() => onMaskTypeChange(m.value)}
                className={`px-2 py-0.5 text-[12px] rounded border transition-colors ${
                  maskType === m.value
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <EffectSlider label="Mask Strength" value={maskStrength} min={0} max={1} step={0.01} onChange={onMaskStrengthChange} />
        <EffectSlider label="Mask Scale" value={maskScale} min={0.25} max={3} step={0.01} onChange={onMaskScaleChange} />
      </div>
    </CollapsiblePanel>
  );
};

export default MaskSelector;
