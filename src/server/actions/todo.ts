"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { ok } from "@/lib/action-result";
import { isoDateIST, isoToDate } from "@/lib/dates";
import { bucketToDate, createTodoSchema, updateTodoSchema } from "@/lib/todo";
import { db } from "../db";
import { can } from "../policy";
import { scheduleTodoReminder } from "../services/reminders";
import { defineAction, UserError } from "./define";

/** Personal to-dos (Microsoft To Do style) — always the caller's own; not audited as business records. */

export const createTodoAction = defineAction({
  schema: createTodoSchema,
  authorize: (user) => can(user, "create", { type: "todo", userId: user.id }),
  handler: async ({ user, input }) => {
    const date = bucketToDate(input.due, isoDateIST());
    const todo = await db.$transaction(async (tx) => {
      const created = await tx.todo.create({
        data: {
          userId: user.id,
          text: input.text,
          dueDate: date ? isoToDate(date) : null,
          dueTime: date ? input.time : null,
          important: input.important,
          remind: input.remind && Boolean(date),
        },
      });
      await scheduleTodoReminder(tx, created);
      return created;
    });
    refresh();
    return ok(input.remind && date ? "Task added · reminder set" : "Task added", { id: todo.id });
  },
});

export const updateTodoAction = defineAction({
  schema: updateTodoSchema,
  authorize: (user) => can(user, "update", { type: "todo", userId: user.id }),
  handler: async ({ user, input }) => {
    const todo = await db.todo.findUnique({ where: { id: input.id } });
    if (!todo || todo.userId !== user.id) throw new UserError("This task no longer exists");
    const p = input.patch;
    const dueDate = p.due !== undefined ? bucketToDate(p.due, isoDateIST()) : p.dueDate !== undefined ? p.dueDate : undefined;
    const updated = await db.$transaction(async (tx) => {
      const next = await tx.todo.update({
        where: { id: todo.id },
        data: {
          ...(p.text !== undefined ? { text: p.text } : {}),
          ...(dueDate !== undefined ? { dueDate: dueDate ? isoToDate(dueDate) : null, ...(dueDate ? {} : { dueTime: null, remind: false }) } : {}),
          ...(p.time !== undefined ? { dueTime: p.time } : {}),
          ...(p.important !== undefined ? { important: p.important } : {}),
          ...(p.remind !== undefined ? { remind: p.remind } : {}),
          ...(p.note !== undefined ? { note: p.note || null } : {}),
          ...(p.done !== undefined ? { done: p.done, doneAt: p.done ? new Date() : null } : {}),
        },
      });
      if (p.due !== undefined || p.dueDate !== undefined || p.time !== undefined || p.remind !== undefined) await scheduleTodoReminder(tx, next);
      return next;
    });
    refresh();
    if (p.remind !== undefined) return ok(updated.remind ? "Reminder set" : "Reminder off");
    return ok();
  },
});

export const deleteTodoAction = defineAction({
  schema: z.object({ id: z.uuid() }),
  authorize: (user) => can(user, "delete", { type: "todo", userId: user.id }),
  handler: async ({ user, input }) => {
    const deleted = await db.todo.deleteMany({ where: { id: input.id, userId: user.id } });
    if (!deleted.count) throw new UserError("This task no longer exists");
    refresh();
    return ok("Task deleted");
  },
});

export const markAchievementsSeenAction = defineAction({
  schema: z.object({}),
  authorize: () => true, // only stamps the caller's own row
  handler: async ({ user }) => {
    await db.user.update({ where: { id: user.id }, data: { achievementsSeenAt: new Date() } });
    return ok();
  },
});
