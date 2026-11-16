import type { BottomTabBarProps } from "expo-router/js-tabs";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/lib/haptics";
import { colors, shadow } from "@/theme/tokens";
import { Icon, type IconName } from "./ui/icon";
import { motion, PressableScale, useSlidingPill } from "./ui/motion";
import { T } from "./ui/text";

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: "Home", icon: "home" },
  wip: { label: "WIP", icon: "building" },
  pipeline: { label: "Pipeline", icon: "trend" },
  "follow-ups": { label: "Follow-ups", icon: "calendarCheck" },
  more: { label: "More", icon: "grid" },
};

const BORDER = 1;
const PAD = 6;
const GAP = 4;

/** The prototype's floating glass tab bar; the navy pill glides to the tab you pick. */
export function FloatingTabBar({ state, emitter, navigateToTab, hidden }: BottomTabBarProps & { hidden: string[] }) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TABS[r.name] && !hidden.includes(r.name));
  const activeKey = state.routes[state.index]?.key;
  const { onLayout, pill } = useSlidingPill(
    routes.length,
    routes.findIndex((r) => r.key === activeKey),
    GAP,
    BORDER + PAD,
  );
  return (
    <View style={[styles.bar, { bottom: insets.bottom + 12 }]} onLayout={onLayout} accessibilityRole="tablist">
      <Animated.View pointerEvents="none" style={[styles.pill, pill]} />
      {routes.map((route) => {
        const focused = route.key === activeKey;
        const tab = TABS[route.name]!;
        return (
          <PressableScale
            key={route.key}
            haptic="none"
            scaleTo={0.92}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptics.select();
                navigateToTab(route.key);
              }
            }}
            style={styles.tab}
          >
            <TabIcon name={tab.icon} focused={focused} />
            <T variant="caption" color={focused ? colors.white : colors.muted} weight={focused ? "bold" : "medium"} style={{ fontSize: 11 }} numberOfLines={1}>
              {tab.label}
            </T>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** The active tab's icon lifts slightly as the pill arrives. */
function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  const on = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    on.set(withSpring(focused ? 1 : 0, motion.slide));
  }, [focused, on]);
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(on.get(), [0, 1], [0, -1.5]) }, { scale: interpolate(on.get(), [0, 1], [1, 1.08]) }],
  }));
  return (
    <Animated.View style={lift}>
      <Icon name={name} size={21} color={focused ? colors.white : colors.muted} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.glass,
    borderWidth: BORDER,
    borderColor: colors.glassBorder,
    padding: PAD,
    flexDirection: "row",
    gap: GAP,
    ...shadow.card,
  },
  // No elevation: on Android it would draw the pill above the tab icons.
  pill: { position: "absolute", left: PAD, top: PAD, bottom: PAD, borderRadius: 28, backgroundColor: colors.navy, ...shadow.button, elevation: 0 },
  tab: { flex: 1, borderRadius: 28, alignItems: "center", justifyContent: "center", gap: 2 },
});
