import { Urbanist_300Light, Urbanist_400Regular, Urbanist_500Medium, Urbanist_600SemiBold, Urbanist_700Bold, useFonts } from "@expo-google-fonts/urbanist";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { apiHost } from "@/api/config";
import { createQueryClient } from "@/api/queries";
import { SessionProvider, useSession } from "@/auth/session";
import { Button, IconWell } from "@/components/ui/primitives";
import { T } from "@/components/ui/text";
import { ToastProvider } from "@/components/toast";
import { colors } from "@/theme/tokens";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Urbanist_300Light, Urbanist_400Regular, Urbanist_500Medium, Urbanist_600SemiBold, Urbanist_700Bold });
  const [queryClient] = useState(createQueryClient);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <SessionProvider>
              <StatusBar style="dark" />
              <RootNavigator fontsReady={fontsLoaded || Boolean(fontError)} />
            </SessionProvider>
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const { status, me } = useSession();
  const ready = fontsReady && status !== "loading";
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Hold the navigator (the splash screen stays up) until the saved session is known, so a link that opens the
  // app (e.g. /lead/<id>) is resolved against the right screens instead of falling back to sign-in or Home.
  if (!ready) return null;

  const signedIn = status === "signedIn" && me !== null;
  const mustChange = signedIn && Boolean(me?.user.mustChangePassword);
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Protected guard={signedIn && !mustChange}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={mustChange}>
          <Stack.Screen name="change-password" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      {status === "offline" ? <Offline /> : null}
    </>
  );
}

/** A saved session exists, but the server couldn't be reached at launch. */
function Offline() {
  const { retry, signOut } = useSession();
  return (
    <View style={styles.offline}>
      <IconWell name="globe" size={64} />
      <T variant="h2" align="center" style={{ marginTop: 14 }}>
        Can't reach Pat Michaels OS
      </T>
      <T variant="small" align="center" style={{ marginTop: 6, maxWidth: 280 }}>
        Check your internet connection. The app talks to {apiHost()}.
      </T>
      <Button label="Try again" onPress={retry} style={{ marginTop: 22, alignSelf: "stretch" }} />
      <Button label="Sign out" kind="ghost" onPress={() => void signOut()} style={{ marginTop: 10, alignSelf: "stretch" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  offline: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center", padding: 32 },
});
