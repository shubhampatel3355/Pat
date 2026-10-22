import { cn } from "./cn";

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** Pill tab group: grey track, active option on #E8E8E8 with a soft shadow. */
export function Segmented<T extends string>({ options, value, onChange, label, size = "md", className }: SegmentedProps<T>) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-0.5 self-start rounded-pill bg-card p-1", className)}>
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
              "hit-44 whitespace-nowrap rounded-pill border-0 text-[13px] font-medium transition-[background-color,box-shadow] duration-150",
              size === "md" ? "h-[34px] px-4" : "h-8 px-3",
              active ? "bg-surface text-ink shadow-seg" : "bg-transparent text-muted",
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

/** Wrapping chips: selected = blue (#023E7D) with white text, others #C7C7C7. */
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
                  : "bg-chip text-ink hover:bg-[#bdbdc0]"
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
