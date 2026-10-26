"use client";

import { StatusCard } from "@/components/status-card";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/ui/page";

/** A page failed while rendering. The server already logged it; the reference matches the log entry. */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : null;
  return (
    <Page>
      <PageHeader title="Something went wrong" meta={digest ? `Reference ${digest}` : "Pat Michaels OS"} />
      <StatusCard icon="spark" title="This page couldn’t load" body="The problem has been recorded. Try again — if it keeps happening, send the reference above to whoever looks after the system.">
        <Button variant="surface" onClick={() => retry()}>
          Try again
        </Button>
      </StatusCard>
    </Page>
  );
}
