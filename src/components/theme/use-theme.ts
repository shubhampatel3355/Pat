"use client";

import { useSyncExternalStore } from "react";
import { isTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

const listeners = new Set<() => void>();
const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)");

/** The theme in effect: the saved choice on <html data-theme>, otherwise the system's. */
function current(): Theme {
  const saved = document.documentElement.dataset.theme;
  if (isTheme(saved)) return saved;
  return systemDark().matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const media = systemDark();
  media.addEventListener("change", onChange);
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onChange);
  };
}

/** Applies a theme everywhere at once and remembers it for a year (read by the server on the next page load). */
export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax${secure}`;
  listeners.forEach((listener) => listener());
}

/**
 * The single source of truth for the active theme. `serverTheme` is what the server rendered (the saved choice,
 * or null when it follows the system) and is only used for the first render.
 */
export function useTheme(serverTheme: Theme | null = null): Theme {
  return useSyncExternalStore(subscribe, current, () => serverTheme ?? "light");
}
