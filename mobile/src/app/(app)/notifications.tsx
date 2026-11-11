import { router } from "expo-router";
import { View } from "react-native";
import { errorText } from "@/api/client";
import { runAction, useAction, useLive } from "@/api/queries";
import { Button, EmptyState, ErrorState, IconWell, ListCard, ListRow, Loading, Section } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { ago } from "@/lib/format";
import { appRouteFor } from "@/lib/links";
import { colors } from "@/theme/tokens";

/** Notifications and team activity — the web shell's bell and ticker (same 15-second poll). */
export default function Notifications() {
  const live = useLive();
  const markRead = useAction<{ ids?: string[] }>("notifications.markRead", { quiet: true });
  const d = live.data;

  return (
    <Screen
      title="Notifications"
      back
      query={live}
      right={d?.unread ? <Button label="Mark all read" kind="secondary" size="sm" onPress={() => void runAction(markRead, {})} /> : undefined}
    >
      {live.isPending ? (
        <Loading />
      ) : live.isError ? (
        <ErrorState message={errorText(live.error)} onRetry={() => void live.refetch()} />
      ) : !d?.notifications.length ? (
        <EmptyState icon="bell" title="No notifications" text="Mentions, assignments and reminders show up here." />
      ) : (
        <ListCard style={{ marginTop: 16 }}>
          {d.notifications.map((n, i) => (
            <ListRow
              key={n.id}
              first={i === 0}
              onPress={() => {
                if (!n.read) void runAction(markRead, { ids: [n.id] });
                const route = appRouteFor(n.href);
                if (route) router.push(route);
              }}
              left={<IconWell name="bell" size={38} color={n.read ? colors.muted : colors.navy} />}
              title={n.text}
              numberOfLines={3}
              sub={ago(n.at)}
              right={n.read ? null : <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.dangerSoft }} />}
            />
          ))}
        </ListCard>
      )}
      {d?.activity.length ? (
        <Section title="Team activity">
          <ListCard>
            {d.activity.map((a, i) => (
              <ListRow key={a.id} first={i === 0} left={<IconWell name="sparkles" size={36} />} title={`${a.who} ${a.text}`} numberOfLines={2} sub={`${a.module} · ${ago(a.at)}`} />
            ))}
          </ListCard>
        </Section>
      ) : null}
    </Screen>
  );
}
