import type { Metadata } from "next";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <ModulePlaceholder title="Settings" icon="settings" milestone={5} />;
}
