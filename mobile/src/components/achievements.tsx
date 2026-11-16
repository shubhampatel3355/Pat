import { useEffect, useState } from "react";
import { Modal, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useAction, useLive } from "@/api/queries";
import type { LiveAchievement } from "@/api/types";
import { haptics } from "@/lib/haptics";
import { colors } from "@/theme/tokens";
import { Button, Hero, IconWell } from "./ui/primitives";
import { T } from "./ui/text";

/**
 * The web shell's celebration: when the live feed reports achievements the user hasn't seen (a deal moved to
 * "Payment Collected", a target reached), show them once; closing marks them seen on the server.
 */
export function AchievementWatcher() {
  const live = useLive();
  const markSeen = useAction("achievements.markSeen", { quiet: true });
  const [dismissed, setDismissed] = useState<string[]>([]);
  const fresh = (live.data?.newAchievements ?? []).filter((a) => !dismissed.includes(a.id));
  if (!fresh.length) return null;

  const close = () => {
    setDismissed((d) => [...d, ...fresh.map((a) => a.id)]);
    markSeen.mutate({});
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.scrim}>
        <Celebrate>
          <AchievementCard fresh={fresh} close={close} />
        </Celebrate>
      </View>
    </Modal>
  );
}

/** The card springs up from slightly small, with a success vibration. */
function Celebrate({ children }: { children: React.ReactNode }) {
  const scale = useSharedValue(0.9);
  useEffect(() => {
    haptics.success();
    scale.set(withSpring(1, { damping: 12, stiffness: 180 }));
  }, [scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={[{ width: "100%" }, pop]}>{children}</Animated.View>;
}

function AchievementCard({ fresh, close }: { fresh: LiveAchievement[]; close: () => void }) {
  return (
    <Hero style={styles.card}>
      <View style={{ alignItems: "center", gap: 10 }}>
        <IconWell name="trophy" size={64} color={colors.white} bg="rgba(255,255,255,0.16)" />
        <T variant="h1" color={colors.white} align="center">
          {fresh.length === 1 ? fresh[0]!.title : `${fresh.length} new achievements`}
        </T>
        <T variant="small" color={colors.mist} align="center">
          {fresh.length === 1 ? (fresh[0]!.meta ?? "Well done!") : "The team is on a roll"}
        </T>
      </View>
      {fresh.length > 1 ? (
        <View style={{ marginTop: 16, gap: 10 }}>
          {fresh.map((a) => (
            <View key={a.id} style={styles.row}>
              <T variant="strong" color={colors.white} style={{ flex: 1 }} numberOfLines={2}>
                {a.title}
              </T>
              {a.value ? (
                <T variant="strong" color={colors.white}>
                  {a.value}
                </T>
              ) : null}
            </View>
          ))}
        </View>
      ) : fresh[0]?.value ? (
        <T variant="display" color={colors.white} align="center" style={{ marginTop: 16 }}>
          {fresh[0].value}
        </T>
      ) : null}
      <Button label="Brilliant" kind="light" onPress={close} style={{ marginTop: 22 }} />
    </Hero>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: 24 },
  card: { width: "100%" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(255,255,255,0.2)" },
});
