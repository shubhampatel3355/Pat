import { forwardRef, useId } from "react";
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

interface FieldProps {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string;
  tone?: FieldTone;
  className?: string;
  children: (id: string, describedBy: string | undefined) => React.ReactNode;
}

/** Label + control + hint, with ids wired for screen readers. */
export function Field({ label, hint, error, tone = "light", className, children }: FieldProps) {
  const id = useId();
  const hintId = hint || error ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-xs font-medium", tone === "light" ? "text-muted" : "text-white/92")}>
        {label}
      </label>
      {children(id, hintId)}
      {(error || hint) && (
        <span id={hintId} className={cn("text-[11px]", error ? (tone === "light" ? "text-danger" : "text-[#FFD2CC]") : tone === "light" ? "text-muted" : "text-white/88")}>
          {error ?? hint}
        </span>
      )}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { tone?: FieldTone };

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput({ tone = "light", className, ...rest }, ref) {
  return <input ref={ref} className={inputClass(tone, cn("h-11 px-3.5", className))} {...rest} />;
});

type TextAreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { tone?: FieldTone };

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea({ tone = "light", className, ...rest }, ref) {
  return <textarea ref={ref} className={inputClass(tone, cn("resize-y px-3.5 py-2.5 leading-5", className))} {...rest} />;
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { tone?: FieldTone };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ tone = "light", className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={inputClass(tone, cn("h-11 cursor-pointer px-3", className))} {...rest}>
      {children}
    </select>
  );
});

/** "− message" error line used under forms in the prototype. */
export function FormError({ message, tone = "light" }: { message?: string | null; tone?: FieldTone }) {
  if (!message) return null;
  return (
    <span role="alert" className={cn("text-xs", tone === "light" ? "text-danger" : "text-[#FFD2CC]")}>
      − {message}
    </span>
  );
}
