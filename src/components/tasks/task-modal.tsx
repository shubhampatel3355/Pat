"use client";

import { useState } from "react";
import type { TaskPriority } from "@/generated/prisma/enums";
import { TASK_PRIORITIES } from "@/lib/constants";
import { DEFAULT_TASK_TIME, splitInstant } from "@/lib/tasks";
import { bucketToDate, DUE_LABEL, type DueBucket } from "@/lib/todo";
import { createTaskAction, updateTaskAction } from "@/server/actions/tasks";
import type { LeadOption, TaskDto } from "@/server/services/tasks";
import type { UserOption } from "@/server/services/wip";
import { Toggle } from "../ui/bits";
import { Button } from "../ui/button";
import { FormError, inputClass } from "../ui/field";
import { Modal } from "../ui/overlay";
import { ChoiceChips } from "../ui/segmented";
import { useAction } from "../ui/toast";

const LABEL = "text-xs font-medium text-muted";
const QUICK_DUES: Exclude<DueBucket, "NONE">[] = ["TODAY", "TOMORROW", "THIS_WEEK", "NEXT_WEEK"];

export function TaskModal({
  task,
  users,
  leads,
  me,
  today,
  defaultLeadId,
  onClose,
  onSaved,
}: {
  task: TaskDto | null;
  users: UserOption[];
  leads: LeadOption[];
  me: string;
  today: string;
  defaultLeadId?: string | null;
  onClose: () => void;
  onSaved?: (id: string | null) => void;
}) {
  const due = splitInstant(task?.dueAt ?? null);
  const [f, setF] = useState({
    title: task?.title ?? "",
    assigneeId: task?.assignee.id ?? me,
    dueDate: due?.date ?? (task ? null : today),
    dueTime: due?.time ?? (task ? null : DEFAULT_TASK_TIME),
    priority: (task?.priority ?? "MEDIUM") as TaskPriority,
    leadId: task?.lead?.id ?? defaultLeadId ?? null,
    remindInApp: task?.reminders.inApp ?? true,
    remindEmail: task?.reminders.email ?? false,
    remindWhatsapp: task?.reminders.whatsapp ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((s) => ({ ...s, [k]: v }));
    setError(null);
  };
  const create = useAction(createTaskAction, { onSuccess: (r) => (onSaved ? onSaved(r.data?.id ?? null) : onClose()), onError: (r) => setError(r.error) });
  const update = useAction(updateTaskAction, { onSuccess: () => (onSaved ? onSaved(task?.id ?? null) : onClose()), onError: (r) => setError(r.error) });
  const activeBucket = QUICK_DUES.find((b) => bucketToDate(b, today) === f.dueDate) ?? null;

  const submit = () => {
    if (f.title.trim().length < 3) return setError("Give the task a title");
    const input = { ...f, dueTime: f.dueDate ? (f.dueTime ?? DEFAULT_TASK_TIME) : null };
    if (task) void update.run({ id: task.id, ...input });
    else void create.run(input);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      subtitle="Assign, set a due date and pick reminder channels"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={create.pending || update.pending}>
            {task ? "Save task" : "Create task"}
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Task</span>
        <input data-autofocus value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Send cost sheet to Vikram" className={inputClass("light", "h-11 px-3.5")} />
      </label>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Assignee</span>
        <ChoiceChips label="Assignee" options={users.map((u) => ({ value: u.id, label: u.name }))} value={f.assigneeId} onChange={(v) => set("assigneeId", v)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Due</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <ChoiceChips
            label="Due"
            options={[...QUICK_DUES.map((b) => ({ value: b as DueBucket | "NONE", label: DUE_LABEL[b] })), { value: "NONE" as const, label: "No date" }]}
            value={f.dueDate ? (activeBucket ?? ("" as DueBucket)) : "NONE"}
            onChange={(b) => setF((s) => ({ ...s, dueDate: b === "NONE" ? null : bucketToDate(b, today), dueTime: b === "NONE" ? null : (s.dueTime ?? DEFAULT_TASK_TIME) }))}
          />
          <input type="date" aria-label="Due date" value={f.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value || null)} className={inputClass("light", "h-8 w-auto px-3 text-xs")} />
          <input type="time" aria-label="Due time" value={f.dueTime ?? ""} disabled={!f.dueDate} onChange={(e) => set("dueTime", e.target.value || null)} className={inputClass("light", "h-8 w-auto px-3 text-xs disabled:opacity-50")} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={LABEL}>Priority</span>
        <ChoiceChips label="Priority" options={TASK_PRIORITIES} value={f.priority} onChange={(v) => set("priority", v)} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className={LABEL}>Linked WIP row</span>
        <select value={f.leadId ?? ""} onChange={(e) => set("leadId", e.target.value || null)} className={inputClass("light", "h-11 cursor-pointer px-3")}>
          <option value="">None</option>
          {leads.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-4">
        <Toggle showLabel label="In-app" checked={f.remindInApp} onChange={(v) => set("remindInApp", v)} />
        <Toggle showLabel label="Email" checked={f.remindEmail} onChange={(v) => set("remindEmail", v)} />
        <span title="Connect WhatsApp in Settings → Integrations to send WhatsApp reminders">
          <Toggle showLabel label="WhatsApp" checked={f.remindWhatsapp} disabled onChange={(v) => set("remindWhatsapp", v)} />
        </span>
      </div>
      <FormError message={error} />
    </Modal>
  );
}
