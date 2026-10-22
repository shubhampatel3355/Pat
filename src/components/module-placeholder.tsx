import Link from "next/link";
import type { IconName } from "@/lib/icons";
import { Icon } from "./ui/icon";

/** The prototype's "module arrives in a later batch" card, used while a module is still being built. */
export function ModulePlaceholder({ title, icon, milestone }: { title: string; icon: IconName; milestone: number }) {
  return (
    <div className="flex flex-col gap-6 pl-[clamp(0px,3vw,48px)] pt-9">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[32px] font-light leading-[38px] tracking-[-.015em]">{title}</h1>
        <span className="text-sm text-muted">Pat Michaels OS</span>
      </div>
      <div className="flex max-w-[560px] flex-col items-start gap-4 rounded-[20px] bg-card p-8 shadow-raised">
        <span className="flex h-14 w-14 items-center justify-center rounded-pill bg-surface">
          <Icon name={icon} size={22} color="#023E7D" />
        </span>
        <span className="text-[22px] font-normal tracking-[-.01em]">Arrives in milestone {milestone}</span>
        <span className="text-sm leading-5 text-muted">This module uses the same shell, cards and widgets as the dashboard. Its screens arrive in the next build milestone.</span>
        <Link href="/dashboard" className="hit-44 inline-flex h-10 items-center rounded-pill bg-primary px-5 text-[13px] font-medium text-white shadow-primary hover:bg-primary-hover hover:text-white">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
