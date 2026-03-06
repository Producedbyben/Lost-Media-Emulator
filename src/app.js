const FALLBACK_PRESETS = {
  "Consumer TV": {
    scanlineStrength: 0.5,
    phosphorMask: 0.5,
    barrelDistortion: 0,
    bloom: 0.5,
    flicker: 0.22,
    chromaticAberration: 0.5,
    noise: 0.5,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0,
    advancedInterlacing: 0,
    advancedFrameStutter: 0,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
  },
  "PVM/BVM": {
    scanlineStrength: 0.25,
    phosphorMask: 0.6,
    barrelDistortion: -0.031,
    bloom: 0.2,
    flicker: 0.12,
    chromaticAberration: 0.08,
    noise: 0.16,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0,
    advancedInterlacing: 0,
    advancedFrameStutter: 0,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
  },
  Arcade: {
    scanlineStrength: 0.4,
    phosphorMask: 0.45,
    barrelDistortion: -0.047,
    bloom: 0.55,
    flicker: 0.2,
    chromaticAberration: 0.2,
    noise: 0.3,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0,
    advancedInterlacing: 0,
    advancedFrameStutter: 0,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
  },
  "Late-80s Home VHS": {
    scanlineStrength: 0.52,
    phosphorMask: 0.26,
    barrelDistortion: -0.094,
    bloom: 0.62,
    flicker: 0.16,
    chromaticAberration: 0.51,
    noise: 0.33,
    pixelSize: 2,
    maskScale: 1,
    advancedLineJitter: 0.23,
    advancedTimebaseWobble: 0.34,
    advancedHeadSwitching: 0.42,
    advancedChromaDelay: 0.33,
    advancedCrossColor: 0.38,
    advancedDropouts: 0.31,
    advancedGhosting: 0.29,
    advancedInterlacing: 0.29,
    advancedFrameStutter: 0.22,
    advancedRfInterference: 0.24,
    advancedExposurePump: 0.19,
    advancedWhiteBalanceDrift: 0.21,
    advancedFocusBreathing: 0.18,
    advancedTapeCrease: 0.2,
    advancedTimestampOSD: 0.54,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
  },
  "90s Rental Tape (3rd Gen Dub)": {
    scanlineStrength: 0.59,
    phosphorMask: 0.2,
    barrelDistortion: -0.109,
    bloom: 0.7,
    flicker: 0.2,
    chromaticAberration: 0.62,
    noise: 0.45,
    pixelSize: 3,
    maskScale: 1.2,
    advancedLineJitter: 0.31,
    advancedTimebaseWobble: 0.44,
    advancedHeadSwitching: 0.56,
    advancedChromaDelay: 0.46,
    advancedCrossColor: 0.54,
    advancedDropouts: 0.49,
    advancedGhosting: 0.43,
    advancedInterlacing: 0.38,
    advancedFrameStutter: 0.44,
    advancedRfInterference: 0.34,
    advancedExposurePump: 0.26,
    advancedWhiteBalanceDrift: 0.24,
    advancedFocusBreathing: 0.24,
    advancedTapeCrease: 0.37,
    advancedTimestampOSD: 0.62,
    advancedOSDStyle: 2,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.08,
    advancedGenerationLoss: 0.72,
    advancedMacroBlocking: 0.18,
  },
  "Hi8 Vacation Cam": {
    scanlineStrength: 0.41,
    phosphorMask: 0.32,
    barrelDistortion: -0.058,
    bloom: 0.46,
    flicker: 0.11,
    chromaticAberration: 0.24,
    noise: 0.2,
    pixelSize: 2,
    maskScale: 1,
    advancedLineJitter: 0.09,
    advancedTimebaseWobble: 0.16,
    advancedHeadSwitching: 0.21,
    advancedChromaDelay: 0.24,
    advancedCrossColor: 0.14,
    advancedDropouts: 0.16,
    advancedGhosting: 0.24,
    advancedInterlacing: 0.26,
    advancedFrameStutter: 0.05,
    advancedRfInterference: 0.16,
    advancedExposurePump: 0.23,
    advancedWhiteBalanceDrift: 0.31,
    advancedFocusBreathing: 0.17,
    advancedTapeCrease: 0.12,
    advancedTimestampOSD: 0.38,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
  },
  "MiniDV Family Cam (2002)": {
    scanlineStrength: 0.3,
    phosphorMask: 0.44,
    barrelDistortion: -0.039,
    bloom: 0.32,
    flicker: 0.08,
    chromaticAberration: 0.17,
    noise: 0.19,
    pixelSize: 2,
    maskScale: 1,
    advancedLineJitter: 0.02,
    advancedTimebaseWobble: 0.05,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0.12,
    advancedCrossColor: 0.06,
    advancedDropouts: 0.08,
    advancedGhosting: 0.18,
    advancedInterlacing: 0.36,
    advancedFrameStutter: 0.12,
    advancedRfInterference: 0.06,
    advancedExposurePump: 0.28,
    advancedWhiteBalanceDrift: 0.22,
    advancedFocusBreathing: 0.12,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0.51,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.12,
    advancedGenerationLoss: 0.05,
    advancedMacroBlocking: 0.08,
  },
  "Off-Air Analog Broadcast": {
    scanlineStrength: 0.45,
    phosphorMask: 0.38,
    barrelDistortion: -0.082,
    bloom: 0.52,
    flicker: 0.14,
    chromaticAberration: 0.37,
    noise: 0.28,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0.2,
    advancedTimebaseWobble: 0.28,
    advancedHeadSwitching: 0.06,
    advancedChromaDelay: 0.24,
    advancedCrossColor: 0.31,
    advancedDropouts: 0.11,
    advancedGhosting: 0.19,
    advancedInterlacing: 0.24,
    advancedFrameStutter: 0.18,
    advancedRfInterference: 0.41,
    advancedExposurePump: 0.21,
    advancedWhiteBalanceDrift: 0.14,
    advancedFocusBreathing: 0.11,
    advancedTapeCrease: 0.03,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
  },
  "Public Access Archive": {
    scanlineStrength: 0.43,
    phosphorMask: 0.34,
    barrelDistortion: -0.07,
    bloom: 0.48,
    flicker: 0.13,
    chromaticAberration: 0.33,
    noise: 0.31,
    pixelSize: 2,
    maskScale: 1,
    advancedLineJitter: 0.15,
    advancedTimebaseWobble: 0.23,
    advancedHeadSwitching: 0.12,
    advancedChromaDelay: 0.28,
    advancedCrossColor: 0.36,
    advancedDropouts: 0.27,
    advancedGhosting: 0.26,
    advancedInterlacing: 0.31,
    advancedFrameStutter: 0.23,
    advancedRfInterference: 0.29,
    advancedExposurePump: 0.25,
    advancedWhiteBalanceDrift: 0.2,
    advancedFocusBreathing: 0.15,
    advancedTapeCrease: 0.11,
    advancedTimestampOSD: 0.68,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    maskType: "none",
  },
  "Early Web Rip (2006)": {
    scanlineStrength: 0,
    phosphorMask: 0,
    barrelDistortion: 0,
    bloom: 0.04,
    flicker: 0,
    chromaticAberration: 0.02,
    noise: 0.06,
    pixelSize: 4,
    maskScale: 1.3,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0,
    advancedInterlacing: 0,
    advancedFrameStutter: 0.24,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 1,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.46,
    advancedGenerationLoss: 0.18,
    advancedMacroBlocking: 0.34,
    maskType: "none",
  },
  "Security Camera Dump": {
    scanlineStrength: 0,
    phosphorMask: 0,
    barrelDistortion: 0,
    bloom: 0.02,
    flicker: 0,
    chromaticAberration: 0.02,
    noise: 0.2,
    pixelSize: 5,
    maskScale: 1.5,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0.02,
    advancedGhosting: 0.03,
    advancedInterlacing: 0,
    advancedFrameStutter: 0.52,
    advancedRfInterference: 0.19,
    advancedExposurePump: 0.12,
    advancedWhiteBalanceDrift: 0.08,
    advancedFocusBreathing: 0.09,
    advancedTapeCrease: 0.03,
    advancedTimestampOSD: 0.76,
    advancedOSDStyle: 3,
    advancedCctvMonochrome: 1,
    advancedSaturation: 0,
    advancedQuantization: 0.42,
    advancedGenerationLoss: 0.2,
    advancedMacroBlocking: 0.3,
    maskType: "none",
  },
  "Bootleg Concert Cam": {
    scanlineStrength: 0.55,
    phosphorMask: 0.24,
    barrelDistortion: -0.101,
    bloom: 0.76,
    flicker: 0.24,
    chromaticAberration: 0.58,
    noise: 0.52,
    pixelSize: 3,
    maskScale: 1,
    advancedLineJitter: 0.34,
    advancedTimebaseWobble: 0.41,
    advancedHeadSwitching: 0.35,
    advancedChromaDelay: 0.4,
    advancedCrossColor: 0.33,
    advancedDropouts: 0.45,
    advancedGhosting: 0.39,
    advancedInterlacing: 0.33,
    advancedFrameStutter: 0.24,
    advancedRfInterference: 0.37,
    advancedExposurePump: 0.43,
    advancedWhiteBalanceDrift: 0.33,
    advancedFocusBreathing: 0.4,
    advancedTapeCrease: 0.39,
    advancedTimestampOSD: 0.26,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    maskType: "phosphor",
  },
  "Damaged Archive Recovery": {
    scanlineStrength: 0.49,
    phosphorMask: 0.27,
    barrelDistortion: -0.074,
    bloom: 0.58,
    flicker: 0.18,
    chromaticAberration: 0.46,
    noise: 0.47,
    pixelSize: 3,
    maskScale: 1.1,
    advancedLineJitter: 0.29,
    advancedTimebaseWobble: 0.36,
    advancedHeadSwitching: 0.28,
    advancedChromaDelay: 0.37,
    advancedCrossColor: 0.4,
    advancedDropouts: 0.57,
    advancedGhosting: 0.34,
    advancedInterlacing: 0.3,
    advancedFrameStutter: 0.34,
    advancedRfInterference: 0.46,
    advancedExposurePump: 0.29,
    advancedWhiteBalanceDrift: 0.35,
    advancedFocusBreathing: 0.31,
    advancedTapeCrease: 0.52,
    advancedTimestampOSD: 0.81,
    advancedOSDStyle: 2,
    advancedCctvMonochrome: 0.24,
    advancedQuantization: 0.08,
    advancedGenerationLoss: 0.79,
    advancedMacroBlocking: 0.14,
    maskType: "dot",
  },
  "Retro Pixel LCD": {
    scanlineStrength: 0.08,
    phosphorMask: 0.04,
    barrelDistortion: 0,
    bloom: 0.08,
    flicker: 0.02,
    chromaticAberration: 0.03,
    noise: 0.04,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0,
    advancedInterlacing: 0,
    advancedFrameStutter: 0,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    maskType: "none",
  },
  "Cyberpunk OLED": {
    scanlineStrength: 0.14,
    phosphorMask: 0.12,
    barrelDistortion: -0.012,
    bloom: 0.68,
    flicker: 0.03,
    chromaticAberration: 0.06,
    noise: 0.05,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0.04,
    advancedInterlacing: 0,
    advancedFrameStutter: 0,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    maskType: "aperture",
  },
  "Streaming Compression": {
    scanlineStrength: 0.18,
    phosphorMask: 0.1,
    barrelDistortion: 0,
    bloom: 0.2,
    flicker: 0.03,
    chromaticAberration: 0.07,
    noise: 0.12,
    pixelSize: 2,
    maskScale: 1.1,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0.02,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0,
    advancedInterlacing: 0,
    advancedFrameStutter: 0.12,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.3,
    advancedGenerationLoss: 0.12,
    advancedMacroBlocking: 0.32,
    maskType: "none",
  },
  "Digital Surveillance": {
    scanlineStrength: 0.22,
    phosphorMask: 0.16,
    barrelDistortion: 0,
    bloom: 0.12,
    flicker: 0.02,
    chromaticAberration: 0.04,
    noise: 0.18,
    pixelSize: 3,
    maskScale: 1.2,
    advancedLineJitter: 0.02,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0.03,
    advancedInterlacing: 0,
    advancedFrameStutter: 0.26,
    advancedRfInterference: 0.03,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0.42,
    advancedOSDStyle: 3,
    advancedCctvMonochrome: 1,
    advancedSaturation: 0,
    advancedQuantization: 0.24,
    advancedGenerationLoss: 0.08,
    advancedMacroBlocking: 0.18,
    maskType: "none",
  },
  "Silent Film 1920s": {
    scanlineStrength: 0,
    phosphorMask: 0,
    bloom: 0.08,
    flicker: 0.24,
    chromaticAberration: 0,
    noise: 0.34,
    pixelSize: 2,
    advancedFrameStutter: 0.18,
    advancedExposurePump: 0.22,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedQuantization: 0,
    advancedCctvMonochrome: 1,
    advancedSaturation: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    advancedFilmGrain: 0.68,
    advancedFilmDust: 0.44,
    advancedFilmScratches: 0.62,
    advancedFilmGateWeave: 0.56,
    advancedFilmHalation: 0.22,
    maskType: "none",
  },
  "Technicolor Print 1950s": {
    scanlineStrength: 0.04,
    phosphorMask: 0.08,
    barrelDistortion: -0.01,
    bloom: 0.36,
    flicker: 0.05,
    chromaticAberration: 0.12,
    noise: 0.14,
    pixelSize: 1,
    advancedGhosting: 0.02,
    advancedExposurePump: 0.1,
    advancedWhiteBalanceDrift: 0.08,
    advancedFocusBreathing: 0.04,
    advancedQuantization: 0,
    advancedCctvMonochrome: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    advancedFilmGrain: 0.44,
    advancedFilmDust: 0.14,
    advancedFilmScratches: 0.08,
    advancedFilmGateWeave: 0.2,
    advancedFilmHalation: 0.62,
    maskType: "dot",
  },
  "Super 8 Home Reel 1970s": {
    scanlineStrength: 0.06,
    phosphorMask: 0.04,
    barrelDistortion: -0.02,
    bloom: 0.42,
    flicker: 0.18,
    chromaticAberration: 0.18,
    noise: 0.29,
    pixelSize: 2,
    advancedFrameStutter: 0.14,
    advancedExposurePump: 0.34,
    advancedWhiteBalanceDrift: 0.24,
    advancedFocusBreathing: 0.28,
    advancedQuantization: 0,
    advancedCctvMonochrome: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    advancedFilmGrain: 0.76,
    advancedFilmDust: 0.38,
    advancedFilmScratches: 0.28,
    advancedFilmGateWeave: 0.46,
    advancedFilmHalation: 0.4,
    maskType: "filmSuper8",
  },
  "16mm Broadcast Kinescope": {
    scanlineStrength: 0.22,
    phosphorMask: 0.18,
    barrelDistortion: -0.046,
    bloom: 0.31,
    flicker: 0.08,
    chromaticAberration: 0.11,
    noise: 0.22,
    pixelSize: 2,
    advancedLineJitter: 0.09,
    advancedTimebaseWobble: 0.14,
    advancedGhosting: 0.12,
    advancedInterlacing: 0.2,
    advancedDropouts: 0.08,
    advancedExposurePump: 0.1,
    advancedWhiteBalanceDrift: 0.06,
    advancedFocusBreathing: 0.06,
    advancedQuantization: 0,
    advancedCctvMonochrome: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    advancedFilmGrain: 0.48,
    advancedFilmDust: 0.22,
    advancedFilmScratches: 0.24,
    advancedFilmGateWeave: 0.32,
    advancedFilmHalation: 0.24,
    maskType: "film16mm",
  },
  "Nitrate Newsreel 1930s": {
    scanlineStrength: 0,
    phosphorMask: 0,
    barrelDistortion: 0,
    bloom: 0.18,
    flicker: 0.28,
    chromaticAberration: 0,
    noise: 0.42,
    pixelSize: 3,
    advancedFrameStutter: 0.24,
    advancedExposurePump: 0.34,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0.08,
    advancedQuantization: 0,
    advancedCctvMonochrome: 1,
    advancedSaturation: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    advancedFilmGrain: 0.82,
    advancedFilmDust: 0.54,
    advancedFilmScratches: 0.74,
    advancedFilmGateWeave: 0.63,
    advancedFilmHalation: 0.29,
    maskType: "none",
  },
  "Live NTSC Kinescope 1950s": {
    scanlineStrength: 0.17,
    phosphorMask: 0.12,
    barrelDistortion: -0.03,
    bloom: 0.26,
    flicker: 0.11,
    chromaticAberration: 0.05,
    noise: 0.26,
    pixelSize: 2,
    advancedLineJitter: 0.18,
    advancedTimebaseWobble: 0.19,
    advancedGhosting: 0.14,
    advancedInterlacing: 0.32,
    advancedDropouts: 0.07,
    advancedRfInterference: 0.13,
    advancedFrameStutter: 0.16,
    advancedExposurePump: 0.15,
    advancedWhiteBalanceDrift: 0.08,
    advancedFocusBreathing: 0.07,
    advancedFilmGrain: 0.51,
    advancedFilmDust: 0.23,
    advancedFilmScratches: 0.21,
    advancedFilmGateWeave: 0.37,
    advancedFilmHalation: 0.17,
    maskType: "film16mm",
  },
  "U-matic Field Tape 1970s": {
    scanlineStrength: 0.37,
    phosphorMask: 0.28,
    barrelDistortion: -0.061,
    bloom: 0.54,
    flicker: 0.16,
    chromaticAberration: 0.35,
    noise: 0.36,
    pixelSize: 2,
    maskScale: 1,
    advancedLineJitter: 0.27,
    advancedTimebaseWobble: 0.33,
    advancedHeadSwitching: 0.45,
    advancedChromaDelay: 0.36,
    advancedCrossColor: 0.34,
    advancedDropouts: 0.42,
    advancedGhosting: 0.31,
    advancedInterlacing: 0.41,
    advancedFrameStutter: 0.22,
    advancedRfInterference: 0.35,
    advancedExposurePump: 0.23,
    advancedWhiteBalanceDrift: 0.22,
    advancedFocusBreathing: 0.18,
    advancedTapeCrease: 0.29,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0.22,
    advancedMacroBlocking: 0,
    maskType: "phosphor",
  },
  "Betacam SP ENG 1980s": {
    scanlineStrength: 0.3,
    phosphorMask: 0.41,
    barrelDistortion: -0.043,
    bloom: 0.35,
    flicker: 0.09,
    chromaticAberration: 0.15,
    noise: 0.22,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0.11,
    advancedTimebaseWobble: 0.15,
    advancedHeadSwitching: 0.08,
    advancedChromaDelay: 0.16,
    advancedCrossColor: 0.12,
    advancedDropouts: 0.14,
    advancedGhosting: 0.17,
    advancedInterlacing: 0.34,
    advancedFrameStutter: 0.09,
    advancedRfInterference: 0.11,
    advancedExposurePump: 0.18,
    advancedWhiteBalanceDrift: 0.15,
    advancedFocusBreathing: 0.12,
    advancedTapeCrease: 0.06,
    advancedTimestampOSD: 0.18,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.02,
    advancedGenerationLoss: 0.06,
    advancedMacroBlocking: 0,
    maskType: "aperture",
  },
  "LaserDisc Transfer 1990s": {
    scanlineStrength: 0.19,
    phosphorMask: 0.24,
    barrelDistortion: -0.02,
    bloom: 0.22,
    flicker: 0.06,
    chromaticAberration: 0.11,
    noise: 0.16,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0.05,
    advancedTimebaseWobble: 0.08,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0.18,
    advancedCrossColor: 0.19,
    advancedDropouts: 0.04,
    advancedGhosting: 0.12,
    advancedInterlacing: 0.22,
    advancedFrameStutter: 0.03,
    advancedRfInterference: 0.1,
    advancedExposurePump: 0.04,
    advancedWhiteBalanceDrift: 0.05,
    advancedFocusBreathing: 0.04,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    maskType: "dot",
  },
  "DVD Rip 2001": {
    scanlineStrength: 0,
    phosphorMask: 0,
    barrelDistortion: 0,
    bloom: 0.05,
    flicker: 0,
    chromaticAberration: 0.01,
    noise: 0.06,
    pixelSize: 2,
    maskScale: 1.2,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0,
    advancedInterlacing: 0.18,
    advancedFrameStutter: 0.05,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.24,
    advancedGenerationLoss: 0.04,
    advancedMacroBlocking: 0.19,
    maskType: "none",
  },
  "HDV Camcorder 2005": {
    scanlineStrength: 0.12,
    phosphorMask: 0.2,
    barrelDistortion: -0.012,
    bloom: 0.18,
    flicker: 0.03,
    chromaticAberration: 0.08,
    noise: 0.12,
    pixelSize: 2,
    maskScale: 1,
    advancedLineJitter: 0.01,
    advancedTimebaseWobble: 0.03,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0.08,
    advancedCrossColor: 0.03,
    advancedDropouts: 0.02,
    advancedGhosting: 0.07,
    advancedInterlacing: 0.27,
    advancedFrameStutter: 0.08,
    advancedRfInterference: 0.02,
    advancedExposurePump: 0.14,
    advancedWhiteBalanceDrift: 0.11,
    advancedFocusBreathing: 0.09,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0.36,
    advancedOSDStyle: 1,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.2,
    advancedGenerationLoss: 0.05,
    advancedMacroBlocking: 0.14,
    maskType: "none",
  },
  "DSLR Video 2010": {
    scanlineStrength: 0.03,
    phosphorMask: 0.04,
    barrelDistortion: -0.008,
    bloom: 0.12,
    flicker: 0.02,
    chromaticAberration: 0.07,
    noise: 0.08,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0.03,
    advancedInterlacing: 0,
    advancedFrameStutter: 0.02,
    advancedRfInterference: 0,
    advancedExposurePump: 0.18,
    advancedWhiteBalanceDrift: 0.12,
    advancedFocusBreathing: 0.14,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.04,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0.05,
    maskType: "none",
  },
  "Early Smartphone 2012": {
    scanlineStrength: 0,
    phosphorMask: 0,
    barrelDistortion: 0,
    bloom: 0.06,
    flicker: 0,
    chromaticAberration: 0.04,
    noise: 0.14,
    pixelSize: 2,
    maskScale: 1.1,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0.04,
    advancedInterlacing: 0,
    advancedFrameStutter: 0.15,
    advancedRfInterference: 0,
    advancedExposurePump: 0.12,
    advancedWhiteBalanceDrift: 0.17,
    advancedFocusBreathing: 0.08,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0.2,
    advancedOSDStyle: 1,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.31,
    advancedGenerationLoss: 0.07,
    advancedMacroBlocking: 0.28,
    maskType: "none",
  },
  "4K HDR Streaming 2020s": {
    scanlineStrength: 0,
    phosphorMask: 0,
    barrelDistortion: 0,
    bloom: 0.16,
    flicker: 0,
    chromaticAberration: 0.01,
    noise: 0.03,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0,
    advancedInterlacing: 0,
    advancedFrameStutter: 0.03,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0.01,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.08,
    advancedGenerationLoss: 0.01,
    advancedMacroBlocking: 0.1,
    maskType: "none",
  },
  "PAL Living Room TV (1970s)": {
    scanlineStrength: 0.48,
    phosphorMask: 0.4,
    barrelDistortion: -0.062,
    bloom: 0.44,
    flicker: 0.09,
    chromaticAberration: 0.22,
    noise: 0.26,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0.12,
    advancedTimebaseWobble: 0.21,
    advancedHeadSwitching: 0.04,
    advancedChromaDelay: 0.29,
    advancedCrossColor: 0.42,
    advancedDropouts: 0.09,
    advancedGhosting: 0.17,
    advancedInterlacing: 0.36,
    advancedFrameStutter: 0.11,
    advancedRfInterference: 0.24,
    advancedExposurePump: 0.16,
    advancedWhiteBalanceDrift: 0.1,
    advancedFocusBreathing: 0.08,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    maskType: "dot",
  },
  "Video CD Capture (1999)": {
    scanlineStrength: 0.03,
    phosphorMask: 0.02,
    barrelDistortion: 0,
    bloom: 0.07,
    flicker: 0,
    chromaticAberration: 0.03,
    noise: 0.12,
    pixelSize: 3,
    maskScale: 1.3,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0.05,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0.04,
    advancedInterlacing: 0.14,
    advancedFrameStutter: 0.16,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.39,
    advancedGenerationLoss: 0.17,
    advancedMacroBlocking: 0.36,
    maskType: "none",
  },
  "CRT PC Monitor (1995)": {
    scanlineStrength: 0.22,
    phosphorMask: 0.52,
    barrelDistortion: -0.026,
    bloom: 0.18,
    flicker: 0.07,
    chromaticAberration: 0.07,
    noise: 0.09,
    pixelSize: 1,
    maskScale: 1,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0.02,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0.03,
    advancedInterlacing: 0,
    advancedFrameStutter: 0,
    advancedRfInterference: 0,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0,
    advancedMacroBlocking: 0,
    maskType: "aperture",
  },
  "Cable Access Recorder (1984)": {
    scanlineStrength: 0.46,
    phosphorMask: 0.29,
    barrelDistortion: -0.086,
    bloom: 0.57,
    flicker: 0.15,
    chromaticAberration: 0.41,
    noise: 0.37,
    pixelSize: 2,
    maskScale: 1,
    advancedLineJitter: 0.24,
    advancedTimebaseWobble: 0.35,
    advancedHeadSwitching: 0.31,
    advancedChromaDelay: 0.39,
    advancedCrossColor: 0.35,
    advancedDropouts: 0.33,
    advancedGhosting: 0.28,
    advancedInterlacing: 0.37,
    advancedFrameStutter: 0.21,
    advancedRfInterference: 0.32,
    advancedExposurePump: 0.22,
    advancedWhiteBalanceDrift: 0.18,
    advancedFocusBreathing: 0.16,
    advancedTapeCrease: 0.24,
    advancedTimestampOSD: 0.47,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0,
    advancedGenerationLoss: 0.28,
    advancedMacroBlocking: 0,
    maskType: "phosphor",
  },
  "Early Webcam (2008)": {
    scanlineStrength: 0,
    phosphorMask: 0,
    barrelDistortion: 0,
    bloom: 0.05,
    flicker: 0,
    chromaticAberration: 0.03,
    noise: 0.21,
    pixelSize: 3,
    maskScale: 1.25,
    advancedLineJitter: 0,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0,
    advancedCrossColor: 0,
    advancedDropouts: 0,
    advancedGhosting: 0.02,
    advancedInterlacing: 0,
    advancedFrameStutter: 0.19,
    advancedRfInterference: 0,
    advancedExposurePump: 0.19,
    advancedWhiteBalanceDrift: 0.28,
    advancedFocusBreathing: 0.11,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.41,
    advancedGenerationLoss: 0.1,
    advancedMacroBlocking: 0.34,
    maskType: "none",
  },
  "ATSC Broadcast Transition (2009)": {
    scanlineStrength: 0.11,
    phosphorMask: 0.07,
    barrelDistortion: -0.008,
    bloom: 0.14,
    flicker: 0.02,
    chromaticAberration: 0.04,
    noise: 0.1,
    pixelSize: 2,
    maskScale: 1.1,
    advancedLineJitter: 0.01,
    advancedTimebaseWobble: 0,
    advancedHeadSwitching: 0,
    advancedChromaDelay: 0.03,
    advancedCrossColor: 0,
    advancedDropouts: 0.01,
    advancedGhosting: 0.05,
    advancedInterlacing: 0.09,
    advancedFrameStutter: 0.13,
    advancedRfInterference: 0.03,
    advancedExposurePump: 0,
    advancedWhiteBalanceDrift: 0,
    advancedFocusBreathing: 0.02,
    advancedTapeCrease: 0,
    advancedTimestampOSD: 0,
    advancedOSDStyle: 0,
    advancedCctvMonochrome: 0,
    advancedQuantization: 0.27,
    advancedGenerationLoss: 0.04,
    advancedMacroBlocking: 0.22,
    maskType: "none",
  },
};

const MP4_MUXER_CDN = "https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.2/build/mp4-muxer.mjs";

function seededNoise(x, y, frame) {
  const v = Math.sin(x * 12.9898 + y * 78.233 + frame * 19.17) * 43758.5453;
  return v - Math.floor(v);
}

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

class CRTRenderer {
  constructor() {
    this.sourceCanvas = document.createElement("canvas");
    this.fitCanvas = document.createElement("canvas");
    this.workCanvas = document.createElement("canvas");
    this.tempCanvas = document.createElement("canvas");
    this.quantCanvas = document.createElement("canvas");
    this.hasImage = false;
  }

  setImage(img, sourceScale = 1) {
    const inputWidth = img.naturalWidth || img.videoWidth || img.width;
    const inputHeight = img.naturalHeight || img.videoHeight || img.height;
    const scale = Math.max(0.1, Math.min(1, sourceScale || 1));
    this.sourceCanvas.width = Math.max(1, Math.round(inputWidth * scale));
    this.sourceCanvas.height = Math.max(1, Math.round(inputHeight * scale));
    const ctx = this.sourceCanvas.getContext("2d");
    ctx.clearRect(0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, inputWidth, inputHeight, 0, 0, this.sourceCanvas.width, this.sourceCanvas.height);
    this.hasImage = true;
  }

  sampleBilinear(data, width, height, u, v, channel) {
    const x = Math.max(0, Math.min(width - 1, u * (width - 1)));
    const y = Math.max(0, Math.min(height - 1, v * (height - 1)));
    const x0 = Math.floor(x);
    const x1 = Math.min(width - 1, x0 + 1);
    const y0 = Math.floor(y);
    const y1 = Math.min(height - 1, y0 + 1);
    const tx = x - x0;
    const ty = y - y0;

    const i00 = (y0 * width + x0) * 4 + channel;
    const i10 = (y0 * width + x1) * 4 + channel;
    const i01 = (y1 * width + x0) * 4 + channel;
    const i11 = (y1 * width + x1) * 4 + channel;

    const a = data[i00] * (1 - tx) + data[i10] * tx;
    const b = data[i01] * (1 - tx) + data[i11] * tx;
    return a * (1 - ty) + b * ty;
  }

  render(outCtx, width, height, seconds, params, frameIndex, fps, renderOptions = {}) {
    outCtx.clearRect(0, 0, width, height);
    outCtx.fillStyle = "black";
    outCtx.fillRect(0, 0, width, height);
    if (!this.hasImage) return;

    this.fitCanvas.width = width;
    this.fitCanvas.height = height;
    const fitCtx = this.fitCanvas.getContext("2d", { willReadFrequently: true });
    fitCtx.clearRect(0, 0, width, height);
    fitCtx.imageSmoothingEnabled = true;
    fitCtx.imageSmoothingQuality = "high";

    const src = this.sourceCanvas;
    const srcAspect = src.width / src.height;
    const dstAspect = width / height;
    let sw = src.width;
    let sh = src.height;
    let sx = 0;
    let sy = 0;

    if (srcAspect > dstAspect) {
      sw = src.height * dstAspect;
      sx = (src.width - sw) / 2;
    } else {
      sh = src.width / dstAspect;
      sy = (src.height - sh) / 2;
    }

    fitCtx.drawImage(src, sx, sy, sw, sh, 0, 0, width, height);

    this.workCanvas.width = width;
    this.workCanvas.height = height;
    const wctx = this.workCanvas.getContext("2d", { willReadFrequently: true });
    const srcPixels = fitCtx.getImageData(0, 0, width, height);
    const outPixels = wctx.createImageData(width, height);
    const srcData = srcPixels.data;
    const dstData = outPixels.data;

    const barrel = Math.max(-0.3, Math.min(0.3, params.barrelDistortion));
    const barrelCornerWarp = Math.max(0.35, 1 + barrel * (0.22 + 0.78 * 2));
    const barrelOverscan = barrel < 0 ? barrelCornerWarp : 1;
    const ca = params.chromaticAberration;
    const scan = params.scanlineStrength;
    const mask = params.phosphorMask;
    const maskType = typeof params.maskType === "string" ? params.maskType : "phosphor";
    const pixelSize = Math.max(1, Number(params.pixelSize) || 1);
    const maskScale = Math.max(1, Number(params.maskScale) || 1);
    const pixelInfluence = 1 + (pixelSize - 1) * 0.22;
    const pixelStepX = width > 1 ? 1 / (width - 1) : 0;
    const pixelStepY = height > 1 ? 1 / (height - 1) : 0;
    const frameSeconds = frameIndex / fps;

    const lineJitter = Math.max(0, Math.min(1, Number(params.advancedLineJitter) || 0));
    const timebaseWobble = Math.max(0, Math.min(1, Number(params.advancedTimebaseWobble) || 0));
    const headSwitching = Math.max(0, Math.min(1, Number(params.advancedHeadSwitching) || 0));
    const chromaDelay = Math.max(0, Math.min(1, Number(params.advancedChromaDelay) || 0));
    const crossColor = Math.max(0, Math.min(1, Number(params.advancedCrossColor) || 0));
    const dropouts = Math.max(0, Math.min(1, Number(params.advancedDropouts) || 0));
    const ghosting = Math.max(0, Math.min(1, Number(params.advancedGhosting) || 0));
    const interlacing = Math.max(0, Math.min(1, Number(params.advancedInterlacing) || 0));
    const frameStutter = Math.max(0, Math.min(1, Number(params.advancedFrameStutter) || 0));
    const rfInterference = Math.max(0, Math.min(1, Number(params.advancedRfInterference) || 0));
    const exposurePump = Math.max(0, Math.min(1, Number(params.advancedExposurePump) || 0));
    const whiteBalanceDrift = Math.max(0, Math.min(1, Number(params.advancedWhiteBalanceDrift) || 0));
    const focusBreathing = Math.max(0, Math.min(1, Number(params.advancedFocusBreathing) || 0));
    const tapeCrease = Math.max(0, Math.min(1, Number(params.advancedTapeCrease) || 0));
    const timestampOSD = Math.max(0, Math.min(1, Number(params.advancedTimestampOSD) || 0));
    const osdStyle = Math.max(0, Math.min(3, Math.round(Number(params.advancedOSDStyle) || 0)));
    const osdStartDate = Number.isFinite(Date.parse(renderOptions.osdStartDateTime || "")) ? new Date(renderOptions.osdStartDateTime) : new Date("1998-10-31T22:48:00");
    const osdCountWithExport = renderOptions.osdCountWithExport !== false;
    const osdElapsedSeconds = osdCountWithExport ? Math.max(0, Number(renderOptions.osdElapsedSeconds ?? frameSeconds) || 0) : 0;
    const osdPrimaryColor = renderOptions.osdPrimaryColor || "#ffa84a";
    const osdAccentColor = renderOptions.osdAccentColor || "#ff3a3a";
    const osdFontPreset = renderOptions.osdFontPreset || "vhs";
    const osdFontByPreset = {
      vhs: '"VCR OSD Mono", "Lucida Console", "Courier New", monospace',
      camcorder: '"MS Gothic", "Small Fonts", "Tahoma", sans-serif',
      cctv: '"OCR A Std", "Consolas", "Lucida Console", monospace',
      broadcast: '"Arial Narrow", "Arial", sans-serif',
    };
    const cctvMonochrome = Math.max(0, Math.min(1, Number(params.advancedCctvMonochrome) || 0));
    const saturationRaw = Number(params.advancedSaturation);
    const saturation = Math.max(0, Math.min(2, Number.isFinite(saturationRaw) ? saturationRaw : 1));
    const quantization = Math.max(0, Math.min(1, Number(params.advancedQuantization) || 0));
    const generationLoss = Math.max(0, Math.min(1, Number(params.advancedGenerationLoss) || 0));
    const macroBlocking = Math.max(0, Math.min(1, Number(params.advancedMacroBlocking) || 0));
    const filmGrain = Math.max(0, Math.min(1, Number(params.advancedFilmGrain) || 0));
    const filmDust = Math.max(0, Math.min(1, Number(params.advancedFilmDust) || 0));
    const filmScratches = Math.max(0, Math.min(1, Number(params.advancedFilmScratches) || 0));
    const filmGateWeave = Math.max(0, Math.min(1, Number(params.advancedFilmGateWeave) || 0));
    const filmHalation = Math.max(0, Math.min(1, Number(params.advancedFilmHalation) || 0));

    const stutterHoldFrames = Math.floor(frameStutter * frameStutter * 6);
    const stutteredFrame = stutterHoldFrames > 0 ? frameIndex - (frameIndex % (stutterHoldFrames + 1)) : frameIndex;
    const temporalFrame = stutterHoldFrames > 0 ? stutteredFrame : frameIndex;
    const temporalSeconds = temporalFrame / fps;

    for (let y = 0; y < height; y++) {
      const ny = (y / (height - 1)) * 2 - 1;
      const maskY = Math.floor(y / maskScale);
      const scanPhase = Math.sin((maskY + 0.5) * Math.PI);
      const scanlineGain = 1 - scan * (0.35 + 0.65 * (0.5 + 0.5 * scanPhase));

      for (let x = 0; x < width; x++) {
        const nx = (x / (width - 1)) * 2 - 1;
        const r2 = nx * nx + ny * ny;
        const warpCurve = 0.22 + 0.78 * r2;
        const warp = Math.max(0.35, 1 + barrel * warpCurve);
        const wobble = Math.sin((ny + temporalSeconds * 0.9) * Math.PI * 6) * timebaseWobble * 0.012;
        const perLineJitter = (seededNoise(y, temporalFrame * 0.07, 7) - 0.5) * lineJitter * 0.018;
        const baseHeadSwitching = ny > 0.84 ? headSwitching * (ny - 0.84) * 0.14 : 0;
        const creaseCenter = seededNoise(Math.floor(temporalSeconds * 0.67), 19, 11);
        const creaseDistance = Math.abs(y / Math.max(1, height - 1) - creaseCenter);
        const creaseWarp = tapeCrease > 0 ? Math.max(0, 1 - creaseDistance / 0.045) * tapeCrease * (0.015 + seededNoise(temporalFrame, y, 41) * 0.02) : 0;

        const weaveX = filmGateWeave * Math.sin(temporalSeconds * 1.7 + y * 0.013) * 0.01;
        const weaveY = filmGateWeave * Math.cos(temporalSeconds * 1.9 + x * 0.009) * 0.008;
        const srcNx = (nx / warp) * barrelOverscan + wobble + perLineJitter + baseHeadSwitching + creaseWarp + weaveX;
        const srcNy = (ny / warp) * barrelOverscan + weaveY;
        const u = Math.max(0, Math.min(1, srcNx * 0.5 + 0.5));
        const v = Math.max(0, Math.min(1, srcNy * 0.5 + 0.5));

        const outIndex = (y * width + x) * 4;

        const edgeShift = ca * (0.0012 + r2 * 0.0045) * (0.8 + (pixelSize - 1) * 0.22);
        const qx = Math.floor((u * width) / pixelSize) * pixelSize + pixelSize * 0.5;
        const qy = Math.floor((v * height) / pixelSize) * pixelSize + pixelSize * 0.5;
        const qu = Math.max(0, Math.min(1, qx / width));
        const qv = Math.max(0, Math.min(1, qy / height));

        const delayShift = chromaDelay * 0.02 * (seededNoise(y, temporalSeconds * 1.3, 23) - 0.2);
        const crossColorShift = crossColor * 0.012 * Math.sin((y + temporalSeconds * 60) * 0.08);
        const ru = qu + edgeShift * (0.7 + Math.abs(nx)) + delayShift;
        const gu = qu + crossColorShift * 0.45;
        const bu = qu - edgeShift * (0.7 + Math.abs(nx)) - delayShift;

        const red = this.sampleBilinear(srcData, width, height, ru, qv, 0);
        const green = this.sampleBilinear(srcData, width, height, gu, qv, 1);
        const blue = this.sampleBilinear(srcData, width, height, bu, qv, 2);

        const redHoriz =
          this.sampleBilinear(srcData, width, height, ru - pixelStepX, qv, 0) * 0.5 +
          this.sampleBilinear(srcData, width, height, ru + pixelStepX, qv, 0) * 0.5;
        const greenHoriz =
          this.sampleBilinear(srcData, width, height, gu - pixelStepX, qv, 1) * 0.5 +
          this.sampleBilinear(srcData, width, height, gu + pixelStepX, qv, 1) * 0.5;
        const blueHoriz =
          this.sampleBilinear(srcData, width, height, bu - pixelStepX, qv, 2) * 0.5 +
          this.sampleBilinear(srcData, width, height, bu + pixelStepX, qv, 2) * 0.5;

        const redVert =
          this.sampleBilinear(srcData, width, height, ru, qv - pixelStepY, 0) * 0.5 +
          this.sampleBilinear(srcData, width, height, ru, qv + pixelStepY, 0) * 0.5;
        const greenVert =
          this.sampleBilinear(srcData, width, height, gu, qv - pixelStepY, 1) * 0.5 +
          this.sampleBilinear(srcData, width, height, gu, qv + pixelStepY, 1) * 0.5;
        const blueVert =
          this.sampleBilinear(srcData, width, height, bu, qv - pixelStepY, 2) * 0.5 +
          this.sampleBilinear(srcData, width, height, bu, qv + pixelStepY, 2) * 0.5;

        const luminance = Math.max(red, green, blue) / 255;
        const bleed = (0.08 + params.bloom * 0.26 + mask * 0.08) * pixelInfluence * Math.pow(luminance, 0.75);
        const blend = Math.min(0.45, bleed);

        const maskX = Math.floor(x / maskScale);
        const boost = 1 + mask * 0.52;
        const dim = 1 - mask * 0.32;
        let rMask = 1;
        let gMask = 1;
        let bMask = 1;

        if (maskType === "phosphor") {
          const triad = maskX % 3;
          rMask = triad === 0 ? boost : dim;
          gMask = triad === 1 ? boost : dim;
          bMask = triad === 2 ? boost : dim;
        } else if (maskType === "aperture") {
          const stripe = maskX % 3;
          const stripeBoost = 1 + mask * 0.34;
          const stripeDim = 1 - mask * 0.2;
          rMask = stripe === 0 ? stripeBoost : stripeDim;
          gMask = stripe === 1 ? stripeBoost : stripeDim;
          bMask = stripe === 2 ? stripeBoost : stripeDim;
        } else if (maskType === "slot") {
          const slotX = maskX % 6;
          const slotY = maskY % 4;
          const slotOpen = slotX < 2 || (slotY & 1 ? slotX >= 2 && slotX < 4 : slotX >= 4);
          const slotGain = slotOpen ? (1 + mask * 0.28) : (1 - mask * 0.24);
          rMask = slotGain;
          gMask = slotGain;
          bMask = slotGain;
        } else if (maskType === "dot") {
          const dotX = (maskX % 6) - 2.5;
          const dotY = (maskY % 6) - 2.5;
          const dotDist = Math.sqrt(dotX * dotX + dotY * dotY);
          const dotGain = 1 + mask * (0.34 - Math.min(0.34, dotDist * 0.08));
          rMask = dotGain;
          gMask = dotGain;
          bMask = dotGain;
        } else if (maskType === "filmSuper8") {
          const edgeX = Math.min(x / Math.max(1, width), (width - x) / Math.max(1, width));
          const edgeY = Math.min(y / Math.max(1, height), (height - y) / Math.max(1, height));
          const edgeVignette = Math.min(edgeX, edgeY);
          const perforationBand = x < width * 0.04 || x > width * 0.96;
          const perfPulse = 0.86 + 0.14 * Math.sin((y / Math.max(1, height)) * Math.PI * 12 + temporalSeconds * 4);
          const super8Gain = 1 - mask * (0.22 * (1 - edgeVignette));
          rMask = super8Gain * (perforationBand ? perfPulse : 1);
          gMask = super8Gain * (perforationBand ? perfPulse : 1);
          bMask = super8Gain * (perforationBand ? perfPulse : 1);
        } else if (maskType === "film16mm") {
          const gateEdge = Math.min(x / Math.max(1, width), (width - x) / Math.max(1, width), y / Math.max(1, height), (height - y) / Math.max(1, height));
          const gateDarken = 1 - mask * (0.16 * (1 - gateEdge));
          const weaveTexture = 1 + mask * 0.08 * (seededNoise(x * 0.03, y * 0.03, temporalFrame) - 0.5);
          rMask = gateDarken * weaveTexture;
          gMask = gateDarken * weaveTexture;
          bMask = gateDarken * weaveTexture;
        }

        const dither = (BAYER_4X4[maskY & 3][maskX & 3] / 15 - 0.5) * (1.4 + params.noise * 2.2);

        let redSoft = red * (1 - blend) + (redHoriz * 0.62 + redVert * 0.38) * blend;
        let greenSoft = green * (1 - blend) + (greenHoriz * 0.62 + greenVert * 0.38) * blend;
        let blueSoft = blue * (1 - blend) + (blueHoriz * 0.62 + blueVert * 0.38) * blend;

        if (filmHalation > 0) {
          const haloMix = Math.min(0.45, filmHalation * (0.12 + luminance * 0.5));
          redSoft = redSoft * (1 - haloMix) + redHoriz * haloMix;
          greenSoft = greenSoft * (1 - haloMix) + greenHoriz * haloMix;
          blueSoft = blueSoft * (1 - haloMix) + blueHoriz * haloMix;
        }

        const grain = (seededNoise(x * 1.91, y * 1.37, temporalFrame * 1.3) - 0.5) * 255 * (0.06 + filmGrain * 0.34);
        redSoft += grain;
        greenSoft += grain * 0.92;
        blueSoft += grain * 0.78;

        const dustHit = seededNoise(x * 0.19 + temporalFrame * 0.03, y * 0.23, 83);
        if (filmDust > 0 && dustHit > 0.995 - filmDust * 0.03) {
          const dustShade = 1 - filmDust * (0.3 + seededNoise(x, y, temporalFrame) * 0.5);
          redSoft *= dustShade;
          greenSoft *= dustShade;
          blueSoft *= dustShade;
        }

        const scratchSeed = seededNoise(Math.floor(x * 0.07), temporalFrame * 0.11, 97);
        if (filmScratches > 0 && scratchSeed > 0.982 - filmScratches * 0.045) {
          const scratchBright = 1 + filmScratches * 0.6;
          redSoft *= scratchBright;
          greenSoft *= scratchBright;
          blueSoft *= scratchBright;
        }

        const dropoutNoise = seededNoise(x * 0.5, y + temporalFrame * 0.27, 31);
        const dropoutGate = dropoutNoise > 0.988 - dropouts * 0.08 ? 1 - dropouts * (0.35 + seededNoise(y, temporalFrame, 59) * 0.5) : 1;
        const interlaceGate = interlacing > 0 ? 1 - interlacing * (((y + temporalFrame) & 1) ? 0.14 : 0.02) : 1;
        const level = scanlineGain * dropoutGate * interlaceGate;

        dstData[outIndex] = Math.min(255, Math.max(0, redSoft * level * rMask + dither));
        dstData[outIndex + 1] = Math.min(255, Math.max(0, greenSoft * level * gMask + dither));
        dstData[outIndex + 2] = Math.min(255, Math.max(0, blueSoft * level * bMask + dither));
        dstData[outIndex + 3] = 255;
      }
    }

    wctx.putImageData(outPixels, 0, 0);
    outCtx.imageSmoothingEnabled = true;
    outCtx.imageSmoothingQuality = "high";
    outCtx.drawImage(this.workCanvas, 0, 0);

    if (ghosting > 0) {
      const ghostShift = Math.round((0.5 + ghosting * 3.5) * Math.sin(temporalSeconds * 1.7));
      outCtx.save();
      outCtx.globalAlpha = Math.min(0.42, ghosting * 0.45);
      outCtx.drawImage(this.workCanvas, ghostShift, 0);
      outCtx.restore();
    }

    if (focusBreathing > 0) {
      const breathWave = Math.sin(temporalSeconds * 1.17 + 1.3) * 0.5 + 0.5;
      const blurPx = (0.2 + breathWave * 1.8) * focusBreathing;
      outCtx.save();
      outCtx.globalAlpha = Math.min(0.55, focusBreathing * 0.6);
      outCtx.filter = `blur(${blurPx.toFixed(2)}px)`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();
    }

    if (generationLoss > 0) {
      const dubPasses = Math.max(1, Math.floor(1 + generationLoss * 3));
      for (let i = 0; i < dubPasses; i++) {
        const shift = Math.round((i + 1) * (0.5 + generationLoss * 1.8));
        const sat = Math.max(0.25, 1 - generationLoss * (0.26 + i * 0.07));
        const contrast = Math.max(0.65, 1 - generationLoss * (0.12 + i * 0.04));
        outCtx.save();
        outCtx.globalAlpha = Math.min(0.34, 0.11 + generationLoss * 0.2);
        outCtx.filter = `blur(${(generationLoss * (0.9 + i * 0.45)).toFixed(2)}px) saturate(${sat.toFixed(3)}) contrast(${contrast.toFixed(3)})`;
        outCtx.drawImage(outCtx.canvas, shift, 0);
        outCtx.drawImage(outCtx.canvas, -shift, 0);
        outCtx.restore();
      }
    }

    if (cctvMonochrome > 0) {
      const fullMonochromeLock = cctvMonochrome >= 0.999;
      outCtx.save();
      outCtx.globalAlpha = fullMonochromeLock ? 1 : Math.min(0.9, 0.2 + cctvMonochrome * 0.7);
      outCtx.filter = `grayscale(1) saturate(0) contrast(${(1 + cctvMonochrome * 0.22).toFixed(3)}) brightness(${(0.95 + cctvMonochrome * 0.08).toFixed(3)})`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();

      if (!fullMonochromeLock) {
        outCtx.save();
        outCtx.globalCompositeOperation = "multiply";
        outCtx.globalAlpha = cctvMonochrome * 0.25;
        outCtx.fillStyle = "rgb(145 182 148)";
        outCtx.fillRect(0, 0, width, height);
        outCtx.restore();
      }
    }

    const bloom = params.bloom;
    if (bloom > 0) {
      outCtx.save();
      outCtx.globalCompositeOperation = "screen";
      outCtx.globalAlpha = Math.min(0.8, (0.16 + bloom * 0.34) * pixelInfluence);
      outCtx.filter = `blur(${(0.8 + bloom * 5.6) * (1 + (pixelSize - 1) * 0.12)}px) brightness(${1 + bloom * 0.55})`;
      outCtx.drawImage(this.workCanvas, 0, 0);
      outCtx.restore();

      outCtx.save();
      outCtx.globalCompositeOperation = "lighter";
      outCtx.globalAlpha = Math.min(0.7, (0.08 + bloom * 0.24) * pixelInfluence);
      outCtx.filter = `blur(${(0.4 + bloom * 2.4) * (1 + (pixelSize - 1) * 0.1)}px)`;
      outCtx.drawImage(this.workCanvas, 1, 0);
      outCtx.drawImage(this.workCanvas, -1, 0);
      outCtx.restore();
    }

    const vignette = Math.min(0.35, 0.08 + Math.abs(barrel) * 0.22);
    const grad = outCtx.createRadialGradient(
      width * 0.5,
      height * 0.5,
      Math.min(width, height) * 0.22,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.6,
    );
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, `rgba(0,0,0,${vignette.toFixed(3)})`);
    outCtx.fillStyle = grad;
    outCtx.fillRect(0, 0, width, height);

    const flickerWaveA = Math.sin(temporalSeconds * Math.PI * 2 * 1.94) * 0.5 + 0.5;
    const flickerWaveB = Math.sin(temporalSeconds * Math.PI * 2 * 0.61 + 1.7) * 0.5 + 0.5;
    const flicker = params.flicker * (0.4 + 0.6 * (0.65 * flickerWaveA + 0.35 * flickerWaveB));
    outCtx.fillStyle = `rgba(255,255,255,${(flicker * 0.2).toFixed(3)})`;
    outCtx.fillRect(0, 0, width, height);

    const retraceY = ((temporalSeconds * 1.45) % 1) * height;
    const retraceBand = Math.max(6, Math.floor(height * 0.02));
    const retraceGrad = outCtx.createLinearGradient(0, retraceY - retraceBand, 0, retraceY + retraceBand);
    retraceGrad.addColorStop(0, "rgba(255,255,255,0)");
    retraceGrad.addColorStop(0.5, `rgba(255,255,255,${(params.flicker * 0.12).toFixed(3)})`);
    retraceGrad.addColorStop(1, "rgba(255,255,255,0)");
    outCtx.fillStyle = retraceGrad;
    outCtx.fillRect(0, retraceY - retraceBand, width, retraceBand * 2);

    const jitterPx = (params.flicker + lineJitter * 0.45) * (seededNoise(temporalFrame, temporalSeconds, 17) - 0.5) * 2.6;
    if (Math.abs(jitterPx) > 0.01) {
      outCtx.save();
      outCtx.globalAlpha = Math.min(0.18, 0.05 + params.flicker * 0.12 + lineJitter * 0.08);
      outCtx.drawImage(outCtx.canvas, jitterPx, 0);
      outCtx.restore();
    }

    if (rfInterference > 0) {
      const bandCount = Math.max(1, Math.floor(1 + rfInterference * 5));
      for (let i = 0; i < bandCount; i++) {
        const bandPos = seededNoise(i + temporalFrame * 0.17, temporalSeconds, 77);
        const bandY = Math.floor(bandPos * height);
        const bandH = Math.max(2, Math.floor(height * (0.004 + rfInterference * 0.018)));
        const alpha = (0.03 + seededNoise(i, temporalFrame, 78) * 0.12) * rfInterference;
        outCtx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
        outCtx.fillRect(0, bandY, width, bandH);
      }
    }

    if (exposurePump > 0 || whiteBalanceDrift > 0) {
      const exposureWave = 1 + (Math.sin(temporalSeconds * 1.53) * 0.5 + 0.5) * exposurePump * 0.28;
      const warmShift = (Math.sin(temporalSeconds * 0.37 + 2.4) * 0.5 + 0.5) * whiteBalanceDrift;
      outCtx.save();
      outCtx.globalAlpha = Math.min(0.35, exposurePump * 0.35);
      outCtx.filter = `brightness(${exposureWave.toFixed(3)})`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();

      if (whiteBalanceDrift > 0) {
        outCtx.save();
        outCtx.globalAlpha = Math.min(0.22, 0.05 + whiteBalanceDrift * 0.2);
        const r = Math.round(30 + warmShift * 70);
        const g = Math.round(18 + warmShift * 28);
        const b = Math.round(40 + (1 - warmShift) * 80);
        outCtx.fillStyle = `rgb(${r} ${g} ${b})`;
        outCtx.globalCompositeOperation = "screen";
        outCtx.fillRect(0, 0, width, height);
        outCtx.restore();
      }
    }

    if (params.noise > 0) {
      const count = Math.floor(width * height * 0.008 * params.noise);
      for (let i = 0; i < count; i++) {
        const x = Math.floor(seededNoise(i, seconds, frameIndex) * width);
        const y = Math.floor(seededNoise(i * 2, seconds + 3.1, frameIndex) * height);
        const grain = seededNoise(x + temporalFrame * 0.3, y, temporalFrame);
        const a = (0.02 + grain * 0.28) * params.noise;
        outCtx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        outCtx.fillRect(x, y, 1, 1);
      }

      const burst = seededNoise(temporalFrame, temporalSeconds * 10, 91);
      if (burst > 0.91) {
        const bandY = Math.floor(seededNoise(temporalFrame, burst, 37) * height);
        const bandH = Math.max(3, Math.floor(height * 0.012));
        outCtx.fillStyle = `rgba(255,255,255,${(params.noise * 0.22).toFixed(3)})`;
        outCtx.fillRect(0, bandY, width, bandH);
      }
    }

    if (macroBlocking > 0.01) {
      const pixelCount = Math.max(1, width * height);
      const perfBudget = Math.min(1, 921600 / pixelCount);
      const resolutionPenalty = Math.min(1, 2073600 / pixelCount);
      const effectiveMacro = macroBlocking * (0.3 + perfBudget * 0.45 + resolutionPenalty * 0.25);
      const blockSize = Math.max(6, Math.round(6 + effectiveMacro * 22 + (1 - resolutionPenalty) * 14));
      const lowW = Math.max(1, Math.floor(width / blockSize));
      const lowH = Math.max(1, Math.floor(height / blockSize));

      if (this.tempCanvas.width !== lowW) this.tempCanvas.width = lowW;
      if (this.tempCanvas.height !== lowH) this.tempCanvas.height = lowH;
      const tctx = this.tempCanvas.getContext("2d");
      tctx.imageSmoothingEnabled = true;
      tctx.imageSmoothingQuality = "low";
      tctx.drawImage(outCtx.canvas, 0, 0, lowW, lowH);

      outCtx.save();
      outCtx.imageSmoothingEnabled = false;
      outCtx.globalAlpha = Math.min(0.72, 0.12 + effectiveMacro * 0.44);
      outCtx.drawImage(this.tempCanvas, 0, 0, lowW, lowH, 0, 0, width, height);
      outCtx.restore();

      const shouldDrawMacroGrid = effectiveMacro > 0.35 && pixelCount <= 2073600;
      if (shouldDrawMacroGrid) {
        outCtx.save();
        outCtx.globalAlpha = Math.min(0.1, effectiveMacro * 0.08);
        outCtx.fillStyle = "rgb(0 0 0)";
        for (let gx = blockSize; gx < width; gx += blockSize) outCtx.fillRect(gx, 0, 1, height);
        for (let gy = blockSize; gy < height; gy += blockSize) outCtx.fillRect(0, gy, width, 1);
        outCtx.restore();
      }
    }

    if (quantization > 0.01) {
      const perfBudget = Math.min(1, 921600 / Math.max(1, width * height));
      const sampleScale = Math.max(1, Math.round(1 + quantization * (2 + (1 - perfBudget) * 4)));
      const qW = Math.max(1, Math.floor(width / sampleScale));
      const qH = Math.max(1, Math.floor(height / sampleScale));
      if (this.quantCanvas.width !== qW) this.quantCanvas.width = qW;
      if (this.quantCanvas.height !== qH) this.quantCanvas.height = qH;
      const qctx = this.quantCanvas.getContext("2d", { willReadFrequently: true });
      qctx.clearRect(0, 0, qW, qH);
      qctx.imageSmoothingEnabled = true;
      qctx.imageSmoothingQuality = "low";
      qctx.drawImage(outCtx.canvas, 0, 0, qW, qH);

      const levels = Math.max(6, Math.round(72 - quantization * 60));
      const imageData = qctx.getImageData(0, 0, qW, qH);
      const data = imageData.data;
      const inv = 255 / (levels - 1);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.round((data[i] / 255) * (levels - 1)) * inv;
        data[i + 1] = Math.round((data[i + 1] / 255) * (levels - 1)) * inv;
        data[i + 2] = Math.round((data[i + 2] / 255) * (levels - 1)) * inv;
      }
      qctx.putImageData(imageData, 0, 0);

      outCtx.save();
      outCtx.imageSmoothingEnabled = false;
      outCtx.globalAlpha = Math.min(0.92, 0.35 + quantization * 0.55);
      outCtx.drawImage(this.quantCanvas, 0, 0, qW, qH, 0, 0, width, height);
      outCtx.restore();
    }

    if (timestampOSD > 0) {
      const stampDate = new Date(osdStartDate.getTime());
      stampDate.setSeconds(stampDate.getSeconds() + Math.floor(osdElapsedSeconds));
      const stamp = `${String(stampDate.getMonth() + 1).padStart(2, "0")}/${String(stampDate.getDate()).padStart(2, "0")}/${String(stampDate.getFullYear()).slice(-2)} ${String(stampDate.getHours()).padStart(2, "0")}:${String(stampDate.getMinutes()).padStart(2, "0")}:${String(stampDate.getSeconds()).padStart(2, "0")}`;
      const flickerAlpha = 0.35 + seededNoise(temporalFrame, temporalSeconds, 113) * 0.45;
      const osdAlpha = Math.min(0.9, timestampOSD * flickerAlpha);
      const padX = Math.floor(width * 0.03);
      const padY = Math.floor(height * 0.95);

      outCtx.save();
      outCtx.font = `${Math.max(12, Math.floor(height * 0.027))}px ${osdFontByPreset[osdFontPreset] || osdFontByPreset.vhs}`;
      outCtx.textBaseline = "bottom";
      outCtx.globalAlpha = osdAlpha;

      if (osdStyle === 0) {
        outCtx.fillStyle = osdPrimaryColor;
        outCtx.fillText(stamp, padX, padY);
      } else if (osdStyle === 1) {
        outCtx.fillStyle = "rgb(237 244 255)";
        outCtx.fillText(stamp, padX, padY);
        outCtx.fillStyle = osdAccentColor;
        outCtx.fillText("REC", padX, Math.floor(height * 0.08));
      } else if (osdStyle === 2) {
        outCtx.fillStyle = osdPrimaryColor;
        outCtx.fillText(stamp, padX, padY);
        outCtx.fillText("CH 03", Math.floor(width * 0.03), Math.floor(height * 0.09));
        outCtx.fillText("SP", Math.floor(width * 0.9), Math.floor(height * 0.09));
      } else {
        outCtx.fillStyle = osdPrimaryColor;
        outCtx.fillText(stamp, padX, padY);
        outCtx.fillText("CAM 4", Math.floor(width * 0.82), Math.floor(height * 0.09));
      }

      outCtx.restore();
    }

    if (Math.abs(saturation - 1) > 0.001) {
      outCtx.save();
      outCtx.globalAlpha = 1;
      outCtx.filter = `saturate(${saturation.toFixed(3)})`;
      outCtx.drawImage(outCtx.canvas, 0, 0);
      outCtx.restore();
    }
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


function getAvcCodecForResolution(width, height) {
  const macroblocksPerFrame = Math.ceil(width / 16) * Math.ceil(height / 16);

  // AVC level limits (max frame size in macroblocks).
  const levelByMaxFs = [
    { maxFs: 99, levelHex: "0a" },
    { maxFs: 396, levelHex: "15" },
    { maxFs: 1620, levelHex: "1e" },
    { maxFs: 3600, levelHex: "1f" },
    { maxFs: 8192, levelHex: "28" },
    { maxFs: 8704, levelHex: "29" },
    { maxFs: 22080, levelHex: "32" },
    { maxFs: 36864, levelHex: "33" },
    { maxFs: 139264, levelHex: "34" },
  ];

  const match = levelByMaxFs.find((entry) => macroblocksPerFrame <= entry.maxFs);
  const levelHex = match ? match.levelHex : "34";

  // Baseline profile (42 00) + computed level to avoid level-3.1 limits on larger videos.
  return `avc1.4200${levelHex}`;
}

function getTargetBitrate(width, height, fps) {
  const pixelsPerSecond = width * height * Math.max(1, fps);
  const estimated = Math.round(pixelsPerSecond * 0.11);
  return Math.max(5_000_000, Math.min(35_000_000, estimated));
}

function getEvenFrameSize(width, height) {
  const safeWidth = Math.max(1, Math.floor(width));
  const safeHeight = Math.max(1, Math.floor(height));
  return {
    width: safeWidth % 2 === 0 ? safeWidth : safeWidth + 1,
    height: safeHeight % 2 === 0 ? safeHeight : safeHeight + 1,
  };
}

const MAX_AVC_CODED_PIXELS = 9_437_184;

function fitExportSize(width, height, { maxEdge = 0, maxPixels = 0, forceEven = false } = {}) {
  let outWidth = Math.max(1, Math.floor(width));
  let outHeight = Math.max(1, Math.floor(height));

  if (maxEdge > 0) {
    const scale = Math.min(1, maxEdge / Math.max(outWidth, outHeight));
    outWidth = Math.max(1, Math.round(outWidth * scale));
    outHeight = Math.max(1, Math.round(outHeight * scale));
  }

  if (maxPixels > 0 && outWidth * outHeight > maxPixels) {
    const scale = Math.sqrt(maxPixels / (outWidth * outHeight));
    outWidth = Math.max(1, Math.floor(outWidth * scale));
    outHeight = Math.max(1, Math.floor(outHeight * scale));
  }

  if (forceEven) {
    return getEvenFrameSize(outWidth, outHeight);
  }

  return { width: outWidth, height: outHeight };
}

async function exportMp4({ canvas, renderer, params, fps, duration, beforeRenderFrame, onProgress, signal, bitrateScale = 1, getRenderOptions }) {
  if (!("VideoEncoder" in window)) {
    throw new Error("WebCodecs VideoEncoder is unavailable in this browser/context.");
  }

  const { Muxer, ArrayBufferTarget } = await import(MP4_MUXER_CDN);
  const throwIfAborted = () => {
    if (signal?.aborted) {
      throw new DOMException("Export cancelled by user.", "AbortError");
    }
  };
  throwIfAborted();
  const width = canvas.width;
  const height = canvas.height;
  const encodedSize = getEvenFrameSize(width, height);
  const encodingNeedsPadding = encodedSize.width !== width || encodedSize.height !== height;
  const totalFrames = Math.max(1, Math.floor(duration * fps));

  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = width;
  renderCanvas.height = height;
  const ctx = renderCanvas.getContext("2d", { alpha: false });

  const encodeCanvas = encodingNeedsPadding ? document.createElement("canvas") : renderCanvas;
  encodeCanvas.width = encodedSize.width;
  encodeCanvas.height = encodedSize.height;
  const encodeCtx = encodingNeedsPadding ? encodeCanvas.getContext("2d", { alpha: false }) : null;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: encodedSize.width, height: encodedSize.height },
    fastStart: "in-memory",
  });

  let encoderFailure = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      encoderFailure = err;
    },
  });

  const codec = getAvcCodecForResolution(encodedSize.width, encodedSize.height);
  const bitrate = Math.max(250_000, Math.round(getTargetBitrate(encodedSize.width, encodedSize.height, fps) * Math.max(0.5, bitrateScale)));

  try {
    encoder.configure({
      codec,
      width: encodedSize.width,
      height: encodedSize.height,
      framerate: fps,
      bitrate,
      latencyMode: "quality",
      hardwareAcceleration: "prefer-hardware",
    });
  } catch (error) {
    console.warn("Hardware-accelerated encoder config unavailable; falling back.", error);
    encoder.configure({
      codec,
      width: encodedSize.width,
      height: encodedSize.height,
      framerate: fps,
      bitrate,
      latencyMode: "quality",
    });
  }

  for (let frame = 0; frame < totalFrames; frame++) {
    throwIfAborted();
    if (encoderFailure) {
      throw encoderFailure;
    }

    const t = frame / fps;
    if (beforeRenderFrame) await beforeRenderFrame(t, frame, fps);
    renderer.render(ctx, width, height, t, params, frame, fps, getRenderOptions?.(t) || {});

    if (encodingNeedsPadding && encodeCtx) {
      encodeCtx.fillStyle = "#000";
      encodeCtx.fillRect(0, 0, encodeCanvas.width, encodeCanvas.height);
      encodeCtx.drawImage(renderCanvas, 0, 0);
    }

    const videoFrame = new VideoFrame(encodeCanvas, {
      timestamp: Math.round((frame * 1_000_000) / fps),
      duration: Math.round(1_000_000 / fps),
    });

    try {
      encoder.encode(videoFrame);
    } finally {
      videoFrame.close();
    }

    onProgress?.((frame + 1) / totalFrames, frame + 1, totalFrames);

    if (frame % 30 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  await encoder.flush();
  throwIfAborted();
  if (encoderFailure) {
    throw encoderFailure;
  }
  encoder.close();
  muxer.finalize();

  const blob = new Blob([target.buffer], { type: "video/mp4" });
  downloadBlob(blob, `crt-export-${Date.now()}.mp4`);
}

function getSupportedWebmMimeType(withAudio) {
  const candidates = withAudio
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
}

async function exportWebmRealtime({ canvas, renderer, params, fps, duration, loadedSourceType, loadedVideo, loadedImage, sourceScale, onProgress, signal, includeAudio, getRenderOptions }) {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const totalFrames = Math.max(1, Math.floor(duration * fps));

  const stream = canvas.captureStream(fps);
  const sourceVideo = loadedSourceType === "video" ? loadedVideo?.video : null;
  const wantsAudio = includeAudio && !!sourceVideo;
  const shouldRunRealtimeVideo = !!sourceVideo && wantsAudio;
  let restoreMuted = null;

  if (wantsAudio) {
    try {
      const mediaStream = sourceVideo.captureStream?.() || sourceVideo.mozCaptureStream?.();
      const audioTrack = mediaStream?.getAudioTracks?.()[0];
      if (audioTrack) {
        stream.addTrack(audioTrack);
      }
    } catch (error) {
      console.warn("Couldn't capture original audio track; exporting without audio.", error);
    }
  }

  const mimeType = getSupportedWebmMimeType(wantsAudio);
  const chunks = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: getTargetBitrate(width, height, fps),
  });

  recorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  });

  const stopPromise = new Promise((resolve) => {
    recorder.addEventListener("stop", resolve, { once: true });
  });

  recorder.start(250);

  if (sourceVideo && !shouldRunRealtimeVideo) {
    await seekVideo(sourceVideo, 0);
    sourceVideo.pause();
  }

  if (shouldRunRealtimeVideo) {
    restoreMuted = sourceVideo.muted;
    sourceVideo.muted = false;
    await seekVideo(sourceVideo, 0);
    await sourceVideo.play();
  }

  const start = performance.now();
  for (let frame = 0; frame < totalFrames; frame++) {
    if (signal?.aborted) {
      recorder.stop();
      throw new DOMException("The operation was aborted.", "AbortError");
    }

    const t = shouldRunRealtimeVideo
      ? Math.min(sourceVideo.currentTime, Math.max(0, duration - 1 / fps))
      : frame / fps;
    if (sourceVideo && !shouldRunRealtimeVideo) {
      await seekVideo(sourceVideo, t);
      renderer.setImage(sourceVideo, sourceScale());
    } else if (sourceVideo) {
      renderer.setImage(sourceVideo, sourceScale());
    } else if (loadedImage) {
      renderer.setImage(loadedImage, sourceScale());
    }

    renderer.render(ctx, width, height, t, params, frame, fps, getRenderOptions?.(t) || {});
    onProgress?.((frame + 1) / totalFrames, frame + 1, totalFrames);

    const nextFrameAt = start + ((frame + 1) * 1000) / fps;
    const delay = Math.max(0, nextFrameAt - performance.now());
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  recorder.stop();
  await stopPromise;

  if (sourceVideo) {
    sourceVideo.pause();
    if (restoreMuted !== null) {
      sourceVideo.muted = restoreMuted;
    }
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }

  const blob = new Blob(chunks, { type: mimeType });
  downloadBlob(blob, `crt-export-${Date.now()}.webm`);
}

(function boot() {
  const renderer = new CRTRenderer();
  const canvas = document.getElementById("previewCanvas");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const statusEl = document.getElementById("status");
  const progressEl = document.getElementById("progress");
  const previewBuffer = document.createElement("canvas");
  const exportBtn = document.getElementById("exportBtn");
  const cancelExportBtn = document.getElementById("cancelExportBtn");
  const resetParamsBtn = document.getElementById("resetParamsBtn");
  const resetSourceBtn = document.getElementById("resetSourceBtn");
  const downloadStillBtn = document.getElementById("downloadStillBtn");
  const imageInput = document.getElementById("imageInput");
  const presetSelect = document.getElementById("presetSelect");
  const osdStartDateTimeInput = document.getElementById("osdStartDateTime");
  const osdCountWithExportInput = document.getElementById("osdCountWithExport");
  const osdPrimaryColorInput = document.getElementById("osdPrimaryColor");
  const osdAccentColorInput = document.getElementById("osdAccentColor");
  const osdStyleInput = document.getElementById("advancedOSDStyle");
  const compareHoldBtn = document.getElementById("compareHoldBtn");
  const compareLockBtn = document.getElementById("compareLockBtn");
  const presetDirtyTag = document.getElementById("presetDirtyTag");
  const presetIntensityInput = document.getElementById("presetIntensity");
  const presetCategoryFilter = document.getElementById("presetCategoryFilter");
  const presetSearchInput = document.getElementById("presetSearch");
  const presetFilterMeta = document.getElementById("presetFilterMeta");
  const exportEstimateEl = document.getElementById("exportEstimate");
  const densityModeRoot = document.getElementById("densityMode");

  const controlIds = [
    "scanlineStrength",
    "phosphorMask",
    "barrelDistortion",
    "bloom",
    "flicker",
    "chromaticAberration",
    "noise",
    "pixelSize",
    "maskScale",
    "advancedLineJitter",
    "advancedTimebaseWobble",
    "advancedHeadSwitching",
    "advancedChromaDelay",
    "advancedCrossColor",
    "advancedDropouts",
    "advancedGhosting",
    "advancedInterlacing",
    "advancedFrameStutter",
    "advancedRfInterference",
    "advancedExposurePump",
    "advancedWhiteBalanceDrift",
    "advancedFocusBreathing",
    "advancedTapeCrease",
    "advancedTimestampOSD",
    "advancedOSDStyle",
    "advancedCctvMonochrome",
    "advancedSaturation",
    "advancedQuantization",
    "advancedGenerationLoss",
    "advancedMacroBlocking",
    "advancedFilmGrain",
    "advancedFilmDust",
    "advancedFilmScratches",
    "advancedFilmGateWeave",
    "advancedFilmHalation",
  ];

  const macroControlIds = [
    "macroSourceProvenance",
    "shapeGenerationDepth",
    "macroDisplayEmulation",
    "shapeTubeAge",
    "macroSignalPathDamage",
    "shapePathInstability",
    "macroDistributionArtifacts",
    "shapeEventRate",
    "macroDigitalDecay",
    "shapeBitrateStress",
    "macroRecoveryRuin",
    "shapeTextureKeep",
    "macroEraStyling",
    "shapeOverlayContext",
  ];

  const macroTargetIds = [
    "scanlineStrength", "phosphorMask", "bloom", "flicker", "noise",
    "advancedLineJitter", "advancedTimebaseWobble", "advancedChromaDelay", "advancedCrossColor",
    "advancedDropouts", "advancedTapeCrease", "advancedRfInterference", "advancedInterlacing",
    "advancedSaturation", "advancedQuantization", "advancedMacroBlocking", "advancedFrameStutter", "advancedGenerationLoss",
    "advancedGhosting", "advancedFilmDust", "advancedFilmScratches", "advancedFilmGrain",
    "advancedFilmHalation", "advancedWhiteBalanceDrift", "advancedTimestampOSD",
  ];

  const PARAM_LIMITS = Object.fromEntries(controlIds.map((id) => {
    const input = document.getElementById(id);
    return [id, { min: Number(input?.min), max: Number(input?.max) }];
  }));


  let hasLoadedSource = false;
  let loadedSourceType = "image";
  let loadedVideo = null;
  let loadedImage = null;
  let presets = refinePresetLibrary(FALLBACK_PRESETS);
  let start = performance.now();
  let previewFrameSeconds = 0;
  let previewTargetSeconds = 0;
  let previewNeedsSeek = false;
  let lastPreviewTick = 0;
  let defaultParamValues = null;
  let activeExportController = null;
  let isExporting = false;
  let previewDirty = true;
  let showOriginalPreview = false;
  let compareLocked = false;
  let activePresetName = null;
  const presetIntensityProfiles = new Map();
  const presetCategories = new Map();
  const detachedMacroIds = new Set();
  const presetPinnedIds = new Set();
  const PARAM_POLICY_STORAGE_KEY = "lme:param-policy:v1";
  const EFFECT_PANEL_CONFIGS = {
    crt: {
      toggleId: "crtEffectsEnabled",
      controlIds: ["scanlineStrength", "phosphorMask", "barrelDistortion", "chromaticAberration", "bloom", "flicker", "maskScale"],
    },
    digital: {
      toggleId: "digitalEffectsEnabled",
      controlIds: ["noise", "advancedFrameStutter", "advancedRfInterference", "advancedCctvMonochrome", "advancedSaturation", "advancedQuantization", "advancedGenerationLoss", "advancedMacroBlocking"],
    },
    film: {
      toggleId: "filmEffectsEnabled",
      controlIds: ["advancedFilmGrain", "advancedFilmDust", "advancedFilmScratches", "advancedFilmGateWeave", "advancedFilmHalation", "advancedExposurePump", "advancedWhiteBalanceDrift", "advancedFocusBreathing"],
    },
  };

  const panelEffectState = Object.fromEntries(Object.keys(EFFECT_PANEL_CONFIGS).map((name) => [name, { enabled: true, savedValues: null }]));


  async function loadPresets() {
    try {
      const module = await import("./presets.js");
      const loaded = module?.PRESETS;
      if (loaded && Object.keys(loaded).length > 0) {
        presets = refinePresetLibrary(loaded);
        setStatus(`Loaded ${Object.keys(loaded).length} presets.`, "success");
        return;
      }
      presets = refinePresetLibrary(FALLBACK_PRESETS);
      setStatus("Preset file was empty. Using built-in presets.", "warn");
    } catch (error) {
      presets = refinePresetLibrary(FALLBACK_PRESETS);
      setStatus("Could not load presets.js. Using built-in presets.", "warn");
      console.warn("Preset loading failed", error);
    }
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }

  function refinePresetLibrary(library = {}) {
    const refined = {};
    for (const [name, preset] of Object.entries(library)) {
      const next = { ...preset };
      const lower = name.toLowerCase();
      const isFilm = /film|super 8|16mm|nitrate|technicolor|kinescope/.test(lower);
      const isTape = /vhs|tape|hi8|betacam|u-matic|broadcast|archive|bootleg|cam/.test(lower) && !isFilm;
      const isDigital = /dvd|web|stream|smartphone|dslr|hdv|4k|digital|compression/.test(lower);

      if (isFilm) {
        next.scanlineStrength = clamp01((next.scanlineStrength || 0) * 0.35);
        next.phosphorMask = clamp01((next.phosphorMask || 0) * 0.4);
        next.advancedFilmGrain = clamp01((next.advancedFilmGrain || 0) + 0.06);
        next.advancedFilmGateWeave = clamp01((next.advancedFilmGateWeave || 0) + 0.04);
        next.advancedFilmHalation = clamp01((next.advancedFilmHalation || 0) + 0.03);
      }

      if (isTape) {
        next.advancedLineJitter = clamp01((next.advancedLineJitter || 0) + 0.04);
        next.advancedTimebaseWobble = clamp01((next.advancedTimebaseWobble || 0) + 0.04);
        next.advancedChromaDelay = clamp01((next.advancedChromaDelay || 0) + 0.03);
        next.advancedCrossColor = clamp01((next.advancedCrossColor || 0) + 0.03);
        next.advancedHeadSwitching = clamp01((next.advancedHeadSwitching || 0) + 0.02);
      }

      if (isDigital) {
        next.scanlineStrength = clamp01((next.scanlineStrength || 0) * 0.6);
        next.phosphorMask = clamp01((next.phosphorMask || 0) * 0.65);
        next.advancedQuantization = clamp01((next.advancedQuantization || 0) + 0.05);
        next.advancedMacroBlocking = clamp01((next.advancedMacroBlocking || 0) + 0.04);
      }

      if (lower.includes("pvm") || lower.includes("bvm")) {
        next.bloom = clamp01((next.bloom || 0) * 0.9);
        next.noise = clamp01((next.noise || 0) * 0.85);
      }

      if (lower.includes("consumer tv") || lower.includes("arcade")) {
        next.barrelDistortion = Number(next.barrelDistortion || 0) - 0.015;
        next.scanlineStrength = clamp01((next.scanlineStrength || 0) + 0.06);
      }

      refined[name] = next;
    }
    return refined;
  }

  function buildPresetIntensityProfile(name, preset = {}) {
    const neutralSource = defaultParamValues || {};
    const ranked = [];
    for (const id of controlIds) {
      if (typeof preset[id] !== "number") continue;
      const neutral = typeof neutralSource[id] === "number"
        ? neutralSource[id]
        : (Number(document.getElementById(id)?.defaultValue) || 0);
      const min = Number(document.getElementById(id)?.min);
      const max = Number(document.getElementById(id)?.max);
      const range = Number.isFinite(max - min) && (max - min) > 0 ? (max - min) : 1;
      const delta = Math.abs((preset[id] - neutral) / range);
      ranked.push({ id, delta });
    }
    ranked.sort((a, b) => b.delta - a.delta);
    const top = ranked.slice(0, 6);
    const weights = {};
    for (const [index, item] of top.entries()) {
      const rankBonus = (6 - index) * 0.08;
      weights[item.id] = 1.05 + rankBonus;
    }

    if (/vhs|tape|archive|bootleg|broadcast|hi8|betacam|u-matic/.test(name.toLowerCase())) {
      for (const key of ["advancedLineJitter", "advancedTimebaseWobble", "advancedDropouts", "advancedHeadSwitching", "advancedGenerationLoss"]) {
        weights[key] = Math.max(weights[key] || 1, 1.45);
      }
    }
    if (/film|super 8|16mm|nitrate|technicolor|kinescope/.test(name.toLowerCase())) {
      for (const key of ["advancedFilmGrain", "advancedFilmDust", "advancedFilmScratches", "advancedFilmGateWeave", "advancedFilmHalation"]) {
        weights[key] = Math.max(weights[key] || 1, 1.5);
      }
    }
    if (/web|stream|digital|dvd|smartphone|dslr|4k|compression/.test(name.toLowerCase())) {
      for (const key of ["advancedQuantization", "advancedMacroBlocking", "advancedFrameStutter"]) {
        weights[key] = Math.max(weights[key] || 1, 1.45);
      }
    }

    return { weights };
  }

  const RANGE_CONTROL_LABELS = {
    scanlineStrength: "Scanline strength",
    phosphorMask: "Mask strength",
    barrelDistortion: "Barrel distortion",
    bloom: "Bloom",
    flicker: "Flicker",
    chromaticAberration: "Chromatic aberration",
    noise: "Noise",
    previewTime: "Preview frame",
    advancedLineJitter: "Line jitter",
    advancedTimebaseWobble: "Timebase wobble",
    advancedHeadSwitching: "Head-switching noise",
    advancedChromaDelay: "Luma/chroma delay",
    advancedCrossColor: "Cross-color artifacts",
    advancedDropouts: "Dropouts/tracking",
    advancedGhosting: "Ghosting/trailing",
    advancedInterlacing: "Interlacing",
    advancedFrameStutter: "Frame stutter/drop",
    advancedRfInterference: "RF interference bands",
    advancedExposurePump: "Exposure pumping",
    advancedWhiteBalanceDrift: "White balance drift",
    advancedFocusBreathing: "Focus breathing",
    advancedTapeCrease: "Tape crease events",
    advancedTimestampOSD: "Timestamp intensity",
    advancedCctvMonochrome: "CCTV monochrome",
    advancedSaturation: "Saturation",
    advancedQuantization: "Quantization/crush",
    advancedGenerationLoss: "Generation loss",
    advancedMacroBlocking: "Macroblocking",
    advancedFilmGrain: "Film grain",
    advancedFilmDust: "Film dust/specks",
    advancedFilmScratches: "Film scratches",
    advancedFilmGateWeave: "Gate weave",
    advancedFilmHalation: "Halation glow",
    macroSourceProvenance: "Source Provenance",
    shapeGenerationDepth: "Generation Depth",
    macroDisplayEmulation: "Display Emulation",
    shapeTubeAge: "Tube Age",
    macroSignalPathDamage: "Signal Path Damage",
    shapePathInstability: "Path Instability",
    macroDistributionArtifacts: "Distribution Artifacts",
    shapeEventRate: "Event Rate",
    macroDigitalDecay: "Digital Decay",
    shapeBitrateStress: "Bitrate Stress",
    macroRecoveryRuin: "Recovery ↔ Ruin",
    shapeTextureKeep: "Texture Keep",
    macroEraStyling: "Era Styling",
    shapeOverlayContext: "Overlay Context",
  };

  function setupRangeWithNumber(id) {
    const slider = document.getElementById(id);
    if (!slider) return;
    const wrapper = slider.closest(".range-control");
    if (!wrapper) return;

    const numericInput = document.createElement("input");
    numericInput.type = "number";
    numericInput.className = "range-number";
    numericInput.min = slider.min;
    numericInput.max = slider.max;
    numericInput.step = slider.step || "any";
    numericInput.value = slider.value;
    numericInput.setAttribute("aria-label", `${id} numeric value`);
    wrapper.appendChild(numericInput);

    const supportsInlineReset = id !== "previewTime";
    let resetBtn = null;
    if (supportsInlineReset) {
      resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "range-reset";
      resetBtn.textContent = "↺";
      resetBtn.title = "Reset to default";
      resetBtn.setAttribute("aria-label", `Reset ${RANGE_CONTROL_LABELS[id] || id} to default`);
      wrapper.appendChild(resetBtn);
    }

    const syncToNumber = () => {
      numericInput.value = slider.value;
      numericInput.disabled = slider.disabled;
      if (resetBtn) resetBtn.disabled = slider.disabled;
    };

    const clampToRange = (value) => {
      const min = Number(slider.min);
      const max = Number(slider.max);
      let next = Number(value);
      if (!Number.isFinite(next)) return Number(slider.value);
      if (Number.isFinite(min)) next = Math.max(min, next);
      if (Number.isFinite(max)) next = Math.min(max, next);
      return next;
    };

    numericInput.addEventListener("input", () => {
      const next = clampToRange(numericInput.value);
      slider.value = String(next);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });

    numericInput.addEventListener("change", () => {
      const next = clampToRange(numericInput.value);
      slider.value = String(next);
      numericInput.value = slider.value;
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });

    numericInput.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      const baseStep = Number(slider.step) || 1;
      const multiplier = event.shiftKey ? 0.1 : (event.altKey ? 10 : 1);
      const direction = event.key === "ArrowUp" ? 1 : -1;
      const current = Number(slider.value) || 0;
      const next = clampToRange(current + (baseStep * multiplier * direction));
      slider.value = String(next);
      numericInput.value = slider.value;
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });

    slider.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      if (!event.shiftKey && !event.altKey) return;
      event.preventDefault();
      const direction = (event.key === "ArrowRight" || event.key === "ArrowUp") ? 1 : -1;
      const baseStep = Number(slider.step) || 1;
      const multiplier = event.shiftKey ? 0.1 : 10;
      const current = Number(slider.value) || 0;
      const next = clampToRange(current + (baseStep * multiplier * direction));
      slider.value = String(next);
      numericInput.value = slider.value;
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        resetSingleControlToDefault(id);
        progressEl.value = 0;
        markPreviewDirty();
      });
    }

    slider.addEventListener("input", syncToNumber);
    slider.addEventListener("change", syncToNumber);
    slider.__syncRangeNumber = syncToNumber;
    syncToNumber();
  }

  function setupSelectionBox(id, { onChange, valueParser = (value) => value, disabledWhen } = {}) {
    const root = document.getElementById(id);
    if (!root) return { getValue: () => undefined, setValue: () => {}, setDisabled: () => {} };

    const buttons = Array.from(root.querySelectorAll("button[data-value]"));
    let current = buttons.find((btn) => btn.dataset.selected === "true")?.dataset.value ?? buttons[0]?.dataset.value;

    const setSelectedVisual = () => {
      for (const btn of buttons) {
        const active = btn.dataset.value === current;
        btn.dataset.selected = active ? "true" : "false";
        btn.setAttribute("aria-checked", active ? "true" : "false");
      }
    };

    const setDisabled = (disabled) => {
      root.dataset.disabled = disabled ? "true" : "false";
      for (const btn of buttons) {
        btn.disabled = !!disabled;
      }
    };

    const setValue = (value, { silent = false } = {}) => {
      const next = String(value);
      if (!buttons.some((btn) => btn.dataset.value === next)) return;
      current = next;
      setSelectedVisual();
      if (!silent) onChange?.(valueParser(current));
    };

    for (const btn of buttons) {
      btn.type = "button";
      btn.setAttribute("role", "radio");
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        setValue(btn.dataset.value);
      });
    }

    setSelectedVisual();
    if (typeof disabledWhen === "boolean") setDisabled(disabledWhen);

    return {
      getValue: () => valueParser(current),
      setValue: (value, options) => setValue(value, options),
      setDisabled,
    };
  }

  function setupCollapsiblePanels() {
    const panels = Array.from(document.querySelectorAll(".panel-collapsible"));
    for (const panel of panels) {
      const header = panel.querySelector(":scope > .panel-header");
      const body = panel.querySelector(":scope > .panel-body");
      if (!header || !body) continue;

      let collapseBtn = header.querySelector(".panel-collapse-btn");
      if (!collapseBtn) {
        collapseBtn = document.createElement("button");
        collapseBtn.type = "button";
        collapseBtn.className = "panel-collapse-btn";
        header.appendChild(collapseBtn);
      }

      const isInteractiveTarget = (target) => {
        if (!(target instanceof Element)) return false;
        return Boolean(target.closest("button, input, label, select, textarea, a"));
      };

      const setCollapsed = (collapsed) => {
        panel.dataset.collapsed = collapsed ? "true" : "false";
        panel.classList.toggle("panel-collapsed", collapsed);
        body.setAttribute("aria-hidden", collapsed ? "true" : "false");
        collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        collapseBtn.setAttribute("aria-label", collapsed ? "Expand panel" : "Collapse panel");
        collapseBtn.textContent = collapsed ? "▸" : "▾";
      };

      setCollapsed(panel.dataset.collapsed === "true");
      collapseBtn.addEventListener("click", () => {
        setCollapsed(!(panel.dataset.collapsed === "true"));
      });

      header.addEventListener("click", (event) => {
        if (event.target === collapseBtn || isInteractiveTarget(event.target)) return;
        setCollapsed(!(panel.dataset.collapsed === "true"));
      });
    }
  }

  function setupTabs() {
    const tabButtons = Array.from(document.querySelectorAll(".tab-btn[data-tab]"));
    const panels = Array.from(document.querySelectorAll(".inspector-tab[data-panel]"));
    if (!tabButtons.length || !panels.length) return;

    const setTab = (name) => {
      for (const button of tabButtons) {
        const isActive = button.dataset.tab === name;
        button.dataset.selected = isActive ? "true" : "false";
      }
      for (const panel of panels) {
        panel.hidden = panel.dataset.panel !== name;
      }
    };

    for (const button of tabButtons) {
      button.addEventListener("click", () => setTab(button.dataset.tab));
    }

    const initial = tabButtons.find((button) => button.dataset.selected === "true")?.dataset.tab || tabButtons[0].dataset.tab;
    setTab(initial);
  }

  function setupQuickJumps() {
    const collapsiblePanels = Array.from(document.querySelectorAll(".panel-collapsible"));
    const collapsePanel = (panel, collapsed) => {
      const body = panel.querySelector(":scope > .panel-body");
      const collapseBtn = panel.querySelector(":scope > .panel-header .panel-collapse-btn");
      if (!body || !collapseBtn) return;
      panel.dataset.collapsed = collapsed ? "true" : "false";
      panel.classList.toggle("panel-collapsed", collapsed);
      body.setAttribute("aria-hidden", collapsed ? "true" : "false");
      collapseBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
      collapseBtn.setAttribute("aria-label", collapsed ? "Expand panel" : "Collapse panel");
      collapseBtn.textContent = collapsed ? "▸" : "▾";
    };

    const jumpButtons = Array.from(document.querySelectorAll("[data-jump-target]"));
    for (const button of jumpButtons) {
      button.addEventListener("click", () => {
        const target = document.getElementById(button.dataset.jumpTarget || "");
        if (!target) return;

        const tabPanel = target.closest(".inspector-tab[data-panel]");
        if (tabPanel) {
          const tabName = tabPanel.dataset.panel;
          const tabButton = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
          tabButton?.click();
        }

        for (const panel of collapsiblePanels) {
          if (panel.id === "workspacePanel") continue;
          collapsePanel(panel, panel !== target);
        }

        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function setupDensityMode() {
    const storageKey = "crt-ui-density";
    const setDensity = (value) => {
      document.body.dataset.density = value;
      try {
        localStorage.setItem(storageKey, value);
      } catch {
        // No-op if storage is not available.
      }
    };

    const densityControl = setupSelectionBox("densityMode", {
      onChange: (value) => setDensity(value),
    });

    if (!densityModeRoot) return;

    let stored = "comfortable";
    try {
      stored = localStorage.getItem(storageKey) || "comfortable";
    } catch {
      stored = "comfortable";
    }

    const normalized = stored === "compact" ? "compact" : "comfortable";
    densityControl.setValue(normalized, { silent: true });
    setDensity(normalized);
  }

  function setStatus(message, mode = "info") {
    statusEl.textContent = message;
    statusEl.dataset.mode = mode;
  }

  function setExportAvailability() {
    exportBtn.disabled = !hasLoadedSource || isExporting;
    if (downloadStillBtn) downloadStillBtn.disabled = !hasLoadedSource || isExporting;
    cancelExportBtn.disabled = !isExporting;
    resetSourceBtn.disabled = isExporting;
    resetParamsBtn.disabled = isExporting;
    imageInput.disabled = isExporting;
    document.getElementById("fps").disabled = isExporting;
    document.getElementById("duration").disabled = isExporting;
    document.getElementById("exportQuality").disabled = isExporting;
    exportFormatControl?.setDisabled(isExporting);
    exportResolutionControl?.setDisabled(isExporting);
    updateExportControlsState();
  }

  function updateExportEstimate() {
    if (!exportEstimateEl) return;
    const fps = Math.max(1, Number(document.getElementById("fps").value) || 30);
    const duration = Math.max(0.1, Number(document.getElementById("duration").value) || 4);
    const quality = Math.max(0.1, Number(document.getElementById("exportQuality").value) || 1);
    const totalFrames = Math.max(1, Math.round(fps * duration));
    const workloadScore = totalFrames * quality;
    const speedHint = workloadScore > 900 ? "Render load: heavy" : (workloadScore > 420 ? "Render load: medium" : "Render load: light");
    const maxEdge = getExportMaxEdge();
    const limited = fitExportSize(canvas.width, canvas.height, { maxEdge });
    exportEstimateEl.textContent = `Export summary: ${totalFrames} frames at ${fps} FPS (${duration.toFixed(1)}s) • ${limited.width}x${limited.height} • ${speedHint}.`;
  }

  let previewModeControl;
  let previewScaleControl;
  let sourceScaleControl;
  let previewMaxPixelsControl;
  let presetControl;
  let maskTypeControl;
  let exportFormatControl;
  let exportResolutionControl;
  let osdFontPresetControl;
  let osdStyleControl;

  function isStillPreviewMode() {
    return previewModeControl?.getValue() === "still";
  }

  function getPreviewScale() {
    return Math.max(0.1, Number(previewScaleControl?.getValue()) || 1);
  }

  function getSourceScale() {
    return Math.max(0.1, Number(sourceScaleControl?.getValue()) || 1);
  }

  function getPreviewMaxPixels() {
    return Math.max(0, Number(previewMaxPixelsControl?.getValue()) || 0);
  }

  function getExportMaxEdge() {
    return Math.max(0, Number(exportResolutionControl?.getValue()) || 0);
  }

  function markPreviewDirty() {
    previewDirty = true;
  }

  function getPreviewRenderSize() {
    const scale = getPreviewScale();
    let width = Math.max(1, Math.round(canvas.width * scale));
    let height = Math.max(1, Math.round(canvas.height * scale));
    const maxPixels = getPreviewMaxPixels();
    if (maxPixels > 0) {
      const pixels = width * height;
      if (pixels > maxPixels) {
        const factor = Math.sqrt(maxPixels / pixels);
        width = Math.max(1, Math.round(width * factor));
        height = Math.max(1, Math.round(height * factor));
      }
    }
    return { width, height };
  }

  function refreshRendererSource() {
    if (loadedSourceType === "video" && loadedVideo?.video) {
      renderer.setImage(loadedVideo.video, getSourceScale());
      markPreviewDirty();
      return;
    }
    if (loadedSourceType === "image" && loadedImage) {
      renderer.setImage(loadedImage, getSourceScale());
      markPreviewDirty();
    }
  }

  function updatePreviewControlsState() {
    const isVideo = loadedSourceType === "video" && loadedVideo?.video;
    const stillMode = isStillPreviewMode();
    const previewTime = document.getElementById("previewTime");
    const previewFps = document.getElementById("previewFps");

    previewTime.disabled = !isVideo;
    previewFps.disabled = !isVideo || stillMode;
    previewModeControl?.setDisabled(!isVideo);
  }

  function syncPreviewTimeControl() {
    const previewTime = document.getElementById("previewTime");
    const max = loadedVideo?.video?.duration ? Math.max(0, loadedVideo.video.duration - 0.001) : 0;
    previewTime.max = max.toFixed(3);
    previewTargetSeconds = Math.max(0, Math.min(previewTargetSeconds, max));
    previewFrameSeconds = previewTargetSeconds;
    previewTime.value = previewTargetSeconds.toFixed(3);
    previewTime.__syncRangeNumber?.();
    previewNeedsSeek = loadedSourceType === "video";
  }


  function updateExportControlsState() {
    const includeAudio = document.getElementById("includeOriginalAudio");
    const isVideo = loadedSourceType === "video" && loadedVideo?.video;
    includeAudio.disabled = isExporting || !isVideo;
    if (!isVideo) includeAudio.checked = false;
  }

  function syncVideoPlaybackState() {
    const video = loadedVideo?.video;
    if (!video) return;

    if (isStillPreviewMode()) {
      if (!video.paused) {
        video.pause();
      }
      return;
    }

    if (video.paused) {
      video.play().catch(() => {});
    }
  }



  function saveParameterPolicyState() {
    try {
      localStorage.setItem(PARAM_POLICY_STORAGE_KEY, JSON.stringify({
        detached: Array.from(detachedMacroIds),
        pinned: Array.from(presetPinnedIds),
      }));
    } catch {
      // ignore storage failures
    }
  }

  function loadParameterPolicyState() {
    try {
      const raw = localStorage.getItem(PARAM_POLICY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      for (const id of parsed?.detached || []) {
        if (macroTargetIds.includes(id)) detachedMacroIds.add(id);
      }
      for (const id of parsed?.pinned || []) {
        if (macroTargetIds.includes(id)) presetPinnedIds.add(id);
      }
    } catch {
      // ignore malformed state
    }
  }

  function buildMacroPolicyControls() {
    const container = document.getElementById("macroPolicyControls");
    if (!container) return;
    container.innerHTML = "";

    for (const id of macroTargetIds) {
      const row = document.createElement("label");
      row.className = "checkbox-row";
      const pretty = RANGE_CONTROL_LABELS[id] || id;
      row.innerHTML = `<span>${pretty}</span>`;

      const controls = document.createElement("span");
      controls.style.display = "inline-flex";
      controls.style.gap = "0.5rem";

      const detach = document.createElement("input");
      detach.type = "checkbox";
      detach.checked = detachedMacroIds.has(id);
      detach.title = `Detach ${pretty} from macro automation`;
      detach.addEventListener("input", () => {
        if (detach.checked) detachedMacroIds.add(id);
        else detachedMacroIds.delete(id);
        saveParameterPolicyState();
        markPreviewDirty();
      });

      const pin = document.createElement("input");
      pin.type = "checkbox";
      pin.checked = presetPinnedIds.has(id);
      pin.title = `Pin ${pretty} so presets do not overwrite it`;
      pin.addEventListener("input", () => {
        if (pin.checked) presetPinnedIds.add(id);
        else presetPinnedIds.delete(id);
        saveParameterPolicyState();
      });

      const detachWrap = document.createElement("label");
      detachWrap.className = "checkbox-row";
      detachWrap.append(detach, document.createTextNode("Detach"));

      const pinWrap = document.createElement("label");
      pinWrap.className = "checkbox-row";
      pinWrap.append(pin, document.createTextNode("Pin"));

      controls.append(detachWrap, pinWrap);
      row.appendChild(controls);
      container.appendChild(row);
    }
  }

  function randomizeMacroControls(amount = 0.35) {
    for (const id of macroControlIds) {
      const slider = document.getElementById(id);
      if (!slider) continue;
      const min = Number(slider.min);
      const max = Number(slider.max);
      const center = (min + max) * 0.5;
      const span = (max - min) * amount;
      const next = Math.max(min, Math.min(max, center + (Math.random() * 2 - 1) * span));
      slider.value = String(next);
      slider.__syncRangeNumber?.();
    }
    markPreviewDirty();
    progressEl.value = 0;
  }

  function resetMacroControls() {
    for (const id of macroControlIds) {
      const slider = document.getElementById(id);
      if (!slider) continue;
      slider.value = slider.defaultValue;
      slider.__syncRangeNumber?.();
    }
    markPreviewDirty();
    progressEl.value = 0;
  }


  function resetParameters() {
    const targetValues = defaultParamValues || readParams();
    for (const id of [...controlIds, ...macroControlIds]) {
      if (typeof targetValues[id] === "number") {
        const slider = document.getElementById(id);
        slider.value = targetValues[id];
        slider.__syncRangeNumber?.();
      }
    }
    enforceDisabledEffectPanels();
    sourceScaleControl?.setValue("1", { silent: true });
    if (presetIntensityInput) {
      presetIntensityInput.value = "1";
      presetIntensityInput.__syncRangeNumber?.();
    }
    maskTypeControl?.setValue("phosphor", { silent: true });
    refreshRendererSource();
    if (loadedSourceType === "video" && isStillPreviewMode()) {
      previewNeedsSeek = true;
    }
    markPreviewDirty();
    progressEl.value = 0;
    setStatus("Parameters reset to defaults.", "success");
    updatePresetDirtyState();
  }

  function resetSingleControlToDefault(id) {
    const slider = document.getElementById(id);
    if (!slider) return;
    const fallback = Number(slider.defaultValue);
    const defaultValue = defaultParamValues && typeof defaultParamValues[id] === "number"
      ? defaultParamValues[id]
      : (Number.isFinite(fallback) ? fallback : Number(slider.value) || 0);
    slider.value = defaultValue;
    slider.__syncRangeNumber?.();
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    setStatus(`Reset ${id} to default.`, "info");
    updatePresetDirtyState();
  }

  function clearLoadedSource({ silent = false } = {}) {
    if (loadedVideo?.video) {
      loadedVideo.video.pause();
      loadedVideo.video.removeAttribute("src");
      loadedVideo.video.load();
    }
    if (loadedVideo?.objectUrl) {
      URL.revokeObjectURL(loadedVideo.objectUrl);
    }
    if (loadedImage && typeof loadedImage.close === "function") {
      loadedImage.close();
    }

    loadedVideo = null;
    loadedImage = null;
    loadedSourceType = "image";
    hasLoadedSource = false;
    renderer.hasImage = false;

    canvas.width = 960;
    canvas.height = 540;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    imageInput.value = "";
    document.getElementById("duration").value = "4";
    previewTargetSeconds = 0;
    previewFrameSeconds = 0;
    previewNeedsSeek = false;
    syncPreviewTimeControl();
    updatePreviewControlsState();
    updateExportControlsState();
    progressEl.value = 0;
    markPreviewDirty();
    setExportAvailability();
    setCompareState(false, { lock: false });

    if (!silent) {
      setStatus("Source reset. Load a new image or video.", "info");
    }
  }

  function clampControlValue(id, value) {
    const limits = PARAM_LIMITS[id] || {};
    let next = Number.isFinite(value) ? value : 0;
    if (Number.isFinite(limits.min)) next = Math.max(limits.min, next);
    if (Number.isFinite(limits.max)) next = Math.min(limits.max, next);
    return next;
  }

  function addMacroValue(values, id, delta) {
    if (detachedMacroIds.has(id)) return;
    values[id] = clampControlValue(id, Number(values[id] || 0) + delta);
  }

  function applyMacroSystems(values) {
    const macrosEnabled = document.getElementById("macroSystemsEnabled")?.checked !== false;
    if (!macrosEnabled) return values;

    const macro = (id) => Number(document.getElementById(id)?.value || 0);

    const source = macro("macroSourceProvenance");
    const generation = macro("shapeGenerationDepth");
    addMacroValue(values, "advancedGenerationLoss", source * (0.25 + generation * 0.75));
    addMacroValue(values, "noise", source * 0.35);
    addMacroValue(values, "advancedGhosting", source * 0.25 * generation);

    const display = macro("macroDisplayEmulation");
    const tubeAge = macro("shapeTubeAge");
    addMacroValue(values, "scanlineStrength", display * 0.32);
    addMacroValue(values, "phosphorMask", display * 0.28);
    addMacroValue(values, "bloom", display * (0.15 + tubeAge * 0.35));
    addMacroValue(values, "flicker", display * tubeAge * 0.25);

    const signal = macro("macroSignalPathDamage");
    const instability = macro("shapePathInstability");
    addMacroValue(values, "advancedChromaDelay", signal * 0.5);
    addMacroValue(values, "advancedCrossColor", signal * 0.45);
    addMacroValue(values, "advancedLineJitter", signal * (0.2 + instability * 0.45));
    addMacroValue(values, "advancedTimebaseWobble", signal * (0.15 + instability * 0.45));

    const distribution = macro("macroDistributionArtifacts");
    const eventRate = macro("shapeEventRate");
    addMacroValue(values, "advancedDropouts", distribution * (0.25 + eventRate * 0.6));
    addMacroValue(values, "advancedTapeCrease", distribution * eventRate * 0.55);
    addMacroValue(values, "advancedRfInterference", distribution * 0.5);
    addMacroValue(values, "advancedInterlacing", distribution * 0.35);

    const digital = macro("macroDigitalDecay");
    const bitrateStress = macro("shapeBitrateStress");
    addMacroValue(values, "advancedQuantization", digital * (0.2 + bitrateStress * 0.7));
    addMacroValue(values, "advancedMacroBlocking", digital * (0.1 + bitrateStress * 0.85));
    addMacroValue(values, "advancedFrameStutter", digital * bitrateStress * 0.35);

    const recover = macro("macroRecoveryRuin");
    const textureKeep = macro("shapeTextureKeep");
    if (recover >= 0) {
      addMacroValue(values, "noise", recover * (0.25 + (1 - textureKeep) * 0.4));
      addMacroValue(values, "advancedFilmDust", recover * 0.4);
      addMacroValue(values, "advancedFilmScratches", recover * 0.25);
    } else {
      addMacroValue(values, "noise", recover * (0.18 + textureKeep * 0.2));
      addMacroValue(values, "advancedMacroBlocking", recover * 0.15);
      addMacroValue(values, "advancedQuantization", recover * 0.12);
    }

    const era = macro("macroEraStyling");
    const overlay = macro("shapeOverlayContext");
    addMacroValue(values, "advancedFilmGrain", era * 0.45);
    addMacroValue(values, "advancedFilmHalation", era * 0.35);
    addMacroValue(values, "advancedWhiteBalanceDrift", era * 0.3);
    addMacroValue(values, "advancedTimestampOSD", era * (0.15 + overlay * 0.65));

    return values;
  }

  function readParams() {
    const values = Object.fromEntries(controlIds.map((id) => [id, Number(document.getElementById(id).value)]));
    applyMacroSystems(values);
    for (const [panelName, config] of Object.entries(EFFECT_PANEL_CONFIGS)) {
      if (panelEffectState[panelName]?.enabled) continue;
      for (const id of config.controlIds) values[id] = 0;
    }
    values.maskType = maskTypeControl?.getValue() || "phosphor";
    return values;
  }

  function interpolatePresetValues(name, intensity = 1) {
    const preset = presets[name] || {};
    const profile = presetIntensityProfiles.get(name) || buildPresetIntensityProfile(name, preset);
    presetIntensityProfiles.set(name, profile);
    const normalized = Math.max(0, Number(intensity) || 0);
    const pull = normalized <= 1
      ? Math.pow(normalized, 1.35)
      : 1 + Math.pow(normalized - 1, 1.2);
    const expected = {};
    for (const id of controlIds) {
      const slider = document.getElementById(id);
      const neutral = defaultParamValues && typeof defaultParamValues[id] === "number"
        ? defaultParamValues[id]
        : (Number(slider?.defaultValue) || Number(slider?.value) || 0);
      if (typeof preset[id] === "number") {
        const min = Number(slider?.min);
        const max = Number(slider?.max);
        const weight = profile.weights?.[id] || 1;
        const localPull = pull * weight;
        let value = neutral + (preset[id] - neutral) * localPull;
        if (Number.isFinite(min)) value = Math.max(min, value);
        if (Number.isFinite(max)) value = Math.min(max, value);
        expected[id] = value;
      } else {
        expected[id] = neutral;
      }
    }
    return {
      values: expected,
      maskType: typeof preset.maskType === "string" ? preset.maskType : "phosphor",
      keys: controlIds.filter((id) => typeof preset[id] === "number"),
    };
  }

  function readOSDOptions(elapsedSeconds = 0) {
    return {
      osdStartDateTime: osdStartDateTimeInput?.value,
      osdPrimaryColor: osdPrimaryColorInput?.value,
      osdAccentColor: osdAccentColorInput?.value,
      osdFontPreset: osdFontPresetControl?.getValue() || "vhs",
      osdCountWithExport: osdCountWithExportInput?.checked !== false,
      osdElapsedSeconds: elapsedSeconds,
    };
  }

  function applyPreset(name, intensity = Number(presetIntensityInput?.value || 1)) {
    const preset = presets[name];
    if (!preset) return;
    const mapped = interpolatePresetValues(name, intensity);
    for (const id of controlIds) {
      if (presetPinnedIds.has(id)) continue;
      const slider = document.getElementById(id);
      slider.value = mapped.values[id];
      slider.__syncRangeNumber?.();
    }
    maskTypeControl?.setValue(mapped.maskType, { silent: true });
    enforceDisabledEffectPanels();
    activePresetName = name;
    updatePresetDirtyState();
  }

  function getPresetCategory(name = "", preset = {}) {
    const lowerName = String(name).toLowerCase();
    if (/(silent film|technicolor|super\s*8|16mm|kinescope|nitrate|newsreel|film|reel)/.test(lowerName)) return "Film";
    if (/(security|surveillance|cctv)/.test(lowerName)) return "Surveillance";
    if (/(web rip|streaming|digital|compression|dvd|hdv|smartphone|dslr|4k|hdr|laserdisc)/.test(lowerName)) return "Digital";
    if (/(pvm|consumer tv|arcade|oled|lcd)/.test(lowerName)) return "Display";
    if (/(vhs|tape|cam|broadcast|analog|archive|hi8|minidv|u-matic|betacam)/.test(lowerName)) return "Analog Video";
    if (Number(preset.advancedFilmGrain || 0) > 0.35 || Number(preset.advancedFilmHalation || 0) > 0.35) return "Film";
    return "Experimental";
  }

  function updatePresetFilterMeta(visibleCount, totalCount) {
    if (!presetFilterMeta) return;
    const query = String(presetSearchInput?.value || "").trim();
    if (visibleCount === totalCount && !query) {
      presetFilterMeta.textContent = `${totalCount} presets`;
      return;
    }
    const querySuffix = query ? ` matching “${query}”` : "";
    presetFilterMeta.textContent = `${visibleCount} of ${totalCount} presets${querySuffix}`;
  }

  function applyPresetFilters() {
    if (!presetSelect || !presetControl) return;
    const selectedCategory = String(presetCategoryFilter?.value || "all");
    const query = String(presetSearchInput?.value || "").trim().toLowerCase();

    const buttons = Array.from(presetSelect.querySelectorAll("button[data-value]"));
    const visibleNames = [];
    for (const button of buttons) {
      const name = button.dataset.value || "";
      const category = presetCategories.get(name) || "Experimental";
      const categoryMatch = selectedCategory === "all" || category === selectedCategory;
      const searchMatch = !query || name.toLowerCase().includes(query);
      const visible = categoryMatch && searchMatch;
      button.hidden = !visible;
      if (visible) visibleNames.push(name);
    }

    updatePresetFilterMeta(visibleNames.length, buttons.length);

    const current = activePresetName || presetControl.getValue();
    if (visibleNames.length > 0 && !visibleNames.includes(current)) {
      presetControl.setValue(visibleNames[0]);
      return;
    }

    if (visibleNames.length === 0 && presetFilterMeta) {
      presetFilterMeta.textContent = "No presets match this filter.";
    }
  }

  function updatePresetDirtyState() {
    if (!presetDirtyTag) return;
    if (!activePresetName) {
      presetDirtyTag.hidden = true;
      return;
    }

    const intensity = Number(presetIntensityInput?.value || 1);
    const expected = interpolatePresetValues(activePresetName, intensity);
    const current = readParams();
    const changedSliders = controlIds.some((id) => Math.abs(Number(current[id] ?? 0) - Number(expected.values[id] ?? 0)) > 0.0001);
    const changedMask = (current.maskType || "phosphor") !== expected.maskType;
    presetDirtyTag.hidden = !(changedSliders || changedMask);
  }

  function initializePresets() {
    const names = Object.keys(presets);
    presetCategories.clear();
    presetSelect.innerHTML = "";

    if (names.length === 0) {
      const message = document.createElement("div");
      message.className = "selection-empty";
      message.textContent = "No presets available";
      presetSelect.appendChild(message);
      return;
    }

    for (const name of names) {
      presetCategories.set(name, getPresetCategory(name, presets[name]));
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.value = name;
      button.textContent = name;
      if (name === "Consumer TV") {
        button.dataset.selected = "true";
      }
      presetSelect.appendChild(button);
    }

    if (presetCategoryFilter) {
      const categories = ["all", ...Array.from(new Set(names.map((name) => presetCategories.get(name))).values()).sort((a, b) => a.localeCompare(b))];
      presetCategoryFilter.innerHTML = "";
      for (const category of categories) {
        const opt = document.createElement("option");
        opt.value = category;
        opt.textContent = category === "all" ? "All categories" : category;
        presetCategoryFilter.appendChild(opt);
      }
    }

    presetControl = setupSelectionBox("presetSelect", {
      onChange: (name) => {
        if (presetIntensityInput) {
          presetIntensityInput.value = "1";
          presetIntensityInput.__syncRangeNumber?.();
        }
        applyPreset(name, 1);
        markPreviewDirty();
        progressEl.value = 0;
        setStatus(`Preset applied: ${name}`, "success");
      },
    });

    const defaultPreset = presets["Consumer TV"] ? "Consumer TV" : names[0];
    presetControl.setValue(defaultPreset, { silent: true });
    applyPreset(defaultPreset, Number(presetIntensityInput?.value || 1));
    applyPresetFilters();
    updatePresetDirtyState();
  }

  async function loadImageFromFile(file) {
    if ("createImageBitmap" in window) {
      try {
        return await createImageBitmap(file);
      } catch (error) {
        console.warn("createImageBitmap failed; falling back to Image.decode", error);
      }
    }

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
    try {
      await img.decode();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
    return img;
  }

  function waitForVideoEvent(video, eventName) {
    return new Promise((resolve) => {
      const handler = () => {
        video.removeEventListener(eventName, handler);
        resolve();
      };
      video.addEventListener(eventName, handler, { once: true });
    });
  }

  function waitForVideoReady(video, { timeoutMs = 1500 } = {}) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      let timeoutId = null;
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        video.removeEventListener("loadeddata", handleReady);
        video.removeEventListener("canplay", handleReady);
        video.removeEventListener("error", handleError);
      };

      const handleReady = () => {
        cleanup();
        resolve(true);
      };

      const handleError = () => {
        cleanup();
        resolve(false);
      };

      timeoutId = setTimeout(() => {
        cleanup();
        resolve(video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
      }, Math.max(0, timeoutMs));

      video.addEventListener("loadeddata", handleReady, { once: true });
      video.addEventListener("canplay", handleReady, { once: true });
      video.addEventListener("error", handleError, { once: true });
    });
  }

  async function ensureVideoFrameReady(video) {
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return true;

    let ready = await waitForVideoReady(video, { timeoutMs: 1200 });
    if (ready) return true;

    try {
      await video.play();
    } catch {
      // ignore autoplay failures; we'll still wait briefly for decode readiness
    }

    ready = await waitForVideoReady(video, { timeoutMs: 1200 });
    if (!video.paused) {
      video.pause();
    }
    return ready;
  }

  async function loadVideoFromFile(file) {
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.load();
    await waitForVideoEvent(video, "loadedmetadata");
    await ensureVideoFrameReady(video);
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("Video metadata is invalid or duration is unavailable.");
    }
    return { video, objectUrl };
  }

  async function seekVideo(video, timeSeconds) {
    const clamped = Math.max(0, Math.min(timeSeconds, Math.max(0, video.duration - 0.000001)));
    if (Math.abs(video.currentTime - clamped) < 0.0005) return;
    video.currentTime = clamped;
    await waitForVideoEvent(video, "seeked");
  }

  function animate(now) {
    const fps = Math.max(1, Number(document.getElementById("fps").value) || 30);
    const elapsed = (now - start) / 1000;
    const frame = Math.floor(elapsed * fps);
    const stillMode = isStillPreviewMode();

    if (!isExporting && loadedSourceType === "video" && loadedVideo?.video) {
      const video = loadedVideo.video;
      syncVideoPlaybackState();
      if (isStillPreviewMode()) {
        if (previewNeedsSeek || Math.abs(video.currentTime - previewTargetSeconds) > 0.0005) {
          previewNeedsSeek = false;
          seekVideo(video, previewTargetSeconds)
            .then(() => {
              previewFrameSeconds = previewTargetSeconds;
              renderer.setImage(video, getSourceScale());
              markPreviewDirty();
            })
            .catch((error) => {
              previewNeedsSeek = true;
              console.warn("Preview seek failed", error);
            });
        }
      } else {
        const previewFps = Math.max(1, Number(document.getElementById("previewFps").value) || 15);
        const minInterval = 1000 / previewFps;
        if (now - lastPreviewTick >= minInterval) {
          lastPreviewTick = now;
          renderer.setImage(video, getSourceScale());
          previewFrameSeconds = video.currentTime;
          markPreviewDirty();
          previewTargetSeconds = previewFrameSeconds;
          document.getElementById("previewTime").value = previewFrameSeconds.toFixed(3);
          document.getElementById("previewTime").__syncRangeNumber?.();
        }
      }
    }

    const shouldRender = previewDirty;
    if (shouldRender) {
      if (showOriginalPreview && renderer.hasImage) {
        const source = loadedSourceType === "video" ? loadedVideo?.video : loadedImage;
        if (source) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          const srcW = source.videoWidth || source.naturalWidth || canvas.width;
          const srcH = source.videoHeight || source.naturalHeight || canvas.height;
          const scale = Math.min(canvas.width / srcW, canvas.height / srcH);
          const drawW = Math.max(1, Math.round(srcW * scale));
          const drawH = Math.max(1, Math.round(srcH * scale));
          ctx.drawImage(source, (canvas.width - drawW) / 2, (canvas.height - drawH) / 2, drawW, drawH);
          previewDirty = false;
          requestAnimationFrame(animate);
          return;
        }
      }
      const { width: previewWidth, height: previewHeight } = getPreviewRenderSize();
      if (previewWidth === canvas.width && previewHeight === canvas.height) {
        renderer.render(ctx, canvas.width, canvas.height, frame / fps, readParams(), frame, fps, readOSDOptions(loadedSourceType === "video" ? previewFrameSeconds : frame / fps));
      } else {
        previewBuffer.width = previewWidth;
        previewBuffer.height = previewHeight;
        const previewCtx = previewBuffer.getContext("2d", { alpha: false, desynchronized: true });
        renderer.render(previewCtx, previewBuffer.width, previewBuffer.height, frame / fps, readParams(), frame, fps, readOSDOptions(loadedSourceType === "video" ? previewFrameSeconds : frame / fps));
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(previewBuffer, 0, 0, canvas.width, canvas.height);
      }
      previewDirty = false;
    }
    requestAnimationFrame(animate);
  }

  imageInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isExporting) return;
    clearLoadedSource({ silent: true });

    progressEl.value = 0.05;
    setStatus(`Processing ${file.name} (${Math.round(file.size / 1024)} KB)...`, "info");

    try {
      if (file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name)) {
        const videoSource = await loadVideoFromFile(file);
        progressEl.value = 0.4;
        renderer.setImage(videoSource.video, getSourceScale());
        loadedVideo = videoSource;
        loadedSourceType = "video";

        canvas.width = videoSource.video.videoWidth;
        canvas.height = videoSource.video.videoHeight;
        document.getElementById("duration").value = Math.max(0.5, videoSource.video.duration).toFixed(2);
        previewTargetSeconds = 0;
        previewFrameSeconds = 0;
        syncPreviewTimeControl();
        updatePreviewControlsState();
        updateExportControlsState();
        syncVideoPlaybackState();
        markPreviewDirty();

        setStatus(`Loaded video ${file.name} (${videoSource.video.videoWidth}x${videoSource.video.videoHeight}, ${videoSource.video.duration.toFixed(2)}s). Ready to export.`, "success");
      } else {
        const imageSource = await loadImageFromFile(file);
        progressEl.value = 0.4;
        loadedImage = imageSource;
        renderer.setImage(imageSource, getSourceScale());
        loadedSourceType = "image";
        canvas.width = imageSource.naturalWidth || imageSource.width || canvas.width;
        canvas.height = imageSource.naturalHeight || imageSource.height || canvas.height;
        previewTargetSeconds = 0;
        previewFrameSeconds = 0;
        syncPreviewTimeControl();
        updatePreviewControlsState();
        updateExportControlsState();
        markPreviewDirty();
        setStatus(`Loaded image ${file.name} (${canvas.width}x${canvas.height}). Ready to export.`, "success");
      }

      progressEl.value = 1;
      hasLoadedSource = true;
      setExportAvailability();
      start = performance.now();
    } catch (error) {
      hasLoadedSource = false;
      progressEl.value = 0;
      setExportAvailability();
      setStatus(`Couldn't load media: ${error.message}`, "error");
      console.error(error);
    }
  });

  document.getElementById("previewFps").addEventListener("input", () => {
    markPreviewDirty();
    progressEl.value = 0;
  });

  document.getElementById("previewTime").addEventListener("input", (event) => {
    previewTargetSeconds = Number(event.target.value) || 0;
    previewNeedsSeek = true;
    markPreviewDirty();
    progressEl.value = 0;
  });


  async function downloadPreviewStill() {
    if (!hasLoadedSource) {
      setStatus("Load an image or video before downloading a still.", "warn");
      return;
    }

    const filename = `crt-still-${Date.now()}.png`;
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((nextBlob) => {
        if (!nextBlob) {
          reject(new Error("Canvas still export returned an empty blob."));
          return;
        }
        resolve(nextBlob);
      }, "image/png");
    });
    downloadBlob(blob, filename);
    setStatus(`Still image downloaded: ${filename}`, "success");
  }

  exportBtn.addEventListener("click", async () => {
    if (!hasLoadedSource) {
      setStatus("Load an image or video before exporting.", "warn");
      return;
    }

    try {
      isExporting = true;
      activeExportController = new AbortController();
      setExportAvailability();
      progressEl.value = 0;
      setStatus("Preparing export...", "info");
      const fps = Math.max(1, Number(document.getElementById("fps").value) || 30);
      const duration = Math.max(0.5, Number(document.getElementById("duration").value) || 4);
      const qualityMultiplier = Math.max(0.5, Math.min(2.5, Number(document.getElementById("exportQuality").value) || 1));
      const includeOriginalAudio = document.getElementById("includeOriginalAudio").checked;
      const selectedFormat = exportFormatControl?.getValue() || "mp4";
      const mustUseRealtimeAudio = includeOriginalAudio && loadedSourceType === "video";
      const maxExportEdge = getExportMaxEdge();
      const baseExportSize = fitExportSize(canvas.width, canvas.height, { maxEdge: maxExportEdge });
      const mp4ExportSize = fitExportSize(baseExportSize.width, baseExportSize.height, { maxPixels: MAX_AVC_CODED_PIXELS, forceEven: true });
      const exportSize = selectedFormat === "webm" || mustUseRealtimeAudio ? baseExportSize : mp4ExportSize;
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = exportSize.width;
      exportCanvas.height = exportSize.height;

      if ((selectedFormat !== "webm" && !mustUseRealtimeAudio) && (baseExportSize.width !== mp4ExportSize.width || baseExportSize.height !== mp4ExportSize.height)) {
        setStatus(`AVC size limit hit. Exporting at ${mp4ExportSize.width}x${mp4ExportSize.height} instead.`, "warn");
      }

      if (selectedFormat === "mp4" && mustUseRealtimeAudio) {
        setStatus("Audio passthrough requires WebM realtime export. Switching format for this render.", "warn");
      }

      if (selectedFormat === "webm" || mustUseRealtimeAudio) {
        await exportWebmRealtime({
          canvas: exportCanvas,
          renderer,
          params: readParams(),
          fps,
          duration,
          loadedSourceType,
          loadedVideo,
          loadedImage,
          sourceScale: getSourceScale,
          includeAudio: includeOriginalAudio,
          onProgress: (value, current, total) => {
            progressEl.value = value;
            setStatus(`Realtime export frame ${current}/${total}`, "info");
          },
          signal: activeExportController.signal,
          getRenderOptions: (t) => readOSDOptions(t),
        });
      } else {
        await exportMp4({
          canvas: exportCanvas,
          renderer,
          params: readParams(),
          fps,
          duration,
          beforeRenderFrame: loadedSourceType === "video" && loadedVideo
            ? async (t) => {
                await seekVideo(loadedVideo.video, t);
                renderer.setImage(loadedVideo.video, getSourceScale());
              }
            : null,
          onProgress: (value, current, total) => {
            progressEl.value = value;
            setStatus(`Encoding frame ${current}/${total}`, "info");
          },
          signal: activeExportController.signal,
          bitrateScale: qualityMultiplier,
          getRenderOptions: (t) => readOSDOptions(t),
        });
      }
      setStatus("Export finished. Download should begin automatically.", "success");
    } catch (error) {
      if (error?.name === "AbortError") {
        setStatus("Export cancelled.", "warn");
      } else {
        setStatus(`Export failed: ${error.message}`, "error");
        console.error(error);
      }
    } finally {
      isExporting = false;
      activeExportController = null;
      setExportAvailability();
    }
  });


  downloadStillBtn?.addEventListener("click", async () => {
    try {
      await downloadPreviewStill();
    } catch (error) {
      setStatus(`Still download failed: ${error.message}`, "error");
      console.error(error);
    }
  });

  cancelExportBtn.addEventListener("click", () => {
    if (!isExporting || !activeExportController) return;
    activeExportController.abort();
    setStatus("Cancelling export...", "warn");
  });

  resetParamsBtn.addEventListener("click", () => {
    resetParameters();
  });

  resetSourceBtn.addEventListener("click", () => {
    clearLoadedSource();
  });

  for (const id of [...controlIds, ...macroControlIds, "fps", "duration", "presetIntensity"]) {
    document.getElementById(id).addEventListener("input", () => {
      markPreviewDirty();
      progressEl.value = 0;
      updatePresetDirtyState();
      if (id === "fps" || id === "duration") updateExportEstimate();
    });
  }

  document.getElementById("exportQuality")?.addEventListener("input", () => {
    updateExportEstimate();
  });

  document.getElementById("macroSystemsEnabled")?.addEventListener("input", () => {
    markPreviewDirty();
    progressEl.value = 0;
  });

  document.getElementById("macroRandomizeSubtle")?.addEventListener("click", () => randomizeMacroControls(0.18));
  document.getElementById("macroRandomizeMedium")?.addEventListener("click", () => randomizeMacroControls(0.35));
  document.getElementById("macroRandomizeWild")?.addEventListener("click", () => randomizeMacroControls(0.5));
  document.getElementById("macroResetBtn")?.addEventListener("click", () => resetMacroControls());

  presetIntensityInput?.addEventListener("input", () => {
    if (!activePresetName) return;
    applyPreset(activePresetName, Number(presetIntensityInput.value || 1));
    markPreviewDirty();
    progressEl.value = 0;
  });

  presetCategoryFilter?.addEventListener("change", () => {
    applyPresetFilters();
  });

  presetSearchInput?.addEventListener("input", () => {
    applyPresetFilters();
  });

  for (const id of ["osdStartDateTime", "osdPrimaryColor", "osdAccentColor", "osdCountWithExport"]) {
    document.getElementById(id)?.addEventListener("input", () => {
      markPreviewDirty();
      progressEl.value = 0;
    });
  }

  for (const id of [...controlIds, ...macroControlIds, "previewTime", "presetIntensity", "quickPresetIntensity", "quickScanlineStrength", "quickBloom", "quickChroma"]) {
    setupRangeWithNumber(id);
  }

  for (const id of controlIds) {
    const slider = document.getElementById(id);
    if (!slider || slider.type !== "range") continue;
    slider.addEventListener("dblclick", () => {
      resetSingleControlToDefault(id);
      progressEl.value = 0;
      markPreviewDirty();
    });
  }

  previewModeControl = setupSelectionBox("previewMode", {
    onChange: () => {
      if (isStillPreviewMode()) {
        previewNeedsSeek = true;
      }
      updatePreviewControlsState();
      syncVideoPlaybackState();
      markPreviewDirty();
      progressEl.value = 0;
    },
  });

  previewScaleControl = setupSelectionBox("previewScale", {
    valueParser: Number,
    onChange: () => {
      markPreviewDirty();
      progressEl.value = 0;
    },
  });

  sourceScaleControl = setupSelectionBox("sourceScale", {
    valueParser: Number,
    onChange: () => {
      refreshRendererSource();
      if (loadedSourceType === "video" && isStillPreviewMode()) {
        previewNeedsSeek = true;
      }
      progressEl.value = 0;
    },
  });

  previewMaxPixelsControl = setupSelectionBox("previewMaxPixels", {
    valueParser: Number,
    onChange: () => {
      markPreviewDirty();
      progressEl.value = 0;
    },
  });

  maskTypeControl = setupSelectionBox("maskType", {
    onChange: () => {
      markPreviewDirty();
      progressEl.value = 0;
      updatePresetDirtyState();
    },
  });

  exportFormatControl = setupSelectionBox("exportFormat", {
    onChange: () => {
      progressEl.value = 0;
    },
  });

  exportResolutionControl = setupSelectionBox("exportResolution", {
    valueParser: Number,
    onChange: () => {
      progressEl.value = 0;
      updateExportEstimate();
    },
  });

  osdFontPresetControl = setupSelectionBox("osdFontPreset", {
    onChange: () => {
      markPreviewDirty();
      progressEl.value = 0;
    },
  });

  osdStyleControl = setupSelectionBox("advancedOSDStyleSelect", {
    valueParser: Number,
    onChange: (value) => {
      if (osdStyleInput) {
        osdStyleInput.value = String(value);
        osdStyleInput.dispatchEvent(new Event("input", { bubbles: true }));
      }
    },
  });

  if (osdStyleInput) {
    osdStyleControl?.setValue(String(Math.round(Number(osdStyleInput.value) || 0)), { silent: true });
    osdStyleInput.addEventListener("input", () => {
      osdStyleControl?.setValue(String(Math.round(Number(osdStyleInput.value) || 0)), { silent: true });
    });
  }

  function enforceDisabledEffectPanels() {
    for (const [panelName, config] of Object.entries(EFFECT_PANEL_CONFIGS)) {
      const state = panelEffectState[panelName];
      if (!state || state.enabled) continue;
      for (const id of config.controlIds) {
        setControlValue(id, 0, { dispatch: false });
      }
    }
  }

  function setControlValue(id, value, { dispatch = true } = {}) {
    const slider = document.getElementById(id);
    if (!slider) return;
    slider.value = String(value);
    slider.__syncRangeNumber?.();
    if (dispatch) {
      slider.dispatchEvent(new Event("input", { bubbles: true }));
      slider.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function updateEffectPanelVisual(panelName, enabled) {
    const config = EFFECT_PANEL_CONFIGS[panelName];
    if (!config) return;
    const toggle = document.getElementById(config.toggleId);
    const panel = toggle?.closest(".panel");
    if (!panel) return;
    panel.classList.toggle("panel-effects-disabled", !enabled);
    const labels = panel.querySelectorAll("label");
    for (const label of labels) {
      if (label.classList.contains("panel-toggle")) continue;
      const input = label.querySelector("input");
      if (!input) continue;
      input.disabled = !enabled;
    }
  }

  function setEffectPanelEnabled(panelName, enabled) {
    const config = EFFECT_PANEL_CONFIGS[panelName];
    const state = panelEffectState[panelName];
    if (!config || !state) return;

    state.enabled = !!enabled;
    if (!state.enabled) {
      state.savedValues = Object.fromEntries(config.controlIds.map((id) => [id, Number(document.getElementById(id)?.value || 0)]));
      for (const id of config.controlIds) {
        setControlValue(id, 0);
      }
      setStatus(`${panelName.toUpperCase()} effects disabled.`, "info");
    } else {
      if (state.savedValues) {
        for (const id of config.controlIds) {
          if (typeof state.savedValues[id] === "number") {
            setControlValue(id, state.savedValues[id]);
          }
        }
      }
      state.savedValues = null;
      setStatus(`${panelName.toUpperCase()} effects enabled.`, "success");
    }

    updateEffectPanelVisual(panelName, state.enabled);
    updatePresetDirtyState();
    markPreviewDirty();
    progressEl.value = 0;
  }

  function setupEffectPanelToggles() {
    for (const [panelName, config] of Object.entries(EFFECT_PANEL_CONFIGS)) {
      const toggle = document.getElementById(config.toggleId);
      if (!toggle) continue;
      toggle.checked = panelEffectState[panelName].enabled;
      updateEffectPanelVisual(panelName, panelEffectState[panelName].enabled);
      toggle.addEventListener("change", () => {
        setEffectPanelEnabled(panelName, toggle.checked);
      });
    }
  }

  function setCompareState(enabled, { lock = compareLocked } = {}) {
    compareLocked = !!lock;
    showOriginalPreview = enabled;
    if (compareHoldBtn) {
      compareHoldBtn.dataset.selected = enabled ? "true" : "false";
      compareHoldBtn.classList.toggle("compare-active", enabled);
      compareHoldBtn.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    if (compareLockBtn) {
      compareLockBtn.dataset.selected = compareLocked ? "true" : "false";
      compareLockBtn.classList.toggle("compare-active", compareLocked);
      compareLockBtn.textContent = compareLocked ? "Unlock compare" : "Lock compare";
      compareLockBtn.setAttribute("aria-pressed", compareLocked ? "true" : "false");
    }
    markPreviewDirty();
  }

  compareHoldBtn?.addEventListener("pointerdown", () => setCompareState(true, { lock: false }));
  compareHoldBtn?.addEventListener("pointerup", () => {
    if (!compareLocked) setCompareState(false, { lock: false });
  });
  compareHoldBtn?.addEventListener("pointerleave", () => {
    if (!compareLocked) setCompareState(false, { lock: false });
  });
  compareLockBtn?.addEventListener("click", () => {
    compareLocked = !compareLocked;
    setCompareState(compareLocked, { lock: compareLocked });
    setStatus(compareLocked ? "Compare locked: showing original." : "Compare unlocked.", "info");
  });
  compareHoldBtn?.addEventListener("keydown", (event) => {
    if (event.code === "Space") setCompareState(true, { lock: compareLocked });
  });
  compareHoldBtn?.addEventListener("keyup", (event) => {
    if (event.code === "Space" && !compareLocked) setCompareState(false, { lock: false });
  });
  compareHoldBtn?.addEventListener("blur", () => {
    if (!compareLocked) setCompareState(false, { lock: false });
  });

  setupEffectPanelToggles();
  setupCollapsiblePanels();
  setupTabs();
  setupQuickJumps();
  setupDensityMode();

  setExportAvailability();
  loadParameterPolicyState();
  buildMacroPolicyControls();

  loadPresets().finally(() => {
    initializePresets();
    defaultParamValues = readParams();
    updatePreviewControlsState();
    updateExportControlsState();
    syncPreviewTimeControl();
    updateExportEstimate();
  });
  window.addEventListener("beforeunload", () => {
    if (loadedVideo?.objectUrl) {
      URL.revokeObjectURL(loadedVideo.objectUrl);
    }
    if (loadedImage && typeof loadedImage.close === "function") {
      loadedImage.close();
    }
  });


  setStatus("Load an image or video (MP4/WebM/MOV/etc.) to begin.", "info");
  requestAnimationFrame(animate);
})();
