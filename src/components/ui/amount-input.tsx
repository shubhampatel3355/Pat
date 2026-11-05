"use client";

import { useLayoutEffect, useRef } from "react";
import { formatAmountInput } from "@/lib/money";
import { cn } from "./cn";

type AmountInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "inputMode" | "type" | "ref"> & {
  value: string;
  onChange: (value: string) => void;
  /** false for whole numbers (areas, seats); amounts allow paise. */
  decimals?: boolean;
};

/** Caret position in `text` just after its `count`-th digit or decimal point (commas don't count). */
function caretAfter(text: string, count: number): number {
  let pos = 0;
  for (let seen = 0; pos < text.length && seen < count; pos++) if (text[pos] !== ",") seen++;
  return pos;
}

/**
 * A number field that groups digits the Indian way as you type (11,20,555). The caret stays beside the digit
 * being edited, and Backspace/Delete on a comma removes the digit next to it. The value stays a string;
 * parse it with parseRupeesToPaise (or strip the commas for whole numbers).
 */
export function AmountInput({ value, onChange, decimals = true, ...rest }: AmountInputProps) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = input.current;
    const at = caret.current;
    caret.current = null;
    if (el && at !== null && document.activeElement === el) el.setSelectionRange(caretAfter(value, at), caretAfter(value, at));
  }, [value]);

  const significant = (text: string) => text.replace(decimals ? /[^\d.]/g : /\D/g, "");

  const change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    let raw = el.value;
    let at = significant(raw.slice(0, el.selectionStart ?? raw.length)).length;
    const kind = (e.nativeEvent as InputEvent).inputType;
    if (kind?.startsWith("delete") && significant(raw) === significant(value)) {
      // Only a comma went: take the digit beside it instead.
      const digits = significant(raw);
      if (kind === "deleteContentBackward" && at > 0) {
        raw = digits.slice(0, at - 1) + digits.slice(at);
        at -= 1;
      } else if (kind === "deleteContentForward") {
        raw = digits.slice(0, at) + digits.slice(at + 1);
      }
    }
    const next = formatAmountInput(raw, decimals);
    if (next === value) {
      // Nothing to store (a letter, a third decimal): put the text and caret back without a re-render.
      el.value = value;
      el.setSelectionRange(caretAfter(value, at), caretAfter(value, at));
      return;
    }
    caret.current = at;
    onChange(next);
  };

  return <input {...rest} ref={input} inputMode={decimals ? "decimal" : "numeric"} value={value} onChange={change} />;
}

/** An amount field with the ₹ sign inside it. `className` sets its height, spacing and surface. */
export function RupeeInput({ className, ...input }: AmountInputProps) {
  return (
    <span className={cn("flex items-center shadow-inset focus-within:shadow-focus", className)}>
      <span className="text-sm text-muted">₹</span>
      <AmountInput {...input} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none disabled:text-muted" />
    </span>
  );
}
