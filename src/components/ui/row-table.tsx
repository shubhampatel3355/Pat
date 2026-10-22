import { cn } from "./cn";

/**
 * The prototype's list pattern: a #D1D1D1 tray (radius 24, padding 8) holding a header row and
 * #E8E8E8 row cards (radius 16, min-height 56) on a shared CSS grid template.
 */
export function RowTable({ minWidth, columns, label, children, className }: { minWidth: number; columns: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("pm-scroll overflow-x-auto rounded-card bg-card p-2", className)}>
      <div role="table" aria-label={label} className="flex flex-col gap-1" style={{ minWidth, ["--cols" as string]: columns }}>
        {children}
      </div>
    </div>
  );
}

export function RowHead({ children }: { children: React.ReactNode }) {
  return (
    <div role="row" className="grid h-10 items-center gap-3 px-3 text-xs font-medium text-muted" style={{ gridTemplateColumns: "var(--cols)" }}>
      {children}
    </div>
  );
}

export function HeadCell({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <span role="columnheader" className={align === "right" ? "text-right" : undefined}>
      {children}
    </span>
  );
}

export function Row({ children, highlighted, className, style, onClick }: { children: React.ReactNode; highlighted?: boolean; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return (
    <div
      role="row"
      onClick={onClick}
      className={cn(
        "grid min-h-14 items-center gap-3 rounded-row px-3 text-[13px] transition-[background-color,box-shadow] duration-[1000ms,120ms] hover:shadow-hover",
        highlighted ? "bg-[rgba(2,62,125,.14)]" : "bg-surface",
        onClick && "cursor-pointer",
        className,
      )}
      style={{ gridTemplateColumns: "var(--cols)", ...style }}
    >
      {children}
    </div>
  );
}

export function Cell({ children, className, align = "left" }: { children?: React.ReactNode; className?: string; align?: "left" | "right" }) {
  return (
    <div role="cell" className={cn("min-w-0", align === "right" && "text-right", className)}>
      {children}
    </div>
  );
}
