import { THEMES, type ThemeName, type DensityMode } from "@/hooks/useTheme";

interface ThemeSelectorProps {
  theme: ThemeName;
  density: DensityMode;
  onThemeChange: (theme: ThemeName) => void;
  onDensityChange: (density: DensityMode) => void;
}

const ThemeSelector = ({ theme, density, onThemeChange, onDensityChange }: ThemeSelectorProps) => {
  return (
    <div className="space-y-2">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Interface theme</span>
        <select
          value={theme}
          onChange={(e) => onThemeChange(e.target.value as ThemeName)}
          className="px-2.5 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </label>
      <div className="flex gap-1">
        {(["comfortable", "compact"] as DensityMode[]).map((d) => (
          <button
            key={d}
            onClick={() => onDensityChange(d)}
            className={`flex-1 px-2 py-1 text-[12px] rounded border transition-colors capitalize ${
              density === d
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeSelector;
