import Link from "next/link";
import type { IconName } from "@/lib/icons";
import { Icon } from "./ui/icon";

/** The prototype's module card ("…arrives in a later batch" + Back to dashboard), used for not-found and error pages. */
export function StatusCard({ icon, title, body, children }: { icon: IconName; title: string; body: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex max-w-[560px] flex-col items-start gap-4 rounded-[20px] bg-card p-8 shadow-raised">
      <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-surface">
        <Icon name={icon} size={22} color="#023E7D" />
      </span>
      <span className="text-[22px] font-normal tracking-[-.01em]">{title}</span>
      <span className="text-sm leading-5 text-muted">{body}</span>
      <div className="flex flex-wrap gap-2">
        {children}
        <Link href="/dashboard" className="hit-44 inline-flex h-10 items-center rounded-pill bg-primary px-5 text-[13px] font-medium text-white shadow-primary hover:bg-primary-hover hover:text-white">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
