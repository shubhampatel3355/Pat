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

/** "− message" error line used under forms in the prototype. */
export function FormError({ message, tone = "light" }: { message?: string | null; tone?: FieldTone }) {
  if (!message) return null;
  return (
    <span role="alert" className={cn("text-xs", tone === "light" ? "text-danger" : "text-[#FFD2CC]")}>
      − {message}
    </span>
  );
}
