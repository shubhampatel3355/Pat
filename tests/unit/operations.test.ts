import { describe, expect, it } from "vitest";
import { bdMeetingInputSchema, bdMeetingUpdateSchema } from "@/lib/schemas/bd";
import { followUpInputSchema, taskInputSchema } from "@/lib/schemas/tasks";
import { cabBookingInputSchema, cabStatusInputSchema } from "@/lib/schemas/vehicles";
import { dueTone, followUpTab, instantLabel, rescheduleOptions, splitInstant } from "@/lib/tasks";
import { uploadSummary } from "@/lib/upload-client";

const ID = "01a16334-418e-7061-ad0d-0a2bf1c6a0d2";
const ID2 = "01a16334-418e-7061-ad0d-0a2bf1c6a0d3";
// 22 Oct 2026, 10:00 IST
const NOW = "2026-10-22T04:30:00.000Z";
const TODAY = "2026-10-22";

describe("due labels and tones (IST)", () => {
  it.each([
    ["2026-10-22T12:30:00.000Z", "Today 6:00 pm"],
    ["2026-10-23T05:30:00.000Z", "Tomorrow 11:00 am"],
    ["2026-10-21T04:00:00.000Z", "Yesterday 9:30 am"],
    ["2026-10-30T04:30:00.000Z", "30 Oct, 10:00 am"],
  ])("%s → %s", (at, label) => expect(instantLabel(at, TODAY)).toBe(label));

  it("tones: overdue once passed, today for the rest of the day", () => {
    expect(dueTone("2026-10-22T04:00:00.000Z", NOW, TODAY)).toBe("overdue");
    expect(dueTone("2026-10-22T12:30:00.000Z", NOW, TODAY)).toBe("today");
    expect(dueTone("2026-10-25T04:30:00.000Z", NOW, TODAY)).toBe("later");
    expect(dueTone(null, NOW, TODAY)).toBe("none");
    expect(dueTone("2026-10-20T04:30:00.000Z", NOW, TODAY, true)).toBe("none");
  });

  it("follow-up tabs", () => {
    expect(followUpTab("2026-10-22T03:00:00.000Z", NOW, TODAY)).toBe("OVERDUE");
    expect(followUpTab("2026-10-22T13:00:00.000Z", NOW, TODAY)).toBe("TODAY");
    // 23 Oct 00:30 IST is tomorrow even though it's still 22 Oct in UTC
    expect(followUpTab("2026-10-22T19:00:00.000Z", NOW, TODAY)).toBe("UPCOMING");
  });

  it("reschedule choices drop 'later today' after 5 pm", () => {
    expect(rescheduleOptions(NOW, TODAY).map((o) => o.label)).toEqual(["Today 6:00 pm", "Tomorrow 11:00 am", "24 Oct, 10:00 am"]);
    expect(rescheduleOptions("2026-10-22T12:00:00.000Z", TODAY).map((o) => o.label)).toEqual(["Tomorrow 11:00 am", "24 Oct, 10:00 am"]);
  });

  it("splits instants into IST date and time for forms", () => {
    expect(splitInstant("2026-10-22T19:00:00.000Z")).toEqual({ date: "2026-10-23", time: "00:30" });
    expect(splitInstant(null)).toBeNull();
  });
});

describe("cab booking input", () => {
  const ok = { carType: "SUV", clientName: "Vertex Semiconductors", pickupDate: "2026-10-23", pickupTime: "10:00", pickupLocation: "Kempegowda Airport, T2", bookedForId: ID } as const;
  it("accepts a booking", () => expect(cabBookingInputSchema.safeParse(ok).success).toBe(true));
  it.each([
    ["unknown car", { carType: "BUS" }],
    ["bad time", { pickupTime: "25:00" }],
    ["short pick-up", { pickupLocation: "T2" }],
    ["no client", { clientName: " " }],
  ])("rejects %s", (_, patch) => expect(cabBookingInputSchema.safeParse({ ...ok, ...patch }).success).toBe(false));
  it("status changes are limited to the workflow's targets", () => {
    expect(cabStatusInputSchema.safeParse({ id: ID, status: "CONFIRMED" }).success).toBe(true);
    expect(cabStatusInputSchema.safeParse({ id: ID, status: "REQUESTED" }).success).toBe(false);
  });
});

describe("BD meeting input", () => {
  const ok = {
    primaryBrokerId: ID,
    secondaryBrokerId: null,
    meetingDate: "2026-10-22",
    tenantName: "Lumen Robotics",
    contactName: "Kiran Desai",
    designation: "",
    meetingType: "SITE_TOUR",
    mode: "IN_PERSON",
    temperature: "WARM",
    comments: "",
  } as const;
  it("normalises phones and emails", () => {
    const r = bdMeetingInputSchema.parse({ ...ok, phone: "+91 98451 77320", email: " Kiran@LumenRobotics.in " });
    expect(r.phone).toBe("9845177320");
    expect(r.email).toBe("kiran@lumenrobotics.in");
  });
  it("accepts landlines and empty contact info", () => {
    expect(bdMeetingInputSchema.parse({ ...ok, phone: "080 4718 2200", email: "" }).phone).toBe("08047182200");
    expect(bdMeetingInputSchema.safeParse(ok).success).toBe(true);
  });
  it("rejects bad contacts and duplicate brokers", () => {
    expect(bdMeetingInputSchema.safeParse({ ...ok, phone: "12345" }).success).toBe(false);
    expect(bdMeetingInputSchema.safeParse({ ...ok, email: "not-an-email" }).success).toBe(false);
    expect(bdMeetingInputSchema.safeParse({ ...ok, secondaryBrokerId: ID }).success).toBe(false);
    expect(bdMeetingUpdateSchema.safeParse({ ...ok, id: ID2, secondaryBrokerId: ID2 }).success).toBe(true);
  });
  it("only knows the four temperatures", () => expect(bdMeetingInputSchema.safeParse({ ...ok, temperature: "LUKE_WARM" }).success).toBe(false));
});

describe("tasks and follow-ups input", () => {
  const task = { title: "Send cost sheet", assigneeId: ID, dueDate: "2026-10-23", dueTime: "18:00", priority: "HIGH", leadId: null, remindInApp: true, remindEmail: false, remindWhatsapp: false } as const;
  it("accepts a task, with or without a due date", () => {
    expect(taskInputSchema.safeParse(task).success).toBe(true);
    expect(taskInputSchema.safeParse({ ...task, dueDate: null, dueTime: null }).success).toBe(true);
  });
  it("needs a real title and priority", () => {
    expect(taskInputSchema.safeParse({ ...task, title: "ok" }).success).toBe(false);
    expect(taskInputSchema.safeParse({ ...task, priority: "CRITICAL" }).success).toBe(false);
  });
  it("follow-ups need a contact, a date and a time", () => {
    const f = { contactName: "Ritika Sharma", type: "CALL", note: "", leadId: null, ownerId: ID, dueDate: "2026-10-23", dueTime: "11:00" } as const;
    expect(followUpInputSchema.safeParse(f).success).toBe(true);
    expect(followUpInputSchema.safeParse({ ...f, dueTime: "" }).success).toBe(false);
    expect(followUpInputSchema.safeParse({ ...f, type: "SMS" }).success).toBe(false);
  });
});

describe("upload toasts", () => {
  const file = { id: ID, name: "a.pdf", ext: "PDF", sizeBytes: 1, uploadedAt: "", uploadedBy: "", ownerName: null, canDelete: true };
  it("success, mixed and failure in one message", () => {
    expect(uploadSummary({ files: [file], errors: [] }, "Client Documents")).toEqual({ message: "1 file uploaded to Client Documents", tone: "info" });
    expect(uploadSummary({ files: [file, file], errors: ["x.pdf: not allowed"] }, "Vault")).toEqual({ message: "2 files uploaded to Vault · x.pdf: not allowed", tone: "error" });
    expect(uploadSummary({ files: [], errors: [] }, "Vault")).toBeNull();
  });
});
