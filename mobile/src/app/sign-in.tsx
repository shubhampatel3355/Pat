import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { errorText } from "@/api/client";
import { apiHost, apiUrl, defaultApiUrl, saveApiUrl } from "@/api/config";
import { useSession } from "@/auth/session";
import { Field } from "@/components/ui/form";
import { Button, IconButton } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import { T } from "@/components/ui/text";
import { colors, heroGradient } from "@/theme/tokens";

/**
 * Sign in with the Pat Michaels work account — the same accounts, password rules, rate limits and
 * emailed sign-in code (owners and admins, when switched on) as the web.
 */
export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { signIn } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your work email and password.");
      return;
    }
    if (otpSentTo && !/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    try {
      const res = await signIn(email.trim(), password, otpSentTo ? otp : undefined);
      if (!res.ok) {
        if (res.otpRequired && res.otpSentTo) {
          setOtpSentTo(res.otpSentTo);
          setOtp("");
        } else setError(res.error);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LinearGradient colors={[heroGradient[2], heroGradient[1], heroGradient[0]]} style={{ flex: 1 }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 16 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Image source={require("@/assets/images/pat-michaels-logo.png")} style={styles.logo} contentFit="contain" accessibilityLabel="Pat Michaels" />
            <T variant="caption" color={colors.mist} style={styles.tagline}>
              BUSINESS OPERATING SYSTEM
            </T>
          </View>

          <View style={styles.card}>
            {otpSentTo ? (
              <>
                <IconButton name="back" label="Back" onPress={() => setOtpSentTo(null)} />
                <View>
                  <T variant="title">Verify it's you</T>
                  <T variant="small" style={{ marginTop: 6 }}>
                    Enter the 6-digit code we emailed to {otpSentTo}.
                  </T>
                </View>
                <Field label="Sign-in code" value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" placeholder="000000" maxLength={6} />
              </>
            ) : (
              <>
                <View>
                  <T variant="title">Sign in</T>
                  <T variant="small" style={{ marginTop: 6 }}>
                    Use your Pat Michaels work account
                  </T>
                </View>
                <Field label="Work email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@patmichaels.com" />
                <Field label="Password" value={password} onChangeText={setPassword} secure autoCapitalize="none" autoComplete="current-password" placeholder="Your password" />
              </>
            )}
            {error ? (
              <T variant="small" color={colors.danger}>
                {error}
              </T>
            ) : null}
            <Button label={otpSentTo ? "Verify & continue" : "Sign in"} onPress={submit} loading={busy} size="lg" />
            {!otpSentTo ? (
              <Pressable onPress={() => void WebBrowser.openBrowserAsync(`${apiUrl()}/forgot-password`)} hitSlop={8} style={{ alignSelf: "center" }} accessibilityRole="link">
                <T variant="strong" style={{ textDecorationLine: "underline" }}>
                  Forgot password?
                </T>
              </Pressable>
            ) : null}
          </View>

          <Pressable onPress={() => setServerOpen(true)} hitSlop={8} style={styles.server} accessibilityRole="button" accessibilityLabel="Change server">
            <T variant="caption" color={colors.ice}>
              Server: {apiHost()} · Change
            </T>
          </Pressable>
          <T variant="caption" color={colors.ice} align="center" style={{ marginTop: 8 }}>
            © {new Date().getFullYear()} Pat Michaels Developers LLP
          </T>
        </ScrollView>
      </KeyboardAvoidingView>
      <ServerSheet visible={serverOpen} onClose={() => setServerOpen(false)} />
    </LinearGradient>
  );
}

/** For testing against another backend (e.g. the web app running on a laptop). */
function ServerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [value, setValue] = useState(apiUrl());
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(url: string | null) {
    setChecking(true);
    setMessage(null);
    const candidate = url ?? defaultApiUrl();
    try {
      const res = await fetch(`${candidate.replace(/\/+$/, "")}/api/health`);
      const body = (await res.json()) as { status?: string };
      if (!body.status) throw new Error();
      await saveApiUrl(url);
      onClose();
    } catch {
      setMessage(`Couldn't reach Pat Michaels OS at ${candidate}.`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Server" sub="Where the app finds Pat Michaels OS">
      <Field label="Address" value={value} onChangeText={setValue} autoCapitalize="none" keyboardType="url" placeholder="https://os.patmichaels.com" />
      {message ? (
        <T variant="small" color={colors.danger} style={{ marginTop: 8 }}>
          {message}
        </T>
      ) : null}
      <Button label="Check and save" onPress={() => void save(value)} loading={checking} style={{ marginTop: 16 }} />
      <Button label={`Use the default (${defaultApiUrl().replace(/^https?:\/\//, "")})`} kind="ghost" onPress={() => void save(null)} style={{ marginTop: 10 }} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "space-between", paddingHorizontal: 10 },
  brand: { alignItems: "center", gap: 12, paddingVertical: 36 },
  logo: { width: 220, height: 79 },
  tagline: { letterSpacing: 1.8, fontSize: 13 },
  card: { borderRadius: 36, backgroundColor: colors.glass, padding: 22, gap: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  server: { alignSelf: "center", marginTop: 18 },
});
