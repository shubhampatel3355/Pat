import "server-only";
import { env } from "../env";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

interface LayoutInput {
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}

/** Branded, table-based HTML that renders in Gmail/Outlook, plus a plain-text twin. */
function render({ preheader, heading, paragraphs, cta, footnote }: LayoutInput): { html: string; text: string } {
  const e = env();
  const logo = `${e.APP_URL.replace(/\/$/, "")}/brand/pat-michaels-logo.png`;
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:22px;color:#1C1C1E">${esc(p)}</p>`).join("");
  const button = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px"><tr><td style="border-radius:999px;background:#023E7D"><a href="${esc(cta.url)}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${esc(cta.label)}</a></td></tr></table>`
    : "";
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(heading)}</title></head>
<body style="margin:0;padding:0;background:#E8E8E8;font-family:Urbanist,'Segoe UI',Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E8E8E8;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden">
<tr><td style="background:linear-gradient(160deg,#023E7D,#001233);background-color:#002855;padding:22px 28px"><img src="${logo}" alt="${esc(e.COMPANY_SHORT_NAME)}" width="150" style="display:block;width:150px;height:auto"></td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:24px;line-height:30px;font-weight:400;color:#001233">${esc(heading)}</h1>
${body}${button}
${cta ? `<p style="margin:0 0 14px;font-size:12px;line-height:18px;color:#55555A">If the button doesn't work, paste this link into your browser:<br><span style="word-break:break-all;color:#023E7D">${esc(cta.url)}</span></p>` : ""}
${footnote ? `<p style="margin:0;font-size:12px;line-height:18px;color:#55555A">${esc(footnote)}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;background:#F2F6FC;font-size:11px;line-height:16px;color:#55555A">${esc(e.COMPANY_LEGAL_NAME)} · ${esc(e.COMPANY_ADDRESS)}<br>GSTIN ${esc(e.COMPANY_GSTIN)} · ${esc(e.COMPANY_WEBSITE)}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [heading, "", ...paragraphs, ...(cta ? ["", `${cta.label}: ${cta.url}`] : []), ...(footnote ? ["", footnote] : []), "", `${e.COMPANY_LEGAL_NAME} · ${e.COMPANY_ADDRESS}`].join("\n");
  return { html, text };
}

export function inviteEmail(input: { name: string; inviterName: string; link: string; expiresHours: number }) {
  return {
    subject: `You're invited to Pat Michaels OS`,
    ...render({
      preheader: `${input.inviterName} added you to Pat Michaels OS.`,
      heading: `Welcome, ${input.name.split(" ")[0]}`,
      paragraphs: [
        `${input.inviterName} has added you to Pat Michaels OS — the workspace for WIP, follow-ups, cabs, payslips and documents.`,
        `Set your password to get started.`,
      ],
      cta: { label: "Set your password", url: input.link },
      footnote: `This link expires in ${input.expiresHours} hours and can be used once.`,
    }),
  };
}

export function passwordResetEmail(input: { name: string; link: string; expiresMinutes: number }) {
  return {
    subject: "Reset your Pat Michaels OS password",
    ...render({
      preheader: "Use this link to choose a new password.",
      heading: "Reset your password",
      paragraphs: [`Hi ${input.name.split(" ")[0]}, we received a request to reset your password.`, `If this wasn't you, you can ignore this email — your password won't change.`],
      cta: { label: "Choose a new password", url: input.link },
      footnote: `This link expires in ${input.expiresMinutes} minutes and can be used once.`,
    }),
  };
}

export function documentEmail(input: { greetingName: string; heading: string; lines: string[]; footnote?: string }) {
  return render({ preheader: input.heading, heading: input.heading, paragraphs: [`Dear ${input.greetingName},`, ...input.lines], footnote: input.footnote });
}

export function reminderEmail(input: { name: string; what: string; when: string; link: string }) {
  return {
    subject: `Reminder: ${input.what}`,
    ...render({
      preheader: `${input.what} · ${input.when}`,
      heading: "Reminder",
      paragraphs: [`Hi ${input.name.split(" ")[0]}, this is your reminder for “${input.what}” (${input.when}).`],
      cta: { label: "Open Pat Michaels OS", url: input.link },
    }),
  };
}
