/**
 * E2E ONLY — loads the demo data into a throwaway database and puts the accounts the specs use into a known
 * state. Refuses to touch anything that doesn't look like a test database.
 *
 *   DATABASE_URL=…/patmichaels_test pnpm exec tsx tests/e2e/prepare-db.ts
 */
import "dotenv/config";
import { hash } from "@node-rs/argon2";
import { createSeedClient } from "../../prisma/seed";
import { seedDemo } from "../../prisma/seed-demo";
import { ARGON2_OPTIONS } from "../../src/server/auth/argon-options";
import { E2E } from "./accounts";

const dbName = (process.env.DATABASE_URL ?? "").split("?")[0]!.split("/").pop() ?? "";
if (process.env.NODE_ENV === "production" || !/_(test|e2e)$/.test(dbName)) {
  console.error(`prepare-db refuses to run against "${dbName}" — point DATABASE_URL at a *_test or *_e2e database`);
  process.exit(1);
}

async function main() {
  const prisma = createSeedClient();
  try {
    await seedDemo(prisma, () => {});
    // The owner starts every run on a temporary password, so the first-sign-in spec is repeatable.
    await prisma.user.update({
      where: { email: E2E.owner.email },
      data: { passwordHash: await hash(E2E.owner.tempPassword, ARGON2_OPTIONS), mustChangePassword: true, sessionVersion: { increment: 1 } },
    });
    await prisma.$executeRaw`DELETE FROM rate_limits WHERE key LIKE 'login:%'`;
    console.log(`E2E database ${dbName} ready`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
