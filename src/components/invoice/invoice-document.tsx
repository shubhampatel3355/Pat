import type { CompanyProfile, InvoiceDocData } from "@/lib/company";
import { BrandedDocument, DOC_LABEL as LABEL } from "../docs/branded-document";

const TITLE: Record<InvoiceDocData["kind"], string> = { INVOICE: "TAX INVOICE", PROFORMA: "PROFORMA INVOICE", CREDIT_NOTE: "CREDIT NOTE" };

/** The branded invoice / proforma / credit note (prototype #pm-doc). */
export function InvoiceDocument({ data, company, logoSrc, flat = false }: { data: InvoiceDocData; company: CompanyProfile; logoSrc?: string; flat?: boolean }) {
  return (
    <BrandedDocument
      company={company}
      logoSrc={logoSrc}
      flat={flat}
      title={TITLE[data.kind]}
      meta={
        <>
          <span style={{ fontSize: 13 }}>
            No. <b>{data.number}</b>
            {data.draft && <span style={{ color: "#C93C37" }}> · draft</span>}
          </span>
          <span style={{ fontSize: 13, color: "#55555A" }}>Date {data.date}</span>
          {data.kind === "PROFORMA" && data.validUntil && <span style={{ fontSize: 12, color: "#55555A" }}>Valid until {data.validUntil}</span>}
          {data.kind === "INVOICE" && data.dueDate && <span style={{ fontSize: 12, color: "#55555A" }}>Due {data.dueDate}</span>}
        </>
      }
    >
      <div style={{ margin: "22px 36px 0", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={LABEL}>Bill to</span>
          <span style={{ fontSize: 15, fontWeight: 600 }}>{data.payeeName}</span>
          <span style={{ fontSize: 13, lineHeight: "18px", color: "#33415C", whiteSpace: "pre-line" }}>{data.billingAddress}</span>
          <span style={{ fontSize: 12, color: "#55555A" }}>GSTIN {data.gstin}</span>
          <span style={{ fontSize: 12, color: "#55555A" }}>Place of supply {data.placeOfSupply}</span>
          <span style={{ fontSize: 12, color: "#55555A" }}>{data.contact}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={LABEL}>{data.kind === "CREDIT_NOTE" ? "Reference" : "Payment terms"}</span>
          <span style={{ fontSize: 13, lineHeight: "18px" }}>{data.kind === "CREDIT_NOTE" ? data.reference : data.paymentTerms}</span>
        </div>
      </div>

      <div style={{ margin: "22px 36px 0", borderRadius: 12, overflow: "hidden", border: "1px solid #D8E1F0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 160px", gap: 12, padding: "10px 16px", background: "#023E7D", color: "#fff", fontSize: 12, fontWeight: 600, letterSpacing: ".04em" }}>
          <span>DESCRIPTION</span>
          <span style={{ textAlign: "right" }}>AMOUNT</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 160px", gap: 12, padding: "14px 16px", fontSize: 13, lineHeight: "19px" }}>
          <span>
            {data.narration}
            <br />
            <span style={{ fontSize: 11, color: "#55555A" }}>SAC {company.sac}</span>
          </span>
          <span style={{ textAlign: "right" }}>{data.fees}</span>
        </div>
        {data.lines.map((l) => (
          <div
            key={l.label}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) 160px",
              gap: 12,
              padding: "8px 16px",
              fontSize: 13,
              borderTop: "1px solid #E6ECF7",
              background: l.strong ? "#F2F6FC" : "#fff",
              fontWeight: l.strong ? 600 : 400,
            }}
          >
            <span style={{ color: "#33415C" }}>{l.label}</span>
            <span style={{ textAlign: "right" }}>{l.value}</span>
          </div>
        ))}
      </div>

      {data.brokers.length > 0 && (
        <div style={{ margin: "20px 36px 0", display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={LABEL}>Brokers &amp; share</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {data.brokers.map((b) => (
              <span key={b.name} style={{ height: 28, padding: "0 12px", borderRadius: 999, background: "#E9F0FB", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                {b.name} <b>{b.pct}%</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {data.kind === "PROFORMA" && (
        <div style={{ margin: "20px 36px 0", padding: "12px 14px", borderRadius: 12, background: "#F2F6FC", fontSize: 12, lineHeight: "17px", color: "#33415C" }}>
          This is a proforma invoice issued for confirmation and is not a tax invoice or a demand for payment. A tax invoice will be raised on acceptance.
        </div>
      )}

      <div style={{ margin: "22px 36px 0", paddingTop: 14, borderTop: "1px solid #D8E1F0", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", fontSize: 12, lineHeight: "17px", color: "#33415C" }}>
        <span>
          <b style={{ color: "#0B1B3A" }}>Bank details</b>
          <br />
          {company.bank ? (
            <>
              {company.bank.accountName} · {company.bank.name}
              {company.bank.branch ? `, ${company.bank.branch}` : ""}
              <br />
              A/c {company.bank.accountNumber} · IFSC {company.bank.ifsc}
            </>
          ) : (
            <>Bank details are not configured (COMPANY_BANK_*).</>
          )}
        </span>
        <span style={{ textAlign: "right" }}>
          <br />
          For <b style={{ color: "#0B1B3A" }}>{company.legalName}</b>
          <br />
          <br />
          Authorised signatory
          <br />
          <span style={{ color: "#55555A" }}>
            {company.signatory.name}, {company.signatory.title}
          </span>
        </span>
      </div>
    </BrandedDocument>
  );
}
