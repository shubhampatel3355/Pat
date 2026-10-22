import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "WIP" };

export default function Page() {
  return <ModulePlaceholder title="WIP" icon="leads" milestone={2} />;
}
