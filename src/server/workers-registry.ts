import "server-only";
import { invoicePdf } from "./pdf/documents";
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
