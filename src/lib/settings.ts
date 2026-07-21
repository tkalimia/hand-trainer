import type { Settings } from "./types";

const KEY = "ht.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  dailyNewGoal: 10,
  dailyReviewGoal: 40,
  quickBatch: 7,
  examCount: 20,
  desiredRetention: 0.9,
  remindersEnabled: false,
  source: "bundled",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function applyTheme(theme: Settings["theme"]) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}
