import { forwardRef } from "react";
import type { IconName } from "@/lib/icons";
import { cn } from "./cn";
import { Icon } from "./icon";

type Variant = "primary" | "secondary" | "surface" | "white" | "glass" | "outline-white" | "ghost" | "danger-soft";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  // Blue pill with lift — the prototype's main call to action.
  primary:
    "bg-primary text-white shadow-primary hover:bg-primary-hover active:scale-[.97] active:bg-primary-active disabled:bg-steel disabled:shadow-none",
  // Neutral pill inside drawers ("Cancel").
  secondary: "bg-surface text-ink hover:bg-raised active:scale-[.97]",
  // Neutral pill on the frame ("Back" on login, top-bar style).
  surface: "bg-surface text-ink shadow-raised hover:bg-field active:scale-[.97]",
  // White pill on blue cards ("Raise invoice").
  white: "bg-white text-navy-950 font-semibold shadow-[0_8px_20px_rgba(0,18,51,.3)] hover:bg-ice active:scale-[.97] active:bg-[#DDE3EC]",
  // Translucent pill on blue cards ("Clear", "Upload documents").
  glass: "bg-white/14 text-white hover:bg-white/24",
  "outline-white": "border-[1.5px] border-white/70 bg-transparent text-white hover:bg-white/14 active:scale-[.97]",
  ghost: "bg-transparent text-ink hover:bg-raised/45",
  "danger-soft": "bg-chip-2 text-danger hover:bg-raised",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-10 px-5 text-[13px]",
  lg: "h-11 px-5 text-sm",
  xl: "h-12 px-5 text-[13px]",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconSize?: number;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon, iconSize = 15, loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "hit-44 inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill border-0 font-medium tracking-[.005em] transition-[transform,background-color] duration-150 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize} strokeWidth={1.7} />}
      {children}
    </button>
  );
});

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  size?: 28 | 32 | 36 | 40;
  tone?: "surface" | "primary" | "chip" | "glass";
  iconSize?: number;
}

const ICON_TONES = {
  surface: "bg-surface text-ink shadow-raised hover:bg-field",
  primary: "bg-primary text-white shadow-primary hover:bg-primary-hover",
  chip: "bg-chip-2 text-ink hover:bg-primary hover:text-white",
  glass: "bg-white/16 text-white hover:bg-white/28",
};

export function IconButton({ icon, label, size = 40, tone = "surface", iconSize, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      title={label}
      aria-label={label}
      className={cn(
        "hit-44 inline-flex flex-none items-center justify-center rounded-pill border-0 transition-[transform,background-color,color] duration-150 active:scale-[.97]",
        ICON_TONES[tone],
        className,
      )}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={iconSize ?? (size >= 40 ? 18 : size >= 32 ? 14 : 12)} strokeWidth={size >= 36 ? 1.5 : 2} />
    </button>
  );
}

/** The 36 px "×" close button used in drawer and modal headers. */
export function CloseButton({ onClick, label = "Close" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="hit-44 h-9 w-9 flex-none rounded-pill border-0 bg-surface text-base hover:bg-raised"
    >
      ×
    </button>
  );
}
