import { tint } from "@/lib/constants";
import { cn } from "./cn";

/** Initials avatar. `tone="blue"` is the signed-in user; `dashed` marks an empty slot ("—"). */
export function Avatar({
  initials,
  size = 32,
  tone = "chip",
  title,
  ring = true,
  className,
}: {
  initials: string;
  size?: number;
  tone?: "chip" | "blue" | "white" | "dashed" | "surface";
  title?: string;
  ring?: boolean;
  className?: string;
}) {
  const tones = {
    chip: "bg-chip text-ink",
    blue: "bg-primary text-white",
    white: "bg-white/16 text-white",
    surface: "bg-surface text-ink",
    dashed: "bg-transparent text-muted border-[1.5px] border-dashed border-neutral",
  };
  return (
    <span
      title={title}
      aria-hidden={title ? undefined : true}
      className={cn("inline-flex flex-none items-center justify-center rounded-pill font-medium", tones[tone], ring && tone !== "dashed" && "shadow-avatar", className)}
      style={{ width: size, height: size, fontSize: size >= 32 ? 11 : 9 }}
    >
      {initials}
    </span>
  );
}

/** Dot + label on an 18 % tint of the status colour. */
export function StatusPill({ color, children, className }: { color: string; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn("inline-flex h-6 items-center gap-1.5 justify-self-start whitespace-nowrap rounded-pill px-2.5 text-[11px] font-medium", className)}
      style={{ background: tint(color) }}
    >
      <span className="h-1.5 w-1.5 rounded-pill" style={{ background: color }} />
      {children}
    </span>
  );
}

/** 40×24 switch. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  showLabel = false,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  showLabel?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={showLabel ? undefined : label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn("hit-44 inline-flex items-center gap-2.5 border-0 bg-transparent p-0 text-[13px] text-muted disabled:cursor-not-allowed disabled:opacity-60", className)}
    >
      <span className="relative h-6 w-10 flex-none rounded-pill transition-colors duration-200" style={{ background: checked ? "#023E7D" : "#C7C7C7" }}>
        <span
          className="absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-pill bg-white shadow-[0_1px_3px_rgba(0,0,0,.2)] transition-transform duration-200 ease-spring"
          style={{ transform: `translateX(${checked ? 16 : 0}px)` }}
        />
      </span>
      {showLabel && label}
    </button>
  );
}

/** Small round icon badge used at the top-left of cards. */
export function IconBadge({ children, tone = "chip", size = 32 }: { children: React.ReactNode; tone?: "chip" | "blue" | "white" | "surface"; size?: number }) {
  const tones = { chip: "bg-chip-2", blue: "bg-primary text-white", white: "bg-white/16 text-white", surface: "bg-surface" };
  return (
    <span className={cn("inline-flex flex-none items-center justify-center rounded-pill", tones[tone])} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-10 text-center text-[13px] text-muted", className)}>{children}</div>;
}
