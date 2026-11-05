/**
 * Labels and colours for enums, taken from the prototype. Keep this the single source of truth for
 * how a status looks anywhere in the app (lists, pills, charts, PDFs).
 */
import type {
  CabStatus,
  CarType,
  FollowUpType,
  LeadTemperature,
  MeetingMode,
  MeetingType,
  TaskPriority,
  TaskStatus,
  WipRemark,
} from "@/generated/prisma/enums";

/** 18% alpha tint used for pill backgrounds (prototype: colour + "2E"). */
export const tint = (hex: string) => `${hex}2E`;

export const WIP_REMARKS: { value: WipRemark; label: string; color: string }[] = [
  { value: "VISITS", label: "Visits", color: "#A8A8AD" },
  { value: "MEETINGS", label: "Meetings", color: "#9C9CA3" },
  { value: "FOLLOW_UP_MEETINGS", label: "Follow Up Meetings", color: "#E8B84A" },
  { value: "NEGOTIATIONS", label: "Negotiations", color: "#F2994A" },
  { value: "ON_HOLD", label: "On Hold", color: "#6B6B70" },
  { value: "LOST", label: "Lost", color: "#C93C37" },
  { value: "INVOICE_RAISED", label: "Invoice Raised", color: "#023E7D" },
  { value: "PAYMENT_COLLECTED", label: "Payment Collected", color: "#3E9B52" },
];
export const WIP_REMARK = Object.fromEntries(WIP_REMARKS.map((r) => [r.value, r])) as Record<WipRemark, (typeof WIP_REMARKS)[number]>;
/** Remarks that are no longer in the pipeline. */
export const CLOSED_REMARKS: WipRemark[] = ["LOST", "PAYMENT_COLLECTED"];

export const TEMPERATURES: { value: LeadTemperature; label: string; color: string }[] = [
  { value: "COLD", label: "Cold", color: "#5C7FA8" },
  { value: "LUKEWARM", label: "Lukewarm", color: "#E8B84A" },
  { value: "WARM", label: "Warm", color: "#F2994A" },
  { value: "HOT", label: "Hot", color: "#C93C37" },
];
export const TEMPERATURE = Object.fromEntries(TEMPERATURES.map((t) => [t.value, t])) as Record<LeadTemperature, (typeof TEMPERATURES)[number]>;

export const MEETING_TYPES: { value: MeetingType; label: string }[] = [
  { value: "INTRODUCTION", label: "Introduction" },
  { value: "REQUIREMENT", label: "Requirement" },
  { value: "SITE_TOUR", label: "Site tour" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "FOLLOW_UP", label: "Follow-up" },
];

export const MEETING_MODES: { value: MeetingMode; label: string }[] = [
  { value: "IN_PERSON", label: "In person" },
  { value: "VIDEO_CALL", label: "Video call" },
  { value: "PHONE_CALL", label: "Phone call" },
];

export const CAR_TYPES: { value: CarType; label: string; seats: string }[] = [
  { value: "SEDAN", label: "Sedan", seats: "4 seats" },
  { value: "SUV", label: "SUV", seats: "6 seats" },
];

const CAB_STATUSES: { value: CabStatus; label: string; color: string }[] = [
  { value: "REQUESTED", label: "Requested", color: "#E8B84A" },
  { value: "CONFIRMED", label: "Confirmed", color: "#023E7D" },
  { value: "COMPLETED", label: "Completed", color: "#3E9B52" },
  { value: "CANCELLED", label: "Cancelled", color: "#A8A8AD" },
];
export const CAB_STATUS = Object.fromEntries(CAB_STATUSES.map((s) => [s.value, s])) as Record<CabStatus, (typeof CAB_STATUSES)[number]>;

export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: "URGENT", label: "Urgent", color: "#023E7D" },
  { value: "HIGH", label: "High", color: "#F2994A" },
  { value: "MEDIUM", label: "Medium", color: "#F5B73B" },
  { value: "LOW", label: "Low", color: "#A8A8AD" },
];
export const TASK_PRIORITY = Object.fromEntries(TASK_PRIORITIES.map((p) => [p.value, p])) as Record<TaskPriority, (typeof TASK_PRIORITIES)[number]>;

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
  { value: "TODO", label: "To do", color: "#A8A8AD" },
  { value: "IN_PROGRESS", label: "In progress", color: "#F5B73B" },
  { value: "DONE", label: "Done", color: "#3E9B52" },
];
export const TASK_STATUS = Object.fromEntries(TASK_STATUSES.map((s) => [s.value, s])) as Record<TaskStatus, (typeof TASK_STATUSES)[number]>;

export const FOLLOW_UP_TYPES: { value: FollowUpType; label: string; icon: "phone" | "whatsapp" | "email" | "calendar" | "visits" }[] = [
  { value: "CALL", label: "Call", icon: "phone" },
  { value: "WHATSAPP", label: "WhatsApp", icon: "whatsapp" },
  { value: "EMAIL", label: "Email", icon: "email" },
  { value: "MEETING", label: "Meeting", icon: "calendar" },
  { value: "SITE_VISIT", label: "Site visit", icon: "visits" },
];
