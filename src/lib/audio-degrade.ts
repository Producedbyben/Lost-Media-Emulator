/**
 * Format-matched audio degradation.
 * ----------------------------------------------------------------------------
 * Takes a decoded AudioBuffer + a preset audio profile (from format-profiles)
 * and renders a degraded AudioBuffer offline so exported video sounds like the
 * medium it emulates (tape hiss + wow/flutter, telephone band-limiting for
 * calls, lossy artifacts for web rips, silence for silent film, ...).
 *
 * Pure Web Audio (OfflineAudioContext) — no dependencies. Returns the original
 * buffer untouched if the profile is effectively clean or anything fails.
 */

export type AudioProfile = {
  lowCutHz: number;
  highCutHz: number;
  hiss: number;
  hum: number;
  wow: number;
  flutter: number;
  mono: number;
  mp3: number;
  telephone: number;
  companding: number;
  crackle: number;
  silent: number;
  // Per-clip shaping (Epic 4 audio panel). Optional so existing format profiles
  // (which omit them) behave as gain 1 / no fade.
  gain?: number;
  fadeIn?: number;
  fadeOut?: number;
};

// Deterministic PRNG (mulberry32) so the additive noise bed is reproducible — a
// given profile always yields the same degraded audio, which keeps preview audio
// byte-identical to the exported audio (the whole point of Epic 4's one DSP).
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Apply level gain + linear fade-in/out (seconds) to one channel, in place.
export function applyGainFade(channel: Float32Array, sampleRate: number, gain: number, fadeIn: number, fadeOut: number): void {
  const n = channel.length;
  const inN = Math.min(n, Math.max(0, Math.round((fadeIn || 0) * sampleRate)));
  const outN = Math.min(n, Math.max(0, Math.round((fadeOut || 0) * sampleRate)));
  for (let i = 0; i < n; i++) {
    let g = gain;
    if (inN > 0 && i < inN) g *= i / inN;
    if (outN > 0 && i >= n - outN) g *= (n - 1 - i) / outN;
    channel[i] *= g;
  }
}

function isEffectivelyClean(p: AudioProfile): boolean {
  return (
    p.silent < 0.01 &&
    p.hiss < 0.01 &&
    p.hum < 0.01 &&
    p.wow < 0.01 &&
    p.flutter < 0.01 &&
    p.mono < 0.01 &&
    p.mp3 < 0.01 &&
    p.telephone < 0.01 &&
    p.crackle < 0.01 &&
    p.lowCutHz <= 22 &&
    p.highCutHz >= 18000 &&
    Math.abs((p.gain ?? 1) - 1) < 0.01 &&
    (p.fadeIn ?? 0) < 0.01 &&
    (p.fadeOut ?? 0) < 0.01
  );
}

/** Build an additive noise/hum/crackle bed as its own AudioBuffer. */
function buildNoiseBed(
  ctx: OfflineAudioContext,
  channels: number,
  length: number,
  sampleRate: number,
  p: AudioProfile,
): AudioBuffer | null {
  if (p.hiss < 0.01 && p.hum < 0.01 && p.crackle < 0.01) return null;
  const bed = ctx.createBuffer(channels, length, sampleRate);
  const humFreq = 60; // mains hum (NTSC regions); harmless if region differs
  const hissGain = p.hiss * 0.06;
  const humGain = p.hum * 0.03;
  for (let ch = 0; ch < channels; ch++) {
    const data = bed.getChannelData(ch);
    const rng = seededRng(0x9e3779b9 + ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      let s = 0;
      // Hiss — gently low-passed white noise so it sits like tape hiss.
      if (hissGain > 0) {
        const white = rng() * 2 - 1;
        lp += 0.4 * (white - lp);
        s += (0.5 * white + 0.5 * lp) * hissGain;
      }
      // Mains hum + 2nd harmonic.
      if (humGain > 0) {
        const t = i / sampleRate;
        s += Math.sin(2 * Math.PI * humFreq * t) * humGain;
        s += Math.sin(2 * Math.PI * humFreq * 2 * t) * humGain * 0.4;
      }
      data[i] = s;
    }
    // Crackle / pops — sparse impulses.
    if (p.crackle > 0.01) {
      const rate = p.crackle * 0.0008; // probability per sample
      for (let i = 0; i < length; i++) {
        if (rng() < rate) {
          const amp = (rng() * 2 - 1) * p.crackle * 0.5;
          data[i] += amp;
          if (i + 1 < length) data[i + 1] += amp * 0.4;
        }
      }
    }
  }
  return bed;
}

export async function degradeAudioBuffer(
  input: AudioBuffer,
  profile: AudioProfile,
): Promise<AudioBuffer> {
  if (!input) return input;
  if (!profile || isEffectivelyClean(profile)) return input;

  // Silent media: return a zeroed buffer of the same shape.
  if (profile.silent >= 0.5) {
    const OfflineCtx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineCtx) return input;
    const silent = new OfflineCtx(input.numberOfChannels, input.length, input.sampleRate);
    return silent.createBuffer(input.numberOfChannels, input.length, input.sampleRate);
  }

  try {
    const OfflineCtx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    if (!OfflineCtx) return input;

    const outChannels = profile.mono >= 0.5 ? 1 : Math.min(2, input.numberOfChannels);
    const ctx: OfflineAudioContext = new OfflineCtx(outChannels, input.length, input.sampleRate);

    const source = ctx.createBufferSource();
    source.buffer = input;

    // ---- Wow & flutter: modulate detune with slow + fast LFOs. ----
    if (profile.wow > 0.01 || profile.flutter > 0.01) {
      const wowLfo = ctx.createOscillator();
      wowLfo.frequency.value = 0.6; // slow speed instability
      const wowGain = ctx.createGain();
      wowGain.gain.value = profile.wow * 28; // cents
      wowLfo.connect(wowGain).connect(source.detune);
      wowLfo.start();

      const flutLfo = ctx.createOscillator();
      flutLfo.frequency.value = 9; // fast flutter
      const flutGain = ctx.createGain();
      flutGain.gain.value = profile.flutter * 14;
      flutLfo.connect(flutGain).connect(source.detune);
      flutLfo.start();
    }

    let node: AudioNode = source;

    // ---- Telephone band overrides band edges when active. ----
    const lowCut = profile.telephone >= 0.5 ? Math.max(profile.lowCutHz, 300) : profile.lowCutHz;
    const highCut = profile.telephone >= 0.5 ? Math.min(profile.highCutHz, 3400) : profile.highCutHz;

    if (lowCut > 25) {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = lowCut;
      hp.Q.value = 0.7;
      node.connect(hp);
      node = hp;
    }
    if (highCut < 19000) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = highCut;
      lp.Q.value = profile.telephone >= 0.5 ? 1.2 : 0.7;
      node.connect(lp);
      node = lp;
      // Lossy/MP3 "swirl": a second resonant lowpass tightens the top end.
      if (profile.mp3 > 0.2) {
        const lp2 = ctx.createBiquadFilter();
        lp2.type = "lowpass";
        lp2.frequency.value = Math.max(2500, highCut * (1 - profile.mp3 * 0.4));
        lp2.Q.value = 0.9;
        node.connect(lp2);
        node = lp2;
      }
    }

    // ---- Companding / level pumping via a compressor. ----
    if (profile.companding > 0.05) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -24 - profile.companding * 10;
      comp.ratio.value = 3 + profile.companding * 6;
      comp.attack.value = 0.005;
      comp.release.value = 0.18;
      node.connect(comp);
      node = comp;
    }

    // ---- Mild waveshaper for lossy/companded "grit". ----
    if (profile.mp3 > 0.3 || profile.companding > 0.4) {
      const shaper = ctx.createWaveShaper();
      const amount = Math.max(profile.mp3, profile.companding);
      const curve = new Float32Array(1024);
      const k = amount * 8;
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
      }
      shaper.curve = curve;
      shaper.oversample = "2x";
      node.connect(shaper);
      node = shaper;
    }

    const masterGain = ctx.createGain();
    masterGain.gain.value = 1;
    node.connect(masterGain);
    masterGain.connect(ctx.destination);

    // ---- Additive bed (hiss / hum / crackle). ----
    const bed = buildNoiseBed(ctx, outChannels, input.length, input.sampleRate, profile);
    if (bed) {
      const bedSrc = ctx.createBufferSource();
      bedSrc.buffer = bed;
      bedSrc.connect(ctx.destination);
      bedSrc.start();
    }

    source.start();
    const rendered = await ctx.startRendering();
    // Per-clip level/gain + linear fades, applied to the rendered buffer so they
    // ride through the one DSP (preview == export).
    const gain = profile.gain ?? 1;
    if (Math.abs(gain - 1) > 0.001 || (profile.fadeIn ?? 0) > 0.001 || (profile.fadeOut ?? 0) > 0.001) {
      for (let ch = 0; ch < rendered.numberOfChannels; ch++) {
        applyGainFade(rendered.getChannelData(ch), rendered.sampleRate, gain, profile.fadeIn ?? 0, profile.fadeOut ?? 0);
      }
    }
    return rendered;
  } catch (err) {
    console.warn("Audio degradation failed — using original audio:", err);
    return input;
  }
}
