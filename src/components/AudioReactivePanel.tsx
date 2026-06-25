import { useState, useCallback } from "react";
import { Plus, Trash2, Volume2, VolumeX, Activity } from "lucide-react";
import CollapsiblePanel from "./CollapsiblePanel";
import EffectSlider from "./EffectSlider";
import { AudioReactiveConfig, AudioAnalyzerState } from "@/lib/audio-analyzer";

interface AudioReactivePanelProps {
  state: AudioAnalyzerState;
  onChange: (state: AudioAnalyzerState) => void;
  hasAudio: boolean;
}

const PARAM_OPTIONS = [
  { key: "bloom", label: "Bloom", min: 0, max: 2 },
  { key: "chromaticAberration", label: "Chroma Ab.", min: 0, max: 2 },
  { key: "noise", label: "Noise", min: 0, max: 2 },
  { key: "scanlineStrength", label: "Scanlines", min: 0, max: 1 },
  { key: "flicker", label: "Flicker", min: 0, max: 1 },
  { key: "advancedLineJitter", label: "Line Jitter", min: 0, max: 1 },
  { key: "advancedRfInterference", label: "RF Noise", min: 0, max: 1 },
  { key: "imageBrightness", label: "Brightness", min: 0.5, max: 1.5 },
  { key: "imageContrast", label: "Contrast", min: 0.5, max: 1.5 },
  { key: "advancedNeonPhosphorBleed", label: "Neon Bleed", min: 0, max: 1 },
];

const BAND_OPTIONS: { value: "bass" | "mid" | "high" | "all"; label: string }[] = [
  { value: "bass", label: "Bass" },
  { value: "mid", label: "Mid" },
  { value: "high", label: "High" },
  { value: "all", label: "All" },
];

const AudioReactivePanel = ({ state, onChange, hasAudio }: AudioReactivePanelProps) => {
  const [showAdd, setShowAdd] = useState(false);

  const update = useCallback((partial: Partial<AudioAnalyzerState>) => {
    onChange({ ...state, ...partial });
  }, [state, onChange]);

  const addConfig = useCallback((paramKey: string) => {
    const opt = PARAM_OPTIONS.find(p => p.key === paramKey);
    if (!opt || state.configs.find(c => c.paramKey === paramKey)) return;
    
    const newConfig: AudioReactiveConfig = {
      paramKey,
      band: "all",
      sensitivity: 1,
      minValue: opt.min,
      maxValue: opt.max,
      invert: false,
      smoothing: 0.5,
    };
    update({ configs: [...state.configs, newConfig] });
    setShowAdd(false);
  }, [state, update]);

  const updateConfig = useCallback((idx: number, partial: Partial<AudioReactiveConfig>) => {
    const newConfigs = [...state.configs];
    newConfigs[idx] = { ...newConfigs[idx], ...partial };
    update({ configs: newConfigs });
  }, [state, update]);

  const removeConfig = useCallback((idx: number) => {
    update({ configs: state.configs.filter((_, i) => i !== idx) });
  }, [state, update]);

  const availableParams = PARAM_OPTIONS.filter(p => !state.configs.find(c => c.paramKey === p.key));

  return (
    <CollapsiblePanel title="Audio Reactive" defaultOpen={false}>
      <div className="pt-2 space-y-2">
        {!hasAudio && (
          <p className="text-[12px] text-muted-foreground">Load an audio file to enable audio-reactive effects.</p>
        )}
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => update({ enabled: !state.enabled })}
            disabled={!hasAudio}
            className={`flex items-center gap-1 px-2 py-1 text-[12px] rounded border transition-colors ${
              state.enabled && hasAudio
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-secondary border-border text-muted-foreground"
            } disabled:opacity-40`}
          >
            {state.enabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            {state.enabled ? "Enabled" : "Disabled"}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            disabled={!hasAudio}
            className="flex items-center gap-1 px-2 py-1 text-[12px] bg-primary/15 text-primary rounded border border-primary/30 hover:bg-primary/25 disabled:opacity-40"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {hasAudio && (
          <EffectSlider
            label="Master Gain"
            value={state.masterGain}
            min={0}
            max={3}
            step={0.1}
            defaultValue={1}
            onChange={(v) => update({ masterGain: v })}
          />
        )}

        {showAdd && (
          <div className="flex flex-wrap gap-1 p-2 bg-secondary/50 rounded border border-border">
            {availableParams.map(p => (
              <button
                key={p.key}
                onClick={() => addConfig(p.key)}
                className="px-2 py-0.5 text-[12px] bg-card border border-border rounded hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors"
              >
                {p.label}
              </button>
            ))}
            {availableParams.length === 0 && (
              <span className="text-[12px] text-muted-foreground">All parameters added</span>
            )}
          </div>
        )}

        {state.configs.map((config, idx) => {
          const opt = PARAM_OPTIONS.find(p => p.key === config.paramKey);
          return (
            <div key={config.paramKey} className="p-2 bg-secondary/30 rounded border border-border space-y-1.5">
              <div className="flex items-center gap-2">
                <Activity className="w-3 h-3 text-primary" />
                <span className="text-[12px] font-medium text-foreground flex-1">{opt?.label || config.paramKey}</span>
                <button
                  onClick={() => removeConfig(idx)}
                  className="p-0.5 hover:bg-destructive/20 rounded transition-colors"
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground w-12">Band:</span>
                <div className="flex gap-0.5">
                  {BAND_OPTIONS.map(b => (
                    <button
                      key={b.value}
                      onClick={() => updateConfig(idx, { band: b.value })}
                      className={`px-1.5 py-0.5 text-[11px] rounded transition-colors ${
                        config.band === b.value
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <EffectSlider
                label="Sensitivity"
                value={config.sensitivity}
                min={0}
                max={3}
                step={0.1}
                defaultValue={1}
                onChange={(v) => updateConfig(idx, { sensitivity: v })}
              />
              
              <EffectSlider
                label="Smoothing"
                value={config.smoothing}
                min={0}
                max={0.95}
                step={0.05}
                defaultValue={0.5}
                onChange={(v) => updateConfig(idx, { smoothing: v })}
              />

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={config.invert}
                    onChange={(e) => updateConfig(idx, { invert: e.target.checked })}
                    className="rounded border-border w-3 h-3"
                  />
                  Invert
                </label>
              </div>
            </div>
          );
        })}

        {state.configs.length === 0 && hasAudio && (
          <p className="text-[12px] text-muted-foreground text-center py-2">
            Click "+ Add" to link parameters to audio
          </p>
        )}
      </div>
    </CollapsiblePanel>
  );
};

export default AudioReactivePanel;
