"use client";

import { cn } from "../ui/cn";
import { inputClass, type FieldTone } from "../ui/field";

/** One broker line in a form: a team member (userId) or an external broker typed by name. */
export type BrokerDraft = { kind: "user"; userId: string } | { kind: "external"; name: string } | { kind: "empty" };

export const NEW_BROKER = "__new";

interface BrokerRowsProps {
  label: string;
  rows: BrokerDraft[];
  onChange: (rows: BrokerDraft[]) => void;
  users: { id: string; name: string }[];
  /** user ids chosen in other lists (so a person can't be picked twice) */
  takenElsewhere?: string[];
  allowExternal?: boolean;
  minRows?: number;
  tone?: FieldTone;
  /** optional trailing control per row (e.g. share %) */
  trailing?: (index: number) => React.ReactNode;
  addLabel?: string;
}

/** Rows of broker selects with remove buttons and "+ Add broker", as in the WIP and Invoice forms. */
export function BrokerRows({ label, rows, onChange, users, takenElsewhere = [], allowExternal = true, minRows = 0, tone = "light", trailing, addLabel = "+ Add broker" }: BrokerRowsProps) {
  const takenHere = rows.flatMap((r) => (r.kind === "user" ? [r.userId] : []));
  const set = (i: number, next: BrokerDraft) => onChange(rows.map((r, j) => (j === i ? next : r)));
  const remove = (i: number) => {
    if (rows.length <= minRows) return;
    onChange(rows.filter((_, j) => j !== i));
  };
  const onBlue = tone === "onBlue";

  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label={label}>
      {rows.map((row, i) => {
        const value = row.kind === "user" ? row.userId : row.kind === "external" ? NEW_BROKER : "";
        const options = users.filter((u) => u.id === value || (!takenHere.includes(u.id) && !takenElsewhere.includes(u.id)));
        return (
          <div key={i} className="flex items-center gap-1.5">
            {row.kind === "external" ? (
              <input
                aria-label={`${label} ${i + 1} — external broker name`}
                autoFocus
                value={row.name}
                onChange={(e) => set(i, { kind: "external", name: e.target.value })}
                placeholder="Type broker's full name"
                className={inputClass(tone, "h-11 flex-1 px-3.5")}
              />
            ) : (
              <select
                aria-label={`${label} ${i + 1}`}
                value={value}
                onChange={(e) => {
                  const v = e.target.value;
                  set(i, v === NEW_BROKER ? { kind: "external", name: "" } : v ? { kind: "user", userId: v } : { kind: "empty" });
                }}
                className={inputClass(tone, "h-11 flex-1 cursor-pointer px-3")}
              >
                <option value="">Select broker</option>
                {options.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
                {allowExternal && <option value={NEW_BROKER}>+ Add a new broker…</option>}
              </select>
            )}
            {trailing?.(i)}
            <button
              type="button"
              title="Remove"
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              onClick={() => remove(i)}
              className={cn(
                "hit-44 flex-none rounded-pill border-0 text-base",
                onBlue ? "h-9 w-9 bg-white/16 text-white hover:bg-white/28" : "h-11 w-11 bg-surface hover:bg-white",
                rows.length <= minRows && "cursor-not-allowed opacity-35",
              )}
            >
              ×
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={() => onChange([...rows, { kind: "empty" }])}
        className={cn(
          "hit-44 h-9 self-start rounded-pill border-0 px-4 text-[13px]",
          onBlue ? "bg-white font-semibold text-navy-950 hover:bg-ice active:scale-[.97]" : "bg-primary font-medium text-white shadow-primary hover:bg-primary-hover active:scale-[.97]",
        )}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function draftsFromChips(chips: { userId: string | null; name: string }[]): BrokerDraft[] {
  return chips.map((c) => (c.userId ? { kind: "user", userId: c.userId } : { kind: "external", name: c.name }));
}
