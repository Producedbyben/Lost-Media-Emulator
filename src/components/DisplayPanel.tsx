import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";
import EffectHelp from "./EffectHelp";
import { EFFECT_INFO, PANEL_INFO } from "@/lib/effect-info";

interface DisplayPanelProps {
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
 * Display & CRT — combines the core CRT optics (scanlines, geometry, bloom) with
 * the v2 panel-physics controls (phosphor persistence, beam spot, subpixel layout).
 */
const DisplayPanel = ({ params, onChange, onStringChange, enabled = true, onToggleEnabled }: DisplayPanelProps) => {
  return (
    <CollapsiblePanel title="Display & CRT" description={PANEL_INFO.display} defaultOpen={true} enabled={enabled} onToggleEnabled={onToggleEnabled} panelId="display">
      <div className="pt-2 space-y-2.5">
        <Sub label="CRT Optics" />
        <EffectSlider label="Scanline Strength" description={EFFECT_INFO.scanlineStrength} value={(params.scanlineStrength as number) ?? 0.5} min={0} max={1} step={0.01} defaultValue={0.5} onChange={(v) => onChange("scanlineStrength", v)} />
        <EffectSlider label="Barrel Distortion" description={EFFECT_INFO.barrelDistortion} value={(params.barrelDistortion as number) ?? 0} min={-0.3} max={0.3} step={0.005} defaultValue={0} onChange={(v) => onChange("barrelDistortion", v)} />
        <EffectSlider label="Chromatic Aberration" description={EFFECT_INFO.chromaticAberration} value={(params.chromaticAberration as number) ?? 0.5} min={0} max={1} step={0.01} defaultValue={0.5} onChange={(v) => onChange("chromaticAberration", v)} />
        <EffectSlider label="Bloom" description={EFFECT_INFO.bloom} value={(params.bloom as number) ?? 0.5} min={0} max={1} step={0.01} defaultValue={0.5} onChange={(v) => onChange("bloom", v)} />
        <EffectSlider label="Neon Bleed" description={EFFECT_INFO.advancedNeonPhosphorBleed} value={(params.advancedNeonPhosphorBleed as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedNeonPhosphorBleed", v)} />
        <EffectSlider label="Flicker" description={EFFECT_INFO.flicker} value={(params.flicker as number) ?? 0.22} min={0} max={1} step={0.01} defaultValue={0.22} onChange={(v) => onChange("flicker", v)} />

        <Sub label="Panel Physics" />
        <div className="flex items-center gap-2 px-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">Scanline Profile <EffectHelp text={EFFECT_INFO.scanlineProfile} /></span>
          <select
            value={String(params.scanlineProfile ?? "off")}
            onChange={(e) => onStringChange("scanlineProfile", e.target.value)}
            className="flex-1 text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
          >
            <option value="off">Off</option>
            <option value="soft">Soft</option>
            <option value="hard">Hard</option>
            <option value="triadAware">Triad Aware</option>
          </select>
        </div>
        <EffectSlider label="Phosphor Persistence" description={EFFECT_INFO.phosphorPersistence} value={(params.phosphorPersistence as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("phosphorPersistence", v)} />
        <EffectSlider label="Beam Spot X" description={EFFECT_INFO.beamSpotSizeX} value={(params.beamSpotSizeX as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("beamSpotSizeX", v)} />
        <EffectSlider label="Beam Spot Y" description={EFFECT_INFO.beamSpotSizeY} value={(params.beamSpotSizeY as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("beamSpotSizeY", v)} />
        <div className="flex items-center gap-2 px-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">Subpixel Layout <EffectHelp text={EFFECT_INFO.subpixelLayoutOverride} /></span>
          <select
            value={String(params.subpixelLayoutOverride ?? "none")}
            onChange={(e) => onStringChange("subpixelLayoutOverride", e.target.value)}
            className="flex-1 text-xs bg-secondary border border-border rounded px-2 py-1 text-foreground"
          >
            <option value="none">None</option>
            <option value="RGB">RGB Stripe</option>
            <option value="BGR">BGR Stripe</option>
            <option value="PenTile">PenTile</option>
          </select>
        </div>
        <EffectSlider label="Pixel Response Time" description={EFFECT_INFO.pixelResponseTime} value={(params.pixelResponseTime as number) ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("pixelResponseTime", v)} />
      </div>
    </CollapsiblePanel>
  );
};

export default DisplayPanel;
