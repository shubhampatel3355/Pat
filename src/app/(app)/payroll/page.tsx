import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Payroll" };

export default function Page() {
  return <ModulePlaceholder title="Payroll" icon="payroll" milestone={4} />;
}
