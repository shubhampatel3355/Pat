import type { CompanyProfile } from "@/lib/company";
import { formatDate } from "@/lib/dates";
import { amountInWords, formatINR } from "@/lib/money";
import { shortMonthLabel, type PayslipComponents, type PayslipTotals, type StatementType } from "@/lib/payroll";
import { BrandedDocument, DOC_LABEL } from "../docs/branded-document";

interface PayslipView {
  type: StatementType;
  periodLabel: string;
  months: string[];
  payDate: string | null;
  employee: { name: string; title: string; dateOfJoining: string | null };
  components: PayslipComponents & PayslipTotals;
}

const ROW: React.CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0,1fr) 140px", gap: 10, padding: "8px 14px", borderTop: "1px solid #E6ECF7", fontSize: 12.5 };
const HEAD: React.CSSProperties = { ...ROW, borderTop: "none", background: "#023E7D", color: "#fff", fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" };
const TOTAL: React.CSSProperties = { ...ROW, background: "#F2F6FC", fontWeight: 600 };
const RIGHT: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums" };

function Table({ title, lines, total }: { title: string; lines: [string, number][]; total: [string, number] }) {
  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid #D8E1F0", breakInside: "avoid" }}>
      <div style={HEAD}>
        <span>{title}</span>
        <span style={{ textAlign: "right" }}>Amount</span>
      </div>
      {lines.map(([label, paise]) => (
        <div key={label} style={ROW}>
          <span style={{ color: "#33415C" }}>{label}</span>
          <span style={RIGHT}>{formatINR(paise)}</span>
        </div>
      ))}
      <div style={TOTAL}>
        <span>{total[0]}</span>
        <span style={RIGHT}>{formatINR(total[1])}</span>
      </div>
    </div>
  );
}

/** Branded payslip (monthly) or pay statement (quarterly / yearly), rendered by /print/payslip. */
export function PayslipDocument({ view, company }: { view: PayslipView; company: CompanyProfile }) {
  const c = view.components;
  const monthly = view.type === "MONTHLY";
  const first = view.months[0] ?? "";
  const last = view.months[view.months.length - 1] ?? "";
  const span = first === last ? shortMonthLabel(first) : `${shortMonthLabel(first)} – ${shortMonthLabel(last)}`;
  const covered = monthly ? view.periodLabel : `${view.months.length} month${view.months.length === 1 ? "" : "s"} paid · ${span}`;
  const earnings: [string, number][] = [
    ["Basic", c.basic],
    ["House rent allowance", c.hra],
    ["Special allowance", c.special],
    ...(c.commission ? ([["Commission", c.commission]] as [string, number][]) : []),
    ...(c.incentive ? ([["Incentive", c.incentive]] as [string, number][]) : []),
  ];
  const deductions: [string, number][] = [
    ["Provident fund (12% of basic)", c.pf],
    ["Professional tax", c.pt],
    ["Income tax (TDS)", c.tds],
    ...(c.other ? ([["Other deductions", c.other]] as [string, number][]) : []),
  ];
  const facts: [string, string][] = [
    ["Employee", view.employee.name],
    ["Designation", view.employee.title],
    ["Date of joining", view.employee.dateOfJoining ? formatDate(view.employee.dateOfJoining) : "—"],
    [monthly ? "Pay period" : "Period", covered],
    ["Days paid", `${c.daysPaid} of ${c.daysInMonth}`],
    [monthly ? "Paid on" : "Last paid on", view.payDate ? formatDate(view.payDate) : "—"],
  ];
  return (
    <BrandedDocument
      company={company}
      flat
      title={monthly ? "PAYSLIP" : "PAY STATEMENT"}
      meta={
        <>
          <span style={{ fontSize: 13 }}>
            <b>{view.periodLabel}</b>
          </span>
          <span style={{ fontSize: 12, color: "#55555A" }}>Confidential</span>
        </>
      }
    >
      <div style={{ margin: "22px 36px 0", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
        {facts.map(([k, v]) => (
          <div key={k} style={{ borderRadius: 12, padding: "10px 12px", background: "#F2F6FC", display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 10.5, color: "#55555A" }}>{k}</span>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>

      <div style={{ margin: "20px 36px 0", display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
        <Table title="Earnings" lines={earnings} total={["Gross earnings", c.gross]} />
        <Table title="Deductions" lines={deductions} total={["Total deductions", c.deductions]} />
      </div>

      <div
        style={{
          margin: "20px 36px 0",
          borderRadius: 14,
          padding: "16px 18px",
          background: "linear-gradient(160deg,#023E7D,#002855)",
          color: "#fff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
          breakInside: "avoid",
        }}
      >
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ ...DOC_LABEL, color: "rgba(255,255,255,.88)" }}>Net pay</span>
          <span style={{ fontSize: 11.5, opacity: 0.88 }}>{amountInWords(c.net)}</span>
        </span>
        <span style={{ fontSize: 26, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{formatINR(c.net)}</span>
      </div>

      {c.note && <p style={{ margin: "14px 36px 0", fontSize: 12, color: "#33415C" }}>Note: {c.note}</p>}
      <p style={{ margin: "16px 36px 0", fontSize: 11, color: "#55555A" }}>
        This is a system-generated {monthly ? "payslip" : "statement"} and does not need a signature. Amounts in Indian rupees.
      </p>
    </BrandedDocument>
  );
}
