import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Business Development" };

export default function Page() {
  return <ModulePlaceholder title="Business Development" icon="bizdev" milestone={4} />;
}
