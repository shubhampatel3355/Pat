import { router } from "expo-router";
import { PasswordForm } from "@/components/password-form";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";

/** Voluntary password change from More → Change password. */
export default function Password() {
  return (
    <Screen title="Change password" back>
      <T variant="small" style={{ marginTop: 12 }}>
        Changing your password signs you out everywhere else, on the web and on other phones.
      </T>
      <PasswordForm onDone={() => router.back()} />
    </Screen>
  );
}
