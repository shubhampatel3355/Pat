import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { LogoIntro } from "@/components/intro/logo-intro";
import { INTRO_COOKIE } from "@/lib/intro";
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
  // The brand intro plays once per browser session (session cookie set by the intro itself).
  const playIntro = !(await cookies()).has(INTRO_COOKIE);
  return (
    <html lang="en-IN" className={`${urbanist.variable} ${urbanistExt.variable}`} data-intro={playIntro ? "1" : undefined} suppressHydrationWarning>
      <body>
        {children}
        {playIntro && <LogoIntro />}
      </body>
    </html>
  );
}
