/**
 * Re-encrypts every encrypted field (BD client phone and email) from one ENCRYPTION_KEY to another, in a single
 * transaction. Run it with the app stopped (or in maintenance), then deploy with the new key.
 *
 *   OLD_ENCRYPTION_KEY=… NEW_ENCRYPTION_KEY=… DATABASE_URL=… pnpm exec tsx scripts/rotate-encryption-key.ts [--dry-run]
 *
 * Uses the same format as src/server/crypto.ts: v1.<iv>.<tag>.<ciphertext>, AES-256-GCM, base64url.
 */
import "dotenv/config";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import pg from "pg";

const COLUMNS = [["bd_meetings", ["client_phone_enc", "client_email_enc"]]] as const;

function key(name: string): Buffer {
  const k = Buffer.from(process.env[name] ?? "", "base64");
  if (k.length !== 32) throw new Error(`${name} must be 32 bytes, base64-encoded`);
  return k;
}

function decrypt(value: string, k: Buffer): string {
  const [version, iv, tag, ct] = value.split(".");
  if (version !== "v1" || !iv || !tag || ct === undefined) throw new Error("Unsupported ciphertext format");
  const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
}

function encrypt(plain: string, k: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const oldKey = key("OLD_ENCRYPTION_KEY");
  const newKey = key("NEW_ENCRYPTION_KEY");
  if (oldKey.equals(newKey)) throw new Error("OLD_ENCRYPTION_KEY and NEW_ENCRYPTION_KEY are the same");
  const client = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    for (const [table, columns] of COLUMNS) {
      const { rows } = await client.query<Record<string, string | null>>(`SELECT id, ${columns.join(", ")} FROM ${table} FOR UPDATE`);
      let changed = 0;
      for (const row of rows) {
        const next = columns.map((c) => (row[c] ? encrypt(decrypt(row[c], oldKey), newKey) : null));
        if (next.every((v) => v === null)) continue;
        await client.query(`UPDATE ${table} SET ${columns.map((c, i) => `${c} = $${i + 2}`).join(", ")} WHERE id = $1`, [row.id, ...next]);
        changed++;
      }
      console.log(`${table}: ${changed} of ${rows.length} rows re-encrypted`);
    }
    await client.query(dryRun ? "ROLLBACK" : "COMMIT");
    console.log(dryRun ? "Dry run: every value decrypted with the old key; nothing saved." : "Done. Deploy with NEW_ENCRYPTION_KEY as ENCRYPTION_KEY.");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
