// Prisma CLI configuration (migrate, generate, studio). The runtime client is created in src/server/db.ts.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations may run with a more privileged role than the app (see docs/DEPLOY.md).
    url: process.env["MIGRATION_DATABASE_URL"] || process.env["DATABASE_URL"],
  },
});
