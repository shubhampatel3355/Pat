"use client";

import { useId } from "react";
import type { Theme } from "@/lib/theme";
import { cn } from "../ui/cn";
import { setTheme, useTheme } from "./use-theme";

/** The app's theme switch (styles in globals.css): knob on the left = light, on the right = dark. */
export function ThemeSwitch({ serverTheme = null, className }: { serverTheme?: Theme | null; className?: string }) {
  const id = useId();
  const theme = useTheme(serverTheme);
  return (
    <span className={cn("theme-switch", className)}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-label="Dark mode"
        className="theme-switch-input"
        checked={theme === "dark"}
        onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
      />
      <label htmlFor={id} className="theme-switch-label hit-44" aria-hidden="true" />
    </span>
  );
}
