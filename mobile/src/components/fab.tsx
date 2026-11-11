import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/tokens";
import { TAB_BAR_SPACE } from "./ui/screen";
import { Icon } from "./ui/icon";

/** Round "+" above the tab bar (or above the bottom edge on stack screens). */
export function Fab({ onPress, label, overTabs = true }: { onPress: () => void; label: string; overTabs?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, { bottom: insets.bottom + (overTabs ? TAB_BAR_SPACE - 24 : 24) }, pressed && { transform: [{ scale: 0.94 }] }]}
    >
      <Icon name="plus" size={28} color={colors.white} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
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
