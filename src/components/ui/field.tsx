import { cn } from "./cn";

/** Light fields sit on glass/grey surfaces; "onBlue" fields sit on the blue invoice / booking cards. */
export type FieldTone = "light" | "onBlue";

const INPUT_BASE = "w-full min-w-0 rounded-[14px] border-0 text-sm outline-none transition-shadow";
const INPUT_TONE: Record<FieldTone, string> = {
  light: "bg-surface shadow-inset focus:shadow-focus",
  onBlue: "bg-white text-ink focus:shadow-focus-white",
};

export function inputClass(tone: FieldTone = "light", extra?: string) {
  return cn(INPUT_BASE, INPUT_TONE[tone], extra);
}

/** The standard single-line field and its label: on glass / grey surfaces, and on the blue cards. */
export const FIELD = inputClass("light", "h-11 px-3.5");
export const FIELD_ON_BLUE = inputClass("onBlue", "h-11 px-3.5");
export const LABEL = "text-xs font-medium text-muted";
export const LABEL_ON_BLUE = "text-xs font-medium text-white/92";

/** "− message" error line used under forms in the prototype. */
export function FormError({ message, tone = "light" }: { message?: string | null; tone?: FieldTone }) {
  if (!message) return null;
  return (
    <span role="alert" className={cn("animate-item-in text-xs", tone === "light" ? "text-danger" : "text-[#FFD2CC]")}>
      − {message}
    </span>
  );
}
