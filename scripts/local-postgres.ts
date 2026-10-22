/**
 * Docker-less PostgreSQL 17 for local development and e2e tests (Windows, macOS, Linux).
 * Data lives in .local/pg. Runs until Ctrl+C.
 *
 *   pnpm db:local
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:54329/patmichaels
 *
 * With Docker available, `docker compose up db` is the equivalent.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const port = Number(process.env.LOCAL_PG_PORT ?? 54329);
const databases = (process.env.LOCAL_PG_DATABASES ?? "patmichaels,patmichaels_test").split(",");
const databaseDir = path.resolve(".local/pg");

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir,
    port,
    user: "postgres",
    password: "postgres",
    authMethod: "scram-sha-256",
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "timezone=UTC", "-c", "log_min_duration_statement=500"],
    onLog: () => {},
    onError: (e) => console.error("[postgres]", e),
  });

  if (!existsSync(path.join(databaseDir, "PG_VERSION"))) {
    console.log("Initialising a new cluster in", databaseDir);
    await pg.initialise();
  }
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  for (const name of databases) {
    const exists = await client.query("select 1 from pg_database where datname = $1", [name]);
    if (!exists.rowCount) {
      await client.query(`create database "${name.replace(/"/g, "")}"`);
      console.log("Created database", name);
    }
  }
  await client.end();

  for (const name of databases) {
    console.log(`PostgreSQL 17 ready → postgresql://postgres:postgres@localhost:${port}/${name}`);
  }

  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
