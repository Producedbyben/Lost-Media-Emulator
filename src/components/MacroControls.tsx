import { useState, useCallback } from "react";
import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";
import { Dice3 } from "lucide-react";

interface MacroControlsProps {
  params: Record<string, number>;
  onChange: (key: string, value: number) => void;
}

interface MacroState {
  detailLoss: number;
  softness: number;
  displayTexture: number;
  glowFlicker: number;
  instability: number;
  jitterSpeed: number;
  damageDropouts: number;
  damageFrequency: number;
  compressionDamage: number;
  blockinessStrength: number;
  cleanWorn: number;
  keepDetail: number;
  ageMood: number;
  osdAmount: number;
}

const DEFAULT_MACROS: MacroState = {
  detailLoss: 0,
  softness: 0.5,
  displayTexture: 0,
  glowFlicker: 0.4,
  instability: 0,
  jitterSpeed: 0.5,
  damageDropouts: 0,
  damageFrequency: 0.4,
  compressionDamage: 0,
  blockinessStrength: 0.5,
  cleanWorn: 0,
  keepDetail: 0.5,
  ageMood: 0,
  osdAmount: 0.3,
};

function macrosToParams(m: MacroState): Record<string, number> {
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return {
    scanlineStrength: mix(0, 0.7, m.displayTexture) * mix(0.6, 1.2, m.glowFlicker),
    phosphorMask: mix(0, 0.65, m.displayTexture),
    bloom: mix(0.1, 0.85, m.glowFlicker),
    flicker: mix(0, 0.4, m.glowFlicker * 0.6),
    noise: mix(0, 0.55, m.detailLoss * 0.5 + m.damageDropouts * 0.3),
    advancedLineJitter: mix(0, 0.45, m.instability) * mix(0.5, 1.5, m.jitterSpeed),
    advancedTimebaseWobble: mix(0, 0.5, m.instability) * mix(0.5, 1.5, m.jitterSpeed),
    advancedHeadSwitching: mix(0, 0.55, m.damageDropouts) * mix(0.4, 1.4, m.damageFrequency),
    advancedChromaDelay: mix(0, 0.45, m.instability * 0.5 + m.detailLoss * 0.3),
    advancedCrossColor: mix(0, 0.5, m.instability * 0.4 + m.detailLoss * 0.3),
    advancedDropouts: mix(0, 0.6, m.damageDropouts) * mix(0.4, 1.4, m.damageFrequency),
    advancedTapeCrease: mix(0, 0.5, m.damageDropouts * 0.7),
    advancedRfInterference: mix(0, 0.5, m.instability * 0.6),
    advancedInterlacing: mix(0, 0.45, m.displayTexture * 0.5),
    advancedQuantization: mix(0, 0.55, m.compressionDamage) * mix(0.5, 1.5, m.blockinessStrength),
    advancedMacroBlocking: mix(0, 0.55, m.compressionDamage) * mix(0.5, 1.4, m.blockinessStrength),
    advancedFrameStutter: mix(0, 0.45, m.compressionDamage * 0.5 + m.damageDropouts * 0.3),
    advancedGenerationLoss: mix(0, 0.7, m.detailLoss * 0.6 + m.compressionDamage * 0.3),
    advancedGhosting: mix(0, 0.45, m.instability * 0.4 + m.detailLoss * 0.3),
    advancedFilmDust: mix(0, 0.5, m.ageMood * 0.6),
    advancedFilmScratches: mix(0, 0.5, m.ageMood * 0.5),
    advancedFilmGrain: mix(0, 0.65, m.ageMood * 0.7 + m.detailLoss * 0.2),
    advancedFilmHalation: mix(0, 0.5, m.ageMood * 0.4),
    advancedWhiteBalanceDrift: mix(0, 0.35, m.ageMood * 0.5),
    advancedTimestampOSD: mix(0, 0.75, m.osdAmount),
  };
}

const MacroControls = ({ params, onChange }: MacroControlsProps) => {
  const applyMacros = useCallback((values: Record<string, number>) => {
    for (const [key, value] of Object.entries(values)) {
      onChange(key, value);
    }
  }, [onChange]);
  const [macros, setMacros] = useState<MacroState>(DEFAULT_MACROS);
  const [enabled, setEnabled] = useState(true);

  const updateMacro = useCallback((key: keyof MacroState, value: number) => {
    setMacros((prev) => {
      const next = { ...prev, [key]: value };
      applyMacros(macrosToParams(next));
      return next;
    });
  }, [applyMacros]);

  const randomize = useCallback((intensity: "light" | "balanced" | "heavy") => {
    const r = () => Math.random();
    const scale = intensity === "light" ? 0.3 : intensity === "balanced" ? 0.6 : 1;
    const next: MacroState = {
      detailLoss: r() * scale * 0.8,
      softness: 0.3 + r() * 0.4,
      displayTexture: r() * scale * 0.7,
      glowFlicker: 0.2 + r() * scale * 0.5,
      instability: r() * scale * 0.7,
      jitterSpeed: 0.3 + r() * 0.4,
      damageDropouts: r() * scale * 0.7,
      damageFrequency: 0.2 + r() * 0.5,
      compressionDamage: r() * scale * 0.6,
      blockinessStrength: 0.3 + r() * 0.4,
      cleanWorn: (r() - 0.5) * 2 * scale,
      keepDetail: 0.3 + r() * 0.4,
      ageMood: r() * scale * 0.7,
      osdAmount: r() * scale * 0.5,
    };
    setMacros(next);
    applyMacros(macrosToParams(next));
  }, [applyMacros]);

  const reset = useCallback(() => {
    setMacros(DEFAULT_MACROS);
    applyMacros(macrosToParams(DEFAULT_MACROS));
  }, [applyMacros]);

  return (
    <CollapsiblePanel title="Quick Look Controls" defaultOpen={false} enabled={enabled} onToggleEnabled={setEnabled}>
      {enabled && (
        <div className="pt-2 space-y-2.5">
          <p className="text-[12px] text-muted-foreground">High-level controls that shape multiple parameters at once.</p>
          <div className="grid grid-cols-1 gap-2">
            <EffectSlider label="Detail Loss" description="One knob for overall sharpness decay — resolution, smearing and generation softness together." value={macros.detailLoss} min={0} max={1} step={0.01} onChange={(v) => updateMacro("detailLoss", v)} />
            <EffectSlider label="Display Texture" description="The visible structure of the screen itself — scanlines, subpixel mask and pixelation." value={macros.displayTexture} min={0} max={1} step={0.01} onChange={(v) => updateMacro("displayTexture", v)} />
            <EffectSlider label="Glow & Flicker" description="Phosphor glow, halation bloom and brightness flicker as one combined amount." value={macros.glowFlicker} min={0} max={1} step={0.01} onChange={(v) => updateMacro("glowFlicker", v)} />
            <EffectSlider label="Image Instability" description="Geometric unsteadiness — jitter, wobble and skew of the whole picture." value={macros.instability} min={0} max={1} step={0.01} onChange={(v) => updateMacro("instability", v)} />
            <EffectSlider label="Damage & Dropouts" description="Physical media damage — dropouts, head-switching tears, dust and scratches." value={macros.damageDropouts} min={0} max={1} step={0.01} onChange={(v) => updateMacro("damageDropouts", v)} />
            <EffectSlider label="Compression Damage" description="Digital codec artefacts — macroblocking, quantisation banding and ringing." value={macros.compressionDamage} min={0} max={1} step={0.01} onChange={(v) => updateMacro("compressionDamage", v)} />
            <EffectSlider label="Age & Mood" description="Colour ageing — fade, shifted balance and tonal drift of old media." value={macros.ageMood} min={0} max={1} step={0.01} onChange={(v) => updateMacro("ageMood", v)} />
            <EffectSlider label="OSD Amount" description="How prominent the burned-in on-screen display (timestamp/labels) is." value={macros.osdAmount} min={0} max={1} step={0.01} onChange={(v) => updateMacro("osdAmount", v)} />
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <button onClick={() => randomize("light")} className="flex items-center gap-1 px-2 py-1 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80">
              <Dice3 className="w-3 h-3" /> Light
            </button>
            <button onClick={() => randomize("balanced")} className="flex items-center gap-1 px-2 py-1 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80">
              <Dice3 className="w-3 h-3" /> Balanced
            </button>
            <button onClick={() => randomize("heavy")} className="flex items-center gap-1 px-2 py-1 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80">
              <Dice3 className="w-3 h-3" /> Heavy
            </button>
            <button onClick={reset} className="px-2 py-1 text-[12px] bg-secondary text-secondary-foreground rounded border border-border hover:bg-secondary/80">
              Reset
            </button>
          </div>
        </div>
      )}
    </CollapsiblePanel>
  );
};

export default MacroControls;
