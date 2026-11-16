import { StyleSheet } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/tokens";
import { TAB_BAR_SPACE } from "./ui/screen";
import { Icon } from "./ui/icon";
import { PressableScale } from "./ui/motion";

/** Round "+" above the tab bar (or above the bottom edge on stack screens). It pops in, and gives a firmer tap. */
export function Fab({ onPress, label, overTabs = true }: { onPress: () => void; label: string; overTabs?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View entering={ZoomIn.springify().damping(14).stiffness(220)} style={[styles.place, { bottom: insets.bottom + (overTabs ? TAB_BAR_SPACE - 24 : 24) }]}>
      <PressableScale onPress={onPress} haptic="press" scaleTo={0.9} accessibilityRole="button" accessibilityLabel={label} style={styles.fab}>
        <Icon name="plus" size={28} color={colors.white} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  place: { position: "absolute", right: 20 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#628ECB",
    shadowOpacity: 0.85,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
});
