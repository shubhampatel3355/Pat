import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Invoice" };

export default function Page() {
  return <ModulePlaceholder title="Invoice" icon="invoice" milestone={3} />;
}
