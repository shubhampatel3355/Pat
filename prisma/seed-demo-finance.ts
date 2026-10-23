/**
 * DEV / DEMO ONLY — invoices, proformas, payments, credit notes and ledger entries from the start of the
 * previous financial year to today, so Finance, Invoice and the Dashboard show realistic numbers.
 * Includes the prototype's INV0 / PF0 documents (dates shifted to today). Deterministic; skipped when
 * any invoice or ledger entry already exists. Called from seed-demo.ts.
 */
import type { PrismaClient } from "../src/generated/prisma/client";
import type { InvoiceType, PaymentMode } from "../src/generated/prisma/enums";
import { addDaysIso, financialYear, fyOfIso, isoToDate, monthLabel } from "../src/lib/dates";
import { computeGst, gstinCheckChar } from "../src/lib/gstin";
import { dueDateFromTerms, formatDocNumber, settledStatus } from "../src/lib/invoice";

type Broker = "NS" | "KI" | "SK" | "RV" | "DN" | "IP";
type Ids = Record<Broker | "PM" | "AR" | "AM", string>;

const RUPEE = 100; // paise

/** Small deterministic PRNG (mulberry32) so every demo database looks the same. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gstin = (first14: string) => first14 + gstinCheckChar(first14);

interface Client {
  name: string;
  gstin: string;
  address: string;
  mobile: string;
  email: string;
  terms: string;
}

const CLIENTS: Client[] = [
  { name: "Zeta Fintech Pvt Ltd", gstin: gstin("29AABCZ1234F1Z"), address: "Prestige Tech Park, Marathahalli, Bengaluru 560103", mobile: "9845021734", email: "accounts@zeta.tech", terms: "Net 30 days" },
  { name: "Brightpath Edu Pvt Ltd", gstin: gstin("29AAJCB6612K1Z"), address: "Bagmane Tech Park, CV Raman Nagar, Bengaluru 560093", mobile: "9886255190", email: "finance@brightpath.in", terms: "Net 15 days" },
  { name: "Saffron Studios LLP", gstin: gstin("29ABHFS0915C1Z"), address: "UB City, Vittal Mallya Road, Bengaluru 560001", mobile: "9900144210", email: "accounts@saffronstudios.in", terms: "Net 30 days" },
  { name: "Vertex Semiconductors India Pvt Ltd", gstin: gstin("29AAGCV2214H1Z"), address: "Manyata Tech Park, Hebbal, Bengaluru 560045", mobile: "9741180233", email: "ap@vertexsemi.com", terms: "Net 45 days" },
  { name: "Greenleaf Agritech Pvt Ltd", gstin: gstin("29AADCG5530N1Z"), address: "Bhartiya City, Thanisandra, Bengaluru 560064", mobile: "9964571102", email: "accounts@greenleaf.ag", terms: "Net 15 days" },
  { name: "Ardent Capital Advisors LLP", gstin: gstin("27AAOFA3381J1Z"), address: "One BKC, Bandra Kurla Complex, Mumbai 400051", mobile: "9820455671", email: "finance@ardentcapital.in", terms: "Net 30 days" },
  { name: "Lumen Robotics Pvt Ltd", gstin: gstin("33AAECL9902G1Z"), address: "Olympia Tech Park, Guindy, Chennai 600032", mobile: "9840317762", email: "ap@lumenrobotics.in", terms: "Net 30 days" },
  { name: "Bluecanopy Insurance Brokers Pvt Ltd", gstin: gstin("29AAKCB1176R1Z"), address: "Embassy Golf Links, Domlur, Bengaluru 560071", mobile: "9535820914", email: "accounts@bluecanopy.in", terms: "Due on receipt" },
  { name: "Quill & Ink Media Pvt Ltd", gstin: gstin("29AAACQ4471L1Z"), address: "Brigade Gateway, Rajajinagar, Bengaluru 560055", mobile: "9008031427", email: "finance@quillink.in", terms: "Net 15 days" },
  { name: "Copperline Legal LLP", gstin: gstin("29AALFC4410P1Z"), address: "Prestige Trade Tower, Palace Road, Bengaluru 560001", mobile: "9632018845", email: "accounts@copperline.law", terms: "Net 30 days" },
];

const BUILDINGS = ["Prestige Tech Park", "RMZ Ecospace", "Embassy Golf Links", "Bagmane Tech Park", "UB City", "Manyata Tech Park", "Bhartiya City", "Embassy Tech Village", "Salarpuria Sattva Knowledge City", "Brigade Gateway", "RMZ Infinity"];
const OPERATORS = ["WeWork Galaxy", "Awfis Brigade Signature", "Table Space Pinnacle", "Smartworks Vaishnavi Tech Park"];
const BROKERS: Broker[] = ["NS", "KI", "SK", "RV", "DN", "IP"];

interface DocPlan {
  type: InvoiceType;
  date: string;
  client: Client;
  narration: string;
  feesPaise: number;
  brokers: ({ key: Broker; pct: number } | { external: string; pct: number })[];
  lead?: string;
  /** Proformas: converted on this date (creates the tax invoice) or left open. */
  convertOn?: string;
  /** Tax invoices: how the client pays (`delay` = days after the due date). */
  pay: { kind: "full" | "half" | "none"; delay?: number };
  creditPct?: number;
}

const inr = (rupees: number) => Math.round(rupees) * RUPEE;

/** Historical brokerage invoices, about three a month, up to two weeks before today. */
function history(today: string): DocPlan[] {
  const rand = rng(2026);
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
  const prevFy = financialYear(fyOfIso(today).startYear - 1);
  const stop = addDaysIso(today, -16);
  const plans: DocPlan[] = [];
  let i = 0;
  for (let d = prevFy.start; d <= stop; d = addDaysIso(`${d.slice(0, 7)}-01`, 32).slice(0, 7) + "-01") {
    const growth = d >= fyOfIso(today).start ? 1.18 : 1;
    for (const day of [6, 17, 26]) {
      const date = `${d.slice(0, 7)}-${String(day).padStart(2, "0")}`;
      if (date > stop || rand() < 0.15) continue;
      const client = pick(CLIENTS);
      const seats = rand() < 0.3;
      let narration: string;
      let fees: number;
      if (seats) {
        const count = 20 + Math.floor(rand() * 90);
        const perSeat = 8000 + Math.floor(rand() * 4) * 1000;
        narration = `Brokerage — ${count} seats at ${pick(OPERATORS)}`;
        fees = count * perSeat;
      } else {
        const area = (30 + Math.floor(rand() * 190)) * 100;
        const rate = 70 + Math.floor(rand() * 60);
        narration = `Brokerage — ${area.toLocaleString("en-IN")} sq ft at ${pick(BUILDINGS)}`;
        fees = area * rate;
      }
      const primary = pick(BROKERS);
      const second = rand() < 0.55 ? pick(BROKERS.filter((b) => b !== primary)) : null;
      const brokers: DocPlan["brokers"] = second ? [{ key: primary, pct: rand() < 0.6 ? 50 : 60 }, { key: second, pct: 0 }] : [{ key: primary, pct: 100 }];
      if (second) brokers[1]!.pct = 100 - brokers[0]!.pct;
      if (!second && rand() < 0.12) brokers.splice(0, 1, { key: primary, pct: 80 }, { external: "JLL (co-broker)", pct: 20 });
      i++;
      plans.push({
        type: "INVOICE",
        date,
        client,
        narration,
        feesPaise: inr(Math.round((fees * growth) / 1000) * 1000),
        brokers,
        // Most pay around the due date; some in two halves; a few very late; one in 22 never.
        pay: i % 22 === 5 ? { kind: "none" } : i % 11 === 5 ? { kind: "full", delay: 75 } : i % 7 === 3 ? { kind: "half", delay: 3 + Math.floor(rand() * 10) } : { kind: "full", delay: Math.floor(rand() * 24) - 5 },
        creditPct: i === 9 || i === 41 ? 15 : undefined,
      });
    }
  }
  return plans;
}

/** The prototype's INV0 and PF0 documents, shifted with the rest of the demo data. */
function prototypeDocs(shift: (iso: string) => string, leads: Map<string, string>): DocPlan[] {
  return [
    {
      type: "PROFORMA",
      date: shift("2026-09-28"),
      client: { name: "Northstar Analytics Pvt Ltd", gstin: gstin("29AAFCN5521D1Z"), address: "RMZ Ecospace, Bellandur, Bengaluru 560103", mobile: "9880392271", email: "finance@northstar.ai", terms: "Net 15 days" },
      narration: "Brokerage — 95 seats at RMZ Ecospace",
      feesPaise: inr(1000000),
      brokers: [{ key: "KI", pct: 100 }],
      convertOn: shift("2026-10-01"),
      pay: { kind: "none" },
    },
    {
      type: "INVOICE",
      date: shift("2026-09-30"),
      client: { name: "Tidal Payments Pvt Ltd", gstin: gstin("27AAHCT6630R1Z"), address: "Embassy Tech Village, Devarabeesanahalli, Bengaluru 560103", mobile: "9741180233", email: "ap@tidalpay.in", terms: "Net 30 days" },
      narration: "Advisory retainer — September 2026",
      feesPaise: inr(150000),
      brokers: [
        { key: "RV", pct: 50 },
        { key: "NS", pct: 50 },
      ],
      pay: { kind: "none" },
    },
    {
      type: "INVOICE",
      date: shift("2026-10-02"),
      client: { name: "Orbit Logistics India LLP", gstin: gstin("29AAFFO2291Q1Z"), address: "Plot 18, Brigade Signature, Yeshwanthpur, Bengaluru 560022", mobile: "9008031427", email: "finance@orbitlogistics.in", terms: "Due on receipt" },
      narration: "Brokerage — 40 seats at Awfis Brigade Signature",
      feesPaise: inr(328000),
      brokers: [
        { key: "DN", pct: 50 },
        { key: "SK", pct: 50 },
      ],
      lead: leads.get("Orbit Logistics"),
      pay: { kind: "full", delay: 3 },
    },
    {
      type: "PROFORMA",
      date: shift("2026-10-05"),
      client: { name: "Halcyon Health Pvt Ltd", gstin: gstin("29AAHCH3317B1Z"), address: "Embassy Golf Links, Domlur, Bengaluru 560071", mobile: "9632018845", email: "accounts@halcyonhealth.in", terms: "50% on acceptance, balance on LOI" },
      narration: "Brokerage — 180 seats at Embassy Golf Links",
      feesPaise: inr(4000000),
      brokers: [
        { key: "NS", pct: 50 },
        { key: "DN", pct: 50 },
      ],
      lead: leads.get("Halcyon Health"),
      pay: { kind: "none" },
    },
    {
      type: "INVOICE",
      date: shift("2026-10-06"),
      client: { name: "Kirana Labs Pvt Ltd", gstin: gstin("29AAICK4417M1Z"), address: "Level 3, Galaxy Tower, Residency Road, Bengaluru 560025", mobile: "9845021734", email: "accounts@kiranalabs.in", terms: "Net 15 days" },
      narration: "Brokerage — 60 managed seats at WeWork Galaxy",
      feesPaise: inr(570000),
      brokers: [
        { key: "SK", pct: 50 },
        { key: "RV", pct: 50 },
      ],
      lead: leads.get("Kirana Labs"),
      pay: { kind: "none" },
    },
  ];
}

export async function seedDemoFinance(prisma: PrismaClient, ids: Ids, today: string, shift: (iso: string) => string, log: (m: string) => void) {
  if ((await prisma.invoice.count()) || (await prisma.ledgerEntry.count())) return;
  const leadRows = await prisma.lead.findMany({ select: { id: true, tenantName: true } });
  const leads = new Map(leadRows.map((l) => [l.tenantName, l.id]));
  const counters = new Map<string, number>();
  const next = (type: InvoiceType, iso: string) => {
    const fy = fyOfIso(iso);
    const key = `${type}:${fy.short}`;
    const seq = (counters.get(key) ?? 0) + 1;
    counters.set(key, seq);
    return { fy: fy.short, seq, number: formatDocNumber(type, fy.short, seq) };
  };
  const actor = ids.AM;
  const rand = rng(77);

  // Documents are created in date order so numbers run in date order within each FY.
  type Event = { date: string; run: () => Promise<void> };
  const events: Event[] = [];
  const plans = [...history(today), ...prototypeDocs(shift, leads)].filter((p) => p.date <= today);

  const createInvoice = async (plan: DocPlan, date: string, convertedFromId: string | null) => {
    const n = next("INVOICE", date);
    const gst = computeGst(plan.feesPaise, plan.client.gstin.slice(0, 2), "29");
    const due = dueDateFromTerms(plan.client.terms, date);
    const inv = await prisma.invoice.create({
      data: {
        type: "INVOICE",
        number: n.number,
        fy: n.fy,
        seq: n.seq,
        status: "ISSUED",
        issueDate: isoToDate(date),
        dueDate: isoToDate(due),
        payeeName: plan.client.name,
        billingAddress: plan.client.address,
        gstin: plan.client.gstin,
        placeOfSupply: plan.client.gstin.slice(0, 2),
        narration: plan.narration,
        paymentTerms: plan.client.terms,
        mobile: plan.client.mobile,
        email: plan.client.email,
        feesPaise: BigInt(plan.feesPaise),
        cgstPaise: BigInt(gst.cgstPaise),
        sgstPaise: BigInt(gst.sgstPaise),
        igstPaise: BigInt(gst.igstPaise),
        totalPaise: BigInt(gst.totalPaise),
        leadId: plan.lead ?? null,
        convertedFromId,
        createdById: actor,
        createdAt: isoToDate(date),
        brokers: { create: plan.brokers.map((b, position) => ({ userId: "key" in b ? ids[b.key] : null, externalName: "external" in b ? b.external : null, sharePct: b.pct, position })) },
      },
    });

    let paid = 0;
    let creditedTotal = 0;
    let creditedFees = 0;
    if (plan.creditPct) {
      const cnDate = addDaysIso(date, 20);
      if (cnDate <= today) {
        const cnFees = Math.round((plan.feesPaise * plan.creditPct) / 100 / 100_000) * 100_000;
        const cnGst = computeGst(cnFees, plan.client.gstin.slice(0, 2), "29");
        const cn = next("CREDIT_NOTE", cnDate);
        await prisma.invoice.create({
          data: {
            type: "CREDIT_NOTE", number: cn.number, fy: cn.fy, seq: cn.seq, status: "ISSUED", issueDate: isoToDate(cnDate), payeeName: plan.client.name, billingAddress: plan.client.address, gstin: plan.client.gstin,
            placeOfSupply: plan.client.gstin.slice(0, 2), narration: `Credit against ${inv.number}`, paymentTerms: "—", mobile: plan.client.mobile, email: plan.client.email, feesPaise: BigInt(cnFees),
            cgstPaise: BigInt(cnGst.cgstPaise), sgstPaise: BigInt(cnGst.sgstPaise), igstPaise: BigInt(cnGst.igstPaise), totalPaise: BigInt(cnGst.totalPaise), creditNoteForId: inv.id,
            reason: "Fee revised after final area measurement", createdById: actor, createdAt: isoToDate(cnDate),
          },
        });
        creditedTotal = cnGst.totalPaise;
        creditedFees = cnFees;
      }
    }

    // Partial payers settle the rest about 40 days after the first instalment.
    const owed = gst.totalPaise - creditedTotal;
    const instalments: { on: string; amount: number }[] = [];
    if (plan.pay.kind !== "none") {
      const target = addDaysIso(due, plan.pay.delay ?? 0);
      const first = target < date ? date : target;
      const half = Math.round(owed / 2);
      if (plan.pay.kind === "half") instalments.push({ on: first, amount: half }, { on: addDaysIso(first, 40), amount: owed - half });
      else instalments.push({ on: first, amount: owed });
    }
    for (const [k, inst] of instalments.entries()) {
      if (inst.on >= today) break;
      const mode: PaymentMode = inst.amount > 10_00_000 * RUPEE ? "RTGS" : rand() < 0.15 ? "CHEQUE" : "NEFT";
      const payment = await prisma.payment.create({
        data: { invoiceId: inv.id, amountPaise: BigInt(inst.amount), receivedOn: isoToDate(inst.on), mode, reference: `UTR${inst.on.replace(/-/g, "")}${String(n.seq).padStart(4, "0")}${k}`, recordedById: actor, createdAt: isoToDate(inst.on) },
      });
      await prisma.ledgerEntry.create({
        data: { type: "INCOME", category: "Brokerage", description: `Payment — ${inv.number} · ${plan.client.name}`, party: plan.client.name, mode, amountPaise: BigInt(inst.amount), entryDate: isoToDate(inst.on), paymentId: payment.id, createdById: actor, createdAt: isoToDate(inst.on) },
      });
      paid += inst.amount;
    }
    await prisma.invoice.update({ where: { id: inv.id }, data: { amountPaidPaise: BigInt(paid), status: settledStatus(gst.totalPaise, paid, creditedTotal, creditedFees, plan.feesPaise) } });
  };

  for (const plan of plans) {
    if (plan.type === "INVOICE") {
      events.push({ date: plan.date, run: () => createInvoice(plan, plan.date, null) });
      continue;
    }
    events.push({
      date: plan.date,
      run: async () => {
        const n = next("PROFORMA", plan.date);
        const gst = computeGst(plan.feesPaise, plan.client.gstin.slice(0, 2), "29");
        const pf = await prisma.invoice.create({
          data: {
            type: "PROFORMA", number: n.number, fy: n.fy, seq: n.seq, status: "OPEN", issueDate: isoToDate(plan.date), validUntil: isoToDate(addDaysIso(plan.date, 15)), payeeName: plan.client.name,
            billingAddress: plan.client.address, gstin: plan.client.gstin, placeOfSupply: plan.client.gstin.slice(0, 2), narration: plan.narration, paymentTerms: plan.client.terms, mobile: plan.client.mobile,
            email: plan.client.email, feesPaise: BigInt(plan.feesPaise), cgstPaise: BigInt(gst.cgstPaise), sgstPaise: BigInt(gst.sgstPaise), igstPaise: BigInt(gst.igstPaise), totalPaise: BigInt(gst.totalPaise),
            leadId: plan.lead ?? null, createdById: actor, createdAt: isoToDate(plan.date),
            brokers: { create: plan.brokers.map((b, position) => ({ userId: "key" in b ? ids[b.key] : null, externalName: "external" in b ? b.external : null, sharePct: b.pct, position })) },
          },
        });
        if (plan.convertOn && plan.convertOn <= today) {
          const convertOn = plan.convertOn;
          events.push({
            date: convertOn,
            run: async () => {
              await prisma.invoice.update({ where: { id: pf.id }, data: { status: "CONVERTED" } });
              await createInvoice(plan, convertOn, pf.id);
            },
          });
          events.sort((a, b) => a.date.localeCompare(b.date));
        }
      },
    });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 0; i < events.length; i++) await events[i]!.run();

  for (const [key, seq] of counters) {
    const [kind, fy] = key.split(":");
    await prisma.$executeRaw`INSERT INTO document_sequences (kind, fy, next_value, updated_at) VALUES (${kind}::"DocumentKind", ${fy}, ${seq + 1}, now())
      ON CONFLICT (kind, fy) DO UPDATE SET next_value = GREATEST(document_sequences.next_value, EXCLUDED.next_value), updated_at = now()`;
  }

  // Ledger: monthly running costs, quarterly items and interest income. Salaries come from the payroll
  // runs in seed-demo-payroll.ts, which post them when each run is disbursed.
  const prevFy = financialYear(fyOfIso(today).startYear - 1);
  const entries: { type: "INCOME" | "EXPENSE"; category: string; description: string; party: string; mode: PaymentMode; amount: number; date: string }[] = [];
  const MARKETING: [string, string, PaymentMode][] = [
    ["LinkedIn campaign — Grade A office space", "LinkedIn India", "CARD"],
    ["Brochures — 2,000 copies", "PrintHub", "UPI"],
    ["CRE broker meetup sponsorship", "Bengaluru Realty Forum", "NEFT"],
    ["Property portal premium listings", "Square Yards", "NEFT"],
  ];
  const VENDORS: [string, string, number][] = [
    ["Lease agreement drafting — 4 mandates", "Khaitan Legal", 250000],
    ["Statutory audit and tax filing", "Rao & Iyer Chartered Accountants", 180000],
    ["Market data subscription — annual", "CoStar India", 420000],
  ];
  let m = 0;
  for (let first = prevFy.start; first <= today; first = addDaysIso(first, 32).slice(0, 7) + "-01", m++) {
    const ym = first.slice(0, 7);
    const current = first >= fyOfIso(today).start;
    const label = `${monthLabel(Number(ym.slice(5)))} ${ym.slice(0, 4)}`;
    const add = (day: number, e: Omit<(typeof entries)[number], "date">) => {
      const date = `${ym}-${String(day).padStart(2, "0")}`;
      if (date <= today) entries.push({ ...e, date });
    };
    add(5, { type: "EXPENSE", category: "Rent", description: `Office rent — ${label}`, party: "Lavelle Road Estates LLP", mode: "NEFT", amount: current ? 340000 : 310000 });
    add(26, { type: "EXPENSE", category: "Office", description: "Pantry and housekeeping", party: "Sodexo", mode: "NEFT", amount: 24500 });
    add(28, { type: "EXPENSE", category: "Cab", description: `Cabs — ${12 + (m % 9)} site-visit trips`, party: "Skyline Cabs", mode: "UPI", amount: 25000 + (m % 5) * 5600 });
    add(20, { type: "EXPENSE", category: "Software", description: "CRM and workspace subscriptions", party: "Zoho Corp", mode: "CARD", amount: 42000 });
    if (m % 2 === 0) {
      const [description, party, mode] = MARKETING[(m / 2) % MARKETING.length]!;
      add(12, { type: "EXPENSE", category: "Marketing", description, party, mode, amount: 60000 + ((m * 37) % 9) * 25000 });
    }
    if (m % 3 === 1) {
      const [description, party, amount] = VENDORS[Math.floor(m / 3) % VENDORS.length]!;
      add(18, { type: "EXPENSE", category: "Vendor payments", description, party, mode: "NEFT", amount });
      add(25, { type: "INCOME", category: "Other income", description: "Interest on fixed deposit", party: "HDFC Bank", mode: "OTHER", amount: 180000 });
    }
    if (m % 4 === 2) add(9, { type: "EXPENSE", category: "Misc", description: "Courier and stamp duty", party: "Various", mode: "CASH", amount: 8500 + (m % 3) * 2500 });
  }
  await prisma.ledgerEntry.createMany({
    data: entries.map((e) => ({ type: e.type, category: e.category, description: e.description, party: e.party, mode: e.mode, amountPaise: BigInt(e.amount * RUPEE), entryDate: isoToDate(e.date), createdById: actor, createdAt: isoToDate(e.date) })),
  });
  log(`Inserted ${plans.length} demo documents with payments, and ${entries.length} ledger entries`);
}
