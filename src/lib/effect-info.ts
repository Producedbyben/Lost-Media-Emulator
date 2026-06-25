/**
 * Central, human-readable explainers for every adjustable effect. Each entry is a
 * short tutorial sentence — what the control does and what to expect as you push
 * it — surfaced as a hover tooltip next to the slider / select and in the panel
 * headers. Keyed by the exact param key so a single source of truth drives the UI.
 */
export const EFFECT_INFO: Record<string, string> = {
  // ---- Color & Grade : Primary Grade ----------------------------------------
  imageBrightness: "Overall exposure. Below 1 darkens the picture, above 1 lifts it brighter.",
  imageContrast: "Spread between shadows and highlights. Higher = punchier, lower = flatter and faded.",
  advancedSaturation: "Colour intensity. 0 is true black & white, 1 is untouched, above 1 over-pushes colour.",
  imageGamma: "Mid-tone brightness curve. Below 1 deepens midtones, above 1 opens them up without clipping.",
  imageTemperature: "Warm/cool white balance. Negative cools toward blue, positive warms toward orange.",
  imageTint: "Green/magenta balance, used to correct or fake a colour cast. Negative = green, positive = magenta.",

  // ---- Color & Grade : Colour Signal ----------------------------------------
  lumaNoise: "Brightness grain in the signal — the fine fizz of an analog luma channel.",
  chromaNoise: "Coloured speckle noise sitting only in the colour channel, typical of weak chroma.",
  chromaBleedHorizontal: "Smears colour sideways past edges, like an over-driven composite signal.",
  chromaBleedVertical: "Smears colour up/down between scanlines — vertical chroma run-off.",
  chromaPhaseError: "Shifts hues incorrectly (NTSC 'never twice the same colour') for off-tint skin tones.",
  blackLevelCrush: "Lifts or clamps the darkest tones so shadows lose detail and go milky or crushed.",
  highlightRollOff: "Softens how highlights clip, rounding hard whites into a gentler analog shoulder.",
  gammaCurve: "Extra signal gamma on top of the grade. Below 1 brightens, above 1 darkens the response.",

  // ---- Display & CRT : Optics -----------------------------------------------
  scanlineStrength: "Darkens the gaps between horizontal lines for the classic CRT raster look.",
  barrelDistortion: "Bulges or pinches the picture geometry like a curved CRT tube face.",
  chromaticAberration: "Splits red/blue channels at the edges, mimicking a misconverged colour gun or cheap lens.",
  bloom: "Blooming halo around bright areas as highlights overload the phosphor or sensor.",
  advancedNeonPhosphorBleed: "Glowing bleed from saturated, bright colours into surrounding pixels.",
  flicker: "Subtle brightness pulsing from the display's refresh, strongest on old tubes.",
  scanlineProfile: "Shape of the scanline gaps: soft for a gentle tube, hard for sharp lines, triad-aware to follow the mask.",
  phosphorPersistence: "How long bright pixels linger after they change — motion leaves a faint trailing glow.",
  beamSpotSizeX: "Horizontal softness of the electron beam dot — higher blurs detail left-to-right.",
  beamSpotSizeY: "Vertical softness of the electron beam dot — higher blurs detail top-to-bottom.",
  subpixelLayoutOverride: "Forces a panel subpixel grid: RGB/BGR stripes for LCDs or PenTile for OLED phones.",
  pixelResponseTime: "Slow LCD pixel switching that smears fast motion into a soft ghost trail.",

  // ---- Tape & Dropouts : Video Artifacts ------------------------------------
  pixelSize: "Chunky downscaling — higher values turn the image into bigger, blockier pixels.",
  advancedLineJitter: "Random horizontal wobble of individual scanlines, like an unstable tape sync.",
  advancedTimebaseWobble: "Slow wavy horizontal drift from a worn tape's timebase error.",
  advancedHeadSwitching: "The torn, noisy band of glitch at the very bottom of a VHS frame.",
  advancedChromaDelay: "Colour lags behind brightness, offsetting hues to the right of edges.",
  advancedCrossColor: "Rainbow shimmer on fine detail where luma and chroma interfere.",
  advancedDropouts: "Brief horizontal streaks where the tape loses signal momentarily.",
  advancedGhosting: "Faint repeated echo of the image, like a weak antenna or worn tape.",
  advancedInterlacing: "Combing teeth on motion from interlaced fields not lining up.",
  advancedTapeCrease: "Occasional creased-tape disruptions that warp a band of the picture.",

  // ---- Tape & Dropouts : Temporal Instability -------------------------------
  dropoutFrequency: "How often signal dropouts occur over time — higher means more frequent glitches.",
  dropoutLength: "How long each dropout lasts, from a quick flash to a longer streak.",
  jitterSpeed: "Speed of the frame-to-frame positional jitter — fast nervous shake vs slow drift.",
  jitterRandomness: "How chaotic the jitter is, from a regular wobble to unpredictable jumps.",
  wowFlutterSlow: "Slow speed warble (wow) of a worn transport, gently bending timing and pitch.",
  wowFlutterFast: "Fast flutter from mechanical instability, a quicker shimmering wobble.",
  flickerFrequencyHz: "Rate of brightness flicker — higher cycles faster, like a failing tube or lamp.",
  flickerDepth: "How strong the flicker dip is, from a faint pulse to heavy strobing.",
  autoExposureHunt: "Brightness 'breathing' as an old auto-exposure circuit hunts for a level.",

  // ---- Tape & Dropouts : Tape Mechanics -------------------------------------
  headClogEvents: "Sudden blanking or smearing when a clogged head briefly loses the picture.",
  trackingError: "Mistracking noise bands rolling through the frame, like a bad tracking adjustment.",
  tapeSkew: "Leaning/skewing of the top of the image as tape tension shifts.",
  chromaNoiseStreaking: "Horizontal coloured streaks dragged across the frame from chroma instability.",

  // ---- Film : Grain & Gate --------------------------------------------------
  advancedFilmGrain: "Photochemical film grain texture across the whole frame.",
  advancedFilmDust: "Dust specks and white/black flecks settled on the film.",
  advancedFilmScratches: "Vertical scratch lines from the film running through worn gear.",
  advancedFilmGateWeave: "Gentle side-to-side wander as the frame floats in the camera/projector gate.",
  advancedFilmHalation: "Warm red glow blooming around bright highlights, baked into film stock.",
  advancedExposurePump: "Flickering exposure between frames from inconsistent shutter or printing.",
  advancedWhiteBalanceDrift: "Slow colour-temperature drift over time, like ageing or mismatched stock.",
  advancedFocusBreathing: "Subtle focus/zoom shift between frames as a lens 'breathes'.",
  grainSize: "Coarseness of the grain — higher gives bigger, chunkier high-ISO style grain.",
  grainChromaticity: "How coloured the grain is, from monochrome speckle to RGB colour noise.",
  gateJitterX: "Horizontal frame registration jitter in the gate.",
  gateJitterY: "Vertical frame registration jitter — the picture hops up and down.",
  gateRotation: "Slight frame rotation wobble from a loose gate.",
  shutterJudder: "Stuttery motion cadence from a film-style shutter and frame rate.",
  printFadeCyan: "Cyan dye fade of an ageing print, shifting the picture toward red.",
  printFadeMagenta: "Magenta dye fade of an ageing print, shifting toward green.",
  printFadeYellow: "Yellow dye fade of an ageing print, shifting toward blue.",
  spliceFlash: "Bright flash frames where the film was cut and spliced.",
  cueMarks: "Reel-change cue dots that appear in the corner, as in old cinema prints.",

  // ---- Digital & Compression : Digital Noise --------------------------------
  noise: "General digital sensor/signal noise added across the image.",
  advancedFrameStutter: "Dropped/repeated frames that make motion stutter, like a stalling stream.",
  advancedRfInterference: "Rolling RF interference bars and static from a weak broadcast signal.",
  advancedCctvMonochrome: "Desaturates toward the grey, low-fidelity look of CCTV security footage.",
  advancedQuantization: "Posterises tones into banded steps, like a low bit-depth signal.",
  advancedGenerationLoss: "Compounding quality loss from copying a copy of a copy.",
  advancedMacroBlocking: "Blocky compression artifacts that clump detail into squares.",
  gopLength: "Spacing of keyframes — higher lets compression errors smear longer before refreshing.",
  deblockingStrength: "Codec deblocking that smooths block edges, trading detail for fewer hard seams.",
  ringingStrength: "Ghostly ripples beside sharp edges from aggressive compression.",
  chromaSubsamplingMode: "How much colour resolution is thrown away: 4:4:4 keeps it all, 4:2:0/4:1:1 crush colour detail.",
  packetLossBurst: "Bursts of corrupted blocks where streamed packets were lost.",
  upscaleSharpenHalos: "Bright halo edges from over-sharpened AI/cheap upscaling.",
  datamoshBloom: "Datamosh P-frame bloom where motion smears and blooms without a keyframe.",
  datamoshDisplacement: "Pushes blocks along motion vectors for the classic melting datamosh slide.",
  pixelSort: "Sorts pixels into streaked bands, a glitch-art corruption effect.",
  bitrotCorruption: "Random corrupted bytes, like a decaying or damaged digital file.",

  // ---- Sensor & Lens --------------------------------------------------------
  rollingShutterSkew: "Slants fast-moving objects from a CMOS sensor reading line by line (jello effect).",
  fixedPatternNoise: "Static per-pixel sensor noise pattern that stays put frame to frame.",
  hotPixels: "Stuck bright pixels scattered across the frame, common on old/hot sensors.",
  lensSmear: "Soft directional smear from a dirty or low-quality lens.",
  haze: "Low-contrast veiling glare, like shooting through a hazy or flared lens.",
  flareGhosts: "Reflected lens-flare ghosts and blobs from bright light sources.",
  vignette: "Darkening toward the corners from the lens or aperture.",
  cornerSharpnessFalloff: "Edges and corners go soft while the centre stays sharp, like a cheap lens.",

  // ---- Media Aging ----------------------------------------------------------
  mediaAgeYears: "Simulated age of the media in years — drives cumulative wear, fade and damage.",
  storageCondition: "How the media was stored: ideal stays clean, humid/hot/mold-risk add progressively worse damage.",
  copyGenerationCount: "How many times it was duplicated — each generation adds more loss and softness.",
  restorationPassLevel: "Amount of clean-up restoration applied, pulling back some damage and noise.",
};

/** Header-level explainers for each toggleable effect panel. */
export const PANEL_INFO: Record<string, string> = {
  grading: "Exposure and colour balance plus analog colour-signal degradation (noise, chroma bleed, phase error).",
  display: "The screen the footage is shown on — CRT optics (scanlines, geometry, bloom) and flat-panel physics.",
  tape: "Magnetic-tape and timing artifacts: dropouts, jitter, wow/flutter, head switching and tracking errors.",
  film: "Photochemical film look — grain, dust, scratches, halation, gate weave and print fade.",
  digital: "Codec-era artifacts: digital noise, compression blocking, packet loss and datamosh decay.",
  sensorLens: "Camera capture flaws — rolling shutter, sensor noise, hot pixels, lens smear, flare and vignette.",
  metaAging: "Overall ageing of the media: years of wear, storage damage, copy generations and restoration.",
  masks: "Phosphor / aperture-grille shadow mask overlaid on the picture for authentic display texture.",
  osd: "Burned-in on-screen display like a camcorder timestamp or recording indicator.",
};

/**
 * Pro-level tips keyed by the same param key as EFFECT_INFO. Where EFFECT_INFO
 * answers "what does this do?" for a beginner, EFFECT_PRO answers "how do I use it
 * well?" — typical ranges, pairings, gotchas and pipeline order for power users.
 * Surfaced as the "Pro" line in the hover tooltip and the guided effects tour.
 */
export const EFFECT_PRO: Record<string, string> = {
  // ---- Color & Grade : Primary Grade ----------------------------------------
  imageBrightness: "Grade exposure here before adding grain/noise — lifting brightness afterwards amplifies them. 0.9–1.1 stays natural.",
  imageContrast: "Pair a small boost with Highlight Roll-Off to stop whites clipping. 0.9–1.2 reads true; higher gets harsh.",
  advancedSaturation: "0 is a true Rec.709 luma greyscale. Push past ~1.5 only for stylised, over-pushed VHS/anime colour.",
  imageGamma: "Moves midtones without touching black/white points — better than Brightness for opening shadows. ~0.85–1.15.",
  imageTemperature: "Warm slightly (+0.1–0.2) to fake tungsten/old stock; cool for fluorescent or moonlight scenes.",
  imageTint: "Small amounts neutralise a cast; a heavy magenta push sells expired film stock.",

  // ---- Color & Grade : Colour Signal ----------------------------------------
  lumaNoise: "Stacks with film grain — both add luminance noise, so keep under ~0.3 or it reads as digital, not analog.",
  chromaNoise: "Combine with Chroma Bleed for an authentic muddy weak-chroma signal rather than clean digital speckle.",
  chromaBleedHorizontal: "Mimics NTSC composite, strongest on red/saturated edges. 0.2–0.4 reads as broadcast.",
  chromaBleedVertical: "Subtler than horizontal — use lightly so colour doesn't smear between scanlines.",
  chromaPhaseError: "The NTSC hue-shift tell: 0.1–0.2 nudges skin tones believably; high values go psychedelic.",
  blackLevelCrush: "Raise for a faded milky-shadow tape look, lower for crushed blacks. Watch banding in gradients.",
  highlightRollOff: "Reach for this whenever whites blow out — it bends hard clipping into a filmic shoulder.",
  gammaCurve: "Signal-stage gamma after the grade; fine-tune the response curve here, do big exposure moves in Primary Grade.",

  // ---- Display & CRT : Optics -----------------------------------------------
  scanlineStrength: "Match Mask Scale to output resolution — strong scanlines on low-res output crush detail. Best above 480p.",
  barrelDistortion: "Keep under ~0.3 for a believable tube and pair with Vignette for a real bezel feel.",
  chromaticAberration: "A few px at the edges sells cheap optics/misconvergence; too much looks like 3D glasses.",
  bloom: "Combine with Phosphor Persistence for glowing motion trails. Overdone bloom hides detail.",
  advancedNeonPhosphorBleed: "Targets saturated brights (neon, UI) — great for arcade/cyberpunk; keep subtle for realism.",
  flicker: "Low rates read as a dying tube. Keep depth low for export so it doesn't strobe uncomfortably.",
  scanlineProfile: "Triad-aware syncs the gaps to the shadow mask for the most authentic look on high-res output.",
  phosphorPersistence: "Essential for authentic CRT motion trails, but high values smear fast action.",
  beamSpotSizeX: "Raise slightly with Beam Spot Y for a soft consumer TV; keep tight for a sharp PVM/BVM.",
  beamSpotSizeY: "Vertical beam focus — pair with Beam Spot X. Higher softens detail and hides aliasing.",
  subpixelLayoutOverride: "Pick the panel you're emulating: PenTile for OLED phones, RGB stripe for LCD monitors.",
  pixelResponseTime: "LCD-era motion smear — use for early flat-panel looks, leave at 0 for CRT/film.",

  // ---- Tape & Dropouts : Video Artifacts ------------------------------------
  pixelSize: "Integer downscale — 2–4 nails low-res camcorder/webcam looks. Apply before sharpening effects.",
  advancedLineJitter: "Small amounts read as a worn tape; large amounts as a failing sync. Tie to Jitter Randomness.",
  advancedTimebaseWobble: "Slow horizontal warp (TBC failure) — pair with wow/flutter for a coherent worn-transport feel.",
  advancedHeadSwitching: "The dirty band at the frame bottom is the #1 VHS tell — even 0.2 instantly reads as tape.",
  advancedChromaDelay: "Offsets colour right of luma, a composite/VHS hallmark. 0.1–0.3 is convincing.",
  advancedCrossColor: "Rainbowing on fine patterns (herringbone, text) — authentic but noisy on detailed frames.",
  advancedDropouts: "Signature white streaks. Animate with Dropout Frequency/Length for natural variation.",
  advancedGhosting: "Lower for a worn tape, higher for a weak-antenna broadcast multipath echo.",
  advancedInterlacing: "Combing teeth only show on motion — use with video sources, not stills.",
  advancedTapeCrease: "Keep low and let it trigger sparingly; constant creasing looks fake.",

  // ---- Tape & Dropouts : Temporal Instability -------------------------------
  dropoutFrequency: "Drives how often dropouts fire alongside the Dropouts amount. Higher = an older, worse tape.",
  dropoutLength: "Mix short+frequent flicks for a busy worn look; long smears for dramatic signal loss.",
  jitterSpeed: "Fast = nervous cheap-cam shake, slow = drifting transport. Shape with Jitter Randomness.",
  jitterRandomness: "0 gives a periodic sync wobble; 1 gives chaotic jumps of a failing tape.",
  wowFlutterSlow: "Slow pitch/timing bend that also informs audio degrade if muxing. Keep subtle for realism.",
  wowFlutterFast: "Quick shimmer — stack lightly over slow wow for a mechanically worn transport.",
  flickerFrequencyHz: "Low for a failing fluorescent/tube, high for strobe artefacts. Pair with Flicker Depth.",
  flickerDepth: "Strength of the flicker dip — keep low for comfortable viewing and export.",
  autoExposureHunt: "Brightness 'breathing' of old AE circuits — great on outdoor/handheld footage.",

  // ---- Tape & Dropouts : Tape Mechanics -------------------------------------
  headClogEvents: "Use very sparingly — sudden picture loss is dramatic, so a little goes a long way.",
  trackingError: "Rolling noise bands like a bad tracking knob — the most aggressive VHS-failure look.",
  tapeSkew: "Subtle amounts lean the top of the frame for a stretched old-tape feel; high values look broken.",
  chromaNoiseStreaking: "Combine with Chroma Noise for a coherent degraded-colour signal rather than isolated streaks.",

  // ---- Film : Grain & Gate --------------------------------------------------
  advancedFilmGrain: "Resolution-independent — set Grain Size for the stock and add it near the end of the chain.",
  advancedFilmDust: "Animate on moving footage so specks don't look stuck to the lens.",
  advancedFilmScratches: "Sparse for prestige film, dense for grindhouse. Vertical lines imply gate wear.",
  advancedFilmGateWeave: "The key tell that sells 'real film' on otherwise rock-steady footage — keep it gentle.",
  advancedFilmHalation: "Warm red bloom baked into stock — pair with grain for a glowing filmic highlight.",
  advancedExposurePump: "Subtle frame-to-frame exposure flicker reads as old projection; high values look unstable.",
  advancedWhiteBalanceDrift: "Great on long shots — slow colour-temp drift implies ageing or mismatched stock.",
  advancedFocusBreathing: "Very subtle lens 'breathing' between frames; sells handheld/vintage glass.",
  grainSize: "Bigger = higher-ISO or smaller format (16mm/Super 8). Scale to output res so grain isn't invisible.",
  grainChromaticity: "0 = clean monochrome filmic grain; higher adds colour speckle that reads as sensor noise.",
  gateJitterX: "Tiny values only — mechanical registration jitter. Large amounts look mechanically broken.",
  gateJitterY: "Vertical registration hop; pair with Gate Jitter X and keep both small for realism.",
  gateRotation: "Loose-gate wobble — keep under a degree or the frame looks like it's spinning.",
  shutterJudder: "Pair with 24fps-style motion for cinematic judder; overdone it just stutters.",
  printFadeCyan: "Fade cyan for a warm red-shifted vintage print; combine all three fades for archival decay.",
  printFadeMagenta: "Magenta fade pushes toward green — balance with the cyan/yellow fades for a believable dye shift.",
  printFadeYellow: "Yellow fade pushes toward blue; small amounts across all three sell an ageing print.",
  spliceFlash: "Use rarely — a bright cut frame implies a physical splice at an edit point.",
  cueMarks: "Occasional corner dots are a knowing nod to projection; constant marks break the illusion.",

  // ---- Digital & Compression : Digital Noise --------------------------------
  noise: "For specific looks prefer Luma/Chroma Noise or Film Grain, which model real noise sources more accurately.",
  advancedFrameStutter: "Video only — dropped/repeated frames sell a buffering or glitchy-stream feel.",
  advancedRfInterference: "Animate the rolling bars for a live-tuning weak-broadcast feel.",
  advancedCctvMonochrome: "Pair with a timestamp OSD and low resolution for a convincing security-cam dump.",
  advancedQuantization: "Watch smooth gradients (skies) — banding shows there first as you posterise.",
  advancedGenerationLoss: "The core of the 'lost media' look — compounds softness and artefacts of repeated copies.",
  advancedMacroBlocking: "8×8 DCT blocks of low-bitrate codecs; ramps hardest on motion and dark areas.",
  gopLength: "Longer GOP lets errors smear across more frames before a keyframe resets — the basis of datamosh.",
  deblockingStrength: "Raise to hide blocking (softer), lower for raw crunchy artefacts. Trades detail for smoothness.",
  ringingStrength: "Mosquito noise beside hard edges and text — a clear tell of aggressive compression.",
  chromaSubsamplingMode: "4:2:0 crushes colour (most consumer codecs); 4:1:1 is NTSC DV; 4:4:4 keeps full colour.",
  packetLossBurst: "Corrupted block bursts of a dropped stream — perfect for digital-decay glitch moments.",
  upscaleSharpenHalos: "Halo edges of cheap AI/upscaling sell a 're-uploaded, re-encoded' provenance.",
  datamoshBloom: "Strongest with a long GOP when a keyframe is skipped. Video only.",
  datamoshDisplacement: "Drags blocks along motion vectors for the melting slide — pair with a long GOP.",
  pixelSort: "Threshold by brightness for controlled, intentional glitch-art streaks.",
  bitrotCorruption: "Tiny amounts read as a decaying file; high amounts as total corruption.",

  // ---- Sensor & Lens --------------------------------------------------------
  rollingShutterSkew: "Video only — subtle jello on fast pans/objects reads as a cheap phone or CMOS cam.",
  fixedPatternNoise: "Static (non-moving) pattern, distinct from random noise — great for old sensors and night shots.",
  hotPixels: "A few stuck dots sell a hot/old sensor; too many look like damage.",
  lensSmear: "Pair with Haze and Flare Ghosts for a grubby, low-quality optics look.",
  haze: "Veiling glare lifts blacks and lowers contrast — recover with a touch of Contrast if needed.",
  flareGhosts: "Put a bright light source in frame for the ghosts to anchor to convincingly.",
  vignette: "Subtle for realism, heavy for lomo/toy-camera. Pair with Barrel Distortion for a lens feel.",
  cornerSharpnessFalloff: "Keeps the centre sharp while corners go soft — the character of cheap vintage glass.",

  // ---- Media Aging ----------------------------------------------------------
  mediaAgeYears: "The master wear driver — set this first, then fine-tune individual effects on top.",
  storageCondition: "Worse conditions multiply damage; combine with Media Age for a coherent decay story.",
  copyGenerationCount: "Each generation compounds softness and noise — the heart of bootleg 'nth-gen tape' looks.",
  restorationPassLevel: "Fakes a partial restoration by pulling back noise/damage; high values can look artificially clean.",
};

/** Pro-level tips for each toggleable effect panel, keyed like PANEL_INFO. */
export const PANEL_PRO: Record<string, string> = {
  grading: "Make all colour decisions here first — downstream noise and compression react to the graded image.",
  display: "Tune this last: it models the screen the signal is shown on, after capture/format degradation.",
  tape: "The richest source of VHS tells — combine head-switching, dropouts and wow/flutter for instant authenticity.",
  film: "Add grain and gate weave near the end so they sit over the graded, degraded image.",
  digital: "Codec artefacts react to motion and bitrate (GOP); strongest on video and key to the 'lost upload' look.",
  sensorLens: "Capture-side flaws — conceptually the start of the chain, since the lens and sensor saw it first.",
  metaAging: "A macro layer that scales many effects by simulated age — the fastest way to dial overall decay.",
  masks: "Match Mask Scale to output resolution; the shadow mask is most convincing above 720p.",
  osd: "Combine burned-in overlays with CCTV monochrome and low resolution for a security-cam look.",
};

/**
 * Reverse lookup so a component holding only the beginner summary string (as
 * passed through `description`/`text` props) can still surface the matching pro
 * tip without every call site needing to pass the param key.
 */
const PRO_BY_SUMMARY: Record<string, string> = {};
for (const [key, summary] of Object.entries(EFFECT_INFO)) {
  const pro = EFFECT_PRO[key];
  if (pro) PRO_BY_SUMMARY[summary] = pro;
}
for (const [key, summary] of Object.entries(PANEL_INFO)) {
  const pro = PANEL_PRO[key];
  if (pro) PRO_BY_SUMMARY[summary] = pro;
}

/** Resolve the pro tip for a given beginner summary string, if one exists. */
export function getProTip(text?: string): string | undefined {
  if (!text) return undefined;
  return PRO_BY_SUMMARY[text];
}
