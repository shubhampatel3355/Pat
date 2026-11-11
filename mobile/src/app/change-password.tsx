import { PasswordForm } from "@/components/password-form";
import { Button } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { useSession } from "@/auth/session";

/** First sign-in (or after an admin reset): the server allows nothing else until the password is changed. */
export default function ChangePassword() {
  const { me, signOut } = useSession();
  return (
    <Screen title="Choose a new password" sub={me ? `Signed in as ${me.user.email}` : undefined}>
      <T variant="body" style={{ marginTop: 12 }}>
        Your temporary password must be changed before you continue.
      </T>
      <PasswordForm />
      <Button label="Sign out" kind="ghost" onPress={() => void signOut()} style={{ marginTop: 12 }} />
    </Screen>
  );
}
