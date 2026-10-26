/** Progress ring (prototype: light track, stroke url(#pmGradB), rounded cap). `pct` 0–100. */
export function Ring({ pct, size = 76, stroke = 8, track = "var(--color-chip-3)", color = "url(#pmGradB)", label, children }: { pct: number; size?: number; stroke?: number; track?: string; color?: string; label?: string; children?: React.ReactNode }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative flex-none" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(clamped)}%`}>
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <circle cx="50" cy="50" r="42" fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${clamped} 100`}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dasharray .6s cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </div>
  );
}

/** Shared SVG gradients from the prototype (rendered once in the app shell). */
export function SvgDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="pmGradA" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#023E7D" />
          <stop offset=".62" stopColor="#5C7FA8" />
          <stop offset="1" stopColor="#E9E9E9" />
        </linearGradient>
        <linearGradient id="pmGradB" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--color-primary)" }} />
          <stop offset="1" style={{ stopColor: "light-dark(#5C7FA8, #7EA7D8)" }} />
        </linearGradient>
        <linearGradient id="pmArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#023E7D" stopOpacity=".28" />
          <stop offset="1" stopColor="#023E7D" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
