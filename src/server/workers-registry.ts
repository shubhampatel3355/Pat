import "server-only";

/**
 * Imported by the worker at start-up. Each module that renders email attachments or handles
 * reminders registers itself here (see registerAttachmentResolver / registerReminderHandler).
 */
export {};
