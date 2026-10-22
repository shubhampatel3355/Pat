import "server-only";
import { registerReminderHandler } from "./queue/workers";
import { handleReminder } from "./services/reminders";

/**
 * Imported by the worker at start-up. Each module that renders email attachments or handles
 * reminders registers itself here (see registerAttachmentResolver / registerReminderHandler).
 */
registerReminderHandler(handleReminder);
