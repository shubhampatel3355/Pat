import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Vehicle Management" };

export default function Page() {
  return <ModulePlaceholder title="Vehicle Management" icon="car" milestone={4} />;
}
