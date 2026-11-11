import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/theme/tokens";
import { Icon } from "./icon";
import { IconButton } from "./primitives";
import { T } from "./text";

/** The prototype's bottom sheet: dimmed navy scrim, frosted panel, grabber, title and close button. */
export function Sheet({ visible, onClose, title, sub, children }: { visible: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.wrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.panel, { paddingBottom: insets.bottom + 18 }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T variant="h2">{title}</T>
              {sub ? (
                <T variant="small" style={{ marginTop: 2 }} numberOfLines={2}>
                  {sub}
                </T>
              ) : null}
            </View>
            <IconButton name="close" label="Close" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export interface Choice<V extends string> {
  value: V;
  label: string;
  sub?: string;
  color?: string;
}

/** Pick one option from a list (stages, people, categories…). */
export function ChoiceSheet<V extends string>({
  visible,
  onClose,
  title,
  sub,
  options,
  value,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  sub?: string;
  options: Choice<V>[];
  value?: V | null;
  onSelect: (value: V) => void;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title} sub={sub}>
      <View style={styles.list}>
        {options.map((o, i) => {
          const current = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => {
                onSelect(o.value);
                onClose();
              }}
              style={({ pressed }) => [styles.option, i > 0 && styles.optionBorder, pressed && { opacity: 0.6 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: current }}
            >
              {o.color ? <View style={[styles.swatch, { backgroundColor: o.color }]} /> : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <T variant="strong" weight={current ? "semibold" : "medium"}>
                  {o.label}
                </T>
                {o.sub ? (
                  <T variant="small" numberOfLines={1}>
                    {o.sub}
                  </T>
                ) : null}
              </View>
              {current ? <Icon name="check" color={colors.navy} /> : null}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  panel: { backgroundColor: colors.canvas, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderColor: "rgba(0,0,0,0.09)" },
  grabber: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.well, alignSelf: "center", marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, marginBottom: 8 },
  list: { backgroundColor: colors.card, borderRadius: 24, paddingHorizontal: 16 },
  option: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8 },
  optionBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.09)" },
  swatch: { width: 12, height: 12, borderRadius: 6 },
});
