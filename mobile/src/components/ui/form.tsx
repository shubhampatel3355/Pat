import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { formatDate, formatTime12, isoDateIST, istToInstant, timeIST } from "@shared/dates";
import { formatAmountInput } from "@shared/money";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, TextInput, View, type KeyboardTypeOptions } from "react-native";
import { colors, fonts, radius } from "@/theme/tokens";
import { Icon } from "./icon";
import { Button } from "./primitives";
import { ChoiceSheet, Sheet, type Choice } from "./sheet";
import { T } from "./text";

/** Business dates and times are Indian Standard Time, whatever the phone's own time zone is. */
const IST = "Asia/Kolkata";

export function FieldLabel({ children }: { children: string }) {
  return (
    <T variant="label" style={{ marginTop: 16, marginBottom: 8 }}>
      {children}
    </T>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <T variant="caption" color={colors.danger} style={{ marginTop: 6 }}>
      {message}
    </T>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
  multiline,
  secure,
  autoCapitalize = "sentences",
  prefix,
  hint,
  editable = true,
  autoComplete,
  maxLength,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  secure?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  prefix?: string;
  hint?: string;
  editable?: boolean;
  autoComplete?: "email" | "password" | "current-password" | "new-password" | "tel" | "name" | "off" | "one-time-code";
  maxLength?: number;
}) {
  const [show, setShow] = useState(false);
  return (
    <View>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <View style={[styles.input, multiline && styles.multiline, error ? styles.inputError : null, !editable && { opacity: 0.6 }]}>
        {prefix ? (
          <T variant="strong" color={colors.muted}>
            {prefix}
          </T>
        ) : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          keyboardType={keyboardType}
          multiline={multiline}
          secureTextEntry={secure && !show}
          autoCapitalize={autoCapitalize}
          autoCorrect={!secure && autoCapitalize !== "none"}
          autoComplete={autoComplete}
          editable={editable}
          maxLength={maxLength}
          style={[styles.textInput, multiline && { minHeight: 84, textAlignVertical: "top", paddingTop: 14 }]}
          accessibilityLabel={label}
        />
        {secure ? (
          <Pressable onPress={() => setShow((s) => !s)} hitSlop={10} accessibilityRole="button" accessibilityLabel={show ? "Hide password" : "Show password"}>
            <Icon name={show ? "eyeOff" : "eye"} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {hint && !error ? (
        <T variant="caption" style={{ marginTop: 6 }}>
          {hint}
        </T>
      ) : null}
      <FieldError message={error} />
    </View>
  );
}

/** Rupees with Indian digit grouping as you type (the web's formatAmountInput). Parse with parseRupeesToPaise. */
export function AmountField(props: { label: string; value: string; onChange: (text: string) => void; error?: string; hint?: string; placeholder?: string; decimals?: boolean }) {
  return (
    <Field
      label={props.label}
      value={props.value}
      onChangeText={(t) => props.onChange(formatAmountInput(t, props.decimals ?? true))}
      error={props.error}
      hint={props.hint}
      placeholder={props.placeholder ?? "0"}
      keyboardType="decimal-pad"
      prefix="₹"
    />
  );
}

/** Whole numbers (area, seats). */
export function NumberField(props: { label: string; value: string; onChange: (text: string) => void; error?: string; placeholder?: string; suffix?: string }) {
  return (
    <Field
      label={props.label}
      value={props.value}
      onChangeText={(t) => props.onChange(formatAmountInput(t, false))}
      error={props.error}
      placeholder={props.placeholder}
      keyboardType="number-pad"
      hint={props.suffix}
    />
  );
}

function PressField({ label, text, placeholder, onPress, error, icon = "down" as const }: { label?: string; text: string | null; placeholder: string; onPress: () => void; error?: string; icon?: "down" | "calendar" | "clock" }) {
  return (
    <View>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <Pressable onPress={onPress} style={({ pressed }) => [styles.input, error ? styles.inputError : null, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={label}>
        <T variant="strong" color={text ? colors.text : colors.faint} style={{ flex: 1 }} numberOfLines={1}>
          {text ?? placeholder}
        </T>
        <Icon name={icon} size={18} color={colors.muted} />
      </Pressable>
      <FieldError message={error} />
    </View>
  );
}

export function Select<V extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose",
  error,
  sheetTitle,
}: {
  label?: string;
  value: V | null;
  options: Choice<V>[];
  onChange: (value: V) => void;
  placeholder?: string;
  error?: string;
  sheetTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <PressField label={label} text={current?.label ?? null} placeholder={placeholder} onPress={() => setOpen(true)} error={error} />
      <ChoiceSheet visible={open} onClose={() => setOpen(false)} title={sheetTitle ?? label ?? placeholder} options={options} value={value} onSelect={onChange} />
    </>
  );
}

export function MultiSelect({
  label,
  values,
  options,
  onChange,
  placeholder = "Choose",
  error,
  max,
}: {
  label?: string;
  values: string[];
  options: Choice<string>[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  error?: string;
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const names = options.filter((o) => values.includes(o.value)).map((o) => o.label);
  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter((x) => x !== v));
    else if (!max || values.length < max) onChange([...values, v]);
  };
  return (
    <>
      <PressField label={label} text={names.length ? names.join(", ") : null} placeholder={placeholder} onPress={() => setOpen(true)} error={error} />
      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? placeholder} sub={max ? `Up to ${max}` : undefined}>
        <View style={styles.multiList}>
          {options.map((o, i) => {
            const on = values.includes(o.value);
            return (
              <Pressable key={o.value} onPress={() => toggle(o.value)} style={[styles.multiRow, i > 0 && styles.multiBorder]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <T variant="strong" style={{ flex: 1 }}>
                  {o.label}
                </T>
                <Icon name={on ? "checkCircle" : "circle"} color={on ? colors.navy : colors.faint} />
              </Pressable>
            );
          })}
        </View>
        <Button label="Done" onPress={() => setOpen(false)} style={{ marginTop: 14 }} />
      </Sheet>
    </>
  );
}

/** Equal-width choice buttons (pricing basis, income/expense…). */
export function Segmented<V extends string>({ label, value, options, onChange }: { label?: string; value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <View>
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <View style={styles.segmented}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, on && styles.segmentOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
              <T variant="small" color={on ? colors.white : colors.muted} align="center" numberOfLines={1}>
                {o.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SwitchRow({ label, sub, value, onChange, disabled }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <T variant="strong">{label}</T>
        {sub ? <T variant="small">{sub}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.navy, false: "rgba(0,0,0,0.18)" }} thumbColor={colors.white} accessibilityLabel={label} />
    </View>
  );
}

function openAndroid(mode: "date" | "time", value: Date, onPick: (d: Date) => void) {
  DateTimePickerAndroid.open({ value, mode, is24Hour: false, timeZoneName: IST, onValueChange: (_e, d) => onPick(d) });
}

/** "YYYY-MM-DD" in IST. */
export function DateField({ label, value, onChange, error, placeholder = "Pick a date", clearable }: { label?: string; value: string | null; onChange: (iso: string | null) => void; error?: string; placeholder?: string; clearable?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = value ? istToInstant(value, "12:00") : new Date();
  const pick = (d: Date) => onChange(isoDateIST(d));
  return (
    <>
      <PressField label={label} text={value ? formatDate(value) : null} placeholder={placeholder} icon="calendar" error={error} onPress={() => (Platform.OS === "android" ? openAndroid("date", current, pick) : setOpen(true))} />
      {clearable && value ? (
        <Pressable onPress={() => onChange(null)} hitSlop={8} style={{ alignSelf: "flex-start", marginTop: 6 }}>
          <T variant="caption" style={{ textDecorationLine: "underline" }}>
            Clear date
          </T>
        </Pressable>
      ) : null}
      {Platform.OS === "ios" ? (
        <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? "Date"}>
          <DateTimePicker value={current} mode="date" display="inline" timeZoneName={IST} onValueChange={(_e, d) => pick(d)} accentColor={colors.navy} themeVariant="light" />
          <Button label="Done" onPress={() => setOpen(false)} style={{ marginTop: 8 }} />
        </Sheet>
      ) : null}
    </>
  );
}

/** "HH:mm" (24-hour) in IST, shown as "2:30 pm". */
export function TimeField({ label, value, onChange, error, placeholder = "Pick a time", day }: { label?: string; value: string | null; onChange: (hhmm: string) => void; error?: string; placeholder?: string; day?: string }) {
  const [open, setOpen] = useState(false);
  const current = istToInstant(day ?? isoDateIST(), value ?? "10:00");
  const pick = (d: Date) => onChange(timeIST(d));
  return (
    <>
      <PressField label={label} text={value ? formatTime12(value) : null} placeholder={placeholder} icon="clock" error={error} onPress={() => (Platform.OS === "android" ? openAndroid("time", current, pick) : setOpen(true))} />
      {Platform.OS === "ios" ? (
        <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? "Time"}>
          <DateTimePicker value={current} mode="time" display="spinner" timeZoneName={IST} minuteInterval={5} onValueChange={(_e, d) => pick(d)} themeVariant="light" />
          <Button label="Done" onPress={() => setOpen(false)} style={{ marginTop: 8 }} />
        </Sheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 50,
    borderRadius: radius.input,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  multiline: { alignItems: "flex-start" },
  inputError: { borderColor: colors.danger },
  textInput: { flex: 1, minHeight: 48, fontFamily: fonts.medium, fontSize: 15, color: colors.text, paddingVertical: 0 },
  segmented: { flexDirection: "row", gap: 6, padding: 4, borderRadius: 22, backgroundColor: colors.chip },
  segment: { flex: 1, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  segmentOn: { backgroundColor: colors.navy },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  multiList: { backgroundColor: colors.card, borderRadius: 24, paddingHorizontal: 16 },
  multiRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  multiBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.09)" },
});
