import { Ionicons } from "@expo/vector-icons";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { haptics } from "@/lib/haptics";
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

const SHOWN_MS = 2800;
let lastId = 0;

/** The prototype's navy pill toast, above the tab bar. It springs in, and success or failure is felt as well as seen. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback((message: string, kind: Kind = "ok") => {
    if (kind === "ok") haptics.success();
    else if (kind === "error") haptics.error();
    setToast({ id: ++lastId, message, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({ show }), [show]);
  const icon = toast ? ICON[toast.kind] : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && icon ? (
        <Animated.View
          key={toast.id}
          entering={FadeInDown.springify().damping(18).stiffness(260)}
          exiting={FadeOutDown.duration(180)}
          pointerEvents="none"
          style={[styles.wrap, { bottom: insets.bottom + 104 }]}
        >
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
