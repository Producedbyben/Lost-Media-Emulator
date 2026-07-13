import { memo } from "react";
import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";
import EffectHelp from "./EffectHelp";
import { EFFECT_INFO, PANEL_INFO } from "@/lib/effect-info";

interface MetaAgingPanelProps {
  params: Record<string, number | string>;
  onChange: (key: string, value: number) => void;
  onStringChange: (key: string, value: string) => void;
  enabled?: boolean;
  onToggleEnabled?: (on: boolean) => void;
}

const MetaAgingPanel = ({ params, onChange, onStringChange, enabled = true, onToggleEnabled }: MetaAgingPanelProps) => {
  return (
    <CollapsiblePanel title="Media Aging" description={PANEL_INFO.metaAging} defaultOpen={false} enabled={enabled} onToggleEnabled={onToggleEnabled} panelId="metaAging">
      <div className="pt-2 space-y-2.5">
        <EffectSlider label="Media Age (Years)" description={EFFECT_INFO.mediaAgeYears} value={(params.mediaAgeYears as number) ?? 0} min={0} max={100} step={1} defaultValue={0} onChange={(v) => onChange("mediaAgeYears", v)} />
        <div className="flex items-center gap-2 px-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">Storage Condition <EffectHelp text={EFFECT_INFO.storageCondition} /></span>
          <select
            value={String(params.storageCondition ?? "ideal")}
            onChange={(e) => onStringChange("storageCondition", e.target.value)}
            className="flex-1 text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
          >
            <option value="ideal">Ideal (Climate controlled)</option>
            <option value="humid">Humid (Basement/attic)</option>
            <option value="hot">Hot (Garage/shed)</option>
            <option value="moldRisk">Mold Risk</option>
          </select>
        </div>
        <EffectSlider label="Copy Generation Count" description={EFFECT_INFO.copyGenerationCount} value={(params.copyGenerationCount as number) ?? 0} min={0} max={20} step={1} defaultValue={0} onChange={(v) => onChange("copyGenerationCount", v)} />
        <EffectSlider label="Restoration Pass Level" description={EFFECT_INFO.restorationPassLevel} value={(params.restorationPassLevel as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("restorationPassLevel", v)} />
      </div>
    </CollapsiblePanel>
  );
};

export default memo(MetaAgingPanel);
