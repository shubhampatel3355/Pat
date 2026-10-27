"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { cn } from "./cn";

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** Puts the thumb under the selected tab; `animate` false jumps there (first placement, resizes). */
function placeThumb(track: HTMLElement, thumb: HTMLElement, animate: boolean) {
  const tab = track.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
  if (!tab) return;
  thumb.style.transition = animate ? "" : "none";
  thumb.style.width = `${tab.offsetWidth}px`;
  thumb.style.transform = `translateX(${tab.offsetLeft}px)`;
  track.dataset.ready = "";
}

/**
 * Pill tab group: grey track, active option on the surface colour with a soft shadow. Once the page is interactive
 * that surface is a thumb that slides to the chosen option (until then the active button paints it itself).
 */
export function Segmented<T extends string>({ options, value, onChange, label, size = "md", className }: SegmentedProps<T>) {
  const track = useRef<HTMLDivElement>(null);
  const thumb = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  // The first placement jumps; choosing another option slides.
  useLayoutEffect(() => {
    if (!track.current || !thumb.current) return;
    placeThumb(track.current, thumb.current, placed.current);
    placed.current = true;
  }, [value, options]);

  // Labels, fonts or the window resizing the tabs: follow without animating.
  useEffect(() => {
    const el = track.current;
    const knob = thumb.current;
    if (!el || !knob) return;
    const resize = new ResizeObserver(() => placeThumb(el, knob, false));
    resize.observe(el);
    return () => resize.disconnect();
  }, []);

  return (
    <div ref={track} role="tablist" aria-label={label} className={cn("group relative flex gap-0.5 self-start rounded-pill bg-card p-1", className)}>
      <span
        ref={thumb}
        aria-hidden="true"
        className="absolute bottom-1 left-0 top-1 hidden rounded-pill bg-surface shadow-seg transition-[transform,width] duration-(--duration-base) ease-spring group-data-ready:block"
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "hit-44 relative whitespace-nowrap rounded-pill border-0 text-[13px] font-medium transition-colors duration-(--duration-base) ease-standard",
              size === "md" ? "h-[34px] px-4" : "h-8 px-3",
              active ? "bg-surface text-ink shadow-seg group-data-ready:bg-transparent group-data-ready:shadow-none" : "bg-transparent text-muted hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface ChoiceChipsProps<T extends string | null> {
  options: readonly { value: T; label: React.ReactNode }[];
  value: T | T[];
  onChange: (value: T) => void;
  label: string;
  tone?: "light" | "onBlue";
  className?: string;
}

/** Wrapping chips: selected = brand blue with white text, others chip grey. */
export function ChoiceChips<T extends string | null>({ options, value, onChange, label, tone = "light", className }: ChoiceChipsProps<T>) {
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const active = selected(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "hit-44 h-8 whitespace-nowrap rounded-pill border-0 px-3 text-xs font-medium transition-colors duration-150",
              tone === "light"
                ? active
                  ? "bg-primary text-white"
                  : "bg-chip text-ink hover:bg-track"
                : active
                  ? "bg-white text-navy-950"
                  : "bg-white/14 text-white hover:bg-white/24",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
