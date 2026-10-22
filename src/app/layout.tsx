import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { INTRO_BOOT_SCRIPT, LogoIntro } from "@/components/intro/logo-intro";
import { urbanist, urbanistExt } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Pat Michaels OS", template: "%s · Pat Michaels OS" },
  description: "Operating system for Pat Michaels Developers LLP — WIP, invoicing, payroll and more.",
  robots: { index: false, follow: false },
  icons: { icon: "/brand/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#001233",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Per-request CSP nonce from src/proxy.ts (every page is dynamically rendered).
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en-IN" className={`${urbanist.variable} ${urbanistExt.variable}`} suppressHydrationWarning>
      <head>
        {/* Decides before first paint whether the brand intro plays (once per session, not with reduced motion). */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: INTRO_BOOT_SCRIPT }} />
      </head>
      <body>
        {children}
        <LogoIntro />
      </body>
    </html>
  );
}
