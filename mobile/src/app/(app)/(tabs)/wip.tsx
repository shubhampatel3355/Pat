import { CLOSED_REMARKS, WIP_REMARKS } from "@shared/constants";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { errorText } from "@/api/client";
import { useWip } from "@/api/queries";
import type { WipRemark } from "@/api/prisma-enums";
import { Fab } from "@/components/fab";
import { TopActions } from "@/components/top-actions";
import { Icon } from "@/components/ui/icon";
import { PressableScale } from "@/components/ui/motion";
import { Chip, ChipRow, EmptyState, ErrorState, Loading, StatGrid } from "@/components/ui/primitives";
import { ScreenList } from "@/components/ui/screen";
import { WipCard } from "@/components/wip-card";
import { formatCompactINR, plural } from "@/lib/format";
import { colors, fonts } from "@/theme/tokens";

type Filter = "OPEN" | "ALL" | "MINE" | WipRemark;

/** WIP: every mandate the user may see (all for admins/owners, their own otherwise), as on the web. */
export default function Wip() {
  const q = useWip();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("OPEN");

  const rows = useMemo(() => {
    const data = q.data;
    if (!data) return [];
    const needle = search.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (filter === "OPEN" && CLOSED_REMARKS.includes(r.remark)) return false;
      if (filter === "MINE" && ![...r.primary, ...r.secondary].some((b) => b.userId === data.me)) return false;
      if (filter !== "OPEN" && filter !== "ALL" && filter !== "MINE" && r.remark !== filter) return false;
      if (!needle) return true;
      const hay = [r.tenantName, r.building, r.location, r.landlordName, ...r.primary.map((b) => b.name), ...r.secondary.map((b) => b.name)].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [q.data, search, filter]);

  const data = q.data;
  // Per-stage counts for the chips. (Not a `data?.rows` closure: the React Compiler's cache check for one
  // reads `data.rows` without the `?.`, which throws while the list is loading.)
  const counts = useMemo(() => {
    const byRemark = new Map<WipRemark, number>();
    for (const r of q.data?.rows ?? []) byRemark.set(r.remark, (byRemark.get(r.remark) ?? 0) + 1);
    return byRemark;
  }, [q.data]);
  const target = data?.cards.targetPaise ?? null;
  const gap = target === null ? null : target - (data?.cards.currentPaise ?? 0);
  // Read here, not inside renderRow, for the same React Compiler reason as the counts.
  const today = data?.today ?? "";

  return (
    <>
      <ScreenList
        tabs
        query={q}
        title="WIP"
        sub={data ? `${plural(rows.length, "mandate")} · ${data.cards.quarterLabel}` : undefined}
        right={<TopActions />}
        top={
          <>
            <View style={styles.search}>
              <Icon name="search" color={colors.muted} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search tenant, building or broker" placeholderTextColor={colors.faint} style={styles.searchInput} accessibilityLabel="Search WIP" />
              {search ? (
                <PressableScale onPress={() => setSearch("")} haptic="select" scaleTo={0.85} hitSlop={10} accessibilityLabel="Clear search">
                  <Icon name="close" color={colors.muted} />
                </PressableScale>
              ) : null}
            </View>

            <ChipRow style={{ paddingHorizontal: 0, marginTop: 14 }}>
              <Chip label="Open" active={filter === "OPEN"} onPress={() => setFilter("OPEN")} />
              <Chip label="All" active={filter === "ALL"} onPress={() => setFilter("ALL")} count={data?.rows.length} />
              <Chip label="Mine" active={filter === "MINE"} onPress={() => setFilter("MINE")} />
              {WIP_REMARKS.map((r) => (
                <Chip key={r.value} label={r.label} active={filter === r.value} onPress={() => setFilter(r.value)} count={counts.get(r.value) ?? 0} />
              ))}
            </ChipRow>

            {data ? (
              <View style={{ marginTop: 16 }}>
                <StatGrid
                  items={[
                    { value: target === null ? "—" : formatCompactINR(target), label: "Target" },
                    { value: formatCompactINR(data.cards.currentPaise), label: `Current · ${plural(data.cards.mandates, "mandate")}` },
                    { value: gap === null ? "—" : formatCompactINR(Math.abs(gap)), label: gap !== null && gap <= 0 ? "Surplus" : "Pending" },
                  ]}
                />
              </View>
            ) : null}
          </>
        }
        rows={data && !q.isError ? rows : []}
        rowKey={(r) => r.id}
        renderRow={(r) => <WipCard row={r} today={today} />}
        empty={
          q.isPending ? (
            <Loading />
          ) : q.isError ? (
            <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
          ) : (
            <EmptyState
              title="No WIP matches"
              text="Try a different search, or clear the filters to see every entry."
              action="Clear filters"
              onAction={() => {
                setSearch("");
                setFilter("ALL");
              }}
            />
          )
        }
      />
      {data?.canCreate ? <Fab label="Add WIP entry" onPress={() => router.push("/lead-form")} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: 16, height: 50, borderRadius: 16, backgroundColor: "rgba(244,244,244,0.9)", borderWidth: 1, borderColor: colors.chipBorder, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, height: "100%", fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
});
