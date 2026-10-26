import type { Metadata } from "next";
import Link from "next/link";
import { AuthScreen } from "./(auth)/auth-card";

export const metadata: Metadata = { title: "Page not found" };

/** Addresses that match no page at all (outside the signed-in shell). */
export default function NotFound() {
  return (
    <AuthScreen title="Page not found" subtitle="That address doesn’t match any page in Pat Michaels OS.">
      <Link
        href="/dashboard"
        className="hit-44 inline-flex h-12 w-full items-center justify-center rounded-pill bg-primary text-[13px] font-medium text-white shadow-primary hover:bg-primary-hover hover:text-white"
      >
        Go to the dashboard
      </Link>
    </AuthScreen>
  );
}
