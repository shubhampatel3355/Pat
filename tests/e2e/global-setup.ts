import { execSync } from "node:child_process";

/** Seeds the e2e database before the specs run. E2E_SKIP_PREPARE=1 skips it when the server's database is already prepared. */
export default function globalSetup() {
  if (process.env.E2E_SKIP_PREPARE === "1") return;
  execSync("pnpm exec tsx tests/e2e/prepare-db.ts", { stdio: "inherit" });
}
