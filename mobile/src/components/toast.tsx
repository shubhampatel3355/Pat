import { Ionicons } from "@expo/vector-icons";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts } from "@/theme/tokens";

type Kind = "ok" | "error" | "info";
interface ToastState {
  id: number;
  message: string;
  kind: Kind;
}

const ToastContext = createContext<{ show: (message: string, kind?: Kind) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}

const ICON: Record<Kind, { name: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  ok: { name: "checkmark", color: colors.successBright, bg: "rgba(66,214,164,0.2)" },
  error: { name: "alert-circle-outline", color: colors.dangerSoft, bg: "rgba(255,107,122,0.2)" },
  info: { name: "time-outline", color: colors.ice, bg: "rgba(177,201,239,0.2)" },
};

/** The prototype's navy pill toast, above the tab bar. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, kind: Kind = "ok") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
    }, 2800);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast, opacity]);

  const value = useMemo(() => ({ show }), [show]);
  const icon = toast ? ICON[toast.kind] : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && icon ? (
        <Animated.View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 104, opacity, transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
          <View style={styles.toast} accessibilityLiveRegion="polite" accessibilityRole="alert">
            <View style={[styles.icon, { backgroundColor: icon.bg }]}>
              <Ionicons name={icon.name} size={16} color={icon.color} />
            </View>
            <Text style={styles.text}>{toast.message}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 20, right: 20, alignItems: "center", zIndex: 1000 },
  toast: {
    maxWidth: 380,
    minHeight: 44,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 18,
    borderRadius: 24,
    backgroundColor: "rgba(0,18,51,0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  icon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  text: { color: colors.white, fontFamily: fonts.medium, fontSize: 13.5, flexShrink: 1 },
});
