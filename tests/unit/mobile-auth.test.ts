import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  Object.assign(process.env, {
    APP_URL: "https://os.example.com",
    DATABASE_URL: "postgresql://u:p@localhost:5432/x",
    AUTH_SECRET: "unit-test-secret-0123456789abcdef0123456789",
    ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    STORAGE_DRIVER: "local",
    MAIL_DRIVER: "file",
    AUTH_REMEMBER_DAYS: "30",
  });
});

describe("mobile app tokens", () => {
  it("round-trip the user and session version, and carry the remember-me lifetime", async () => {
    const { issueMobileToken, verifyMobileToken } = await import("@/server/auth/mobile-token");
    const { token, expiresAt } = issueMobileToken({ id: "0190a0a0-0000-7000-8000-000000000001", sessionVersion: 3 });
    const claims = verifyMobileToken(token);
    expect(claims).toMatchObject({ uid: "0190a0a0-0000-7000-8000-000000000001", sv: 3 });
    const days = (Date.parse(expiresAt) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  it("are refused when tampered with, expired, or signed for another purpose", async () => {
    const { issueMobileToken, verifyMobileToken } = await import("@/server/auth/mobile-token");
    const { signPayload } = await import("@/server/crypto");
    const { token } = issueMobileToken({ id: "u1", sessionVersion: 0 });
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "someone-else", sv: 0, iat: 1, exp: 9_999_999_999 })).toString("base64url");
    expect(verifyMobileToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyMobileToken(`${body}.${sig}x`)).toBeNull();
    expect(verifyMobileToken("")).toBeNull();
    // A print-page or download token must never work as a sign-in.
    expect(verifyMobileToken(signPayload("local-storage", { uid: "u1", sv: 0, iat: 1 }, 60))).toBeNull();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 31 * 86_400_000);
    expect(verifyMobileToken(token)).toBeNull();
    vi.useRealTimers();
  });

  it("are renewed once they are a day old", async () => {
    const { shouldRenew } = await import("@/server/auth/mobile-token");
    const now = Math.floor(Date.now() / 1000);
    expect(shouldRenew({ uid: "u1", sv: 0, iat: now - 3600 })).toBe(false);
    expect(shouldRenew({ uid: "u1", sv: 0, iat: now - 2 * 86_400 })).toBe(true);
  });
});

describe("bearer requests", () => {
  it("read only the Bearer scheme", async () => {
    const { bearerToken } = await import("@/server/request");
    expect(bearerToken(new Headers({ authorization: "Bearer abc.def" }))).toBe("abc.def");
    expect(bearerToken(new Headers({ authorization: "bearer  abc.def " }))).toBe("abc.def");
    expect(bearerToken(new Headers({ authorization: "Bearer" }))).toBeNull();
    // A proxy's Basic auth is not ours: the browser's cookie session must keep working behind it.
    expect(bearerToken(new Headers({ authorization: "Basic dXNlcjpwYXNz" }))).toBeNull();
    expect(bearerToken(new Headers())).toBeNull();
  });

  it("pass the same-origin check (browsers can't attach them cross-site); cookie requests are still checked", async () => {
    const { isSameOrigin } = await import("@/server/request");
    expect(isSameOrigin(new Headers({ authorization: "Bearer abc.def", origin: "https://evil.example" }))).toBe(true);
    expect(isSameOrigin(new Headers({ origin: "https://evil.example", host: "os.example.com" }))).toBe(false);
    expect(isSameOrigin(new Headers({ origin: "https://os.example.com", host: "os.example.com" }))).toBe(true);
    expect(isSameOrigin(new Headers({ authorization: "Basic dXNlcjpwYXNz", origin: "https://evil.example", host: "os.example.com" }))).toBe(false);
  });
});
