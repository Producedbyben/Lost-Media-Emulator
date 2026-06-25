import { useState, useCallback } from "react";

const FAV_KEY = "lme-favorite-presets";
const RECENT_KEY = "lme-recent-presets";
const MAX_RECENT = 10;

export function usePresetFavorites() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
  });

  const [recentlyUsed, setRecentlyUsed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
  });

  const toggleFavorite = useCallback((name: string) => {
    setFavorites(prev => {
      const next = prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
      localStorage.setItem(FAV_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addRecent = useCallback((name: string) => {
    setRecentlyUsed(prev => {
      const next = [name, ...prev.filter(n => n !== name)].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback((name: string) => favorites.includes(name), [favorites]);

  return { favorites, recentlyUsed, toggleFavorite, addRecent, isFavorite };
}
