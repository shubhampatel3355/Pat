import { beforeAll, describe, expect, it } from "vitest";

// Presigning is local (no network), so the S3 driver can be checked without MinIO.
beforeAll(() => {
  Object.assign(process.env, {
    APP_URL: "https://os.example.com",
    DATABASE_URL: "postgresql://u:p@localhost:5432/x",
    AUTH_SECRET: "unit-test-secret-0123456789abcdef0123456789",
    ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    STORAGE_DRIVER: "s3",
    S3_ENDPOINT: "http://minio:9000",
    S3_PUBLIC_ENDPOINT: "https://files.example.com",
    S3_BUCKET: "pm-test",
    S3_ACCESS_KEY_ID: "key",
    S3_SECRET_ACCESS_KEY: "secret",
    MAIL_DRIVER: "file",
  });
});

describe("S3 download links", () => {
  it("are signed for the public address, expire in a minute and force a download", async () => {
    const { storage } = await import("@/server/storage");
    const url = new URL(await storage().signedDownloadUrl("vault/abc.pdf", "Lease deed.pdf"));
    expect(url.origin).toBe("https://files.example.com");
    expect(url.pathname).toBe("/pm-test/vault/abc.pdf");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
    expect(url.searchParams.get("response-content-disposition")).toBe("attachment; filename*=UTF-8''Lease%20deed.pdf");
  });
});
