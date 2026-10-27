"use client";

import { useOptimistic, useState, useTransition } from "react";
import { dateToBucket, DUE_BUCKETS, DUE_LABEL, whenLabel, bucketToDate, type DueBucket } from "@/lib/todo";
import { createTodoAction, deleteTodoAction, updateTodoAction } from "@/server/actions/todo";
import type { TodoDto } from "@/server/services/dashboard";
import { CheckGlyph } from "../ui/icon";
import { useToast } from "../ui/toast";

type Filter = "day" | "imp" | "plan" | "all";
const FILTERS: [Filter, string][] = [
  ["day", "My Day"],
  ["imp", "Important"],
  ["plan", "Planned"],
  ["all", "All"],
];

type Change = { kind: "patch"; id: string; patch: Partial<TodoDto> } | { kind: "remove"; id: string } | { kind: "add"; todo: TodoDto };

function reducer(list: TodoDto[], c: Change): TodoDto[] {
  if (c.kind === "add") return [c.todo, ...list];
  if (c.kind === "remove") return list.filter((t) => t.id !== c.id);
  return list.map((t) => (t.id === c.id ? { ...t, ...c.patch } : t));
}

const pill = "h-7 rounded-pill border-0 bg-chip-3 px-2 text-[11px] outline-none";

export function TodoCard({ todos, today }: { todos: TodoDto[]; today: string }) {
  const { show } = useToast();
  const [items, apply] = useOptimistic(todos, reducer);
  const [, start] = useTransition();
  const [filter, setFilter] = useState<Filter>("day");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [due, setDue] = useState<DueBucket>("TODAY");
  const [time, setTime] = useState("10:00");
  const [star, setStar] = useState(false);
  const [remind, setRemind] = useState(true);

  const match: Record<Filter, (t: TodoDto) => boolean> = {
    day: (t) => t.dueDate === today,
    imp: (t) => t.important,
    plan: (t) => t.dueDate !== null,
    all: () => true,
  };
  const open = items.filter((t) => !t.done).length;
  const total = items.length;
  const pct = total ? Math.round(((total - open) / total) * 100) : 0;
  const shown = items.filter(match[filter]).sort((a, b) => Number(a.done) - Number(b.done) || (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99"));

  const run = (change: Change, call: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: (ok: boolean) => void) =>
    start(async () => {
      apply(change);
      const r = await call();
      if (!r.ok) show(r.error ?? "Couldn't save", "error");
      else if (r.message) show(r.message);
      after?.(r.ok);
    });

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    const date = bucketToDate(due, today);
    const temp: TodoDto = { id: `tmp-${Date.now()}`, text, dueDate: date, dueTime: date ? time : null, important: star, remind: remind && Boolean(date), note: "", done: false };
    setDraft("");
    setStar(false);
    run({ kind: "add", todo: temp }, () => createTodoAction({ text, due, time: date ? time : null, important: star, remind }));
  };

  const patch = (t: TodoDto, p: Parameters<typeof updateTodoAction>[0]["patch"], local: Partial<TodoDto>, after?: (ok: boolean) => void) =>
    run({ kind: "patch", id: t.id, patch: local }, () => updateTodoAction({ id: t.id, patch: p }), after);

  const emptyMsg = filter === "imp" ? "No important tasks. Tap ★ on any task." : filter === "day" ? "Nothing planned for today." : "Nothing here yet.";

  return (
    <section aria-label="To do" className="flex flex-col gap-2 rounded-[20px] bg-surface p-3 shadow-lifted">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-primary">
          <CheckGlyph size={14} strokeWidth={1.8} />
        </span>
        <div className="flex flex-1 flex-col">
          <h2 className="m-0 text-sm font-medium">To Do</h2>
          <span className="text-[11px] text-muted">{total ? (open ? `${open} open · ${total - open} done` : "All done") : "Empty"}</span>
        </div>
        <div className="relative h-9 w-9 flex-none" role="img" aria-label={`${pct}% done`}>
          <svg viewBox="0 0 36 36" className="h-full w-full">
            <circle cx="18" cy="18" r="14" fill="none" className="stroke-card" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="14" fill="none" className="stroke-primary" strokeWidth="3.5" strokeLinecap="round" pathLength={100} strokeDasharray={`${pct} 100`} transform="rotate(-90 18 18)" style={{ transition: "stroke-dasharray .6s cubic-bezier(.22,1,.36,1)" }} />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium">{pct}%</span>
        </div>
      </div>

      <div className="pm-scroll relative flex gap-1 overflow-x-auto" role="tablist" aria-label="To-do lists">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={filter === k}
            onClick={() => setFilter(k)}
            className="hit-44 flex h-7 flex-none items-center gap-1.5 rounded-pill border-0 px-2.5 text-[11px] font-medium transition-colors duration-150"
            style={{ background: filter === k ? "var(--color-primary)" : "var(--color-card)", color: filter === k ? "#fff" : "var(--color-ink)" }}
          >
            {label}
            <span className="opacity-75">{items.filter((t) => !t.done).filter(match[k]).length}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5 rounded-row bg-field p-2 shadow-inset">
        <div className="flex gap-1.5">
          <input
            aria-label="Add a task"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add a task"
            maxLength={200}
            className="h-8 min-w-0 flex-1 border-0 bg-transparent px-1.5 text-xs outline-none"
          />
          <button type="button" onClick={add} title="Add" aria-label="Add task" className="hit-44 h-8 w-8 flex-none rounded-pill border-0 bg-primary text-[17px] text-white shadow-[0_6px_14px_rgba(2,62,125,.3)] hover:bg-primary-hover active:scale-[.94]">
            +
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <select aria-label="Due date" value={due} onChange={(e) => setDue(e.target.value as DueBucket)} className={`${pill} cursor-pointer`}>
            {DUE_BUCKETS.map((b) => (
              <option key={b} value={b}>
                {DUE_LABEL[b]}
              </option>
            ))}
          </select>
          <input type="time" aria-label="Time" value={time} onChange={(e) => setTime(e.target.value)} className={pill} disabled={due === "NONE"} />
          <button type="button" aria-pressed={star} onClick={() => setStar((s) => !s)} className="hit-44 h-7 rounded-pill border-0 px-2.5 text-[11px]" style={{ background: star ? "var(--color-primary)" : "var(--color-chip-3)", color: star ? "#fff" : "var(--color-ink)" }}>
            ★ Important
          </button>
          <button type="button" aria-pressed={remind} onClick={() => setRemind((r) => !r)} className="hit-44 h-7 rounded-pill border-0 px-2.5 text-[11px]" style={{ background: remind ? "var(--color-primary)" : "var(--color-chip-3)", color: remind ? "#fff" : "var(--color-ink)" }}>
            🔔 Remind
          </button>
        </div>
      </div>

      <ul className="pm-scroll m-0 flex max-h-[260px] list-none flex-col gap-[3px] overflow-y-auto p-0">
        {shown.map((t, i) => {
          const isOpen = openId === t.id;
          const bucket = dateToBucket(t.dueDate, today);
          return (
            <li
              key={t.id}
              className="flex animate-item-in flex-col rounded-xl transition-[background-color,opacity] duration-300"
              // Stagger the first few only, so a long list is never held back.
              style={{ background: t.done ? "var(--color-chip-2)" : "var(--color-field)", opacity: t.done ? 0.6 : 1, animationDelay: `${Math.min(i, 6) * 40}ms` }}
            >
              <div className="flex min-h-10 items-center gap-2 px-2 py-1">
                <button
                  type="button"
                  aria-label={t.done ? `Mark “${t.text}” as not done` : `Complete “${t.text}”`}
                  aria-pressed={t.done}
                  onClick={() =>
                    patch(t, { done: !t.done }, { done: !t.done }, (ok) => {
                      if (ok && !t.done && open === 1) show("All tasks done");
                    })
                  }
                  className="hit-44 flex h-5 w-5 flex-none items-center justify-center rounded-pill p-0 transition-colors duration-200"
                  style={{ border: `1.5px solid ${t.done ? "var(--color-primary)" : "var(--color-neutral)"}`, background: t.done ? "var(--color-primary)" : "transparent", animation: t.done ? "pmaPop .5s cubic-bezier(.16,1,.3,1)" : undefined }}
                >
                  <CheckGlyph />
                </button>
                <button type="button" onClick={() => setOpenId(isOpen ? null : t.id)} aria-expanded={isOpen} className="flex min-w-0 flex-1 flex-col border-0 bg-transparent p-0 text-left">
                  <span className="truncate text-xs leading-4" style={{ textDecoration: t.done ? "line-through" : "none" }}>
                    {t.text}
                  </span>
                  <span className="flex items-center gap-1.5 truncate text-[10px]" style={{ color: !t.done && t.dueDate === today ? "var(--color-link)" : "var(--color-muted)" }}>
                    {t.done ? "Completed" : whenLabel(t.dueDate, t.dueTime, today)}
                    {t.note && <span className="text-muted">· note</span>}
                  </span>
                </button>
                <button
                  type="button"
                  title="Reminder"
                  aria-label={t.remind ? "Turn reminder off" : "Turn reminder on"}
                  aria-pressed={t.remind}
                  onClick={() => patch(t, { remind: !t.remind }, { remind: !t.remind })}
                  className="hit-44 h-6 w-6 flex-none rounded-pill border-0 bg-transparent text-xs hover:bg-chip-2"
                  style={{ opacity: t.remind ? 1 : 0.28 }}
                >
                  🔔
                </button>
                <button
                  type="button"
                  title="Important"
                  aria-label={t.important ? "Unmark important" : "Mark important"}
                  aria-pressed={t.important}
                  onClick={() => patch(t, { important: !t.important }, { important: !t.important })}
                  className="hit-44 h-6 w-6 flex-none rounded-pill border-0 bg-transparent text-sm hover:bg-chip-2"
                  style={{ color: t.important ? "var(--color-link)" : "var(--color-muted)" }}
                >
                  {t.important ? "★" : "☆"}
                </button>
              </div>
              {isOpen && (
                <div className="flex flex-col gap-1.5 pb-2 pl-9 pr-2">
                  <div className="flex flex-wrap gap-1">
                    <select
                      aria-label="Due"
                      value={bucket ?? "KEEP"}
                      onChange={(e) => {
                        const b = e.target.value as DueBucket;
                        const d = bucketToDate(b, today);
                        patch(t, { due: b }, { dueDate: d, ...(d ? {} : { dueTime: null, remind: false }) });
                      }}
                      className={`${pill} cursor-pointer`}
                    >
                      {!bucket && <option value="KEEP">{whenLabel(t.dueDate, null, today)}</option>}
                      {DUE_BUCKETS.map((b) => (
                        <option key={b} value={b}>
                          {DUE_LABEL[b]}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      aria-label="Time"
                      value={t.dueTime ?? ""}
                      disabled={!t.dueDate}
                      onChange={(e) => patch(t, { time: e.target.value || null }, { dueTime: e.target.value || null })}
                      className={pill}
                    />
                  </div>
                  <NoteField todo={t} onSave={(note) => patch(t, { note }, { note })} />
                  <button
                    type="button"
                    onClick={() => run({ kind: "remove", id: t.id }, () => deleteTodoAction({ id: t.id }), () => setOpenId(null))}
                    className="h-[26px] self-start rounded-pill border-0 bg-chip-2 px-2.5 text-[11px] text-danger hover:bg-raised"
                  >
                    Delete task
                  </button>
                </div>
              )}
            </li>
          );
        })}
        {shown.length === 0 && <li className="p-4 text-center text-xs text-muted">{emptyMsg}</li>}
      </ul>
    </section>
  );
}

/** Notes save when the field loses focus (no request per keystroke). */
function NoteField({ todo, onSave }: { todo: TodoDto; onSave: (note: string) => void }) {
  const [value, setValue] = useState(todo.note);
  return (
    <textarea
      aria-label="Note"
      value={value}
      rows={2}
      maxLength={1000}
      placeholder="Add a note"
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== todo.note && onSave(value)}
      className="resize-none rounded-[10px] border-0 bg-field px-2 py-1.5 text-[11px] outline-none focus:shadow-focus"
    />
  );
}
