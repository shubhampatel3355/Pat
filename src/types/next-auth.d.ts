import type { DefaultSession } from "next-auth";
// Imported so the "next-auth/jwt" augmentation below resolves the real module.
import type {} from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    /** Session version at sign-in; compared with users.session_version on every request. */
    sv?: number;
    user: { id: string } & DefaultSession["user"];
  }

  interface User {
    remember?: boolean;
    sessionVersion?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    sv?: number;
    /** Absolute expiry (epoch seconds) — 12 h, or 30 days with "Remember this device". */
    rexp?: number;
  }
}
