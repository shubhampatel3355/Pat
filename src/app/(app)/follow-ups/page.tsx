import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Follow-ups & Tasks" };

export default function Page() {
  return <ModulePlaceholder title="Follow-ups & Tasks" icon="followups" milestone={4} />;
}
