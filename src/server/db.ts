import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";
import { logger } from "./logger";

function createClient() {
  const e = env();
  const adapter = new PrismaPg({ connectionString: e.DATABASE_URL, max: e.DB_POOL_MAX });
  const slowMs = e.SLOW_QUERY_MS;
  return new PrismaClient({ adapter }).$extends({
    name: "slow-query-log",
    query: {
      async $allOperations({ model, operation, args, query }) {
        const started = performance.now();
        try {
          return await query(args);
        } finally {
          const ms = performance.now() - started;
          if (ms > slowMs) logger.warn({ model, operation, ms: Math.round(ms) }, "slow query");
        }
      },
    },
  });
}

type Database = ReturnType<typeof createClient>;

// The interactive-transaction client of the *extended* client (inferred from the callback overload).
function _transactionClientOf(d: Database) {
  return d.$transaction(async (tx) => tx);
}
export type Tx = Awaited<ReturnType<typeof _transactionClientOf>>;

const globalForDb = globalThis as unknown as { __pmDb?: Database };

function getDb(): Database {
  if (!globalForDb.__pmDb) globalForDb.__pmDb = createClient();
  return globalForDb.__pmDb;
}

/**
 * Lazily-initialised Prisma client (so importing this module during `next build`
 * never needs DATABASE_URL). One instance per process, reused across hot reloads.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const client = getDb();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
