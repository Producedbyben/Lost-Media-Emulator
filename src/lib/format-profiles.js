/**
 * Format Authenticity Profiles
 * ----------------------------------------------------------------------------
 * Every preset emulates a real recording/display medium. A convincing result
 * needs the medium's *physical signal characteristics*, not just grain and
 * scanlines:
 *   - native luma/chroma resolution (the single biggest "looks real" factor)
 *   - display aspect ratio + frame cadence
 *   - the colour-signal system (NTSC / PAL composite, digital, film, none)
 *   - a matching audio degradation profile
 *   - an authenticity dossier (what it is, the era, signature artifacts)
 *
 * This module is the single source of truth for that metadata. It is keyed by
 * preset name with sensible category-based fallbacks so every existing preset
 * (and any custom/shared preset) resolves to something coherent.
 */

// ---------------------------------------------------------------------------
// Audio degradation profiles (consumed by src/lib/audio-degrade.ts)
// ---------------------------------------------------------------------------
// All fields 0..1 unless noted. lowCutHz / highCutHz are absolute Hz.
export const AUDIO_PROFILES = {
  clean: { label: "Clean", lowCutHz: 0, highCutHz: 20000, hiss: 0, hum: 0, wow: 0, flutter: 0, mono: 0, mp3: 0, telephone: 0, companding: 0, crackle: 0, silent: 0 },
  vhs: { label: "VHS linear audio", lowCutHz: 80, highCutHz: 10000, hiss: 0.32, hum: 0.18, wow: 0.35, flutter: 0.25, mono: 0.5, mp3: 0, telephone: 0, companding: 0.2, crackle: 0.05, silent: 0 },
  vhsHifi: { label: "VHS Hi-Fi", lowCutHz: 40, highCutHz: 14000, hiss: 0.14, hum: 0.08, wow: 0.18, flutter: 0.22, mono: 0, mp3: 0, telephone: 0, companding: 0.15, crackle: 0, silent: 0 },
  betamax: { label: "Betamax linear", lowCutHz: 70, highCutHz: 11000, hiss: 0.26, hum: 0.15, wow: 0.28, flutter: 0.22, mono: 0.6, mp3: 0, telephone: 0, companding: 0.18, crackle: 0.04, silent: 0 },
  hi8: { label: "Hi8 / Video8 AFM", lowCutHz: 60, highCutHz: 12500, hiss: 0.18, hum: 0.06, wow: 0.2, flutter: 0.3, mono: 0.3, mp3: 0, telephone: 0, companding: 0.25, crackle: 0, silent: 0 },
  camcorderDigital: { label: "MiniDV/HDV PCM", lowCutHz: 30, highCutHz: 16000, hiss: 0.06, hum: 0.03, wow: 0.04, flutter: 0.06, mono: 0, mp3: 0, telephone: 0, companding: 0.05, crackle: 0, silent: 0 },
  broadcast: { label: "Off-air broadcast", lowCutHz: 60, highCutHz: 13000, hiss: 0.2, hum: 0.22, wow: 0.08, flutter: 0.1, mono: 0.4, mp3: 0, telephone: 0, companding: 0.1, crackle: 0.03, silent: 0 },
  webRip: { label: "Lossy web rip", lowCutHz: 50, highCutHz: 14000, hiss: 0.05, hum: 0.02, wow: 0.03, flutter: 0.05, mono: 0.2, mp3: 0.6, telephone: 0, companding: 0, crackle: 0, silent: 0 },
  lowBitrate: { label: "Heavy compression", lowCutHz: 90, highCutHz: 11000, hiss: 0.04, hum: 0, wow: 0.02, flutter: 0.04, mono: 0.4, mp3: 0.85, telephone: 0, companding: 0, crackle: 0, silent: 0 },
  telephone: { label: "Voice call / Zoom", lowCutHz: 300, highCutHz: 3400, hiss: 0.08, hum: 0.05, wow: 0.04, flutter: 0.1, mono: 1, mp3: 0.5, telephone: 1, companding: 0.2, crackle: 0, silent: 0 },
  cctv: { label: "Surveillance / no audio", lowCutHz: 400, highCutHz: 4000, hiss: 0.3, hum: 0.3, wow: 0.05, flutter: 0.08, mono: 1, mp3: 0.2, telephone: 0.5, companding: 0.1, crackle: 0.06, silent: 0 },
  opticalFilm: { label: "Optical film soundtrack", lowCutHz: 120, highCutHz: 6500, hiss: 0.28, hum: 0.06, wow: 0.3, flutter: 0.18, mono: 1, mp3: 0, telephone: 0, companding: 0.1, crackle: 0.4, silent: 0 },
  silent: { label: "Silent (no soundtrack)", lowCutHz: 0, highCutHz: 0, hiss: 0, hum: 0, wow: 0, flutter: 0, mono: 1, mp3: 0, telephone: 0, companding: 0, crackle: 0, silent: 1 },
  modern: { label: "Modern digital", lowCutHz: 20, highCutHz: 18000, hiss: 0.02, hum: 0, wow: 0, flutter: 0, mono: 0, mp3: 0.1, telephone: 0, companding: 0, crackle: 0, silent: 0 },
};

// ---------------------------------------------------------------------------
// Base media templates. resScaleX/Y = luma resolution as a fraction of the
// output; chromaScaleX = chroma horizontal resolution fraction. system drives
// the composite colour stage. composite = dot-crawl/rainbow strength.
// ---------------------------------------------------------------------------
const BASE = {
  digitalClean: { system: "digital", resScaleX: 1, resScaleY: 1, chromaScaleX: 1, composite: 0, fps: 30, interlaced: false, aspect: "16:9", audio: "modern" },
  crt: { system: "NTSC", resScaleX: 0.78, resScaleY: 1, chromaScaleX: 0.5, composite: 0.35, fps: 30, interlaced: true, aspect: "4:3", audio: "broadcast" },
  pal: { system: "PAL", resScaleX: 0.78, resScaleY: 1, chromaScaleX: 0.45, composite: 0.3, fps: 25, interlaced: true, aspect: "4:3", audio: "broadcast" },
  vhs: { system: "NTSC", resScaleX: 0.42, resScaleY: 0.92, chromaScaleX: 0.12, composite: 0.6, fps: 30, interlaced: true, aspect: "4:3", audio: "vhs" },
  betamax: { system: "NTSC", resScaleX: 0.46, resScaleY: 0.92, chromaScaleX: 0.13, composite: 0.55, fps: 30, interlaced: true, aspect: "4:3", audio: "betamax" },
  hi8: { system: "NTSC", resScaleX: 0.52, resScaleY: 0.94, chromaScaleX: 0.16, composite: 0.45, fps: 30, interlaced: true, aspect: "4:3", audio: "hi8" },
  svhs: { system: "NTSC", resScaleX: 0.62, resScaleY: 0.96, chromaScaleX: 0.18, composite: 0.35, fps: 30, interlaced: true, aspect: "4:3", audio: "vhsHifi" },
  miniDV: { system: "digital", resScaleX: 0.72, resScaleY: 0.96, chromaScaleX: 0.4, composite: 0.12, fps: 30, interlaced: true, aspect: "4:3", audio: "camcorderDigital" },
  hdv: { system: "digital", resScaleX: 0.85, resScaleY: 0.94, chromaScaleX: 0.42, composite: 0.08, fps: 30, interlaced: true, aspect: "16:9", audio: "camcorderDigital" },
  broadcast: { system: "NTSC", resScaleX: 0.7, resScaleY: 1, chromaScaleX: 0.42, composite: 0.4, fps: 30, interlaced: true, aspect: "4:3", audio: "broadcast" },
  webLow: { system: "digital", resScaleX: 0.34, resScaleY: 0.34, chromaScaleX: 0.34, composite: 0, fps: 24, interlaced: false, aspect: "4:3", audio: "lowBitrate" },
  webMid: { system: "digital", resScaleX: 0.55, resScaleY: 0.55, chromaScaleX: 0.5, composite: 0, fps: 30, interlaced: false, aspect: "4:3", audio: "webRip" },
  dvd: { system: "digital", resScaleX: 0.75, resScaleY: 0.9, chromaScaleX: 0.5, composite: 0.05, fps: 30, interlaced: true, aspect: "4:3", audio: "webRip" },
  surveillance: { system: "digital", resScaleX: 0.36, resScaleY: 0.4, chromaScaleX: 0.3, composite: 0, fps: 12, interlaced: false, aspect: "4:3", audio: "cctv" },
  film8: { system: "film", resScaleX: 0.5, resScaleY: 0.5, chromaScaleX: 0.5, composite: 0, fps: 18, interlaced: false, aspect: "4:3", audio: "silent" },
  film16: { system: "film", resScaleX: 0.66, resScaleY: 0.66, chromaScaleX: 0.66, composite: 0, fps: 24, interlaced: false, aspect: "4:3", audio: "opticalFilm" },
  film35: { system: "film", resScaleX: 0.85, resScaleY: 0.85, chromaScaleX: 0.85, composite: 0, fps: 24, interlaced: false, aspect: "1.85:1", audio: "opticalFilm" },
  filmSilent: { system: "film", resScaleX: 0.5, resScaleY: 0.5, chromaScaleX: 0.5, composite: 0, fps: 16, interlaced: false, aspect: "4:3", audio: "silent" },
  lcd: { system: "digital", resScaleX: 1, resScaleY: 1, chromaScaleX: 1, composite: 0, fps: 60, interlaced: false, aspect: "16:9", audio: "modern" },
  oled: { system: "digital", resScaleX: 1, resScaleY: 1, chromaScaleX: 1, composite: 0, fps: 60, interlaced: false, aspect: "9:16", audio: "modern" },
  social: { system: "digital", resScaleX: 0.6, resScaleY: 0.6, chromaScaleX: 0.55, composite: 0, fps: 30, interlaced: false, aspect: "9:16", audio: "webRip" },
  smartphoneOld: { system: "digital", resScaleX: 0.4, resScaleY: 0.4, chromaScaleX: 0.4, composite: 0, fps: 24, interlaced: false, aspect: "4:3", audio: "lowBitrate" },
  modern4k: { system: "digital", resScaleX: 1, resScaleY: 1, chromaScaleX: 1, composite: 0, fps: 60, interlaced: false, aspect: "16:9", audio: "modern" },
};

// ---------------------------------------------------------------------------
// Per-preset assignment. value = [baseKey, overrides?, dossier?]
// ---------------------------------------------------------------------------
const P = {
  "True Zero (Neutral)": ["digitalClean", { resScaleX: 1, resScaleY: 1, composite: 0, audio: "clean" }, { medium: "Unprocessed source", years: "—", res: "native", artifacts: "None — pass-through reference" }],
  "Consumer TV": ["crt", {}, { medium: "Consumer NTSC CRT television", years: "1970s–1990s", res: "~480i, ~330 lines", artifacts: "Dot crawl, soft chroma, scanlines, slight bloom" }],
  "PVM/BVM": ["crt", { resScaleX: 0.92, chromaScaleX: 0.7, composite: 0.12, audio: "broadcast" }, { medium: "Pro broadcast monitor (Sony PVM/BVM)", years: "1980s–2000s", res: "480i RGB/Component, ~600 lines", artifacts: "Tight scanlines, aperture grille, minimal composite artifacts" }],
  "Late-80s Home VHS": ["vhs", {}, { medium: "Home VHS recording (SP)", years: "1985–1992", res: "~240 lines luma", artifacts: "Chroma bleed, head switching noise, tape hiss, dropouts" }],
  "90s Rental Tape (3rd Gen Dub)": ["vhs", { resScaleX: 0.36, chromaScaleX: 0.1, composite: 0.7 }, { medium: "3rd-generation VHS dub", years: "1990s", res: "~210 lines, degraded", artifacts: "Heavy generation loss, smeared chroma, tracking error" }],
  "Hi8 Vacation Cam": ["hi8", {}, { medium: "Hi8 camcorder", years: "1989–1999", res: "~400 lines luma", artifacts: "AFM hiss, mild chroma noise, exposure pumping" }],
  "MiniDV Family Cam (2002)": ["miniDV", {}, { medium: "MiniDV camcorder (DV25)", years: "1996–2006", res: "480i 4:1:1", artifacts: "Blocky chroma edges, interlacing, clean PCM audio" }],
  "Off-Air Analog Broadcast": ["broadcast", {}, { medium: "Off-air analog TV capture", years: "1960s–2009", res: "480i composite", artifacts: "RF snow, ghosting, hum bars, multipath" }],
  "Public Access Archive": ["broadcast", { audio: "vhs" }, { medium: "Public-access cable on VHS", years: "1980s–1990s", res: "~240 lines", artifacts: "Composite + tape generation loss, burned-in OSD" }],
  "Early Web Rip (2006)": ["webLow", { fps: 15 }, { medium: "Early streaming/web rip", years: "2005–2008", res: "320×240 / 240p", artifacts: "Blocking, ringing, color banding, mono lossy audio" }],
  "Security Camera Dump": ["surveillance", {}, { medium: "Analog/DVR security camera", years: "1990s–2010s", res: "CIF/4CIF, low fps", artifacts: "Low framerate, timestamp OSD, IR cast, heavy compression" }],
  "Bootleg Concert Cam": ["hi8", { resScaleX: 0.46, composite: 0.5, audio: "lowBitrate" }, { medium: "Bootleg camcorder recording", years: "1990s–2000s", res: "low, handheld", artifacts: "Auto-exposure pumping, clipped audio, shake" }],
  "Damaged Archive Recovery": ["vhs", { resScaleX: 0.34, chromaScaleX: 0.08, composite: 0.75 }, { medium: "Damaged/decayed archival tape", years: "varies", res: "severely degraded", artifacts: "Dropouts, tape crease, mold damage, severe chroma loss" }],
  "Retro Pixel LCD": ["lcd", { resScaleX: 0.45, resScaleY: 0.45, chromaScaleX: 0.45, audio: "modern" }, { medium: "Early low-res LCD panel", years: "1990s–2000s", res: "low pixel grid", artifacts: "Visible pixel grid, limited gamut, slow response" }],
  "Cyberpunk OLED": ["oled", { aspect: "16:9" }, { medium: "Modern OLED display look", years: "2018+", res: "high", artifacts: "Deep blacks, PenTile subpixels, vivid neon bloom" }],
  "Neon Sign Bloom (TikTok Style)": ["social", { resScaleX: 0.7, resScaleY: 0.7 }, { medium: "Stylized social media look", years: "2020s", res: "1080×1920", artifacts: "Heavy bloom, saturated neon, vertical crop" }],
  "Streaming Compression": ["webMid", { audio: "webRip" }, { medium: "Modern streaming re-encode", years: "2010s+", res: "720p/1080p", artifacts: "GOP blocking, deblocking smear, banding" }],
  "Digital Surveillance": ["surveillance", { resScaleX: 0.45, resScaleY: 0.5, fps: 15 }, { medium: "IP/DVR digital surveillance", years: "2010s", res: "low-mid, low fps", artifacts: "H.264 blocking, timestamp OSD, motion smear" }],
  "Silent Film 1920s": ["filmSilent", {}, { medium: "Silent-era 35mm nitrate", years: "1900s–1929", res: "soft, ~4:3", artifacts: "Heavy flicker, dust/scratches, frame jitter, no sound" }],
  "Technicolor Print 1950s": ["film35", { fps: 24, audio: "opticalFilm" }, { medium: "3-strip Technicolor print", years: "1932–1955", res: "high, saturated", artifacts: "Dye registration fringing, rich saturation, gate weave" }],
  "Super 8 Home Reel 1970s": ["film8", { fps: 18, audio: "silent" }, { medium: "Super 8mm home movie", years: "1965–1982", res: "low, grainy", artifacts: "Heavy grain, gate weave, splice flashes, no sound" }],
  "16mm Broadcast Kinescope": ["film16", {}, { medium: "16mm kinescope of TV", years: "1950s–1960s", res: "soft 4:3", artifacts: "Film-of-CRT scanline ghosting, grain, optical audio" }],
  "Nitrate Newsreel 1930s": ["filmSilent", { fps: 20, audio: "opticalFilm" }, { medium: "35mm nitrate newsreel", years: "1920s–1940s", res: "soft, high contrast", artifacts: "Decay blooms, heavy scratches, flicker" }],
  "Live NTSC Kinescope 1950s": ["film16", { system: "NTSC", composite: 0.2, audio: "opticalFilm" }, { medium: "Kinescope of live NTSC", years: "1948–1958", res: "soft, ~480 lines", artifacts: "Film grain over CRT scanlines, optical hiss" }],
  "U-matic Field Tape 1970s": ["broadcast", { resScaleX: 0.5, chromaScaleX: 0.2, composite: 0.5, audio: "broadcast" }, { medium: "3/4\" U-matic field tape", years: "1971–1985", res: "~250 lines", artifacts: "Chroma noise, head switching, ENG field look" }],
  "Betacam SP ENG 1980s": ["broadcast", { resScaleX: 0.82, chromaScaleX: 0.5, composite: 0.18, audio: "broadcast" }, { medium: "Betacam SP component tape", years: "1986–2001", res: "~340 lines component", artifacts: "Clean component color, mild noise, broadcast grade" }],
  "LaserDisc Transfer 1990s": ["crt", { resScaleX: 0.72, chromaScaleX: 0.45, composite: 0.28, audio: "broadcast" }, { medium: "LaserDisc composite transfer", years: "1978–2001", res: "~425 lines", artifacts: "Composite dot crawl, line twitter, analog noise" }],
  "DVD Rip 2001": ["dvd", {}, { medium: "DVD-Video MPEG-2 rip", years: "1997–2010", res: "480i/p", artifacts: "MPEG-2 blocking, interlacing combing, 4:2:0 chroma" }],
  "HDV Camcorder 2005": ["hdv", {}, { medium: "HDV (MPEG-2 HD) camcorder", years: "2004–2011", res: "1080i", artifacts: "GOP blocking on motion, interlacing, slight sharpening" }],
  "DSLR Video 2010": ["digitalClean", { resScaleX: 0.85, resScaleY: 0.7, chromaScaleX: 0.5, fps: 24, aspect: "16:9", audio: "modern" }, { medium: "Early DSLR video (line-skip)", years: "2008–2013", res: "1080p line-skipped", artifacts: "Moiré, aliasing, rolling shutter, jello" }],
  "Early Smartphone 2012": ["smartphoneOld", { aspect: "16:9", fps: 30 }, { medium: "Early smartphone camera", years: "2010–2014", res: "720p, noisy", artifacts: "Heavy noise reduction smear, rolling shutter, mono audio" }],
  "4K HDR Streaming 2020s": ["modern4k", {}, { medium: "4K HDR streaming", years: "2018+", res: "2160p", artifacts: "Near-pristine; faint banding in gradients" }],
  "PAL Living Room TV (1970s)": ["pal", {}, { medium: "PAL CRT television", years: "1967–1990s", res: "576i, ~330 lines", artifacts: "PAL chroma averaging, scanlines, 50Hz flicker" }],
  "Video CD Capture (1999)": ["webLow", { resScaleX: 0.45, resScaleY: 0.5, fps: 24, audio: "lowBitrate" }, { medium: "VideoCD (MPEG-1)", years: "1993–2003", res: "352×240", artifacts: "MPEG-1 blocking, low bitrate mud, mono audio" }],
  "CRT PC Monitor (1995)": ["crt", { system: "digital", resScaleX: 0.85, chromaScaleX: 0.85, composite: 0, aspect: "4:3", audio: "modern" }, { medium: "VGA CRT computer monitor", years: "1990s", res: "640–1024 RGB", artifacts: "Shadow mask, slight defocus, 60–85Hz flicker" }],
  "Cable Access Recorder (1984)": ["vhs", { composite: 0.65, audio: "vhs" }, { medium: "Cable access taped on VHS", years: "1980s", res: "~230 lines", artifacts: "Composite + VHS loss, hum bars, OSD" }],
  "Early Webcam (2008)": ["webLow", { resScaleX: 0.3, resScaleY: 0.3, fps: 15, aspect: "4:3", audio: "telephone" }, { medium: "Early USB webcam", years: "2005–2010", res: "320×240, ~15fps", artifacts: "Low light noise, smear, blocky compression" }],
  "Polaroid SX-70 Instant": ["film35", { fps: 24, resScaleX: 0.7, resScaleY: 0.7, aspect: "1:1", audio: "silent" }, { medium: "Polaroid SX-70 instant film", years: "1972+", res: "soft square", artifacts: "Warm cast, vignetting, soft focus, square frame" }],
  "Disposable Camera 35mm Flash": ["film35", { fps: 24, resScaleX: 0.7, resScaleY: 0.7, audio: "silent" }, { medium: "Disposable 35mm with flash", years: "1990s", res: "grainy 35mm", artifacts: "Harsh flash falloff, grain, lab color shift" }],
  "Aerochrome Infrared Film": ["film35", { fps: 24, audio: "silent" }, { medium: "Kodak Aerochrome IR film", years: "1960s+", res: "high", artifacts: "Foliage→magenta/red false color, grain" }],
  "Night Vision Camcorder": ["hi8", { resScaleX: 0.42, chromaScaleX: 0.05, composite: 0.4, audio: "hi8" }, { medium: "NightShot IR camcorder", years: "1990s+", res: "low, monochrome-green", artifacts: "Green IR cast, heavy noise, IR hotspots" }],
  "Police Bodycam 2016": ["digitalClean", { resScaleX: 0.6, resScaleY: 0.6, fps: 30, aspect: "16:9", audio: "lowBitrate" }, { medium: "Police body-worn camera", years: "2014+", res: "720p wide", artifacts: "Fisheye, timestamp OSD, rolling shutter, compression" }],
  "Covert Spycam Button Lens": ["surveillance", { resScaleX: 0.32, resScaleY: 0.36, fps: 20, audio: "cctv" }, { medium: "Covert pinhole/button camera", years: "2000s+", res: "very low", artifacts: "Fisheye, low light noise, blocking, distortion" }],
  "Ring Doorbell Daytime": ["digitalClean", { resScaleX: 0.55, resScaleY: 0.55, fps: 15, aspect: "16:9", audio: "telephone" }, { medium: "Smart video doorbell (day)", years: "2015+", res: "1080p wide, low fps", artifacts: "Fisheye, HDR halos, compression, OSD" }],
  "Ring Doorbell Night IR": ["surveillance", { resScaleX: 0.5, resScaleY: 0.5, fps: 15, audio: "telephone" }, { medium: "Smart doorbell (IR night)", years: "2015+", res: "1080p IR mono", artifacts: "IR monochrome, hotspot bloom, noise, OSD" }],
  "GoPro Hero3 Action Cam": ["digitalClean", { resScaleX: 0.8, resScaleY: 0.8, fps: 30, aspect: "16:9", audio: "lowBitrate" }, { medium: "GoPro Hero3 action cam", years: "2012+", res: "1080p wide FOV", artifacts: "Extreme barrel distortion, oversharpening, wind noise" }],
  "Disposable Security IR Flood": ["surveillance", { resScaleX: 0.4, resScaleY: 0.42, fps: 12, audio: "cctv" }, { medium: "IR-flood security camera", years: "2010s", res: "low, IR", artifacts: "Blown IR highlights, monochrome, heavy noise" }],
  "ATSC Broadcast Transition (2009)": ["digitalClean", { resScaleX: 0.7, resScaleY: 0.7, fps: 30, aspect: "16:9", composite: 0, audio: "webRip" }, { medium: "Early ATSC digital broadcast", years: "2009", res: "1080i/720p", artifacts: "MPEG-2 macroblocking, pixelation freezes, dropout" }],
  "Sony Trinitron WEGA (2001)": ["crt", { resScaleX: 0.88, chromaScaleX: 0.55, composite: 0.15, audio: "broadcast" }, { medium: "Sony Trinitron WEGA flat CRT", years: "1998–2006", res: "480i, aperture grille", artifacts: "Aperture grille, faint damper wires, warm glow" }],
  "Shadow Mask CRT Terminal (Amber)": ["crt", { system: "digital", resScaleX: 0.7, chromaScaleX: 0.7, composite: 0, aspect: "4:3", audio: "modern" }, { medium: "Amber monochrome CRT terminal", years: "1980s", res: "text-mode", artifacts: "Amber monochrome, phosphor persistence, scanlines" }],
  "IPS Office LCD (2013)": ["lcd", { aspect: "16:9" }, { medium: "IPS office LCD monitor", years: "2010s", res: "1080p", artifacts: "IPS glow, slight backlight bleed, RGB stripe" }],
  "OLED Smartphone PenTile (2018)": ["oled", {}, { medium: "OLED smartphone (PenTile)", years: "2016+", res: "1080×2340", artifacts: "PenTile diamond subpixels, deep blacks, vivid color" }],
  "Pioneer Plasma TV (2007)": ["lcd", { resScaleX: 0.9, resScaleY: 0.9, aspect: "16:9", audio: "modern" }, { medium: "Pioneer KURO plasma", years: "2007–2009", res: "1080p", artifacts: "Phosphor dithering, near-black detail, faint buzz" }],
  "2-inch Quadruplex Broadcast (1960s)": ["broadcast", { resScaleX: 0.6, chromaScaleX: 0.3, composite: 0.45, fps: 30, audio: "broadcast" }, { medium: "2\" Quadruplex videotape", years: "1956–1970s", res: "~480 lines", artifacts: "Banding (venetian blind), tip penetration noise" }],
  "VHS-C Camcorder (1993)": ["vhs", { resScaleX: 0.4, composite: 0.6, audio: "vhs" }, { medium: "VHS-C compact camcorder", years: "1982–2000s", res: "~240 lines", artifacts: "Tape hiss, chroma bleed, exposure pumping, OSD" }],
  "S-VHS Master Tape (1996)": ["svhs", {}, { medium: "S-VHS master tape", years: "1987–2000s", res: "~400 lines", artifacts: "Y/C separated (less dot crawl), mild noise, hi-fi audio" }],
  "RealPlayer 240p Stream (1999)": ["webLow", { resScaleX: 0.28, resScaleY: 0.3, fps: 12, audio: "telephone" }, { medium: "RealVideo streaming", years: "1997–2005", res: "176×144–320×240", artifacts: "Smeary low-bitrate blocking, posterization, low fps" }],
  "Pocket Digicam MJPEG (2004)": ["smartphoneOld", { resScaleX: 0.45, resScaleY: 0.45, fps: 15, aspect: "4:3", audio: "lowBitrate" }, { medium: "Compact digicam MJPEG clip", years: "2000s", res: "320×240/640×480", artifacts: "JPEG blocking per frame, noise, mono audio" }],
  "Blu-ray Disc Transfer (2008)": ["modern4k", { resScaleX: 0.95, resScaleY: 0.95, fps: 24, aspect: "16:9", audio: "modern" }, { medium: "Blu-ray H.264 transfer", years: "2006+", res: "1080p", artifacts: "Near-pristine, light grain retention, deep color" }],
  "Vine Reupload Compilation (2014)": ["social", { resScaleX: 0.5, resScaleY: 0.5, aspect: "1:1", audio: "lowBitrate" }, { medium: "Re-uploaded Vine compilation", years: "2013–2017", res: "480×480 recompressed", artifacts: "Multi-generation compression, blocking, watermark loss" }],
  "Vertical Livestream Story (2024)": ["social", { resScaleX: 0.7, resScaleY: 0.7, audio: "webRip" }, { medium: "Vertical mobile livestream", years: "2020s", res: "720×1280", artifacts: "Adaptive bitrate dips, blocking on motion, vertical crop" }],
  "Betamax Home Recording (1981)": ["betamax", {}, { medium: "Betamax home recording", years: "1975–1988", res: "~250 lines", artifacts: "Chroma noise, head switching, hiss, dropouts" }],
  "Video8 Handycam (1988)": ["hi8", { resScaleX: 0.46, composite: 0.5, audio: "hi8" }, { medium: "Video8 Handycam", years: "1985–1995", res: "~280 lines", artifacts: "AFM hiss, chroma noise, date OSD" }],
  "MiniDV LP Mode (Dropout-Prone)": ["miniDV", { resScaleX: 0.66, composite: 0.18, audio: "camcorderDigital" }, { medium: "MiniDV in LP mode", years: "1996–2006", res: "480i, dropout-prone", artifacts: "DV dropout mosquito blocks, frozen blocks, interlacing" }],
  "D-VHS HD Recording (2003)": ["hdv", { resScaleX: 0.9, audio: "vhsHifi" }, { medium: "D-VHS digital HD tape", years: "1998–2007", res: "1080i MPEG-2", artifacts: "Clean HD with occasional dropout glitches" }],
  "TV Tuner Card Capture (2007)": ["broadcast", { system: "digital", resScaleX: 0.55, resScaleY: 0.6, composite: 0.25, aspect: "4:3", audio: "webRip" }, { medium: "PC TV-tuner card capture", years: "2000s", res: "480i captured", artifacts: "Composite + capture noise, interlacing, dropped frames" }],
  "XviD AVI Fansub (2003)": ["webMid", { resScaleX: 0.5, resScaleY: 0.5, fps: 24, audio: "lowBitrate" }, { medium: "XviD/DivX AVI fansub", years: "2001–2008", res: "~512×384", artifacts: "Blocking, ringing, hardsub text, low bitrate" }],
  "Analog Cable Scrambled Signal": ["broadcast", { resScaleX: 0.6, composite: 0.55, audio: "broadcast" }, { medium: "Scrambled analog cable", years: "1980s–2000s", res: "480i corrupted", artifacts: "Sync suppression, color inversion bars, tearing" }],
  "Rear-Projection CRT TV (2004)": ["crt", { resScaleX: 0.6, resScaleY: 0.85, composite: 0.3, aspect: "16:9", audio: "broadcast" }, { medium: "Rear-projection CRT TV", years: "1990s–2000s", res: "soft, large", artifacts: "Soft convergence, scanline blur, hotspot falloff" }],
  "LED Billboard Phone Capture": ["social", { resScaleX: 0.45, resScaleY: 0.45, aspect: "16:9", audio: "webRip" }, { medium: "Phone capture of LED wall", years: "2015+", res: "moiré-prone", artifacts: "LED pixel moiré, refresh banding, blown highlights" }],
  "Zoom Call Recording (2020)": ["webMid", { resScaleX: 0.45, resScaleY: 0.45, fps: 24, aspect: "16:9", audio: "telephone" }, { medium: "Video call recording", years: "2020+", res: "360p–720p adaptive", artifacts: "Bitrate dips, frozen tiles, telephone-band audio" }],
  "PAL UHF Antenna (1978)": ["pal", { resScaleX: 0.62, composite: 0.5, audio: "broadcast" }, { medium: "PAL UHF off-air", years: "1970s", res: "576i weak signal", artifacts: "RF snow, ghosting, Hanover bars, 50Hz hum" }],
  "VHS Mold Damage (30yr Attic)": ["vhs", { resScaleX: 0.34, chromaScaleX: 0.07, composite: 0.72, audio: "vhs" }, { medium: "Mold-damaged attic VHS", years: "stored 30yr", res: "severely degraded", artifacts: "Dropout clusters, mold spotting, sticky-shed wobble" }],
  "Betamax Humid Garage (1983)": ["betamax", { resScaleX: 0.4, chromaScaleX: 0.09, composite: 0.62, audio: "betamax" }, { medium: "Humidity-damaged Betamax", years: "stored damp", res: "degraded", artifacts: "Hydrolysis dropouts, chroma loss, wow/flutter" }],
  "35mm Faded Cinema Print": ["film35", { audio: "opticalFilm" }, { medium: "Faded 35mm release print", years: "1970s–1980s prints", res: "high but faded", artifacts: "Cyan/magenta dye fade, red shift, scratches, grain" }],
  "8mm Kodachrome Home Movie": ["film8", { fps: 18, audio: "silent" }, { medium: "8mm Kodachrome home movie", years: "1950s–1970s", res: "low, rich color", artifacts: "Saturated Kodachrome palette, grain, gate weave, no sound" }],
  "YouTube 2007 Re-encode": ["webLow", { resScaleX: 0.36, resScaleY: 0.36, fps: 24, audio: "lowBitrate" }, { medium: "Early YouTube re-encode", years: "2005–2009", res: "320×240 H.263", artifacts: "Heavy blocking, color banding, mono lossy audio" }],
  "MPEG-2 Satellite Glitch": ["digitalClean", { resScaleX: 0.7, resScaleY: 0.7, composite: 0, aspect: "16:9", audio: "webRip" }, { medium: "Digital satellite (DVB) glitch", years: "2000s+", res: "480i/1080i", artifacts: "Macroblock corruption, frozen/garbled blocks, audio cut" }],
  "iPhone 3G Vertical Video": ["smartphoneOld", { resScaleX: 0.35, resScaleY: 0.35, fps: 15, aspect: "9:16", audio: "lowBitrate" }, { medium: "iPhone 3G video", years: "2008–2010", res: "VGA 15fps", artifacts: "Low fps judder, noise, rolling shutter, vertical crop" }],
  "Instagram Live 2024": ["social", { resScaleX: 0.6, resScaleY: 0.6, audio: "webRip" }, { medium: "Instagram Live capture", years: "2020s", res: "720×1280 adaptive", artifacts: "Bitrate dips, UI overlay safe-area, blocking" }],
  "CRT Plasma Burn-In": ["lcd", { resScaleX: 0.85, resScaleY: 0.85, aspect: "16:9", audio: "modern" }, { medium: "Plasma with burn-in", years: "2000s", res: "1080p", artifacts: "Ghost image retention, phosphor dithering" }],
  "PenTile OLED Sunlight": ["oled", { aspect: "9:16" }, { medium: "OLED viewed in sunlight", years: "2016+", res: "high", artifacts: "PenTile, washed blacks, reflection glare" }],
  "Trinitron Warm Glow": ["crt", { resScaleX: 0.85, chromaScaleX: 0.55, composite: 0.18, audio: "broadcast" }, { medium: "Trinitron warm-glow look", years: "1990s–2000s", res: "480i", artifacts: "Aperture grille, warm whites, soft bloom" }],
  "Drone Footage Jello": ["digitalClean", { resScaleX: 0.85, resScaleY: 0.85, fps: 30, aspect: "16:9", audio: "modern" }, { medium: "Consumer drone footage", years: "2015+", res: "1080p/4K", artifacts: "Rolling-shutter jello, prop wobble, sharpening, wind" }],
  "Restored Archive Master": ["modern4k", { resScaleX: 0.92, resScaleY: 0.92, fps: 24, aspect: "4:3", audio: "modern" }, { medium: "Restored archival master", years: "restoration", res: "high, clean", artifacts: "Faint residual grain, gentle stabilization, clean color" }],
  "4th Gen VHS Bootleg": ["vhs", { resScaleX: 0.32, chromaScaleX: 0.06, composite: 0.75, audio: "vhs" }, { medium: "4th-generation VHS bootleg", years: "1990s", res: "heavily degraded", artifacts: "Compounded generation loss, smeared chroma, tracking" }],
  "TikTok Screen Record Repost": ["social", { resScaleX: 0.5, resScaleY: 0.5, audio: "lowBitrate" }, { medium: "Screen-recorded TikTok repost", years: "2020s", res: "720×1280 recompressed", artifacts: "Double compression, UI bars, watermark, banding" }],
};

const CATEGORY_FALLBACK = {
  "CRT / Monitor": "crt",
  "VHS / Tape": "vhs",
  "Camcorder": "hi8",
  "Broadcast": "broadcast",
  "Digital": "webMid",
  "Social / Mobile": "social",
  "Surveillance": "surveillance",
  "Film": "film16",
  "Display": "lcd",
  "Stylized": "digitalClean",
  "V2: Advanced": "vhs",
};

const ASPECT_RATIOS = {
  "4:3": 4 / 3, "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1, "1.85:1": 1.85, "2.39:1": 2.39,
};

/** Resolve the full format profile for a preset name (+ optional category). */
export function getFormatProfile(presetName, category) {
  const entry = P[presetName];
  let base, overrides, dossier;
  if (entry) {
    base = BASE[entry[0]] || BASE.digitalClean;
    overrides = entry[1] || {};
    dossier = entry[2] || null;
  } else {
    base = BASE[CATEGORY_FALLBACK[category]] || BASE.digitalClean;
    overrides = {};
    dossier = null;
  }
  const merged = { ...base, ...overrides };
  const audio = AUDIO_PROFILES[merged.audio] || AUDIO_PROFILES.clean;
  return {
    name: presetName || "Custom",
    system: merged.system,
    resScaleX: clamp01(merged.resScaleX),
    resScaleY: clamp01(merged.resScaleY),
    chromaScaleX: clamp01(merged.chromaScaleX),
    composite: clamp01(merged.composite),
    fps: merged.fps,
    interlaced: !!merged.interlaced,
    aspect: merged.aspect,
    aspectRatio: ASPECT_RATIOS[merged.aspect] || 4 / 3,
    audioKey: merged.audio,
    audio,
    dossier: dossier || {
      medium: presetName || "Custom look",
      years: "—",
      res: "—",
      artifacts: "Custom effect stack",
    },
  };
}

/** Compact badge string, e.g. "NTSC · 480i · 4:3 · ~240 lines". */
export function getFormatBadge(profile) {
  if (!profile) return "";
  const sys = profile.system === "digital" ? "Digital" : profile.system === "film" ? "Film" : profile.system;
  const scan = profile.system === "film" ? `${profile.fps}p` : profile.interlaced ? "interlaced" : `${profile.fps}p`;
  return `${sys} · ${scan} · ${profile.aspect}`;
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(1, n));
}

export { ASPECT_RATIOS };
