import { z } from "./zod";
import { addDaysIso, formatDayMonth, formatTime12, isoToDate } from "./dates";
import { hhmm, isoDate, text } from "./schemas/common";

/** Microsoft To Do–style due buckets used by the dashboard to-do card. */
export const DUE_BUCKETS = ["TODAY", "TOMORROW", "THIS_WEEK", "NEXT_WEEK", "NONE"] as const;
export type DueBucket = (typeof DUE_BUCKETS)[number];

export const DUE_LABEL: Record<DueBucket, string> = {
  TODAY: "Today",
  TOMORROW: "Tomorrow",
  THIS_WEEK: "This week",
  NEXT_WEEK: "Next week",
  NONE: "No date",
};

/** 0 = Monday … 6 = Sunday */
function weekday(iso: string): number {
  return (isoToDate(iso).getUTCDay() + 6) % 7;
}

/** Bucket → calendar date (weeks run Monday–Sunday; "This week" = Saturday, the last working day). */
export function bucketToDate(bucket: DueBucket, today: string): string | null {
  switch (bucket) {
    case "TODAY":
      return today;
    case "TOMORROW":
      return addDaysIso(today, 1);
    case "THIS_WEEK":
      return weekday(today) >= 5 ? today : addDaysIso(today, 5 - weekday(today));
    case "NEXT_WEEK":
      return addDaysIso(today, 7 - weekday(today));
    case "NONE":
      return null;
  }
}

/** Date → the bucket it currently falls in (null when it is in the past or beyond next week). */
export function dateToBucket(date: string | null, today: string): DueBucket | null {
  if (!date) return "NONE";
  if (date === today) return "TODAY";
  if (date === addDaysIso(today, 1)) return "TOMORROW";
  const endOfWeek = addDaysIso(today, 6 - weekday(today));
  if (date > today && date <= endOfWeek) return "THIS_WEEK";
  if (date > endOfWeek && date <= addDaysIso(endOfWeek, 7)) return "NEXT_WEEK";
  return null;
}

export function whenLabel(date: string | null, time: string | null, today: string): string {
  if (!date) return "No due date";
  const bucket = dateToBucket(date, today);
  const day = bucket ? DUE_LABEL[bucket] : date < today ? `Overdue · ${formatDayMonth(date)}` : formatDayMonth(date);
  return time ? `${day} · ${formatTime12(time)}` : day;
}

export const createTodoSchema = z.object({
  text: text(200).pipe(z.string().min(1, "Type the task")),
  due: z.enum(DUE_BUCKETS),
  time: hhmm.nullable(),
  important: z.boolean(),
  remind: z.boolean(),
});

export const updateTodoSchema = z.object({
  id: z.uuid(),
  patch: z
    .object({
      text: text(200).pipe(z.string().min(1)),
      due: z.enum(DUE_BUCKETS),
      dueDate: isoDate.nullable(),
      time: hhmm.nullable(),
      important: z.boolean(),
      remind: z.boolean(),
      note: text(1000),
      done: z.boolean(),
    })
    .partial(),
});
