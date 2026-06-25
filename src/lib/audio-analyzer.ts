// Audio reactive parameter modulation using Web Audio API

export interface AudioReactiveConfig {
  paramKey: string;
  band: "bass" | "mid" | "high" | "all";
  sensitivity: number; // 0-2
  minValue: number;
  maxValue: number;
  invert: boolean;
  smoothing: number; // 0-1
}

export interface AudioAnalyzerState {
  configs: AudioReactiveConfig[];
  enabled: boolean;
  masterGain: number;
}

export const DEFAULT_AUDIO_ANALYZER_STATE: AudioAnalyzerState = {
  configs: [],
  enabled: false,
  masterGain: 1,
};

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private frequencyData: Uint8Array | null = null;
  private smoothedValues: Map<string, number> = new Map();

  async init(audioBuffer: AudioBuffer): Promise<void> {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.8;
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = audioBuffer;
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
  }

  play(offset = 0): void {
    if (this.sourceNode && this.audioContext) {
      try {
        this.sourceNode.start(0, offset);
      } catch {
        // Already started, recreate
        if (this.sourceNode.buffer) {
          const newSource = this.audioContext.createBufferSource();
          newSource.buffer = this.sourceNode.buffer;
          newSource.connect(this.analyser!);
          this.sourceNode = newSource;
          this.sourceNode.start(0, offset);
        }
      }
    }
  }

  stop(): void {
    try {
      this.sourceNode?.stop();
    } catch {}
  }

  updateFrequencyData(): void {
    if (this.analyser && this.frequencyData) {
      // @ts-ignore - TypeScript has issues with Uint8Array buffer types
      this.analyser.getByteFrequencyData(this.frequencyData);
    }
  }

  getBandValue(band: "bass" | "mid" | "high" | "all"): number {
    this.updateFrequencyData();
    if (!this.frequencyData || this.frequencyData.length === 0) return 0;
    const data = this.frequencyData;
    if (data.length === 0) return 0;

    let start = 0, end = data.length;
    const third = Math.floor(data.length / 3);

    switch (band) {
      case "bass": start = 0; end = third; break;
      case "mid": start = third; end = third * 2; break;
      case "high": start = third * 2; end = data.length; break;
      case "all": break;
    }

    let sum = 0;
    for (let i = start; i < end; i++) {
      sum += data[i];
    }
    return (sum / (end - start)) / 255;
  }

  evaluateConfigs(
    configs: AudioReactiveConfig[],
    baseParams: Record<string, number>,
    masterGain: number
  ): Record<string, number> {
    const result = { ...baseParams };

    for (const config of configs) {
      const rawValue = this.getBandValue(config.band);
      const adjusted = rawValue * config.sensitivity * masterGain;
      const clamped = Math.max(0, Math.min(1, adjusted));
      
      // Apply smoothing
      const prevSmoothed = this.smoothedValues.get(config.paramKey) ?? clamped;
      const smoothed = prevSmoothed + (clamped - prevSmoothed) * (1 - config.smoothing);
      this.smoothedValues.set(config.paramKey, smoothed);

      // Map to value range
      let finalValue = config.minValue + (smoothed * (config.maxValue - config.minValue));
      if (config.invert) {
        finalValue = config.maxValue - (smoothed * (config.maxValue - config.minValue));
      }

      result[config.paramKey] = finalValue;
    }

    return result;
  }

  destroy(): void {
    this.stop();
    this.audioContext?.close();
    this.audioContext = null;
    this.analyser = null;
    this.sourceNode = null;
  }
}
