import { BRAND_MARK } from "@/lib/icons";

export function AuthHeading({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="m-0 text-[32px] font-light leading-[38px] tracking-[-.015em]">{title}</h1>
      <p className="m-0 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

/** The prototype's sign-in card: frosted glass, 420 px, enters after the brand intro. Without a title the children render their own heading. */
export function AuthScreen({ title, subtitle, children }: { title?: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden p-6">
      <div className="glass pm-after-intro relative flex w-full max-w-[420px] animate-[pmcCard_1s_cubic-bezier(.22,1,.36,1)_both] flex-col gap-5 rounded-panel p-8 shadow-panel">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-pill bg-surface shadow-raised">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path d={BRAND_MARK} fill="#023E7D" />
            </svg>
          </div>
          <div className="flex flex-col leading-[1.2]">
            <span className="text-sm font-medium">Pat Michaels</span>
            <span className="text-xs text-muted">Business Operating System</span>
          </div>
        </div>
        {title && <AuthHeading title={title} subtitle={subtitle} />}
        {children}
      </div>
    </main>
  );
}
