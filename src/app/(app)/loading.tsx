/** Shown while a page's data loads (navigation feels immediate). Matches the module page rhythm. */
export default function AppLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex animate-delayed-in flex-col gap-4 pl-[clamp(0px,1vw,8px)] pt-8">
      <span className="h-[38px] w-56 animate-pulse rounded-pill bg-card" />
      <span className="h-4 w-80 max-w-full animate-pulse rounded-pill bg-card" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-2 pt-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-36 animate-pulse rounded-card bg-card" />
        ))}
      </div>
      <span className="h-72 animate-pulse rounded-card bg-card" />
    </div>
  );
}
