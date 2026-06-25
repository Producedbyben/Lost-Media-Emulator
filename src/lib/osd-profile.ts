/** Auto-generate OSD profile from a preset name */
export interface OSDProfile {
  startDateTime: string;
  fontPreset: string;
  style: number;
  primaryColor: string;
  accentColor: string;
  countWithExport: boolean;
}

export function generateOSDProfile(name: string, preset: Record<string, any>): OSDProfile {
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
  const startDateTime = `${eraYear}-06-15T19:24:00`;

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

  return {
    startDateTime,
    fontPreset,
    style,
    primaryColor,
    accentColor,
    countWithExport: true,
  };
}
