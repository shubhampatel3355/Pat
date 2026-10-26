import type { WipRemark } from "@/generated/prisma/enums";
import { tint, WIP_REMARK } from "@/lib/constants";

/** Compact WIP stage pill (prototype Employee View: My WIP, My incentive). */
export function StagePill({ remark }: { remark: WipRemark }) {
  const r = WIP_REMARK[remark];
  return (
    <span className="flex h-[22px] flex-none items-center gap-[5px] justify-self-start whitespace-nowrap rounded-pill px-[9px] text-[10px] font-medium" style={{ background: tint(r.color) }}>
      <span className="h-[5px] w-[5px] rounded-pill" style={{ background: r.color }} />
      {r.label}
    </span>
  );
}
