import { cn } from "./cn";

/** Module page wrapper: 32 px top padding, 16 px rhythm (prototype module screens). */
export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-4 pl-[clamp(0px,1vw,8px)] pt-8", className)}>{children}</div>;
}

export function PageHeader({ title, meta, actions }: { title: React.ReactNode; meta?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="m-0 text-[32px] font-light leading-[38px] tracking-[-.015em]">{title}</h1>
        {meta && <span className="text-[13px] text-muted">{meta}</span>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, meta }: { title: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="m-0 text-[22px] font-normal leading-7 tracking-[-.01em]">{title}</h2>
      {meta && <span className="text-xs text-muted">{meta}</span>}
    </div>
  );
}
