import { CLOSED_REMARKS, WIP_REMARK } from "@shared/constants";
import { areaLabel, rateLabel, rentLine } from "@shared/wip";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import type { WipRow } from "@/api/types";
import { formatCompactINR, formatDate } from "@/lib/format";
import { colors } from "@/theme/tokens";
import { Icon } from "./ui/icon";
import { Avatar, Button, Card, Pill } from "./ui/primitives";
import { T } from "./ui/text";

/** One mandate, styled after the prototype's lead card. */
export function WipCard({ row, today }: { row: WipRow; today: string }) {
  const remark = WIP_REMARK[row.remark];
  const overdue = row.closureDate < today && !CLOSED_REMARKS.includes(row.remark);
  const area = areaLabel(row.pricingBasis, row.areaSqft, row.seats);
  const brokers = [...row.primary, ...row.secondary];
  const open = () => router.push(`/lead/${row.id}`);
  return (
    <Card>
      <Pressable onPress={open} style={({ pressed }) => [styles.top, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={`${row.tenantName}, ${remark.label}`}>
        <Avatar initials={row.initials} name={row.tenantName} size={48} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="strong" style={{ fontSize: 16 }} numberOfLines={1}>
            {row.tenantName}
          </T>
          <T variant="caption" numberOfLines={1} style={{ marginTop: 2 }}>
            WIP #{row.sl}
            {area !== "—" ? ` · ${area}` : ""}
          </T>
        </View>
        <Pill label={remark.label} color={remark.color} />
      </Pressable>
      <View style={styles.box}>
        <View style={styles.line}>
          <Icon name="building" size={16} color={colors.text} />
          <T variant="small" color={colors.text} numberOfLines={1} style={{ flex: 1 }}>
            {[row.building, row.location].filter(Boolean).join(", ")}
          </T>
        </View>
        <View style={styles.line}>
          <Icon name="wallet" size={16} color={colors.muted} />
          <T variant="small" numberOfLines={1} style={{ flex: 1 }}>
            {rateLabel(row.pricingBasis, row.ratePaise)} · {rentLine(row.pricingBasis, row.monthlyRentPaise)}
          </T>
        </View>
      </View>
      <View style={styles.foot}>
        <View style={styles.line}>
          <Icon name="clock" size={16} color={overdue ? colors.danger : colors.muted} />
          <T variant="small" color={overdue ? colors.danger : colors.muted}>
            Closure {formatDate(row.closureDate)}
          </T>
        </View>
        <T variant="strong">{formatCompactINR(row.estFeesPaise)}</T>
      </View>
      <View style={styles.foot}>
        <T variant="caption" numberOfLines={1} style={{ flex: 1 }}>
          {brokers.map((b) => b.name).join(", ") || "No brokers"}
        </T>
        <Button label="Details" size="sm" icon="forward" onPress={open} style={{ paddingHorizontal: 14 }} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  box: { marginTop: 14, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.03)", padding: 12, gap: 8 },
  line: { flexDirection: "row", alignItems: "center", gap: 7 },
  foot: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
});
