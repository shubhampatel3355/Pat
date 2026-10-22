import { getApiUser } from "@/server/auth/session";
import { liveSnapshot } from "@/server/services/live";

/** Polled by the shell every 15 s: notifications, team activity ticker, new achievements. */
export async function GET() {
  const user = await getApiUser();
  if (!user) return Response.json({ error: "unauthorised" }, { status: 401 });
  return Response.json(await liveSnapshot(user), { headers: { "cache-control": "no-store" } });
}
