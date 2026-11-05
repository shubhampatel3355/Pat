import { z } from "../zod";
import { hhmm, isoDate, requiredText, text } from "./common";

const taskFields = {
  title: text(200).pipe(z.string().min(3, "Give the task a title")),
  assigneeId: z.uuid(),
  dueDate: isoDate.nullable(),
  dueTime: hhmm.nullable(),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]),
  leadId: z.uuid().nullable(),
  remindInApp: z.boolean(),
  remindEmail: z.boolean(),
  remindWhatsapp: z.boolean(),
};

export const taskInputSchema = z.object(taskFields);
export const taskUpdateSchema = z.object({ id: z.uuid(), ...taskFields });
export const taskStatusSchema = z.object({ id: z.uuid(), status: z.enum(["TODO", "IN_PROGRESS", "DONE"]) });
export const taskRemindersSchema = z.object({ id: z.uuid(), remindInApp: z.boolean(), remindEmail: z.boolean(), remindWhatsapp: z.boolean() });
export const taskCommentSchema = z.object({ taskId: z.uuid(), body: text(1000).pipe(z.string().min(1, "Write a comment")) });

const followUpFields = {
  contactName: requiredText(120, "Enter who to follow up with"),
  type: z.enum(["CALL", "WHATSAPP", "EMAIL", "MEETING", "SITE_VISIT"]),
  note: text(300),
  leadId: z.uuid().nullable(),
  ownerId: z.uuid(),
  dueDate: isoDate,
  dueTime: hhmm,
};

export const followUpInputSchema = z.object(followUpFields);
export const followUpUpdateSchema = z.object({ id: z.uuid(), ...followUpFields });
export const followUpRescheduleSchema = z.object({ id: z.uuid(), dueDate: isoDate, dueTime: hhmm });
