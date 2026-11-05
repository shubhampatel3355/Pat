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

// The Dockerfile copies .next/standalone as it comes out of the build: a lockfile in a parent folder must not move it.
const root = process.cwd();

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: root,
  // Playwright reads this by a computed path, so tracing misses it, and without it the job workers and PDFs can't load.
  outputFileTracingIncludes: { "/*": ["node_modules/playwright-core/browsers.json"] },
  poweredByHeader: false,
  reactStrictMode: true,
  // The app has no next/image: this turns the optimiser endpoint (CPU-heavy, and public) off.
  images: { unoptimized: true },
  // Dev servers otherwise print every Server Action call with its arguments — passwords, salaries, client
  // contacts — to the terminal and any log file. (Production never logs these.)
  logging: { serverFunctions: false },
  // Native / Node-only packages stay out of the bundle and are traced into the standalone output.
  serverExternalPackages: [
    "@node-rs/argon2",
    "pg",
    "pg-boss",
    "playwright-core",
    "pino",
    "exceljs",
    "nodemailer",
    "@sentry/node",
  ],
  turbopack: {
    root,
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
