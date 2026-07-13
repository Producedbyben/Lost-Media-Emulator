import { useEffect, useRef, memo } from "react";
import { VolumeX } from "lucide-react";
import EffectSlider from "./EffectSlider";
import CollapsiblePanel from "./CollapsiblePanel";
import type { AudioProfile } from "@/lib/audio-degrade";

interface AudioPanelProps {
  profile: AudioProfile;
  onChange: (patch: Partial<AudioProfile>) => void;
  decodedBuffer: AudioBuffer | null;
  hasAudio: boolean;
  enabled?: boolean;
  onToggleEnabled?: (on: boolean) => void;
}

const Sub = ({ label }: { label: string }) => (
  <div className="flex items-center gap-2 pt-1.5 first:pt-0">
    <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/60">{label}</span>
    <div className="flex-1 h-px bg-border/40" />
  </div>
);

/** Min/max peak waveform drawn from the decoded source buffer. */
function Waveform({ buffer }: { buffer: AudioBuffer | null }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = cv.width, H = cv.height, mid = H / 2;
    const styles = getComputedStyle(document.documentElement);
    const fg = `hsl(${styles.getPropertyValue("--signal").trim() || "142 64% 58%"})`;
    const dim = `hsl(${styles.getPropertyValue("--border").trim() || "34 5% 22%"})`;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = dim; ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();
    if (!buffer) return;
    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / W));
    ctx.strokeStyle = fg; ctx.beginPath();
    for (let x = 0; x < W; x++) {
      let min = 1, max = -1;
      for (let j = 0; j < step; j++) {
        const v = data[x * step + j] || 0;
        if (v < min) min = v; if (v > max) max = v;
      }
      ctx.moveTo(x + 0.5, mid - max * mid);
      ctx.lineTo(x + 0.5, mid - min * mid);
    }
    ctx.stroke();
  }, [buffer]);
  return <canvas ref={ref} width={256} height={48} className="w-full h-12 rounded-[3px] bg-background border border-border" />;
}

/**
 * Audio — per-clip authenticity surface. Waveform, level/gain, fade in/out, and
 * the period-degradation suite (hiss, hum, wow/flutter, mono, crackle, bandwidth).
 * What you hear here is what exports — both run the one degradeAudioBuffer DSP.
 */
const AudioPanel = ({ profile, onChange, decodedBuffer, hasAudio, enabled = true, onToggleEnabled }: AudioPanelProps) => {
  return (
    <CollapsiblePanel title="Audio" description="Per-clip level, fades and period audio degradation. Preview matches export." defaultOpen={false} enabled={enabled} onToggleEnabled={onToggleEnabled} panelId="audio">
      {!hasAudio ? (
        <div className="pt-3 pb-1 flex items-center gap-2 text-[12px] text-muted-foreground">
          <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
          No audio track in this source.
        </div>
      ) : (
        <div className="pt-2 space-y-2.5">
          <Waveform buffer={decodedBuffer} />
          <Sub label="Level & Fades" />
          <EffectSlider label="Level" description="Overall audio loudness for this clip. 100% = unchanged." value={profile.gain ?? 1} min={0} max={2} step={0.01} defaultValue={1} onChange={(v) => onChange({ gain: v })} />
          <EffectSlider label="Fade In (s)" description="Ramp the audio up from silence over this many seconds at the start." value={profile.fadeIn ?? 0} min={0} max={5} step={0.1} defaultValue={0} onChange={(v) => onChange({ fadeIn: v })} />
          <EffectSlider label="Fade Out (s)" description="Ramp the audio down to silence over this many seconds at the end." value={profile.fadeOut ?? 0} min={0} max={5} step={0.1} defaultValue={0} onChange={(v) => onChange({ fadeOut: v })} />
          <Sub label="Period Degradation" />
          <EffectSlider label="Tape Hiss" description="Broadband analogue tape noise — the constant background 'shhh' of cassette and VHS audio." value={profile.hiss} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ hiss: v })} />
          <EffectSlider label="Mains Hum" description="Low 50/60Hz electrical hum picked up from power circuits — the classic ground-loop drone." value={profile.hum} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ hum: v })} />
          <EffectSlider label="Wow (slow)" description="Slow pitch drift from uneven tape speed — long, seasick pitch bends." value={profile.wow} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ wow: v })} />
          <EffectSlider label="Flutter (fast)" description="Fast pitch wavering from tape-transport vibration — a nervous warble on sustained tones." value={profile.flutter} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ flutter: v })} />
          <EffectSlider label="Mono Fold-down" description="Collapse stereo toward a single centre channel, like single-mic or mono-broadcast sound." value={profile.mono} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ mono: v })} />
          <EffectSlider label="Crackle / Pops" description="Random clicks and pops — dirty tape heads, worn vinyl, damaged optical tracks." value={profile.crackle} min={0} max={1} step={0.01} defaultValue={0} onChange={(v) => onChange({ crackle: v })} />
          <Sub label="Bandwidth" />
          <EffectSlider label="Low Cut (Hz)" description="Remove bass below this frequency — small speakers and telephone lines lose the low end first." value={profile.lowCutHz} min={20} max={2000} step={10} defaultValue={20} onChange={(v) => onChange({ lowCutHz: v })} />
          <EffectSlider label="High Cut (Hz)" description="Remove treble above this frequency — tape generations and broadcast chains dull the highs." value={profile.highCutHz} min={2000} max={20000} step={100} defaultValue={20000} onChange={(v) => onChange({ highCutHz: v })} />
        </div>
      )}
    </CollapsiblePanel>
  );
};

export default memo(AudioPanel);
