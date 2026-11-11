/**
 * Notifications and search results come with the web's links (e.g. "/wip?focus=<id>"). This maps each to the
 * matching app screen, so a notification opens the same record on either.
 */
function parse(href: string): { path: string; q: Record<string, string> } {
  const [rawPath = "", qs = ""] = href.split("#")[0]!.split("?");
  const q: Record<string, string> = {};
  for (const part of qs.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    q[decodeURIComponent(k!)] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  return { path: rawPath.replace(/\/+$/, "") || "/", q };
}

export function appRouteFor(href: string | null | undefined): string | null {
  if (!href) return null;
  const { path, q } = parse(href);
  switch (path) {
    case "/":
    case "/dashboard":
      return "/";
    case "/wip":
      if (q.focus) return `/lead/${q.focus}`;
      if (q.new) return "/lead-form";
      return "/wip";
    case "/follow-ups":
      if (q.task) return `/task/${q.task}`;
      if (q.new === "task") return "/task-form";
      if (q.new === "followup") return "/follow-up-form";
      return "/follow-ups";
    case "/business-development":
      return q.new ? "/bd-form" : "/bd";
    case "/vehicles":
      return "/vehicles";
    case "/finance":
      return q.expense ? "/ledger-form?type=EXPENSE" : "/finance";
    case "/invoices":
      return q.focus ? `/invoice/${q.focus}` : "/invoices";
    case "/payroll":
      return "/payroll";
    case "/payslips":
      return "/payslips";
    case "/teams":
      return "/teams";
    case "/settings":
      return "/settings";
    case "/vault":
      return "/vault";
    default:
      if (path.startsWith("/vault/")) return `/vault/${path.slice("/vault/".length)}`;
      return null;
  }
}
