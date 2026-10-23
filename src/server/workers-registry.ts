import "server-only";
import { invoicePdf, payslipPdf } from "./pdf/documents";
import { registerAttachmentResolver, registerReminderHandler } from "./queue/workers";
import { handleReminder } from "./services/reminders";

/**
 * Imported by the worker at start-up. Each module that renders email attachments or handles
 * reminders registers itself here.
 */
registerReminderHandler(handleReminder);

registerAttachmentResolver("invoice-pdf", async (spec) => {
  if (spec.kind !== "invoice-pdf") throw new Error("Wrong attachment kind");
  const { filename, bytes } = await invoicePdf(spec.invoiceId);
  return { filename, content: bytes, contentType: "application/pdf" };
});

registerAttachmentResolver("payslip-pdf", async (spec) => {
  if (spec.kind !== "payslip-pdf") throw new Error("Wrong attachment kind");
  const pdf = await payslipPdf(spec.userId, spec.periodType, spec.period);
  if (!pdf) throw new Error(`No payslip for ${spec.userId} ${spec.periodType} ${spec.period}`);
  return { filename: pdf.filename, content: pdf.bytes, contentType: "application/pdf" };
});
