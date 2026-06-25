import { useState, useEffect, useCallback } from "react";

export type ThemeName = "midnight" | "graphite" | "classic" | "dusk" | "forest" | "amber" | "daylight" | "paper";
export type DensityMode = "comfortable" | "compact";

const THEMES: { value: ThemeName; label: string }[] = [
  { value: "midnight", label: "Midnight" },
  { value: "graphite", label: "Graphite" },
  { value: "classic", label: "Classic" },
  { value: "dusk", label: "Dusk" },
  { value: "forest", label: "Forest" },
  { value: "amber", label: "Amber" },
  { value: "daylight", label: "Daylight" },
  { value: "paper", label: "Paper" },
];

export { THEMES };

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    return (localStorage.getItem("lme-theme") as ThemeName) || "midnight";
  });
  const [density, setDensityState] = useState<DensityMode>(() => {
    return (localStorage.getItem("lme-density") as DensityMode) || "comfortable";
  });

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("lme-theme", theme);
    // Toggle light/dark class for Tailwind
    const isLight = theme === "daylight" || theme === "paper";
    document.documentElement.classList.toggle("light", isLight);
    document.documentElement.classList.toggle("dark", !isLight);
  }, [theme]);

  useEffect(() => {
    document.body.setAttribute("data-density", density);
    localStorage.setItem("lme-density", density);
  }, [density]);

  const setTheme = useCallback((t: ThemeName) => setThemeState(t), []);
  const setDensity = useCallback((d: DensityMode) => setDensityState(d), []);

  return { theme, setTheme, density, setDensity };
}
