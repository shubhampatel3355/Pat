import { router } from "expo-router";
import { useLive } from "@/api/queries";
import { colors } from "@/theme/tokens";
import { IconButton } from "./ui/primitives";

/** Search and notifications, top right of the main screens (bell dot = unread notifications). */
export function TopActions({ filters }: { filters?: { active: boolean; onPress: () => void } }) {
  const live = useLive();
  return (
    <>
      {filters ? <IconButton name="sliders" label="Filters" onPress={filters.onPress} dot={filters.active ? colors.successBright : false} /> : <IconButton name="search" label="Search" onPress={() => router.push("/search")} />}
      <IconButton name="bell" label="Notifications" onPress={() => router.push("/notifications")} dot={(live.data?.unread ?? 0) > 0 ? colors.dangerSoft : false} />
    </>
  );
}
