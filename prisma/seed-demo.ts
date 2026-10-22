/**
 * DEV / DEMO ONLY — loads the design prototype's sample data (team, WIP, to-dos, …) so screens can be
 * compared side by side with design-reference/. Refuses to run when NODE_ENV=production.
 * Idempotent: rows are matched by natural keys (email, tenant name, …) and skipped if present.
 *
 *   pnpm db:seed:demo
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { WipRemark } from "../src/generated/prisma/enums";
import { ARGON2_OPTIONS } from "../src/server/auth/argon-options";
import { addDaysIso, currentFy, formatDate, fyQuarterOfIso, isoDateIST, isoToDate, istToInstant } from "../src/lib/dates";
import { estimatedFeesPaise } from "../src/lib/wip";
import { createSeedClient, seedBase } from "./seed";
import { seedDemoFinance } from "./seed-demo-finance";

if (process.env.NODE_ENV === "production") {
  console.error("seed-demo refuses to run with NODE_ENV=production");
  process.exit(1);
}

const LAKH = 100_000 * 100; // paise
const TODAY = isoDateIST();
// The prototype is set around 8 Oct 2026; shift its dates so the demo always looks current.
const PROTO_TODAY = "2026-10-08";
const OFFSET = Math.round((Date.parse(TODAY) - Date.parse(PROTO_TODAY)) / 86_400_000);
const shift = (iso: string) => addDaysIso(iso, OFFSET);

type Key = "PM" | "AR" | "NS" | "KI" | "SK" | "RV" | "DN" | "IP" | "AM" | "VB" | "RK";

const PEOPLE: Record<Exclude<Key, "PM" | "AR">, { name: string; title: string; role: "ADMIN" | "EMPLOYEE"; partner: "PM" | "AR"; doj: string; monthly: number; phone: string; qTargetL: number }> = {
  NS: { name: "Neha Sharma", title: "Senior sales manager", role: "EMPLOYEE", partner: "PM", doj: "2021-03-12", monthly: 82000, phone: "9845021734", qTargetL: 48 },
  KI: { name: "Karthik Iyer", title: "Sales manager", role: "EMPLOYEE", partner: "PM", doj: "2021-08-04", monthly: 72000, phone: "9900144210", qTargetL: 42 },
  SK: { name: "Sana Khan", title: "Sales executive", role: "EMPLOYEE", partner: "PM", doj: "2022-01-19", monthly: 52000, phone: "9741180233", qTargetL: 30 },
  RV: { name: "Rahul Verma", title: "Sales executive", role: "EMPLOYEE", partner: "PM", doj: "2022-06-07", monthly: 48000, phone: "9886255190", qTargetL: 30 },
  DN: { name: "Divya Nair", title: "Sales executive", role: "EMPLOYEE", partner: "AR", doj: "2023-02-02", monthly: 46000, phone: "9008031427", qTargetL: 27 },
  IP: { name: "Imran Pasha", title: "Plots specialist", role: "EMPLOYEE", partner: "AR", doj: "2023-09-15", monthly: 50000, phone: "9964571102", qTargetL: 24 },
  AM: { name: "Anita Mathew", title: "Accounts lead", role: "ADMIN", partner: "PM", doj: "2020-06-03", monthly: 64000, phone: "9535820914", qTargetL: 0 },
  VB: { name: "Vinod Babu", title: "Site office manager", role: "EMPLOYEE", partner: "AR", doj: "2021-11-11", monthly: 42000, phone: "9632018845", qTargetL: 0 },
  RK: { name: "Ravi Kumar", title: "Cab coordinator", role: "EMPLOYEE", partner: "AR", doj: "2022-05-08", monthly: 28000, phone: "9880392271", qTargetL: 0 },
};

const LANDLORDS: Record<string, [string, "LANDLORD" | "OPERATOR"]> = {
  "Prestige Tech Park": ["Prestige Group", "LANDLORD"],
  "RMZ Ecospace": ["RMZ Corp", "LANDLORD"],
  "WeWork Galaxy": ["WeWork India", "OPERATOR"],
  "Embassy Golf Links": ["Embassy Group", "LANDLORD"],
  "Bagmane Tech Park": ["Bagmane Group", "LANDLORD"],
  "Awfis Brigade Signature": ["Awfis", "OPERATOR"],
  "UB City": ["UB Group", "LANDLORD"],
  "Manyata Tech Park": ["Embassy Group", "LANDLORD"],
  "Table Space Pinnacle": ["Table Space", "OPERATOR"],
  "Bhartiya City": ["Bhartiya Urban", "LANDLORD"],
  "Prestige Trade Tower": ["Prestige Group", "LANDLORD"],
  "Embassy Tech Village": ["Embassy Group", "LANDLORD"],
};

const REMARK: Record<string, WipRemark> = {
  Visits: "VISITS",
  Meetings: "MEETINGS",
  "Follow Up Meetings": "FOLLOW_UP_MEETINGS",
  Negotiations: "NEGOTIATIONS",
  "On Hold": "ON_HOLD",
  Lost: "LOST",
  "Invoice Raised": "INVOICE_RAISED",
  "Payment Collected": "PAYMENT_COLLECTED",
};

// [tenant, area sq ft, seats, basis, rate (₹), building, location, primary, secondary, closure, remark] — WIP0 in the prototype
const WIP: [string, number, number, "sqft" | "seat", number, string, string, Key, Key | null, string, string][] = [
  ["Zeta Fintech", 12500, 140, "sqft", 92, "Prestige Tech Park", "Marathahalli, ORR", "NS", "KI", "2026-10-28", "Negotiations"],
  ["Northstar Analytics", 8200, 95, "sqft", 85, "RMZ Ecospace", "Bellandur, ORR", "KI", null, "2026-11-15", "Follow Up Meetings"],
  ["Kirana Labs", 0, 60, "seat", 9500, "WeWork Galaxy", "Residency Road, CBD", "SK", "RV", "2026-10-20", "Invoice Raised"],
  ["Halcyon Health", 15800, 180, "sqft", 110, "Embassy Golf Links", "Domlur, Inner Ring Road", "NS", "DN", "2026-12-10", "Meetings"],
  ["Brightpath Edu", 5400, 62, "sqft", 78, "Bagmane Tech Park", "CV Raman Nagar", "RV", null, "2026-11-05", "Visits"],
  ["Orbit Logistics", 0, 40, "seat", 8200, "Awfis Brigade Signature", "Yeshwanthpur", "DN", "SK", "2026-10-12", "Payment Collected"],
  ["Saffron Studios", 3600, 38, "sqft", 96, "UB City", "Vittal Mallya Road, CBD", "KI", "NS", "2026-11-30", "Negotiations"],
  ["Vertex Semiconductors", 22000, 240, "sqft", 88, "Manyata Tech Park", "Hebbal, ORR North", "NS", "KI", "2027-01-20", "Meetings"],
  ["Mosaic Design Co.", 0, 24, "seat", 11000, "Table Space Pinnacle", "Indiranagar", "SK", null, "2026-10-25", "On Hold"],
  ["Greenleaf Agritech", 6800, 72, "sqft", 70, "Bhartiya City", "Thanisandra", "IP", "RV", "2026-12-18", "Visits"],
  ["Copperline Legal", 4200, 36, "sqft", 125, "Prestige Trade Tower", "Palace Road, CBD", "KI", null, "2026-09-30", "Lost"],
  ["Tidal Payments", 9600, 110, "sqft", 98, "Embassy Tech Village", "Devarabeesanahalli, ORR", "RV", "NS", "2026-11-22", "Follow Up Meetings"],
];

// [text, due offset days | null, time, important, remind, note, done] — TODOS0
const TODOS: [string, number | null, string, boolean, boolean, string, boolean][] = [
  ["Call back Rohan Mehta on budget", 0, "09:30", true, true, "Share revised rent for 12k sq ft, Prestige Tech Park.", false],
  ["Send cost sheet — Vikram Shetty", 0, "18:00", false, true, "", false],
  ["Collect KYC documents — Karan Malhotra", 1, "11:00", false, false, "PAN, Aadhaar, 3 salary slips.", false],
  ["Prepare LOI draft — Zeta Fintech", 3, "15:00", true, true, "", false],
  ["Weekly pipeline review with partners", 7, "10:00", false, false, "", true],
];

// Team activity ticker (FEED_POOL)
const FEED: [Key, string, string][] = [
  ["NS", "WIP", "logged a call with Zeta Fintech"],
  ["KI", "WIP", "moved Orbit Logistics to Negotiations"],
  ["SK", "WIP", "completed a site visit at Prestige Tech Park"],
  ["RV", "WIP", "sent the LOI to Vertex Semiconductors"],
  ["DN", "WIP", "added a new lead: Kirana Labs"],
  ["IP", "Vehicles", "booked a cab for 3:00 pm"],
];

export async function seedDemo(prisma: PrismaClient, log: (m: string) => void = console.log) {
  await seedBase(prisma, log);
  const password = await hash(process.env.SEED_DEMO_PASSWORD || "Demo-Password-2026", ARGON2_OPTIONS);
  const ids = {} as Record<Key, string>;

  const owners = await prisma.user.findMany({ where: { role: "OWNER" }, orderBy: { createdAt: "asc" } });
  ids.PM = owners.find((o) => o.email.startsWith("pat"))?.id ?? owners[0]!.id;
  ids.AR = owners.find((o) => o.email.startsWith("arjun"))?.id ?? owners[1]?.id ?? ids.PM;
  await prisma.user.updateMany({ where: { id: { in: [ids.PM, ids.AR] } }, data: { phone: "9845000001" } });

  for (const [key, p] of Object.entries(PEOPLE) as [Exclude<Key, "PM" | "AR">, (typeof PEOPLE)[keyof typeof PEOPLE]][]) {
    const email = `${p.name.split(" ")[0]!.toLowerCase()}@patmichaels.in`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: p.name,
        title: p.title,
        role: p.role,
        phone: p.phone,
        partnerId: ids[p.partner],
        dateOfJoining: isoToDate(p.doj),
        ctcAnnualPaise: BigInt(p.monthly * 12 * 100),
        passwordHash: password,
        lastLoginAt: new Date(),
      },
    });
    ids[key] = user.id;
  }
  log("Demo team ready (password: SEED_DEMO_PASSWORD or Demo-Password-2026)");

  // Targets: company WIP fees this quarter, partner revenue this FY, member revenue this quarter.
  const fy = currentFy();
  const quarter = fyQuarterOfIso(TODAY);
  const upsertTarget = (scope: "COMPANY" | "PARTNER" | "USER", scopeKey: string, metric: "REVENUE" | "WIP_FEES", period: string, amount: number) =>
    prisma.target.upsert({
      where: { scope_scopeKey_metric_period: { scope, scopeKey, metric, period } },
      update: {},
      create: { scope, scopeKey, metric, period, amountPaise: BigInt(amount) },
    });
  await upsertTarget("PARTNER", ids.PM, "REVENUE", fy.key, 1400 * LAKH);
  await upsertTarget("PARTNER", ids.AR, "REVENUE", fy.key, 1000 * LAKH);
  for (const [key, p] of Object.entries(PEOPLE) as [Exclude<Key, "PM" | "AR">, (typeof PEOPLE)[keyof typeof PEOPLE]][]) {
    if (!p.qTargetL) continue;
    await upsertTarget("USER", ids[key], "REVENUE", quarter.key, p.qTargetL * LAKH);
    await upsertTarget("USER", ids[key], "WIP_FEES", quarter.key, Math.round(p.qTargetL * 0.6) * LAKH);
  }

  // WIP
  let leads = 0;
  for (const [tenant, area, seats, basis, rate, building, location, p1, p2, close, remark] of WIP) {
    if (await prisma.lead.findFirst({ where: { tenantName: tenant } })) continue;
    const pricingBasis = basis === "sqft" ? "PER_SQFT" : "PER_SEAT";
    const ratePaise = rate * 100;
    const [landlordName, landlordType] = LANDLORDS[building] ?? ["Owner entity", "LANDLORD"];
    const areaSqft = pricingBasis === "PER_SQFT" ? area : null;
    const seatCount = pricingBasis === "PER_SEAT" ? seats : null;
    await prisma.lead.create({
      data: {
        tenantName: tenant,
        pricingBasis,
        areaSqft,
        seats: seatCount,
        ratePaise: BigInt(ratePaise),
        building,
        location,
        landlordType,
        landlordName,
        estFeesPaise: BigInt(estimatedFeesPaise(pricingBasis, ratePaise, areaSqft, seatCount)),
        closureDate: isoToDate(remark === "Payment Collected" || remark === "Lost" ? addDaysIso(TODAY, -8) : shift(close)),
        remark: REMARK[remark]!,
        createdById: ids[p1],
        brokers: {
          create: [
            { role: "PRIMARY", userId: ids[p1], position: 0 },
            ...(p2 ? [{ role: "SECONDARY" as const, userId: ids[p2], position: 0 }] : []),
          ],
        },
      },
    });
    leads++;
  }
  if (leads) log(`Inserted ${leads} WIP rows`);

  // Achievement for the collected deal
  const orbit = await prisma.lead.findFirst({ where: { tenantName: "Orbit Logistics" } });
  if (orbit && !(await prisma.achievement.findFirst({ where: { leadId: orbit.id } }))) {
    await prisma.achievement.create({
      data: {
        kind: "DEAL_CLOSED",
        userId: ids.DN,
        leadId: orbit.id,
        title: "Divya Nair closed Orbit Logistics",
        meta: `Awfis Brigade Signature · ${formatDate(addDaysIso(TODAY, -2))}`,
        valuePaise: orbit.estFeesPaise,
        createdAt: istToInstant(addDaysIso(TODAY, -2), "16:00"),
      },
    });
  }

  // To-dos for Pat
  if (!(await prisma.todo.count({ where: { userId: ids.PM } }))) {
    await prisma.todo.createMany({
      data: TODOS.map(([text, offset, time, important, remind, note, done]) => ({
        userId: ids.PM,
        text,
        dueDate: offset === null ? null : isoToDate(addDaysIso(TODAY, offset)),
        dueTime: offset === null ? null : time,
        important,
        remind,
        note: note || null,
        done,
        doneAt: done ? new Date() : null,
      })),
    });
    log("Inserted to-dos for Pat");
  }

  // Team activity
  if (!(await prisma.auditLog.count({ where: { feed: true } }))) {
    const people = await prisma.user.findMany({ where: { id: { in: FEED.map(([k]) => ids[k]) } } });
    await prisma.auditLog.createMany({
      data: FEED.map(([k, module, text], i) => {
        const actor = people.find((p) => p.id === ids[k])!;
        return { actorId: actor.id, actorName: actor.name, module, action: "update", text: `${actor.name} ${text}`, visibility: "PUBLIC" as const, feed: true, createdAt: new Date(Date.now() - (i + 1) * 4 * 60_000) };
      }),
    });
  }

  await seedDemoFinance(prisma, ids, TODAY, shift, log);
  return ids;
}

async function main() {
  const prisma = createSeedClient();
  try {
    await seedDemo(prisma);
    console.log("Demo seed complete.");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && /seed-demo\.(ts|mjs|js)$/.test(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
