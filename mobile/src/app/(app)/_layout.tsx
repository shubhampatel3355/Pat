import { Stack } from "expo-router";
import { AchievementWatcher } from "@/components/achievements";
import { colors } from "@/theme/tokens";

/** Signed-in area: the tabs, detail screens, and forms presented as modal sheets. */
const MODALS = [
  "lead-form",
  "follow-up-form",
  "task-form",
  "todo-form",
  "bd-form",
  "cab-form",
  "ledger-form",
  "invoice-form",
  "payment-form",
  "credit-note-form",
  "payslip-form",
  "payroll-start",
  "member-form",
  "password",
] as const;

export default function AppLayout() {
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
        <Stack.Screen name="(tabs)" />
        {MODALS.map((name) => (
          <Stack.Screen key={name} name={name} options={{ presentation: "modal" }} />
        ))}
      </Stack>
      <AchievementWatcher />
    </>
  );
}
