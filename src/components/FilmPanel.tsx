import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";
import { EFFECT_INFO, PANEL_INFO } from "@/lib/effect-info";

interface FilmPanelProps {
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
 * Film — combines the core film emulation (grain, dust, scratches, halation) with
 * the advanced v2 stock/gate controls (grain size, gate jitter, print fade, etc.).
 */
const FilmPanel = ({ params, onChange, enabled = true, onToggleEnabled }: FilmPanelProps) => {
  return (
    <CollapsiblePanel title="Film" description={PANEL_INFO.film} defaultOpen={false} enabled={enabled} onToggleEnabled={onToggleEnabled} panelId="film">
      <div className="pt-2 space-y-2.5">
        <Sub label="Grain & Gate" />
        <EffectSlider label="Film Grain" description={EFFECT_INFO.advancedFilmGrain} value={params.advancedFilmGrain ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedFilmGrain", v)} />
        <EffectSlider label="Film Dust/Specks" description={EFFECT_INFO.advancedFilmDust} value={params.advancedFilmDust ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedFilmDust", v)} />
        <EffectSlider label="Film Scratches" description={EFFECT_INFO.advancedFilmScratches} value={params.advancedFilmScratches ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedFilmScratches", v)} />
        <EffectSlider label="Gate Weave" description={EFFECT_INFO.advancedFilmGateWeave} value={params.advancedFilmGateWeave ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedFilmGateWeave", v)} />
        <EffectSlider label="Halation Glow" description={EFFECT_INFO.advancedFilmHalation} value={params.advancedFilmHalation ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedFilmHalation", v)} />
        <EffectSlider label="Exposure Pumping" description={EFFECT_INFO.advancedExposurePump} value={params.advancedExposurePump ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedExposurePump", v)} />
        <EffectSlider label="White Balance Drift" description={EFFECT_INFO.advancedWhiteBalanceDrift} value={params.advancedWhiteBalanceDrift ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedWhiteBalanceDrift", v)} />
        <EffectSlider label="Focus Breathing" description={EFFECT_INFO.advancedFocusBreathing} value={params.advancedFocusBreathing ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("advancedFocusBreathing", v)} />

        <Sub label="Stock & Print (Advanced)" />
        <EffectSlider label="Grain Size" description={EFFECT_INFO.grainSize} value={params.grainSize ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("grainSize", v)} />
        <EffectSlider label="Grain Chromaticity" description={EFFECT_INFO.grainChromaticity} value={params.grainChromaticity ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("grainChromaticity", v)} />
        <EffectSlider label="Gate Jitter X" description={EFFECT_INFO.gateJitterX} value={params.gateJitterX ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("gateJitterX", v)} />
        <EffectSlider label="Gate Jitter Y" description={EFFECT_INFO.gateJitterY} value={params.gateJitterY ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("gateJitterY", v)} />
        <EffectSlider label="Gate Rotation" description={EFFECT_INFO.gateRotation} value={params.gateRotation ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("gateRotation", v)} />
        <EffectSlider label="Shutter Judder" description={EFFECT_INFO.shutterJudder} value={params.shutterJudder ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("shutterJudder", v)} />
        <EffectSlider label="Print Fade (Cyan)" description={EFFECT_INFO.printFadeCyan} value={params.printFadeCyan ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("printFadeCyan", v)} />
        <EffectSlider label="Print Fade (Magenta)" description={EFFECT_INFO.printFadeMagenta} value={params.printFadeMagenta ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("printFadeMagenta", v)} />
        <EffectSlider label="Print Fade (Yellow)" description={EFFECT_INFO.printFadeYellow} value={params.printFadeYellow ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("printFadeYellow", v)} />
        <EffectSlider label="Splice Flash" description={EFFECT_INFO.spliceFlash} value={params.spliceFlash ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("spliceFlash", v)} />
        <EffectSlider label="Cue Marks" description={EFFECT_INFO.cueMarks} value={params.cueMarks ?? 0} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange("cueMarks", v)} />
      </div>
    </CollapsiblePanel>
  );
};

export default FilmPanel;
