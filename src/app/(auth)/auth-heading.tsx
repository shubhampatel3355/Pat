/** Title + subtitle of the sign-in card (also used by the login form's two steps). */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="m-0 text-[32px] font-light leading-[38px] tracking-[-.015em]">{title}</h1>
      <p className="m-0 text-sm text-muted">{subtitle}</p>
    </div>
  );
}
