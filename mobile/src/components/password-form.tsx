import { useState } from "react";
import { View } from "react-native";
import { errorText, request } from "@/api/client";
import type { PasswordChangeResponse } from "@/api/types";
import { useSession } from "@/auth/session";
import { Field } from "@/components/ui/form";
import { Button } from "@/components/ui/primitives";
import { T } from "@/components/ui/text";
import { useToast } from "@/components/toast";
import { colors } from "@/theme/tokens";

/**
 * The web's change-password action (same rules: 10+ characters, not your email name, not a common word).
 * Every other session — web and app — is signed out; this device continues with a fresh token.
 */
export function PasswordForm({ onDone }: { onDone?: () => void }) {
  const { adoptToken } = useSession();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    setErrors({});
    setMessage(null);
    try {
      const res = await request<PasswordChangeResponse>("/api/mobile/v1/auth/password", { method: "POST", body: { current, next, confirm } });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setMessage(res.error);
        return;
      }
      if (res.session) await adoptToken(res.session);
      toast.show(res.message ?? "Password changed");
      onDone?.();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View>
      <Field label="Current password" value={current} onChangeText={setCurrent} secure autoCapitalize="none" autoComplete="current-password" error={errors.current} />
      <Field label="New password" value={next} onChangeText={setNext} secure autoCapitalize="none" autoComplete="new-password" error={errors.next} hint="At least 10 characters. Avoid your name or common words." />
      <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secure autoCapitalize="none" autoComplete="new-password" error={errors.confirm} />
      {message && !Object.keys(errors).length ? (
        <T variant="small" color={colors.danger} style={{ marginTop: 12 }}>
          {message}
        </T>
      ) : null}
      <Button label="Change password" onPress={save} loading={busy} size="lg" style={{ marginTop: 22 }} />
    </View>
  );
}
