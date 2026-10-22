import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Teams" };

export default function Page() {
  return <ModulePlaceholder title="Teams" icon="teams" milestone={2} />;
}
