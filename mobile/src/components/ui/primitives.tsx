import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { avatarGradient, colors, heroGradient, radius, shadow, tint, toneFor } from "@/theme/tokens";
import { Icon, type IconName } from "./icon";
import { T } from "./text";

// ── Surfaces ────────────────────────────────────────────────────────────────

export function Card({ children, style, padded = true, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean; onPress?: () => void }) {
  const body = [styles.card, padded && styles.cardPad, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [body, pressed && styles.pressed]} accessibilityRole="button">
      {children}
    </Pressable>
  );
}

/** The navy gradient card (targets, profile). */
export function Hero({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.heroShadow, style]}>
      <LinearGradient colors={heroGradient} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={styles.hero}>
        {children}
      </LinearGradient>
    </View>
  );
}

/** Rows inside a card, separated by hairlines. */
export function ListCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, styles.listCard, style]}>{children}</View>;
}

/**
 * A row in a ListCard. `leftAction` is for a control of its own (e.g. a checkbox): it sits beside the
 * tappable area rather than inside it, so taps never trigger both.
 */
export function ListRow({
  title,
  sub,
  left,
  leftAction,
  right,
  onPress,
  first,
  numberOfLines = 1,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  left?: React.ReactNode;
  leftAction?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  first?: boolean;
  numberOfLines?: number;
}) {
  if (leftAction) {
    return (
      <View style={[styles.rowOuter, !first && styles.rowBorder]}>
        {leftAction}
        <View style={{ flex: 1, minWidth: 0 }}>
          <ListRow title={title} sub={sub} left={left} right={right} onPress={onPress} first numberOfLines={numberOfLines} />
        </View>
      </View>
    );
  }
  const content = (
    <>
      {left}
      <View style={styles.rowText}>
        {typeof title === "string" ? (
          <T variant="strong" numberOfLines={numberOfLines}>
            {title}
          </T>
        ) : (
          title
        )}
        {sub ? (
          typeof sub === "string" ? (
            <T variant="small" numberOfLines={2} style={{ marginTop: 2 }}>
              {sub}
            </T>
          ) : (
            sub
          )
        ) : null}
      </View>
      {right}
    </>
  );
  const style = [styles.row, !first && styles.rowBorder];
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [style, pressed && styles.rowPressed]} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

// ── Buttons ─────────────────────────────────────────────────────────────────

type ButtonKind = "primary" | "secondary" | "ghost" | "danger" | "light";

export function Button({
  label,
  onPress,
  kind = "primary",
  icon,
  loading,
  disabled,
  size = "md",
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  style?: StyleProp<ViewStyle>;
}) {
  const fg = kind === "primary" || kind === "danger" ? colors.white : kind === "light" ? colors.navy : colors.text;
  const height = size === "lg" ? 54 : size === "sm" ? 38 : 46;
  return (
    <Pressable
      onPress={() => {
        if (loading || disabled) return;
        void Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [styles.button, { height, borderRadius: height / 2 }, buttonKinds[kind], (disabled || loading) && styles.disabled, pressed && styles.pressedScale, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <T variant="strong" color={fg} style={{ fontSize: size === "sm" ? 13.5 : 15, flexShrink: 1 }} numberOfLines={1}>
        {label}
      </T>
    </Pressable>
  );
}

const buttonKinds = StyleSheet.create({
  primary: { backgroundColor: colors.navy, ...shadow.button },
  secondary: { backgroundColor: colors.well, borderWidth: 1, borderColor: colors.glassBorder },
  ghost: { backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chipBorder },
  danger: { backgroundColor: colors.danger },
  light: { backgroundColor: colors.white },
});

/** Round 44 pt button (back, search, bell, filters). */
export function IconButton({ name, onPress, label, dot, dark, size = 44 }: { name: IconName; onPress: () => void; label: string; dot?: string | false; dark?: boolean; size?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, { width: size, height: size, borderRadius: size / 2 }, dark && styles.iconButtonDark, pressed && styles.pressedScale]}
    >
      <Icon name={name} size={20} color={dark ? colors.white : colors.text} />
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
    </Pressable>
  );
}

// ── Chips & pills ───────────────────────────────────────────────────────────

export function Chip({ label, active, onPress, count, small }: { label: string; active?: boolean; onPress: () => void; count?: number; small?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [styles.chip, small && styles.chipSmall, active ? styles.chipActive : null, pressed && styles.pressed]}
    >
      <T variant="small" color={active ? colors.white : colors.muted} style={{ fontSize: small ? 12.5 : 13.5 }}>
        {label}
      </T>
      {count !== undefined ? (
        <View style={[styles.count, { backgroundColor: active ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.08)" }]}>
          <T variant="caption" color={active ? colors.white : colors.muted} style={{ fontSize: 11.5 }}>
            {count}
          </T>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipRow, style]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Pill({ label, color = colors.muted, solid }: { label: string; color?: string; solid?: boolean }) {
  return (
    <View style={[styles.pill, { backgroundColor: solid ? color : tint(color) }]}>
      <T variant="caption" color={solid ? colors.white : color} style={{ fontSize: 11.5 }} numberOfLines={1}>
        {label}
      </T>
    </View>
  );
}

// ── People ──────────────────────────────────────────────────────────────────

export function Avatar({ initials, name, size = 44, gradient }: { initials: string; name?: string; size?: number; gradient?: boolean }) {
  const label = (
    <T weight="medium" color={colors.white} style={{ fontSize: size * 0.32 }}>
      {initials}
    </T>
  );
  if (gradient) {
    return (
      <LinearGradient colors={avatarGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        {label}
      </LinearGradient>
    );
  }
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: toneFor(name ?? initials) }]}>{label}</View>;
}

export function IconWell({ name, size = 38, color = colors.text, bg = colors.well }: { name: IconName; size?: number; color?: string; bg?: string }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Icon name={name} size={size * 0.48} color={color} />
    </View>
  );
}

// ── Numbers ─────────────────────────────────────────────────────────────────

export function ProgressBar({ pct, height = 6, color = colors.navy, track = colors.track }: { pct: number; height?: number; color?: string; track?: string }) {
  const width = `${Math.max(0, Math.min(100, pct))}%` as const;
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: "hidden" }}>
      <View style={{ height, width, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function Ring({ pct, size = 44, stroke = 4, color = colors.navy, label }: { pct: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(0,0,0,0.09)" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(c * p) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {label ? (
        <T variant="caption" color={colors.text} style={{ fontSize: size * 0.27 }}>
          {label}
        </T>
      ) : null}
    </View>
  );
}

/** Small tile with a big value (module stats). */
export function Stat({ value, label, style }: { value: string; label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stat, style]}>
      <T variant="h2" weight="regular" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </T>
      <T variant="caption" style={{ marginTop: 4 }} numberOfLines={2}>
        {label}
      </T>
    </View>
  );
}

export function StatGrid({ items }: { items: { value: string; label: string }[] }) {
  return (
    <View style={styles.statGrid}>
      {items.map((s) => (
        <Stat key={s.label} value={s.value} label={s.label} style={{ flex: 1 }} />
      ))}
    </View>
  );
}

/** Monthly bars (finance). */
export function Bars({ values, labels, highlight = values.length - 1, height = 110 }: { values: number[]; labels: string[]; highlight?: number; height?: number }) {
  const max = Math.max(0, ...values);
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 5, height }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, height: `${Math.max(4, max ? (v / max) * 100 : 0)}%`, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderRadius: 2, backgroundColor: i === highlight ? colors.navy : colors.sky }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 5, marginTop: 6 }}>
        {labels.map((l, i) => (
          <T key={i} variant="caption" style={{ flex: 1, textAlign: "center", fontSize: 9.5 }}>
            {l}
          </T>
        ))}
      </View>
    </View>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

export function Section({ title, action, onAction, children, style }: { title?: string; action?: string; onAction?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 26 }, style]}>
      {title ? (
        <View style={styles.sectionHead}>
          <T variant="h3">{title}</T>
          {action && onAction ? (
            <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
              <T variant="small" style={{ textDecorationLine: "underline" }}>
                {action}
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function GroupLabel({ children }: { children: string }) {
  return (
    <T variant="label" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 4 }}>
      {children}
    </T>
  );
}

export function EmptyState({ icon = "search", title, text, action, onAction }: { icon?: IconName; title: string; text?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={[styles.card, styles.empty]}>
      <IconWell name={icon} size={60} />
      <T variant="h3" align="center" style={{ marginTop: 8 }}>
        {title}
      </T>
      {text ? (
        <T variant="small" align="center" style={{ maxWidth: 260 }}>
          {text}
        </T>
      ) : null}
      {action && onAction ? <Button label={action} onPress={onAction} style={{ marginTop: 10, paddingHorizontal: 24 }} /> : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ gap: 12, paddingTop: 18 }}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.skeleton, { height: i === 0 ? 200 : 120 }]} />
      ))}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <EmptyState icon="alert" title="Couldn't load this" text={message} action="Try again" onAction={onRetry} />;
}

export function Spacer({ h = 12 }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function KeyValue({ k, v, first }: { k: string; v: React.ReactNode; first?: boolean }) {
  return (
    <View style={[styles.kv, !first && styles.rowBorder]}>
      <T variant="small" style={{ flexShrink: 0, maxWidth: "45%" }}>
        {k}
      </T>
      {typeof v === "string" ? (
        <T variant="strong" weight="regular" align="right" style={{ flex: 1 }}>
          {v}
        </T>
      ) : (
        v
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.card, borderWidth: 1, borderColor: colors.cardBorder, ...shadow.card },
  cardPad: { padding: 16 },
  listCard: { paddingHorizontal: 16, paddingVertical: 2 },
  heroShadow: { borderRadius: radius.hero, ...shadow.hero },
  hero: { borderRadius: radius.hero, padding: 20, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10 },
  rowOuter: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.09)" },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.75 },
  pressedScale: { transform: [{ scale: 0.97 }] },
  disabled: { opacity: 0.5 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 },
  iconButton: { backgroundColor: colors.well, borderWidth: 1, borderColor: colors.wellBorder, alignItems: "center", justifyContent: "center" },
  iconButtonDark: { backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.2)" },
  dot: { position: "absolute", top: 9, right: 10, width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: colors.canvas },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.chipBorder },
  chipSmall: { height: 34, paddingHorizontal: 13, borderRadius: 17 },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipRow: { gap: 8, paddingHorizontal: 20 },
  count: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pill: { height: 24, paddingHorizontal: 10, borderRadius: 12, alignItems: "center", justifyContent: "center", alignSelf: "flex-start" },
  avatar: { alignItems: "center", justifyContent: "center" },
  stat: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.cardBorder, paddingVertical: 14, paddingHorizontal: 12 },
  statGrid: { flexDirection: "row", gap: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 34, paddingHorizontal: 24, marginTop: 24 },
  skeleton: { borderRadius: radius.card, backgroundColor: "rgba(0,0,0,0.05)" },
  kv: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, paddingVertical: 12 },
});
