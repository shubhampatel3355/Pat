/**
 * Production-safe, idempotent seed. Safe to run on every deploy:
 *  - on a database with no owners, creates them from SEED_OWNERS (required in production; the dev/demo
 *    default is the prototype's two partners) — never touches owners once any exist,
 *  - inserts missing permission defaults (never overrides a toggle changed in Settings),
 *  - creates the three vault folders,
 *  - creates company targets only when SEED_TARGET_REVENUE_CR / SEED_TARGET_WIP_CR are set.
 *
 *   pnpm db:seed
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ARGON2_OPTIONS } from "../src/server/auth/argon-options";
import { PERMISSION_DEFS } from "../src/lib/permissions";
import { currentFy, fyQuarterOfIso, isoDateIST } from "../src/lib/dates";

const CRORE_PAISE = 10_000_000 * 100;

function parseOwners(raw: string): { name: string; email: string }[] {
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const m = entry.match(/^(.+?)\s*<([^>]+)>$/);
      if (!m) throw new Error(`SEED_OWNERS entry must look like "Name <email>": ${entry}`);
      return { name: m[1]!.trim(), email: m[2]!.trim().toLowerCase() };
    });
}

/** Development and demo databases only: the prototype's two partners. */
const DEV_OWNERS = "Pat Michaels <pat@patmichaels.in>;Arjun Rao <arjun@patmichaels.in>";

/** Company targets for the current FY (revenue) and quarter (WIP fees), each only when missing. */
export async function seedCompanyTargets(prisma: PrismaClient, crore: { revenue?: number; wipFees?: number }) {
  const fy = currentFy();
  const quarter = fyQuarterOfIso(isoDateIST());
  const rows = [
    crore.revenue !== undefined ? { metric: "REVENUE" as const, period: fy.key, amount: crore.revenue } : null,
    crore.wipFees !== undefined ? { metric: "WIP_FEES" as const, period: quarter.key, amount: crore.wipFees } : null,
  ];
  for (const r of rows) {
    if (!r) continue;
    await prisma.target.upsert({
      where: { scope_scopeKey_metric_period: { scope: "COMPANY", scopeKey: "company", metric: r.metric, period: r.period } },
      update: {},
      create: { scope: "COMPANY", scopeKey: "company", metric: r.metric, period: r.period, amountPaise: BigInt(Math.round(r.amount * CRORE_PAISE)) },
    });
  }
}

export async function seedBase(prisma: PrismaClient, log: (msg: string) => void = console.log) {
  // Owners: only the very first ones, on a database that has none. After that, people are managed in the app,
  // so renaming or removing a seeded owner never brings them back on the next deploy.
  const ownerCount = await prisma.user.count({ where: { role: "OWNER", deletedAt: null } });
  const rawOwners = process.env.SEED_OWNERS ?? (process.env.NODE_ENV === "production" ? null : DEV_OWNERS);
  if (!ownerCount && !rawOwners) {
    throw new Error('No owner accounts yet. Set SEED_OWNERS to create the first ones, e.g. SEED_OWNERS="Asha Rao <asha@yourcompany.com>"');
  }
  const owners = ownerCount ? [] : parseOwners(rawOwners!);
  for (const owner of owners) {
    const existing = await prisma.user.findUnique({ where: { email: owner.email } });
    if (existing) {
      if (existing.role !== "OWNER") await prisma.user.update({ where: { id: existing.id }, data: { role: "OWNER" } });
      continue;
    }
    const password = process.env.SEED_OWNER_PASSWORD || randomBytes(12).toString("base64url");
    await prisma.user.create({
      data: {
        email: owner.email,
        name: owner.name,
        role: "OWNER",
        title: "Partner",
        passwordHash: await hash(password, ARGON2_OPTIONS),
        mustChangePassword: true,
      },
    });
    log(`Created owner ${owner.name} <${owner.email}>${process.env.SEED_OWNER_PASSWORD ? "" : ` — temporary password: ${password}`} (must be changed at first sign-in)`);
  }

  // Permission defaults (missing rows only)
  const rows = PERMISSION_DEFS.flatMap((def) => (["ADMIN", "EMPLOYEE"] as const).map((role) => ({ role, key: def.key, allowed: def.defaults[role] })));
  const created = await prisma.permission.createMany({ data: rows, skipDuplicates: true });
  if (created.count) log(`Inserted ${created.count} permission defaults`);

  // Vault folders
  const folders = [
    { key: "PM_DOCUMENTS", name: "Pat Michaels Documents" },
    { key: "CLIENT_DOCUMENTS", name: "Client Documents" },
    { key: "EMPLOYEE_DOCUMENTS", name: "Employee Documents" },
  ] as const;
  for (const f of folders) await prisma.folder.upsert({ where: { key: f.key }, update: {}, create: f });

  // Targets: none are invented. Set them in Settings → General, or seed them with SEED_TARGET_REVENUE_CR /
  // SEED_TARGET_WIP_CR (crore). A target already set is never changed.
  const revenue = process.env.SEED_TARGET_REVENUE_CR;
  const wipFees = process.env.SEED_TARGET_WIP_CR;
  await seedCompanyTargets(prisma, { revenue: revenue ? Number(revenue) : undefined, wipFees: wipFees ? Number(wipFees) : undefined });
}

export function createSeedClient() {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

async function main() {
  const prisma = createSeedClient();
  try {
    await seedBase(prisma);
    console.log("Seed complete.");
  } finally {
    await prisma.$disconnect();
  }
}

// Run when executed directly (tsx prisma/seed.ts or the bundled dist file), not when imported by seed-demo.
const invokedDirectly = process.argv[1] && /seed(\.bundle)?\.(ts|mjs|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
