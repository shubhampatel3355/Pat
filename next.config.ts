import type { NextConfig } from "next";

// Static security headers. The Content-Security-Policy (with a per-request nonce) is set in src/proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Native / Node-only packages stay out of the bundle and are traced into the standalone output.
  serverExternalPackages: [
    "@node-rs/argon2",
    "pg",
    "pg-boss",
    "playwright-core",
    "pino",
    "pino-pretty",
    "exceljs",
    "nodemailer",
    "@sentry/node",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    serverActions: {
      // Forms only. File uploads go through /api/files (25 MB limit enforced there).
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
