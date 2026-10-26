/**
 * Light / dark theme. The saved choice lives in a cookie so the server renders it on <html data-theme> (no flash,
 * no hydration mismatch); with no cookie the page follows the system's colour scheme (see globals.css).
 */
export type Theme = "light" | "dark";

export const THEME_COOKIE = "pm_theme";

export const isTheme = (value: unknown): value is Theme => value === "light" || value === "dark";
