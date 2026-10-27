import type { IconName } from "@/lib/icons";
import { Icon } from "../ui/icon";
import { FreshValue } from "../ui/motion";

type Bars = { value: number; tip: string }[];
type BarChart = { bars: Bars; ticks: string[] };
type DialChart = { pct: number; value: string; caption: string };

export type KpiChart =
  | ({ type: "spark" } & BarChart)
  | ({ type: "slider" } & BarChart)
  | ({ type: "ring" } & DialChart)
  | ({ type: "gauge" } & DialChart)
  | ({ type: "stadium" } & DialChart);

export interface KpiCardData {
  title: string;
  icon: IconName;
  value: string;
  delta: string;
  chart: KpiChart;
}

const TRACK = "rgba(255,255,255,.18)";

/** Bar heights as % of the tallest bar (min 6% so empty months still show a stub). */
function heights(bars: Bars): { h: string; top: boolean }[] {
  const max = Math.max(0, ...bars.map((b) => b.value));
  const top = max > 0 ? bars.findIndex((b) => b.value === max) : -1;
  return bars.map((b, i) => ({ h: `${Math.max(6, max ? (b.value / max) * 100 : 0)}%`, top: i === top }));
}

function Ticks({ ticks, spread }: { ticks: string[]; spread: "between" | "around" }) {
  return (
    <div className={`flex text-[10px] opacity-[.88] ${spread === "between" ? "justify-between" : "justify-around"}`} aria-hidden="true">
      {ticks.map((t, i) => (
        <span key={`${t}-${i}`}>{t}</span>
      ))}
    </div>
  );
}

function Chart({ chart }: { chart: KpiChart }) {
  if (chart.type === "spark") {
    return (
      <div className="flex w-full flex-col gap-1.5" role="img" aria-label={chart.bars.map((b) => b.tip).join(", ")}>
        <div className="flex h-[84px] items-end justify-between gap-[3px]">
          {heights(chart.bars).map((b, i) => (
            <span key={i} title={chart.bars[i]!.tip} className="max-w-2 flex-1 animate-bar-in rounded-pill bg-white transition-[height,opacity] duration-(--duration-enter) ease-standard" style={{ height: b.h, opacity: b.top ? 1 : 0.4, animationDelay: `${i * 25}ms` }} />
          ))}
        </div>
        <Ticks ticks={chart.ticks} spread="between" />
      </div>
    );
  }
  if (chart.type === "slider") {
    return (
      <div className="flex w-full flex-col gap-1.5" role="img" aria-label={chart.bars.map((b) => b.tip).join(", ")}>
        <div className="flex h-[84px] justify-around">
          {heights(chart.bars).map((b, i) => (
            <div key={i} title={chart.bars[i]!.tip} className="relative h-full w-1.5 rounded-pill" style={{ background: TRACK }}>
              <span className="absolute inset-x-0 bottom-0 animate-bar-in rounded-pill bg-white transition-[height] duration-(--duration-enter) ease-standard" style={{ height: b.h }} />
              <span className="absolute -left-0.5 h-2.5 w-2.5 animate-knob-in rounded-pill bg-white shadow-[0_0_0_2px_#023E7D] transition-[bottom] duration-(--duration-enter) ease-standard" style={{ bottom: `calc(${b.h} - 5px)` }} />
            </div>
          ))}
        </div>
        <Ticks ticks={chart.ticks} spread="around" />
      </div>
    );
  }
  const offset = 100 - chart.pct;
  const label = `${chart.caption} ${chart.value}`;
  if (chart.type === "ring") {
    return (
      <div className="relative h-[100px] w-[100px]" role="img" aria-label={label}>
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r="42" fill="none" stroke={TRACK} strokeWidth="7" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={offset} transform="rotate(-90 50 50)" className="animate-draw" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base">{chart.value}</span>
          <span className="text-[10px] opacity-[.88]">{chart.caption}</span>
        </div>
      </div>
    );
  }
  if (chart.type === "gauge") {
    return (
      <div className="relative w-full max-w-[200px]" role="img" aria-label={label}>
        <svg viewBox="0 0 200 108" className="block w-full" aria-hidden="true">
          <path d="M14 100A86 86 0 0 1 186 100" fill="none" stroke={TRACK} strokeWidth="7" strokeLinecap="round" />
          <path d="M14 100A86 86 0 0 1 186 100" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={offset} className="animate-draw" />
        </svg>
        <div className="absolute inset-x-0 bottom-0.5 flex flex-col items-center">
          <span className="text-[11px] opacity-[.88]">{chart.caption}</span>
          <span className="text-base">{chart.value}</span>
        </div>
      </div>
    );
  }
  return (
    <div className="relative w-full max-w-[210px]" role="img" aria-label={label}>
      <svg viewBox="0 0 240 92" className="block w-full" aria-hidden="true">
        <rect x="4" y="4" width="232" height="84" rx="42" fill="none" stroke={TRACK} strokeWidth="7" />
        <rect x="4" y="4" width="232" height="84" rx="42" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" pathLength={100} strokeDasharray="100 100" strokeDashoffset={offset} transform="rotate(180 120 46)" className="animate-draw" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex h-20 flex-col items-center justify-center">
        <span className="text-[11px] opacity-[.88]">{chart.caption}</span>
        <span className="text-base">{chart.value}</span>
      </div>
    </div>
  );
}

/** Blue Finance KPI card (prototype finKpis: 160° gradient, radius 24, padding 22, min-height 280). */
export function KpiCard({ title, icon, value, delta, chart }: KpiCardData) {
  return (
    <section aria-label={title} className="bg-blue-card flex min-h-[280px] flex-col gap-3 rounded-card p-[22px] text-white shadow-blue transition-transform duration-(--duration-base) ease-spring hover:-translate-y-0.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-pill bg-white/16">
          <Icon name={icon} size={14} color="#fff" />
        </span>
        <h2 className="m-0 flex-1 text-sm font-medium">{title}</h2>
      </div>
      <div className="flex flex-wrap items-baseline gap-1.5">
        <span className="text-[36px] font-light leading-10 tracking-[-.01em]">
          <FreshValue value={value} />
        </span>
        {delta && <span className="text-xs opacity-[.88]">{delta}</span>}
      </div>
      <div className="relative flex min-h-[130px] flex-1 items-end justify-center">
        <Chart chart={chart} />
      </div>
    </section>
  );
}
