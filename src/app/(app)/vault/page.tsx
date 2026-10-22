import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Contracts & Vault" };

export default function Page() {
  return <ModulePlaceholder title="Contracts & Vault" icon="vault" milestone={4} />;
}
