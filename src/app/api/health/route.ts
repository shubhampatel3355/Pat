import { db } from "@/server/db";

const startedAt = Date.now();

/** Liveness + database reachability for Docker HEALTHCHECK, Coolify and uptime monitors. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ok", db: "ok", uptimeSec: Math.round((Date.now() - startedAt) / 1000), version: process.env.APP_VERSION ?? "dev" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return Response.json({ status: "degraded", db: "unreachable" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
