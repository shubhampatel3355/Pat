import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Finance" };

export default function Page() {
  return <ModulePlaceholder title="Finance" icon="finance" milestone={3} />;
}
