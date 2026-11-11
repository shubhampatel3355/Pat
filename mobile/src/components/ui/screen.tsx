import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/tokens";
import { Button, IconButton } from "./primitives";
import { T } from "./text";

/** Space the floating tab bar covers at the bottom of tab screens. */
export const TAB_BAR_SPACE = 120;

interface Refreshable {
  isRefetching: boolean;
  refetch: () => unknown;
}

function Backdrop() {
  // The prototype's soft navy glow at the top of every screen.
  return <LinearGradient pointerEvents="none" colors={["rgba(2,62,125,0.14)", "rgba(2,62,125,0)"]} style={styles.glow} />;
}

export function ScreenHeader({ title, sub, back, right, compact }: { title: string; sub?: string; back?: boolean; right?: React.ReactNode; compact?: boolean }) {
  return (
    <View style={styles.header}>
      {back ? <IconButton name="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T variant={compact || back ? "h1" : "title"} numberOfLines={2}>
          {title}
        </T>
        {sub ? (
          <T variant="small" style={{ marginTop: 2 }} numberOfLines={2}>
            {sub}
          </T>
        ) : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

/**
 * A scrolling screen on the grey canvas. Pass `query` for pull-to-refresh, `tabs` on tab screens so the
 * content clears the floating tab bar, and `footer` for a pinned action bar.
 */
export function Screen({
  title,
  sub,
  back,
  right,
  header,
  query,
  tabs,
  footer,
  children,
  contentStyle,
  scroll = true,
}: {
  title?: string;
  sub?: string;
  back?: boolean;
  right?: React.ReactNode;
  header?: React.ReactNode;
  query?: Refreshable;
  tabs?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bottom = tabs ? TAB_BAR_SPACE + insets.bottom : footer ? 110 + insets.bottom : 36 + insets.bottom;
  const head = header ?? (title ? <ScreenHeader title={title} sub={sub} back={back} right={right} /> : null);
  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={{ paddingTop: insets.top + 6, flex: 1 }}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: bottom }, contentStyle]}
            keyboardShouldPersistTaps="handled"
            refreshControl={query ? <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} tintColor={colors.navy} /> : undefined}
          >
            {head}
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, { flex: 1, paddingBottom: 0 }, contentStyle]}>
            {head}
            {children}
          </View>
        )}
      </View>
      {footer ? <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>{footer}</View> : null}
    </View>
  );
}

/** A form presented as a modal: close button, title, fields, and a pinned save button. */
export function FormScreen({
  title,
  sub,
  submitLabel = "Save",
  onSubmit,
  saving,
  children,
  secondary,
}: {
  title: string;
  sub?: string;
  submitLabel?: string;
  onSubmit: () => void;
  saving?: boolean;
  children: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.formHead, { paddingTop: Platform.OS === "ios" ? 14 : insets.top + 10 }]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T variant="h2" numberOfLines={1}>
            {title}
          </T>
          {sub ? (
            <T variant="small" numberOfLines={1} style={{ marginTop: 2 }}>
              {sub}
            </T>
          ) : null}
        </View>
        <IconButton name="close" label="Close" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 30 }]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <View style={[styles.footer, styles.formFooter, { paddingBottom: insets.bottom + 12 }]}>
        {secondary}
        <Button label={submitLabel} onPress={onSubmit} loading={saving} size="lg" style={{ flex: 1 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  glow: { position: "absolute", left: 0, right: 0, top: 0, height: 280 },
  content: { paddingHorizontal: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 6, paddingBottom: 4 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.glass,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.glassBorder,
  },
  formHead: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  formFooter: { position: "relative", flexDirection: "row", gap: 10 },
});
