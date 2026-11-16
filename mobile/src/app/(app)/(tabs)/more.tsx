import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { View } from "react-native";
import { apiHost } from "@/api/config";
import { useLive } from "@/api/queries";
import { useMe, useSession } from "@/auth/session";
import { Toggle } from "@/components/ui/form";
import { Icon, iconForWeb, type IconName } from "@/components/ui/icon";
import { Avatar, Button, GroupLabel, Hero, IconWell, ListCard, ListRow, Pill } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { confirmAlert } from "@/lib/confirm";
import { ROLE_LABELS } from "@/lib/format";
import { haptics, hapticsEnabled, hapticsSupported, setHapticsEnabled } from "@/lib/haptics";
import { appRouteFor } from "@/lib/links";
import { colors } from "@/theme/tokens";

/** Pages that already have a tab. */
const IN_TABS = new Set(["/dashboard", "/wip", "/follow-ups"]);

/** Every module the person may open — the web sidebar's list (same permission filter on the server). */
export default function More() {
  const me = useMe();
  const { signOut } = useSession();
  const live = useLive();
  const groups = me.nav.map((g) => ({ ...g, items: g.items.filter((i) => !IN_TABS.has(i.href)) })).filter((g) => g.items.length);

  const row = (key: string, label: string, icon: IconName, onPress: () => void, first: boolean, right?: React.ReactNode) => (
    <ListRow key={key} first={first} onPress={onPress} left={<IconWell name={icon} />} title={label} right={right ?? <Icon name="forward" size={18} color={colors.faint} />} />
  );

  return (
    <Screen tabs title="More">
      <Hero style={{ marginTop: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar initials={me.user.initials} size={54} gradient />
          <View style={{ flex: 1, minWidth: 0 }}>
            <T variant="h3" color={colors.white} numberOfLines={1}>
              {me.user.name}
            </T>
            <T variant="small" color={colors.mist} numberOfLines={1}>
              {[me.user.title, ROLE_LABELS[me.user.role]].filter(Boolean).join(" · ")}
            </T>
            <T variant="caption" color={colors.ice} numberOfLines={1}>
              {me.user.email}
            </T>
          </View>
        </View>
      </Hero>

      {groups.map((g) => (
        <View key={g.label}>
          <GroupLabel>{g.label}</GroupLabel>
          <ListCard>
            {g.items.map((item, i) => {
              const route = appRouteFor(item.href);
              return route ? row(item.href, item.label, iconForWeb(item.icon), () => router.push(route), i === 0) : null;
            })}
          </ListCard>
        </View>
      ))}

      <GroupLabel>Account</GroupLabel>
      <ListCard>
        {row("search", "Search", "search", () => router.push("/search"), true)}
        {row("notifications", "Notifications", "bell", () => router.push("/notifications"), false, live.data?.unread ? <Pill label={`${live.data.unread} new`} color={colors.danger} /> : undefined)}
        {row("password", "Change password", "key", () => router.push("/password"), false)}
        {row("web", "Open on the web", "globe", () => void WebBrowser.openBrowserAsync(me.appUrl), false)}
        {hapticsSupported ? <VibrationRow /> : null}
      </ListCard>

      <Button
        label="Sign out"
        icon="logout"
        kind="ghost"
        size="lg"
        style={{ marginTop: 24 }}
        onPress={() =>
          confirmAlert("Sign out?", "You'll need your password to sign in again.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => void signOut() },
          ])
        }
      />
      <T variant="caption" align="center" style={{ marginTop: 14 }}>
        {me.company.legalName} · {apiHost()}
      </T>
    </Screen>
  );
}

/** Taps, ticks and confirmations you can feel; saved on this phone. */
function VibrationRow() {
  const [on, setOn] = useState(hapticsEnabled);
  return (
    <ListRow
      left={<IconWell name="phone" />}
      title="Vibration"
      sub="Feel taps, ticks and confirmations"
      right={
        <Toggle
          value={on}
          label="Vibration"
          onChange={(v) => {
            setOn(v);
            void setHapticsEnabled(v);
            if (v) haptics.toggle(true); // the switch's own click was skipped while vibration was off
          }}
        />
      }
    />
  );
}
