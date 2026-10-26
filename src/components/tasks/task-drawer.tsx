"use client";

import Link from "next/link";
import { useState } from "react";
import type { TaskStatus } from "@/generated/prisma/enums";
import { TASK_PRIORITY, TASK_STATUSES } from "@/lib/constants";
import { formatDateTimeShort } from "@/lib/dates";
import { instantLabel } from "@/lib/tasks";
import { addTaskCommentAction, deleteTaskAction, setTaskRemindersAction, setTaskStatusAction } from "@/server/actions/tasks";
import type { TaskDto } from "@/server/services/tasks";
import { Avatar, Toggle } from "../ui/bits";
import { Button } from "../ui/button";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { Drawer } from "../ui/overlay";
import { Segmented } from "../ui/segmented";
import { useAction } from "../ui/toast";

export function TaskDrawer({ task, today, onClose, onEdit }: { task: TaskDto; today: string; onClose: () => void; onEdit: () => void }) {
  const [comment, setComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = useAction(setTaskStatusAction);
  const reminders = useAction(setTaskRemindersAction);
  const post = useAction(addTaskCommentAction, { onSuccess: () => setComment("") });
  const remove = useAction(deleteTaskAction, { onSuccess: onClose });

  const setReminder = (k: "remindInApp" | "remindEmail", v: boolean) =>
    void reminders.run({ id: task.id, remindInApp: task.reminders.inApp, remindEmail: task.reminders.email, remindWhatsapp: task.reminders.whatsapp, [k]: v });
  const send = () => {
    if (comment.trim()) void post.run({ taskId: task.id, body: comment });
  };
  const fields: [string, React.ReactNode][] = [
    ["Assignee", task.assignee.name],
    ["Due", task.dueAt ? instantLabel(task.dueAt, today) : "No due date"],
    ["Priority", TASK_PRIORITY[task.priority].label],
    ["Linked to", task.lead ? <Link href={`/wip?focus=${task.lead.id}`} className="text-link hover:underline">{task.lead.name}</Link> : "General"],
  ];

  return (
    <Drawer
      open
      onClose={onClose}
      title={task.title}
      subtitle={`${task.lead?.name ?? "General"} · created by ${task.createdBy}`}
      footer={
        task.canEdit ? (
          <>
            {task.canDelete && (
              <Button variant="danger-soft" className="mr-auto" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
            <Button variant="secondary" onClick={onEdit}>
              Edit task
            </Button>
          </>
        ) : undefined
      }
    >
      <Segmented<TaskStatus>
        label="Task status"
        size="sm"
        options={TASK_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        value={task.status}
        onChange={(v) => task.canEdit && void status.run({ id: task.id, status: v })}
      />

      <div className="grid grid-cols-2 gap-1.5">
        {fields.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 rounded-[14px] bg-surface p-2.5">
            <span className="text-[11px] text-muted">{k}</span>
            <span className="text-[13px]">{v}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-[20px] bg-surface p-3">
        <span className="text-xs font-medium text-muted">Reminders</span>
        <div className="flex flex-wrap gap-4">
          <Toggle showLabel label="In-app" checked={task.reminders.inApp} disabled={!task.canEdit || reminders.pending} onChange={(v) => setReminder("remindInApp", v)} />
          <Toggle showLabel label="Email" checked={task.reminders.email} disabled={!task.canEdit || reminders.pending} onChange={(v) => setReminder("remindEmail", v)} />
          <span title="Connect WhatsApp in Settings → Integrations to send WhatsApp reminders">
            <Toggle showLabel label="WhatsApp" checked={task.reminders.whatsapp} disabled onChange={() => {}} />
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Comments</span>
        {task.comments.length === 0 ? (
          <div className="flex items-start gap-2.5">
            <Avatar initials="—" size={28} ring={false} />
            <div className="flex flex-1 flex-col gap-0.5 rounded-row bg-surface px-3 py-2">
              <span className="text-[13px] leading-[18px]">Start the thread for this task.</span>
              <span className="text-[11px] text-muted">No comments yet</span>
            </div>
          </div>
        ) : (
          task.comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <Avatar initials={c.author.initials} size={28} ring={false} />
              <div className="flex flex-1 flex-col gap-0.5 rounded-row bg-surface px-3 py-2">
                <span className="whitespace-pre-wrap text-[13px] leading-[18px]">{c.body}</span>
                <span className="text-[11px] text-muted">
                  {c.author.name} · {formatDateTimeShort(new Date(c.at))}
                </span>
              </div>
            </div>
          ))
        )}
        {task.canEdit && (
          <div className="flex gap-1.5">
            <input
              aria-label="Write a comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Write a comment"
              className="h-10 min-w-0 flex-1 rounded-pill border-0 bg-surface px-3.5 text-[13px] shadow-inset outline-none focus:shadow-focus"
            />
            <Button onClick={send} loading={post.pending} disabled={!comment.trim()}>
              Post
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this task?"
        body={`“${task.title}” is removed for everyone. The audit log keeps a copy.`}
        confirmLabel="Delete"
        pending={remove.pending}
        onConfirm={() => void remove.run({ id: task.id })}
        onClose={() => setConfirmDelete(false)}
      />
    </Drawer>
  );
}
