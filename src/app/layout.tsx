import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { LogoIntro } from "@/components/intro/logo-intro";
import { INTRO_COOKIE } from "@/lib/intro";
import { isTheme, THEME_COOKIE } from "@/lib/theme";
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
  const isPrint = (await headers()).get("x-pm-path")?.startsWith("/print/") ?? false;
  const jar = await cookies();
  // The brand intro plays once per browser session (session cookie set by the intro itself).
  const playIntro = !isPrint && !jar.has(INTRO_COOKIE);
  // A saved theme is rendered straight away; without one, CSS follows the system (globals.css).
  const savedTheme = jar.get(THEME_COOKIE)?.value;
  return (
    <html
      lang="en-IN"
      className={`${urbanist.variable} ${urbanistExt.variable}`}
      data-intro={playIntro ? "1" : undefined}
      data-print={isPrint ? "1" : undefined}
      data-theme={!isPrint && isTheme(savedTheme) ? savedTheme : undefined}
      suppressHydrationWarning
    >
      <body>
        {children}
        {playIntro && <LogoIntro />}
      </body>
    </html>
  );
}
