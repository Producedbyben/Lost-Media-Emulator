/** Auto-generate OSD profile from a preset name */
export interface OSDProfile {
  startDateTime: string;
  fontPreset: string;
  style: number;
  primaryColor: string;
  accentColor: string;
  countWithExport: boolean;
  cornerConfig: {
    topLeft: { enabled: boolean; text: string };
    topRight: { enabled: boolean; text: string };
  };
}

// PE's osd-era-map.md (engine-grounded) — explicit datestamp for the 15 yearless OSD looks
// (advancedTimestampOSD > 0, no 4-digit year in the name). Without this they fall back to
// renderOSD()'s hardcoded 1998-10-31 — era-wrong for the 2010s devices (e.g. a 2019 Ring
// stamping 1998). Year-named looks keep using the name-derived era below.
const OSD_DATETIME_BY_LOOK: Record<string, string> = {
  "Security Camera Dump": "2006-02-18T03:14:00",
  "Digital Surveillance": "2016-04-09T02:47:00",
  "Night Vision Camcorder": "1999-12-31T23:12:00",
  "Covert Spycam Button Lens": "2009-06-15T17:22:00",
  "Ring Doorbell Daytime": "2019-05-21T14:05:00",
  "Ring Doorbell Night IR": "2019-11-03T23:41:00",
  "GoPro Hero3 Action Cam": "2013-07-19T10:30:00",
  "Disposable Security IR Flood": "2017-08-27T01:53:00",
  "Late-80s Home VHS": "1989-07-15T14:32:00",
  "90s Rental Tape (3rd Gen Dub)": "1994-11-20T20:15:00",
  "Hi8 Vacation Cam": "1993-08-06T11:48:00",
  "Public Access Archive": "1991-03-12T21:05:00",
  "Bootleg Concert Cam": "1998-09-22T21:30:00",
  "Damaged Archive Recovery": "1984-05-04T13:00:00",
  "MiniDV LP Mode (Dropout-Prone)": "2001-10-14T16:20:00",
};

// PE's osd-era-map.md — explicit corner-label text so renderOSD() never falls back to the garbled
// "CAM2"/"CTFID CHANNEL3" default. "" = the real device burns no channel/ID (date/time only).
// Includes the 3 year-named looks the FIX-LIST flagged for the same garble. Any OSD look NOT in
// this map gets an empty label (DEFAULT RULE) — never the garbled fallback.
const OSD_LABEL_BY_LOOK: Record<string, string> = {
  "Security Camera Dump": "CAM 01",
  "Digital Surveillance": "CAM 04",
  "Disposable Security IR Flood": "CAM 02",
  "Night Vision Camcorder": "NIGHTSHOT",
  "Ring Doorbell Daytime": "FRONT DOOR",
  "Ring Doorbell Night IR": "FRONT DOOR",
  "Public Access Archive": "CH 03",
  "MiniDV LP Mode (Dropout-Prone)": "LP",
  "Cable Access Recorder (1984)": "CH 03",
  "Covert Spycam Button Lens": "",
  "GoPro Hero3 Action Cam": "",
  "Late-80s Home VHS": "",
  "90s Rental Tape (3rd Gen Dub)": "",
  "Hi8 Vacation Cam": "",
  "Bootleg Concert Cam": "",
  "Damaged Archive Recovery": "",
  "Betamax Home Recording (1981)": "",
  "Betacam SP ENG 1980s": "",
};

export function generateOSDProfile(name: string, preset: Record<string, unknown>): OSDProfile {
  const lower = name.toLowerCase();

  // Detect era year from name
  const yearMatch = name.match(/(19|20)\d{2}/);
  const eraYear = yearMatch ? Number(yearMatch[0]) : (
    /late-80s|1980s/.test(lower) ? 1988 :
    /90s/.test(lower) ? 1996 :
    /200[0-9]/.test(lower) ? 2004 :
    /201[0-9]|2020s/.test(lower) ? 2016 :
    1998
  );
  // Per-look engine-grounded date wins; otherwise the name-derived era (year-named looks unchanged).
  const startDateTime = OSD_DATETIME_BY_LOOK[name] ?? `${eraYear}-06-15T19:24:00`;

  // Font preset
  let fontPreset = "vhs";
  if (/security|surveillance|cctv/.test(lower)) fontPreset = "cctv";
  else if (/camcorder|minidv|hdv|hi8/.test(lower)) fontPreset = "camcorder";
  else if (/smartphone|dslr/.test(lower)) fontPreset = "modern";
  else if (/dvd|digital|stream|web|broadcast/.test(lower)) fontPreset = "broadcast";
  else if (/vhs|tape|archive|bootleg|rental|damaged/.test(lower)) fontPreset = "vhs";

  // OSD style
  let style = Math.max(0, Math.min(9, Math.round(Number(preset.advancedOSDStyle) || 0)));
  if (/security|surveillance|cctv/.test(lower)) style = 8;
  else if (/police|body ?cam|dash ?cam|evidence/.test(lower)) style = 6;
  else if (/broadcast|eng|atsc|off-air|public access/.test(lower)) style = 7;
  else if (/film|super 8|16mm|nitrate|kinescope/.test(lower)) style = 5;
  else if (/digital still|digicam|minidv|hdv|camcorder|smartphone|dslr/.test(lower)) style = Math.max(style, 4);
  else if (/digital|web|dvd|stream/.test(lower)) style = Math.max(style, 1);
  else if (/rental|dub|archive|damaged/.test(lower)) style = Math.max(style, 2);

  // Colors
  const isSecurity = /security|surveillance/.test(lower);
  const primaryColor = isSecurity ? "#d7ffd0" : "#ffa84a";
  const accentColor = isSecurity ? "#6cff8a" : "#ff3a3a";

  // Corner labels: explicit per-look text (PE's map); empty/unlisted ⇒ no ID corner. top-right is
  // always disabled so the "CTFID CHANNEL3" fallback never renders.
  const label = OSD_LABEL_BY_LOOK[name];
  const hasLabel = typeof label === "string" && label.length > 0;
  const cornerConfig = {
    topLeft: { enabled: hasLabel, text: hasLabel ? label : "" },
    topRight: { enabled: false, text: "" },
  };

  return {
    startDateTime,
    fontPreset,
    style,
    primaryColor,
    accentColor,
    countWithExport: true,
    cornerConfig,
  };
}
