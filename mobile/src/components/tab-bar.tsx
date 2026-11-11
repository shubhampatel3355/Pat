import type { BottomTabBarProps } from "expo-router/js-tabs";
import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, shadow } from "@/theme/tokens";
import { Icon, type IconName } from "./ui/icon";
import { T } from "./ui/text";

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: "Home", icon: "home" },
  wip: { label: "WIP", icon: "building" },
  pipeline: { label: "Pipeline", icon: "trend" },
  "follow-ups": { label: "Follow-ups", icon: "calendarCheck" },
  more: { label: "More", icon: "grid" },
};

/** The prototype's floating glass tab bar with a navy pill behind the active tab. */
export function FloatingTabBar({ state, emitter, navigateToTab, hidden }: BottomTabBarProps & { hidden: string[] }) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TABS[r.name] && !hidden.includes(r.name));
  return (
    <View style={[styles.bar, { bottom: insets.bottom + 12 }]} accessibilityRole="tablist">
      {routes.map((route) => {
        const focused = state.routes[state.index]?.key === route.key;
        const tab = TABS[route.name]!;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={() => {
              const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                void Haptics.selectionAsync().catch(() => undefined);
                navigateToTab(route.key);
              }
            }}
            style={[styles.tab, focused && styles.tabOn]}
          >
            <Icon name={tab.icon} size={21} color={focused ? colors.white : colors.muted} />
            <T variant="caption" color={focused ? colors.white : colors.muted} weight={focused ? "bold" : "medium"} style={{ fontSize: 11 }} numberOfLines={1}>
              {tab.label}
            </T>
          </Pressable>
        );
      })}
    </View>
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
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: 6,
    flexDirection: "row",
    gap: 4,
    ...shadow.card,
  },
  tab: { flex: 1, borderRadius: 28, alignItems: "center", justifyContent: "center", gap: 2 },
  tabOn: { backgroundColor: colors.navy, ...shadow.button },
});
