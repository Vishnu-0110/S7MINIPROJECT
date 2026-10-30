import { create } from "zustand";

const storageKey = "bit-smartfleet-theme";
const preference = () => localStorage.getItem(storageKey) || "system";
const resolvedTheme = (value) => value === "system"
  ? (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  : value;

function applyTheme(value) {
  const resolved = resolvedTheme(value);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export const useThemeStore = create((set, get) => ({
  preference: typeof window === "undefined" ? "system" : preference(),
  resolved: typeof window === "undefined" ? "light" : resolvedTheme(preference()),
  setPreference: (value) => {
    localStorage.setItem(storageKey, value);
    set({ preference: value, resolved: applyTheme(value) });
  },
  initialize: () => {
    const value = get().preference;
    set({ resolved: applyTheme(value) });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (get().preference === "system") set({ resolved: applyTheme("system") });
    };
    media?.addEventListener?.("change", onChange);
    return () => media?.removeEventListener?.("change", onChange);
  }
}));
