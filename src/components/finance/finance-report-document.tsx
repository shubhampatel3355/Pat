import type { CompanyProfile } from "@/lib/company";
import type { FinanceReportView } from "@/server/services/finance-view";
import { BrandedDocument, DOC_LABEL } from "../docs/branded-document";

const SECTION: React.CSSProperties = { margin: "22px 36px 0", display: "flex", flexDirection: "column", gap: 8, breakInside: "avoid" };
const TABLE: React.CSSProperties = { borderRadius: 12, overflow: "hidden", border: "1px solid #D8E1F0", fontSize: 12 };
const HEAD: React.CSSProperties = { display: "grid", gap: 10, padding: "8px 14px", background: "#023E7D", color: "#fff", fontSize: 11, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase" };
const ROW: React.CSSProperties = { display: "grid", gap: 10, padding: "7px 14px", borderTop: "1px solid #E6ECF7", breakInside: "avoid" };
const RIGHT: React.CSSProperties = { textAlign: "right", fontVariantNumeric: "tabular-nums" };
const CLIP: React.CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };

/** The finance report PDF: summary tiles, P&L, month by month and receivables (rendered by /print/finance). */
export function FinanceReportDocument({ view, company }: { view: FinanceReportView; company: CompanyProfile }) {
  const monthCols = "minmax(0,1fr) repeat(4,minmax(0,1.2fr))";
  const recCols = "120px minmax(0,1.6fr) 100px 80px minmax(0,1fr)";
  return (
    <BrandedDocument
      company={company}
      flat
      title="FINANCE REPORT"
      meta={
        <>
          <span style={{ fontSize: 13 }}>
            <b>{view.fyLabel}</b>
          </span>
          <span style={{ fontSize: 13, color: "#55555A" }}>{view.periodLabel}</span>
          <span style={{ fontSize: 12, color: "#55555A" }}>Generated {view.generatedOn}</span>
        </>
      }
    >
      <div style={{ margin: "22px 36px 0", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, breakInside: "avoid" }}>
        {view.tiles.map((t) => (
          <div key={t.label} style={{ borderRadius: 12, padding: "12px 14px", background: "linear-gradient(160deg,#023E7D,#002855)", color: "#fff", display: "flex", flexDirection: "column", gap: 2, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            <span style={{ fontSize: 11, opacity: 0.88 }}>{t.label}</span>
            <span style={{ fontSize: 18, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{t.value}</span>
            <span style={{ fontSize: 10.5, opacity: 0.88 }}>{t.sub}</span>
          </div>
        ))}
      </div>

      <div style={SECTION}>
        <span style={DOC_LABEL}>Profit &amp; loss</span>
        <div style={TABLE}>
          {view.pnl.map((l, i) => (
            <div key={`${l.label}-${i}`} style={{ ...ROW, gridTemplateColumns: "minmax(0,1fr) 160px", borderTop: i ? ROW.borderTop : "none", background: l.strong ? "#F2F6FC" : "#fff", fontWeight: l.strong ? 600 : 400 }}>
              <span style={{ color: l.indent ? "#55555A" : "#33415C", paddingLeft: l.indent ? 14 : 0 }}>{l.label}</span>
              <span style={RIGHT}>{l.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={SECTION}>
        <span style={DOC_LABEL}>Month by month</span>
        <div style={TABLE}>
          <div style={{ ...HEAD, gridTemplateColumns: monthCols }}>
            <span>Month</span>
            <span style={{ textAlign: "right" }}>Revenue</span>
            <span style={{ textAlign: "right" }}>Collections</span>
            <span style={{ textAlign: "right" }}>Expenses</span>
            <span style={{ textAlign: "right" }}>Payroll</span>
          </div>
          {view.monthly.map((m) => (
            <div key={m.label} style={{ ...ROW, gridTemplateColumns: monthCols }}>
              <span>{m.label}</span>
              {m.cells.map((c, i) => (
                <span key={i} style={RIGHT}>
                  {c}
                </span>
              ))}
            </div>
          ))}
          <div style={{ ...ROW, gridTemplateColumns: monthCols, background: "#F2F6FC", fontWeight: 600 }}>
            <span>Total</span>
            {view.monthlyTotal.map((c, i) => (
              <span key={i} style={RIGHT}>
                {c}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={SECTION}>
        <span style={DOC_LABEL}>Receivables ageing</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 8 }}>
          {view.ageing.map((a) => (
            <div key={a.label} style={{ borderRadius: 12, padding: "10px 12px", background: "#F2F6FC", display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, color: "#55555A" }}>
                {a.label} · {a.count}
              </span>
              <span style={{ fontSize: 14, fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{a.value}</span>
            </div>
          ))}
        </div>
        {view.receivables.length > 0 && (
          <div style={TABLE}>
            <div style={{ ...HEAD, gridTemplateColumns: recCols }}>
              <span>Invoice</span>
              <span>Client</span>
              <span>Due</span>
              <span style={{ textAlign: "right" }}>Overdue</span>
              <span style={{ textAlign: "right" }}>Outstanding</span>
            </div>
            {view.receivables.map((r) => (
              <div key={r.number} style={{ ...ROW, gridTemplateColumns: recCols }}>
                <span>{r.number}</span>
                <span style={CLIP}>{r.client}</span>
                <span>{r.due}</span>
                <span style={RIGHT}>{r.overdue}</span>
                <span style={RIGHT}>{r.outstanding}</span>
              </div>
            ))}
          </div>
        )}
        {view.moreReceivables > 0 && <span style={{ fontSize: 11, color: "#55555A" }}>…and {view.moreReceivables} more open invoices (see the Excel export).</span>}
      </div>

      <div style={{ margin: "20px 36px 0", padding: "12px 14px", borderRadius: 12, background: "#F2F6FC", fontSize: 11, lineHeight: "16px", color: "#33415C", display: "flex", flexDirection: "column", gap: 4, breakInside: "avoid" }}>
        {view.notes.map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </BrandedDocument>
  );
}
