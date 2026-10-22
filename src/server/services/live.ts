import "server-only";
import type { LiveSnapshot } from "@/components/shell/live";
import { formatCompactINR, toPaise } from "@/lib/money";
import { initialsOf } from "../auth/session";
import { db } from "../db";
import { isAdminOrOwner, type SessionUser } from "../policy";
import { feedScope } from "../policy/scopes";

const ACHIEVEMENT_WINDOW_DAYS = 30;

/** Notifications, team activity and fresh achievements for the shell (also served by /api/live). */
export async function liveSnapshot(user: SessionUser): Promise<LiveSnapshot> {
  const me = await db.user.findUnique({ where: { id: user.id }, select: { achievementsSeenAt: true, createdAt: true } });
  const windowStart = new Date(Date.now() - ACHIEVEMENT_WINDOW_DAYS * 86_400_000);
  const seenAt = me?.achievementsSeenAt ?? me?.createdAt ?? windowStart;
  const since = seenAt > windowStart ? seenAt : windowStart;

  const [notifications, unread, feed, achievements] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.auditLog.findMany({ where: feedScope(user), orderBy: { createdAt: "desc" }, take: 14, select: { id: true, actorName: true, text: true, module: true, createdAt: true } }),
    db.achievement.findMany({
      where: { createdAt: { gt: since }, ...(isAdminOrOwner(user) ? {} : { userId: user.id }) },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  return {
    unread,
    notifications: notifications.map((n) => ({ id: n.id, text: n.text, href: n.href, at: n.createdAt.toISOString(), read: Boolean(n.readAt) })),
    activity: feed.map((a) => ({
      id: a.id,
      initials: a.actorName === "System" ? "SYS" : initialsOf(a.actorName),
      who: a.actorName,
      text: a.text.startsWith(`${a.actorName} `) ? a.text.slice(a.actorName.length + 1) : a.text,
      module: a.module,
      at: a.createdAt.toISOString(),
    })),
    newAchievements: achievements.map((a) => ({
      id: a.id,
      title: a.title,
      meta: a.meta,
      value: a.valuePaise === null ? null : formatCompactINR(toPaise(a.valuePaise)),
      at: a.createdAt.toISOString(),
    })),
  };
}
