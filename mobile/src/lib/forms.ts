import type { ActionResult } from "@/api/types";

/** Field errors from a server action, with a nested prefix (e.g. "data.") removed. */
export function fieldErrors(res: ActionResult<unknown>, prefix = ""): Record<string, string> {
  if (res.ok || !res.fieldErrors) return {};
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(res.fieldErrors)) out[prefix && key.startsWith(prefix) ? key.slice(prefix.length) : key] = message;
  return out;
}

/** "4,200" → 4200; "" → null. */
export function intOrNull(text: string): number | null {
  const digits = text.replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

/** First value of a route parameter. */
export function param(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
