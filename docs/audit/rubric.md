# Lost Media Emulator — Authenticity Rubric

**Version:** 1.0  
**Audience:** Human auditors scoring presets and individual effects against real degraded-medium references.

---

## Hard Rule

**No score may be assigned without a `referenceRef`.** Every scorecard MUST supply at least one cleared reference (a `ReferenceEntry` in the reference library with a valid `id`, `source`, `license`, and `demonstrates` field). Scores based on intuition or general knowledge alone are invalid and will fail `validateScorecard`. If no cleared reference exists yet, source one before scoring — do not estimate.

---

## Scoring Scale (1–5)

| Score | Label | Definition |
|-------|-------|------------|
| **1** | Wrong / Generic | The artifact does not match the medium at all, or the rendering is a generic digital filter with no physical basis. A forensic viewer would immediately identify it as fake. Example: film grain modelled as uniform white noise with no density-dependence; a "VHS" preset that is just a hue shift and scanlines. |
| **2** | Recognisable but Wrong | The broad category is correct (there is some kind of noise/distortion resembling the medium) but key physical properties are wrong in a way a practitioner would notice: wrong spatial character, wrong frequency distribution, wrong edge behaviour, wrong scale. |
| **3** | Plausible but Off | Reads as the intended medium at a casual glance. A knowledgeable viewer would say "it's close but something is off" — one or two physical parameters are incorrect or the artifact is placed/shaped wrong, but the overall impression is believable. |
| **4** | Accurate with Minor Deviations | Almost indistinguishable from reference except for one small, difficult-to-spot deviation (e.g. halation glow is correct colour but slightly too wide; head-switching band is at the right position but a pixel or two too tall). A careful A/B with the reference is needed to spot the difference. |
| **5** | Indistinguishable from Reference | Side-by-side against the cleared reference, no practically visible difference. The artifact reproduces the physical process faithfully at the output resolution being tested. |

Scores must be integers 1–5. Half-points are not valid.

---

## Rubric Criteria Axes

### 1. `physicalPlausibility`

This axis asks whether the rendered artifact is consistent with the underlying physics or chemistry of the medium. Evidence that **raises** the score: the artifact's spatial frequency, directionality, density, and colour characteristics match what the medium's physical process produces (e.g. film grain clumping in the midtones where silver halide crystals are densest; head-switching noise appearing exclusively at the very bottom of a VHS frame because that is where the video head changes during vertical blanking). Evidence that **lowers** the score: artifacts that are physically impossible for the medium (e.g. chroma bleed that is perfectly symmetric when the real NTSC subcarrier decay is asymmetric; grain that is evenly distributed regardless of exposure rather than increasing in shadow and mid-shadow; scanline gaps that are thicker at the centre than the edges of the phosphor strip). Any artifact that is clearly implemented as a generic image-processing filter with no physical anchor scores 1.

### 2. `parameterBehaviour`

This axis asks whether moving a slider from its minimum to its maximum reproduces the continuum of states the real medium would exhibit at different levels of degradation. Evidence that **raises** the score: the slider's low end maps to a pristine or lightly worn version of the medium and the high end maps to a severely degraded version, with a believable monotonic progression (e.g. increasing `trackingError` should widen the noise band and push it higher up the frame, not just increase brightness of a fixed band; increasing `wowFlutterSlow` should increase pitch deviation and timing displacement proportionally). Evidence that **lowers** the score: the effect threshold is bunched at one end with no visible change across most of the range; the visual character changes discontinuously (clicks or jumps at arbitrary values); the slider produces an effect that goes backward or wraps in a physically nonsensical way. Auditors must sweep the full range against reference footage showing the real medium at equivalent levels.

### 3. `artifactCorrectness`

This axis asks whether the specific shape, placement, orientation, and timing of the rendered artifact match the real artifact — not just whether "there is some distortion." Evidence that **raises** the score: the artifact is geometrically faithful (e.g. a VHS head-switching glitch appears as a torn band of horizontal noise at the very bottom few scanlines, not at a random position; chroma delay shifts hue to the right of luminance edges because the NTSC chroma subcarrier lags behind luma in a composite signal; film halation glows warm red rather than white because the base fog scatter is dominated by red wavelengths). Evidence that **lowers** the score: the artifact is at the wrong spatial position (e.g. head-switching noise in the middle of the frame); the wrong colour (e.g. neutral-grey halation); the wrong shape (e.g. circular chroma bleed instead of horizontal); or absent spatial structure (e.g. tape dropouts that are just brightness dips rather than the correct white-then-black horizontal streak caused by head-to-tape contact loss).

### 4. `defaults`

This axis asks whether the factory default value is immediately credible for the medium the preset or effect claims to represent, without any user adjustment. Evidence that **raises** the score: the default produces a look that a practitioner would recognise as plausibly from that era and format out of the box (e.g. a VHS preset's head-switching at a low but visible amount; film grain at a size appropriate to the claimed format — finer for 35mm, chunkier for 16mm or Super 8; NTSC chroma bleed just visible on saturated edges as it would appear on a modest consumer deck). Evidence that **lowers** the score: the default is set to zero (invisible), is set so high that the artifact is a caricature, or targets a different era than the effect's label claims (e.g. a "VHS 1982" preset defaulting to heavy macroblocking, a codec artifact that did not exist in VHS). Auditors should compare the raw default output against a reference sample of real media from the labelled year and format before touching any control.

### 5. `eraFit`

This axis asks whether the combination of artifacts plausibly co-occurs in media from the claimed era and medium. Evidence that **raises** the score: every enabled effect is physically possible for the claimed medium in the claimed year (e.g. a 1988 home VHS dub has head-switching, luma/chroma noise, wow/flutter, and horizontal chroma bleed, but not macroblocking, packet-loss bursts, or rolling-shutter jello, none of which existed in consumer VHS). Evidence that **lowers** the score: anachronistic artifacts (digital codec blocking on a film preset; rolling shutter on a CRT broadcast preset); missing signature artifacts of the era (a 1990s VHS preset with no head-switching band is immediately suspect); or artifacts scaled to an intensity that was only achievable by a later generation of equipment. Auditors should cross-reference a technology timeline to confirm each active effect could co-exist in a real sample from that era.

---

## Per-Category Reference Checks

The categories below correspond to the effect panel families in the application. For each category, auditors must identify a specific real-world artifact and verify the implementation against it.

---

### Color & Grade : Primary Grade

**Real-world artifact to check:** Exposure and white-balance drift on original camera original (OCO) tape versus a broadcast dub. Real consumer camcorder footage from the 1980s–90s shows lifted blacks (raised pedestal), compressed highlights, and a slight warm cast from tungsten-balanced stock under mixed lighting. The auto-exposure system causes brief exposure hunting on bright cuts. **What to verify:** `imageBrightness` at 0.9 should approximate the contrast range of a copied VHS, not a digital file; `highlightRollOff` should produce a curved shoulder (not a hard clip) matching the way a CRT-era camera handled overexposure; `imageGamma` at 0.85 should lift midtones the way a consumer tube TV's gamma curve boosted shadow detail. Grade the effect against a cleared reference clip of original camcorder footage, not a modern digital master.

---

### Color & Grade : Colour Signal

**Real-world artifact to check:** NTSC composite colour signal degradation — specifically, the horizontal chroma smear visible on saturated edges (e.g. a red title card on black) and the colour phase error ("Never Twice the Same Color") that produces subtly wrong hue on skin tones when the subcarrier is not properly locked. Real VHS chroma bleed is directional (horizontal only) and extends further on highly saturated colours. The chroma delay is approximately 80–200 ns, placing the colour channel visibly to the right of the luma edge. **What to verify:** `chromaBleedHorizontal` must produce a unidirectional soft smear to the right; `chromaPhaseError` must rotate hues in the NTSC subcarrier rotation direction (not a random tint); `lumaNoise` should add high-frequency noise that changes frame-to-frame (not a static pattern); `blackLevelCrush` should lift shadows to the milky-grey characteristic of a poorly set-up consumer deck.

---

### Display & CRT : Optics

**Real-world artifact to check:** The shadow mask (or aperture grille) of a consumer Trinitron or slotted-mask CRT at standard viewing distance. On a real 13–20 inch consumer TV of the 1980s–90s, individual phosphor triads are visible at close range but merge at 1m. Scanline gaps are horizontal dark bands between every other row of phosphors; they are narrower in the centre of the screen and widen slightly toward the edges due to beam geometry. Barrel distortion is present but mild (under 3% on a typical consumer set) and is worst at the corners. **What to verify:** `scanlineStrength` at moderate value should produce gaps that are dark but not black (real phosphor stripes transmit ~10–15% ambient light in the gap); `barrelDistortion` at 0.15–0.2 should match the geometry of a typical 14-inch consumer TV rather than an extreme fish-eye; `phosphorPersistence` must leave a trailing glow only on bright areas (the persistence is luminance-dependent, not applied uniformly); `bloom` should affect only highlights above roughly 70% luminance, not the whole frame.

---

### Tape & Dropouts : Video Artifacts

**Real-world artifact to check:** VHS head-switching noise and tape dropouts from a third-generation dub. The head-switching glitch is the single most recognisable VHS tell: a torn, noisy horizontal band 6–10 scanlines tall at the very bottom of the picture, caused by the video head changing during the vertical blanking interval that overruns into the active picture area. Tape dropouts appear as brief horizontal white-then-dark streaks, typically 1–4 scanlines tall and 20–80 pixels wide, caused by physical loss of magnetic contact between the tape oxide and the head. **What to verify:** `advancedHeadSwitching` must produce the noise band only at the bottom of the frame (not centre or top); the band's vertical extent should match a real head-switch (approximately 6–12 scanlines); `advancedDropouts` must produce correctly shaped horizontal streaks with the bright leading edge followed by a dark trailing edge (the correct polarity is caused by the head reading no signal, not a signal inversion); `advancedChromaDelay` must shift colour right of luma edges, not left.

---

### Tape & Dropouts : Temporal Instability

**Real-world artifact to check:** Wow and flutter from a worn VHS transport and timebase error from a consumer-grade TBC (or lack thereof). Real wow produces slow pitch and timing modulation at 0.5–3 Hz; flutter is faster at 10–30 Hz. The combined effect causes horizontal wander at the top of the frame (the last area to stabilise after vertical sync) and a periodic brightness pulse from the AGC circuit reacting to the changing tape speed. Auto-exposure hunting appears as a frame-by-frame brightness ramp over 0.5–2 seconds, common on footage shot with a moving bright source. **What to verify:** `wowFlutterSlow` should produce the characteristic slow breathing wander with the largest displacement at the top few scanlines of the frame (real timebase error is worst at top-of-field); `autoExposureHunt` must produce a slow multi-frame ramp, not a per-frame flicker (the AGC time constant is hundreds of milliseconds); `jitterRandomness` at its maximum should produce chaotic, uncorrelated frame-to-frame shifts rather than a regular oscillation; `flickerFrequencyHz` around 50–60 Hz should replicate hum bar interference from a poorly filtered AC power supply, not a random flicker.

---

### Tape & Dropouts : Tape Mechanics

**Real-world artifact to check:** Tracking error and skew distortion on a worn or misaligned VHS tape played on a different deck. A tracking error produces horizontal noise bands (1–10 scanlines of high-frequency noise) rolling slowly upward through the frame at the rate of the misalignment. Skew distortion leans the top of the image left or right because tape tension is insufficient to hold the tape against the drum at the start of each frame. Chroma noise streaking appears as coloured horizontal smears (not short specks) when the chroma FM carrier is contaminated by cross-talk from adjacent tape tracks. **What to verify:** `trackingError` bands must roll (move vertically over multiple frames) and their density should increase with control value; the bands must be horizontal noise streaks, not random pixels; `tapeSkew` must lean the top portion of the image only (the effect dissipates by mid-frame as the tape tensions normalises); `chromaNoiseStreaking` must produce horizontal colour smears not vertical, and their colour should be random per-streak rather than a uniform tint; `headClogEvents` must produce brief complete blanking (white or dark field) rather than noise, consistent with a head that has lost all contact.

---

### Film : Grain & Gate

**Real-world artifact to check:** Photochemical grain from 16mm reversal film (e.g. Kodak Ektachrome 160T or Kodachrome 40) and gate weave from a worn film projector or camera gate. Real photochemical grain is NOT uniform: it is finest in the highlights (where the silver halide is fully exposed and the large clumps average out), coarsest and most visible in the shadow-to-midtone transition zone (approximately 25–45% luminance), and invisible in deep black (where no silver is present). Grain also has a slight colour correlation — real grain on colour film has pink/green/cyan bias per grain clump, not pure luminance speckle. Gate weave is a slow, random horizontal drift (occasionally vertical) at ±0.5–2 pixel amplitude at film-standard resolution, distinct from the jitter caused by a sprocket hole damage. Film halation is a warm red-orange glow (baked in at the film base) appearing only around highlights above roughly 85% luminance; it is not a neutral bloom. **What to verify:** `advancedFilmGrain` grain density must be visibly higher in the midtones than in highlights or deep blacks; `grainChromaticity` above 0 should introduce colour speckle consistent with dye-layer separation, not random RGB noise; `advancedFilmGateWeave` drift must be sub-pixel and slow (not the sharp every-frame jitter of a machine error); `advancedFilmHalation` must be warm (orange/red) and restricted to highlights, not applied as a general softening glow over the whole image.

---

### Digital & Compression : Digital Noise

**Real-world artifact to check:** H.264/MPEG-2 macroblocking and mosquito noise on a low-bitrate streaming encode of a dark, fast-moving scene — the most common compression failure on 2000s–2010s internet video and early HD broadcast. Real H.264 macroblocking is constrained to 8×8 and 16×16 DCT block boundaries; blocks appear most prominently in dark areas (where quantisation error is less masked) and on fast horizontal motion (where the codec runs out of bits predicting from the previous frame). Mosquito noise appears as high-frequency ringing along high-contrast edges (text, window frames) immediately adjacent to the main edge, with its spatial frequency inversely proportional to the block size. **What to verify:** `advancedMacroBlocking` blocks must align to an 8×8 or 16×16 grid, not be random; they must be most visible in shadow areas of the frame; at higher control values the blocks should appear in mid-tone areas too; `ringingStrength` artifacts must appear adjacent to sharp edges (not uniformly over the image); `datamoshBloom` must produce a genuine P-frame smear (textures from the previous keyframe bleeding into a new composition) rather than a generic motion blur; `gopLength` at high values should make errors persist over multiple frames before a keyframe resets the block structure.

---

### Sensor & Lens

**Real-world artifact to check:** Rolling shutter "jello" from an early CMOS smartphone or mirrorless camera (e.g. iPhone 3GS or Canon 5D Mk II) during a fast horizontal pan, and fixed-pattern noise on an uncooled CCD sensor in a low-light security or surveillance camera. Real rolling shutter skew is proportional to pan speed and inversely proportional to frame readout time; on a phone sensor it produces a lean (not a uniform smear) in which vertical lines become diagonal during a fast pan, and rotating objects appear as arcs. Fixed-pattern noise is spatially static (does not change frame to frame), with a column-parallel or row-parallel banding character dictated by the CCD readout circuit; it is distinct from temporal random noise. Hot pixels are single-pixel or 2×2-pixel clusters that remain lit (typically red, white, or blue) across all frames, not moving or flickering. **What to verify:** `rollingShutterSkew` must lean the image content as a shear distortion (verticals become diagonals), not as a global horizontal shift; the amount of skew must scale with image content speed rather than being a constant offset; `fixedPatternNoise` must produce a pattern that is identical across consecutive frames (zero frame-to-frame variation); `hotPixels` must be spatially fixed across the duration of the clip, not animated or randomly repositioned.

---

### Media Aging

**Real-world artifact to check:** A VHS tape stored for 20–30 years in sub-optimal conditions (garage, high humidity, temperature cycling) versus one stored archivally (cool, dry, dark). The aged tape shows progressive oxide shedding (increased dropout frequency and longer dropout duration), binder degradation (sticky-shed syndrome producing slow transport speed and head clogging), colour fade biased toward magenta loss (leaving a green/cyan cast in darker areas), and reduced video SNR (increased luma and chroma noise). Each additional copy generation adds approximately 1–2 dB of luma SNR loss and approximately 3 dB of chroma SNR loss, which compounds non-linearly: a fifth-generation copy has severe colour desaturation, heavy dropout activity, and visible noise floor rather than a linear extrapolation from a first-generation copy. **What to verify:** `mediaAgeYears` at 30 years with `storageCondition` set to "humid" should produce visibly increased dropout frequency AND increased noise floor (both must appear, not just one); `copyGenerationCount` at 4–5 should produce obvious colour desaturation and noise that is substantially worse than generation 1–2 (the degradation must compound, not scale linearly); `restorationPassLevel` at its maximum should reduce noise and dropout visibility but should NOT restore colour saturation to pristine levels — real restoration reduces surface noise but cannot recover lost chroma from binder degradation.

---

## Severity Definitions

Severity describes how visible the inaccuracy is in a normal export at the project's intended output resolution and codec. It is assigned based on how a viewer watching the exported file (not the real-time preview) would perceive the error.

| Severity | Definition |
|----------|------------|
| **none** | The inaccuracy is only detectable by frame-by-frame comparison to a reference at high zoom. In a standard playback, no viewer would notice the difference. No fix required before shipping. |
| **low** | Visible on close inspection during playback, or detectable by a practitioner during a casual viewing, but a general audience would not notice it or would attribute it to natural variation in the medium. Fix in a future maintenance pass. |
| **med** | Clearly noticeable during normal playback to anyone familiar with the medium; the artifact "reads wrong" even without a direct comparison. Undermines the preset's credibility as an authentic representation. Fix before the next minor release. |
| **high** | Immediately obvious to any viewer, regardless of familiarity with the medium — breaks the illusion entirely or misrepresents the medium to a harmful degree (e.g. a "1985 VHS" look that produces digital codec blocking). Fix before this preset or effect ships. |

Severity is separate from score: a score of 3 (plausible but off) may carry a severity of **low** if the inaccuracy is subtle, or **high** if it is a prominent wrong-era artifact. Auditors must assign both independently.
