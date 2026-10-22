"use client";

import { useState } from "react";
import { markAchievementsSeenAction } from "@/server/actions/todo";
import { AchievementsModal } from "../dashboard/achievements";
import { useLive } from "./live";

/**
 * Pops the celebration modal when the live feed reports achievements the user hasn't seen
 * (e.g. a deal moved to "Payment Collected"). Closing it marks them seen.
 */
export function CelebrationWatcher() {
  const live = useLive();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const fresh = live.newAchievements.filter((a) => !dismissed.includes(a.id));
  if (!fresh.length) return null;
  const close = () => {
    setDismissed((d) => [...d, ...fresh.map((a) => a.id)]);
    void markAchievementsSeenAction({}).then(() => live.refresh());
  };
  return (
    <AchievementsModal
      headline={fresh.length === 1 ? fresh[0]!.title : `${fresh.length} new achievements`}
      sub={fresh.length === 1 ? (fresh[0]!.meta ?? "Well done!") : "The team is on a roll"}
      rows={fresh.map((a) => ({ id: a.id, icon: "trophy", title: a.title, meta: a.meta ?? "", value: a.value ?? "" }))}
      onClose={close}
    />
  );
}
