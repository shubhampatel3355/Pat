import "server-only";
import ExcelJS from "exceljs";
import type { CompanyProfile } from "@/lib/company";
import { isoToDate } from "@/lib/dates";
import { expenseGroupOf, safeCellText, sharePct } from "@/lib/finance";
import { PAYMENT_MODES } from "@/lib/invoice";
import type { FinanceReport } from "../services/finance";

/** Indian digit grouping (12,36,640.00). Excel has no locale-free lakh format, so this uses conditional sections. */
const INR = "[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00";
const DATE = "dd mmm yyyy";
const PCT = '0"%"';
const NAVY = "FF023E7D";

type Kind = "text" | "money" | "date" | "int" | "pct";
type Value = string | number | Date | null;
interface Column {
  header: string;
  width: number;
  kind?: Kind;
}

const FORMATS: Partial<Record<Kind, string>> = { money: INR, date: DATE, int: "0", pct: PCT };
const rupees = (paise: number) => paise / 100;
const MODE = Object.fromEntries(PAYMENT_MODES.map((m) => [m.value, m.label])) as Record<string, string>;

/** Text from the database may start with "=", "+", "-" or "@"; never let a spreadsheet treat it as a formula. */
const cell = (v: Value) => (typeof v === "string" ? safeCellText(v) : v);

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
  row.height = 22;
  row.alignment = { vertical: "middle" };
}

function addTable(wb: ExcelJS.Workbook, name: string, columns: Column[], rows: Value[][], totals?: Value[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = columns.map((c) => ({ header: c.header, width: c.width, style: FORMATS[c.kind ?? "text"] ? { numFmt: FORMATS[c.kind ?? "text"] } : {} }));
  styleHeader(ws.getRow(1));
  for (const r of rows) ws.addRow(r.map(cell));
  if (totals) {
    const row = ws.addRow(totals.map(cell));
    row.font = { bold: true };
    row.eachCell((c) => (c.border = { top: { style: "thin", color: { argb: NAVY } } }));
  }
  if (rows.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1 + rows.length, column: columns.length } };
  return ws;
}

/** The finance report as an .xlsx workbook: Summary, Monthly, Expenses, Receivables, Invoices, Ledger. */
export async function financeWorkbook(report: FinanceReport, company: CompanyProfile, generated: { by: string; at: string }): Promise<Buffer> {
  const o = report.overview;
  const p = o.period;
  const wb = new ExcelJS.Workbook();
  wb.creator = company.legalName;
  wb.created = new Date();
  wb.title = `Finance report ${p.fy.label}`;

  // Summary
  const ws = wb.addWorksheet("Summary");
  ws.columns = [{ width: 46 }, { width: 20, style: { numFmt: INR } }, { width: 20, style: { numFmt: INR } }, { width: 12, style: { numFmt: PCT } }];
  ws.addRow([cell(company.legalName)]).font = { bold: true, size: 14 };
  ws.addRow([cell(`Finance report · ${p.fy.label} · ${p.label}${p.toDate ? " (year to date)" : ""}`)]);
  ws.addRow([cell(`Generated ${generated.at} by ${generated.by}`)]).font = { color: { argb: "FF55555A" } };
  ws.addRow([]);
  styleHeader(ws.addRow(["Figure", "Amount (₹)", "Same period last year (₹)", "Change"]));
  const line = (label: string, now: number, before: number | null) => {
    const change = before === null ? null : sharePct(now - before, before);
    return ws.addRow([label, rupees(now), before === null ? null : rupees(before), change]);
  };
  line("Fees invoiced (excl. GST)", o.billing.invoiceFeesPaise, null);
  line("Less credit notes (excl. GST)", -o.billing.creditFeesPaise, null);
  line("Revenue (excl. GST)", o.revenue.paise, o.revenue.prevPaise).font = { bold: true };
  line("Other income", o.otherIncomePaise, null);
  line("Expenses", o.expenses.paise, o.expenses.prevPaise);
  line("Profit", o.profit.paise, o.profit.prevPaise).font = { bold: true };
  ws.addRow(["Profit margin", null, null, o.profit.marginPct]);
  line("Collections (incl. GST)", o.collections.paise, o.collections.prevPaise);
  line("Payroll (Salaries)", o.payroll.paise, o.payroll.prevPaise);
  line("Receivables outstanding today (incl. GST)", o.receivables.outstandingPaise, null);
  line("  of which overdue", o.receivables.overduePaise, null);
  line("Billed in the period (incl. GST, net of credit notes)", o.receivables.billedPaise, null);
  ws.addRow(["Collected of the period's billing", null, null, o.receivables.collectedPct]);
  ws.addRow([]);
  for (const note of [
    "Revenue: fees on tax invoices issued in the period, excluding GST, net of credit notes.",
    "Profit = revenue + other income (receipts not tied to an invoice payment) − expenses.",
    p.toDate ? "The financial year is still running: figures are year to date and compared with the same dates last year." : "Compared with the previous financial year.",
  ])
    ws.addRow([note]).font = { italic: true, color: { argb: "FF55555A" } };

  // Monthly
  const inPeriod = o.revenue.months.filter((m) => m.month <= p.to.slice(0, 7));
  const at = (points: typeof o.revenue.months, month: string) => points.find((x) => x.month === month)?.paise ?? 0;
  addTable(
    wb,
    "Monthly",
    [
      { header: "Month", width: 12 },
      { header: "Revenue excl. GST (₹)", width: 22, kind: "money" },
      { header: "Collections (₹)", width: 18, kind: "money" },
      { header: "Expenses (₹)", width: 18, kind: "money" },
      { header: "Payroll (₹)", width: 18, kind: "money" },
      { header: "Net cash flow (₹)", width: 18, kind: "money" },
    ],
    inPeriod.map((m) => {
      const collections = at(o.collections.months, m.month);
      const expenses = at(o.expenses.months, m.month);
      return [`${m.label} ${m.month.slice(0, 4)}`, rupees(m.paise), rupees(collections), rupees(expenses), rupees(at(o.payroll.months, m.month)), rupees(collections - expenses)];
    }),
    ["Total", rupees(o.revenue.paise), rupees(o.collections.paise), rupees(o.expenses.paise), rupees(o.payroll.paise), rupees(o.collections.paise - o.expenses.paise)],
  );

  // Expenses by category (and the card group each one counts towards)
  addTable(
    wb,
    "Expenses",
    [
      { header: "Category", width: 22 },
      { header: "Card group", width: 14 },
      { header: "Amount (₹)", width: 18, kind: "money" },
      { header: "Share", width: 10, kind: "pct" },
    ],
    o.expenses.byCategory.map((c) => [c.category, expenseGroupOf(c.category), rupees(c.paise), sharePct(c.paise, o.expenses.paise)]),
    ["Total", null, rupees(o.expenses.paise), o.expenses.paise ? 100 : null],
  );

  // Receivables
  const rec = o.receivables;
  addTable(
    wb,
    "Receivables",
    [
      { header: "Invoice", width: 16 },
      { header: "Client", width: 32 },
      { header: "Issued", width: 13, kind: "date" },
      { header: "Due", width: 13, kind: "date" },
      { header: "Total (₹)", width: 16, kind: "money" },
      { header: "Paid (₹)", width: 16, kind: "money" },
      { header: "Credited (₹)", width: 16, kind: "money" },
      { header: "Outstanding (₹)", width: 17, kind: "money" },
      { header: "Days overdue", width: 13, kind: "int" },
      { header: "Ageing", width: 13 },
    ],
    rec.open.map((r) => [r.number, r.payeeName, isoToDate(r.issueDate), r.dueDate ? isoToDate(r.dueDate) : null, rupees(r.totalPaise), rupees(r.paidPaise), rupees(r.creditedPaise), rupees(r.outstandingPaise), r.daysOverdue, rec.ageing[r.bucket]!.label]),
    ["Total", null, null, null, null, null, null, rupees(rec.outstandingPaise), null, null],
  );

  // Invoice register
  addTable(
    wb,
    "Invoices",
    [
      { header: "Number", width: 16 },
      { header: "Type", width: 12 },
      { header: "Date", width: 13, kind: "date" },
      { header: "Client", width: 32 },
      { header: "GSTIN", width: 18 },
      { header: "Against", width: 16 },
      { header: "Fees (₹)", width: 16, kind: "money" },
      { header: "GST (₹)", width: 14, kind: "money" },
      { header: "Total (₹)", width: 16, kind: "money" },
      { header: "Paid (₹)", width: 16, kind: "money" },
      { header: "Outstanding (₹)", width: 17, kind: "money" },
      { header: "Status", width: 15 },
    ],
    report.register.map((r) => {
      const sign = r.type === "CREDIT_NOTE" ? -1 : 1;
      return [r.number, r.type === "CREDIT_NOTE" ? "Credit note" : "Invoice", isoToDate(r.issueDate), r.payeeName, r.gstin, r.against, sign * rupees(r.feesPaise), sign * rupees(r.gstPaise), sign * rupees(r.totalPaise), rupees(r.paidPaise), rupees(r.outstandingPaise), r.status.replace("_", " ").toLowerCase()];
    }),
  );

  // Ledger
  addTable(
    wb,
    "Ledger",
    [
      { header: "Date", width: 13, kind: "date" },
      { header: "Type", width: 10 },
      { header: "Category", width: 18 },
      { header: "Description", width: 46 },
      { header: "Party", width: 26 },
      { header: "Mode", width: 10 },
      { header: "Amount (₹)", width: 17, kind: "money" },
      { header: "Source", width: 16 },
      { header: "Recorded by", width: 20 },
    ],
    report.ledger.map((e) => [
      isoToDate(e.date),
      e.type === "INCOME" ? "Income" : "Expense",
      e.category,
      e.description,
      e.party,
      MODE[e.mode] ?? e.mode,
      (e.type === "INCOME" ? 1 : -1) * rupees(e.amountPaise),
      e.source === "payment" ? "Invoice payment" : e.source === "payroll" ? "Payroll" : "Manual entry",
      e.recordedBy,
    ]),
  );

  return Buffer.from(await wb.xlsx.writeBuffer());
}
