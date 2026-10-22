import "server-only";
import type { Tx } from "../db";

/** In-app notifications (bell). De-duplicates recipients and skips the actor. */
export async function notify(tx: Tx, userIds: (string | null | undefined)[], n: { kind: string; text: string; href?: string }, exceptUserId?: string) {
  const recipients = [...new Set(userIds.filter((id): id is string => Boolean(id) && id !== exceptUserId))];
  if (!recipients.length) return;
  await tx.notification.createMany({ data: recipients.map((userId) => ({ userId, kind: n.kind, text: n.text.slice(0, 300), href: n.href ?? null })) });
}

/** Owners and admins — the people who hear about money events. */
export async function managerIds(tx: Tx): Promise<string[]> {
  const rows = await tx.user.findMany({ where: { role: { in: ["OWNER", "ADMIN"] }, active: true, deletedAt: null }, select: { id: true } });
  return rows.map((r) => r.id);
}
