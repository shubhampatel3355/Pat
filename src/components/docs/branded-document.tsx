import type { CompanyProfile } from "@/lib/company";

export const DOC_LABEL: React.CSSProperties = { fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#023E7D", fontWeight: 600 };

/**
 * The Pat Michaels letterhead (prototype #pm-doc) shared by invoices, payslips and finance reports:
 * gradient top band, logo with registration details, title block, content and the navy footer band.
 * No hooks, so it renders in preview modals, in the browser print view and on the /print pages that
 * Chromium turns into PDFs.
 */
export function BrandedDocument({
  company,
  title,
  meta,
  children,
  logoSrc = "/brand/pat-michaels-logo.png",
  flat = false,
}: {
  company: CompanyProfile;
  title: string;
  /** Lines under the title (number, dates…). */
  meta: React.ReactNode;
  children: React.ReactNode;
  logoSrc?: string;
  flat?: boolean;
}) {
  return (
    <div
      id="pm-doc"
      style={{
        width: "100%",
        maxWidth: 820,
        background: "#fff",
        color: "#0B1B3A",
        borderRadius: flat ? 0 : 6,
        boxShadow: flat ? "none" : "0 30px 90px rgba(0,0,0,.4)",
        display: "flex",
        flexDirection: "column",
        WebkitPrintColorAdjust: "exact",
        printColorAdjust: "exact",
        fontFamily: "inherit",
      }}
    >
      <div style={{ height: 10, background: "linear-gradient(90deg,#001233,#023E7D)" }} />
      <div style={{ padding: "28px 36px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ alignSelf: "flex-start", padding: "12px 20px", borderRadius: 12, background: "linear-gradient(160deg,#023E7D,#001233)", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- printed document; must not depend on the image optimiser */}
            <img src={logoSrc} alt={company.shortName} width={150} height={54} style={{ display: "block", width: 150, height: "auto" }} />
          </div>
          <span style={{ fontSize: 11, color: "#55555A", lineHeight: "16px" }}>
            {company.address}
            <br />
            GSTIN {company.gstin} · RERA agent {company.rera}
          </span>
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 24, lineHeight: "30px", fontWeight: 600, letterSpacing: ".04em", color: "#023E7D" }}>{title}</span>
          {meta}
        </div>
      </div>

      {children}

      <div style={{ marginTop: 22, padding: "12px 36px", background: "#001233", color: "#CFE0FA", fontSize: 11, letterSpacing: ".06em", display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <span>{company.legalName.toUpperCase()}</span>
        <span>{company.website}</span>
      </div>
    </div>
  );
}
