import type { Metadata } from "next";
import { StatusCard } from "@/components/status-card";
import { Page, PageHeader } from "@/components/ui/page";

export const metadata: Metadata = { title: "Not available" };

/** Pages that don't exist and pages the signed-in role may not open (both answer 404). */
export default function AppNotFound() {
  return (
    <Page>
      <PageHeader title="Not available" meta="Pat Michaels OS" />
      <StatusCard
        icon="lock"
        title="This page isn’t available"
        body="It may have moved, or your role doesn’t include it. If you need access, ask an owner to change your permissions in Settings."
      />
    </Page>
  );
}
