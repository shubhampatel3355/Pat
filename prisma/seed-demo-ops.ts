/**
 * DEV / DEMO ONLY — the prototype's cab bookings, BD meetings, tasks, follow-ups and vault files (dates
 * shifted to today). Each section is skipped when its table already has rows. Called from seed-demo.ts.
 */
import { createCipheriv, randomBytes } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { CabStatus, CarType, FollowUpType, LeadTemperature, MeetingMode, MeetingType, TaskPriority, TaskStatus } from "../src/generated/prisma/enums";
import { addDaysIso, isoDateIST, isoToDate, istToInstant } from "../src/lib/dates";

/** Same v1 AES-256-GCM format as src/server/crypto.ts (which is server-only and can't be imported here). */
function encrypt(plain: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (base64) to seed client contacts");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

type Key = "PM" | "AR" | "NS" | "KI" | "SK" | "RV" | "DN" | "IP" | "AM" | "VB" | "RK";
export type DemoIds = Record<Key, string>;

// [booked for, car, date, time, pick-up, booked on (date, time), status, client] — VM0
const CABS: [Key, CarType, string, string, string, [string, string], CabStatus, string][] = [
  ["NS", "SEDAN", "2026-10-08", "11:00", "Office — 14, Lavelle Road", ["2026-10-08", "09:12"], "CONFIRMED", "Zeta Fintech"],
  ["KI", "SUV", "2026-10-08", "14:30", "Prestige Tech Park, Marathahalli", ["2026-10-07", "18:40"], "CONFIRMED", "Orbit Logistics"],
  ["PM", "SEDAN", "2026-10-09", "09:00", "Home — Koramangala 5th Block", ["2026-10-07", "16:05"], "REQUESTED", "Kirana Labs"],
  ["SK", "SEDAN", "2026-10-09", "16:00", "WeWork Galaxy, Residency Road", ["2026-10-07", "11:20"], "REQUESTED", "Northstar Analytics"],
  ["VB", "SUV", "2026-10-10", "10:00", "Office — 14, Lavelle Road", ["2026-10-06", "17:30"], "CONFIRMED", "Halcyon Health"],
  ["RV", "SEDAN", "2026-10-06", "15:00", "Embassy Tech Village, ORR", ["2026-10-05", "10:15"], "COMPLETED", "Tidal Payments"],
];

// [broker, secondary, date, tenant, sector, contact, designation, phone, email, type, temperature, mode, comments] — BD0
const MEETINGS: [Key, Key | null, string, string, string, string, string, string, string, MeetingType, LeadTemperature, MeetingMode, string][] = [
  ["NS", "KI", "2026-10-07", "Zeta Fintech", "Fintech", "Ritika Sharma", "Head of Admin", "9845022114", "ritika.sharma@zeta.tech", "REQUIREMENT", "HOT", "IN_PERSON", "Needs 140 seats on ORR by Jan. Shortlisted Prestige Tech Park and RMZ Ecospace."],
  ["KI", null, "2026-10-06", "Northstar Analytics", "Data & AI", "Arvind Menon", "VP Operations", "9900187213", "arvind@northstar.ai", "SITE_TOUR", "WARM", "IN_PERSON", "Second floor at RMZ Ecospace visited. Wants fit-out cost split."],
  ["SK", "RV", "2026-10-06", "Kirana Labs", "Retail tech", "Megha Rao", "Founder & CEO", "9741130982", "megha@kiranalabs.in", "PROPOSAL", "HOT", "VIDEO_CALL", "Managed office, 60 seats. Proposal sent; decision this week."],
  ["NS", "DN", "2026-10-05", "Halcyon Health", "Healthcare", "Dr. Suresh Pillai", "Chief Operating Officer", "9886244107", "suresh.pillai@halcyon.health", "INTRODUCTION", "LUKEWARM", "IN_PERSON", "Exploring a consolidation of two offices into Domlur."],
  ["RV", null, "2026-10-04", "Brightpath Edu", "Ed-tech", "Anjali Kulkarni", "Facilities Manager", "9008055621", "anjali.k@brightpath.edu", "REQUIREMENT", "COLD", "PHONE_CALL", "Early stage. Budget not confirmed; call back in November."],
  ["KI", "NS", "2026-10-03", "Saffron Studios", "Media", "Rahul Iyer", "Studio Head", "8123490876", "rahul@saffronstudios.in", "FOLLOW_UP", "WARM", "IN_PERSON", "Happy with UB City option; asked for 9-year lock-in terms."],
  ["NS", "KI", "2026-10-02", "Vertex Semiconductors", "Hardware", "Kavitha Ramesh", "Director, Real Estate APAC", "9964511873", "kavitha.ramesh@vertexsemi.com", "PROPOSAL", "HOT", "VIDEO_CALL", "22,000 sq ft at Manyata. Board approval expected mid-November."],
  ["SK", null, "2026-10-01", "Mosaic Design Co.", "Design", "Tara Bhat", "Partner", "9535877420", "tara@mosaicdesign.co", "FOLLOW_UP", "LUKEWARM", "PHONE_CALL", "Lease renewal on hold until Q1 hiring plan is final."],
  ["IP", "RV", "2026-09-30", "Greenleaf Agritech", "Agri-tech", "Vivek Gowda", "CFO", "9632066218", "vivek.gowda@greenleaf.ag", "INTRODUCTION", "COLD", "IN_PERSON", "Prefers North Bengaluru near the airport. Sharing Bhartiya City options."],
  ["RV", "NS", "2026-09-28", "Tidal Payments", "Fintech", "Neeraj Shah", "Head of Workplace", "9880341295", "neeraj@tidalpay.in", "SITE_TOUR", "WARM", "IN_PERSON", "Visited Embassy Tech Village. Comparing with Bagmane."],
];

// [contact, tenant (WIP row), type, note, owner, day offset from today, time] — follow-ups in the prototype's mix
const FOLLOW_UPS: [string, string, FollowUpType, string, Key, number, string][] = [
  ["Ritika Sharma", "Zeta Fintech", "CALL", "Budget confirmation", "NS", 0, "11:30"],
  ["Arvind Menon", "Northstar Analytics", "MEETING", "Negotiation call", "KI", 0, "13:00"],
  ["Dr. Suresh Pillai", "Halcyon Health", "SITE_VISIT", "Post-visit feedback", "NS", 0, "15:30"],
  ["Megha Rao", "Kirana Labs", "WHATSAPP", "Share floor plan", "SK", 0, "15:00"],
  ["Vivek Gowda", "Greenleaf Agritech", "EMAIL", "Send cost sheet", "IP", 0, "16:30"],
  ["Anjali Kulkarni", "Brightpath Edu", "CALL", "Budget confirmation", "RV", 0, "17:00"],
  ["Neeraj Shah", "Tidal Payments", "WHATSAPP", "Share Bagmane comparison", "RV", 0, "18:00"],
  ["Kavitha Ramesh", "Vertex Semiconductors", "CALL", "Board approval status", "NS", -1, "16:00"],
  ["Rahul Iyer", "Saffron Studios", "EMAIL", "Lock-in terms", "KI", -1, "11:00"],
  ["Tara Bhat", "Mosaic Design Co.", "CALL", "Renewal decision", "SK", -2, "10:00"],
  ["Ritika Sharma", "Zeta Fintech", "MEETING", "LOI walkthrough", "NS", 1, "11:00"],
  ["Arvind Menon", "Northstar Analytics", "EMAIL", "Fit-out cost split", "KI", 1, "15:00"],
  ["Megha Rao", "Kirana Labs", "CALL", "Decision on proposal", "SK", 2, "10:30"],
  ["Kavitha Ramesh", "Vertex Semiconductors", "MEETING", "Term sheet review", "NS", 3, "14:00"],
  ["Vivek Gowda", "Greenleaf Agritech", "SITE_VISIT", "Bhartiya City tour", "IP", 4, "11:00"],
  ["Neeraj Shah", "Tidal Payments", "SITE_VISIT", "Bagmane Tech Park tour", "RV", 5, "10:00"],
];

// [title, assignee, day offset, time, priority, status, tenant (WIP row) or null] — TASKS0, made commercial
const TASKS: [string, Key, number, string, TaskPriority, TaskStatus, string | null][] = [
  ["Send cost sheet — Zeta Fintech", "KI", 0, "18:00", "HIGH", "TODO", "Zeta Fintech"],
  ["Collect KYC documents — Kirana Labs", "NS", 1, "18:00", "URGENT", "IN_PROGRESS", "Kirana Labs"],
  ["Update Prestige Tech Park rent card", "RV", 2, "18:00", "MEDIUM", "TODO", null],
  ["Book cab for Halcyon Health site tour", "SK", 0, "10:45", "HIGH", "DONE", "Halcyon Health"],
  ["Upload LOI draft — Vertex Semiconductors", "DN", 2, "18:00", "MEDIUM", "IN_PROGRESS", "Vertex Semiconductors"],
  ["Call back Ritika Sharma on budget", "KI", 0, "09:30", "URGENT", "TODO", "Zeta Fintech"],
  ["Share Bhartiya City layout with Greenleaf", "IP", 1, "18:00", "LOW", "TODO", "Greenleaf Agritech"],
  ["Prepare term sheet — Saffron Studios", "NS", 1, "18:00", "HIGH", "IN_PROGRESS", "Saffron Studios"],
  ["Weekly pipeline review with partners", "PM", 1, "10:00", "MEDIUM", "TODO", null],
  ["Renew Skyline Cabs vendor contract", "DN", 5, "18:00", "LOW", "DONE", null],
];

export async function seedDemoOps(prisma: PrismaClient, ids: DemoIds, shift: (iso: string) => string, log: (m: string) => void) {
  if (!(await prisma.cabBooking.count())) {
    await prisma.cabBooking.createMany({
      data: CABS.map(([who, carType, date, time, pickupLocation, [onDate, onTime], status, clientName]) => ({
        carType,
        clientName,
        pickupDate: isoToDate(shift(date)),
        pickupTime: time,
        pickupLocation,
        bookedForId: ids[who],
        createdById: ids[who],
        status,
        statusChangedById: status === "REQUESTED" ? null : ids.RK,
        statusChangedAt: status === "REQUESTED" ? null : istToInstant(shift(onDate), "19:00"),
        createdAt: istToInstant(shift(onDate), onTime),
      })),
    });
    log(`Inserted ${CABS.length} cab bookings`);
  }

  if (!(await prisma.bdMeeting.count())) {
    await prisma.bdMeeting.createMany({
      data: MEETINGS.map(([p1, p2, date, tenantName, sector, contactName, designation, phone, email, meetingType, temperature, mode, comments]) => ({
        primaryBrokerId: ids[p1],
        secondaryBrokerId: p2 ? ids[p2] : null,
        meetingDate: isoToDate(shift(date)),
        tenantName,
        sector,
        contactName,
        designation,
        clientPhoneEnc: encrypt(phone),
        clientEmailEnc: encrypt(email),
        meetingType,
        temperature,
        mode,
        comments,
        createdById: ids[p1],
        createdAt: istToInstant(shift(date), "18:00"),
      })),
    });
    log(`Inserted ${MEETINGS.length} BD meetings`);
  }

  const leads = new Map((await prisma.lead.findMany({ select: { id: true, tenantName: true } })).map((l) => [l.tenantName, l.id]));
  const today = isoDateIST();

  if (!(await prisma.followUp.count())) {
    await prisma.followUp.createMany({
      data: FOLLOW_UPS.map(([contactName, tenant, type, note, owner, offset, time]) => ({
        contactName,
        leadId: leads.get(tenant) ?? null,
        type,
        note,
        ownerId: ids[owner],
        createdById: ids[owner],
        dueAt: istToInstant(addDaysIso(today, offset), time),
        createdAt: istToInstant(addDaysIso(today, Math.min(offset, 0) - 3), "10:00"),
      })),
    });
    log(`Inserted ${FOLLOW_UPS.length} follow-ups`);
  }

  if (!(await prisma.task.count())) {
    for (const [title, assignee, offset, time, priority, status, tenant] of TASKS) {
      const created = await prisma.task.create({
        data: {
          title,
          assigneeId: ids[assignee],
          createdById: ids.PM,
          dueAt: istToInstant(addDaysIso(today, offset), time),
          priority,
          status,
          leadId: tenant ? (leads.get(tenant) ?? null) : null,
          remindInApp: true,
          remindEmail: priority === "URGENT",
          completedAt: status === "DONE" ? new Date() : null,
          createdAt: istToInstant(addDaysIso(today, -4), "09:00"),
        },
      });
      if (title.startsWith("Collect KYC")) {
        await prisma.taskComment.create({ data: { taskId: created.id, authorId: ids.NS, body: "PAN and GST certificate received. Waiting on the board resolution.", createdAt: istToInstant(addDaysIso(today, -1), "17:20") } });
      }
    }
    log(`Inserted ${TASKS.length} tasks`);
  }
}
