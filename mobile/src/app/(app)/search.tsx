import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { errorText } from "@/api/client";
import { useSearch } from "@/api/queries";
import { Icon, iconForWeb } from "@/components/ui/icon";
import { EmptyState, ErrorState, IconWell, ListCard, ListRow, Section } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { appRouteFor } from "@/lib/links";
import { colors, fonts } from "@/theme/tokens";

/** Search across WIP, meetings, invoices, people, tasks, follow-ups and documents (the web's ⌘K search). */
export default function Search() {
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 300);
    return () => clearTimeout(t);
  }, [text]);
  const search = useSearch(q);

  return (
    <Screen title="Search" back>
      <View style={styles.box}>
        <Icon name="search" color={colors.muted} />
        <TextInput value={text} onChangeText={setText} autoFocus placeholder="Tenant, invoice, person, document…" placeholderTextColor={colors.faint} style={styles.input} returnKeyType="search" accessibilityLabel="Search" />
        {text ? (
          <Pressable onPress={() => setText("")} hitSlop={10} accessibilityLabel="Clear">
            <Icon name="close" color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {q.length < 2 ? (
        <T variant="small" style={{ marginTop: 16 }}>
          Type at least two letters.
        </T>
      ) : search.isError ? (
        <ErrorState message={errorText(search.error)} onRetry={() => void search.refetch()} />
      ) : search.data && !search.data.groups.length ? (
        <EmptyState title="Nothing found" text={`No results for “${q}” that you can open.`} />
      ) : (
        search.data?.groups.map((g) => (
          <Section key={g.label} title={g.label}>
            <ListCard>
              {g.items.map((item, i) => {
                const route = appRouteFor(item.href);
                return (
                  <ListRow
                    key={`${item.href}-${i}`}
                    first={i === 0}
                    onPress={route ? () => router.push(route) : undefined}
                    left={<IconWell name={iconForWeb(item.icon)} size={38} />}
                    title={item.label}
                    sub={item.meta}
                  />
                );
              })}
            </ListCard>
          </Section>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 16, height: 50, borderRadius: 16, backgroundColor: "rgba(244,244,244,0.9)", borderWidth: 1, borderColor: colors.chipBorder, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  input: { flex: 1, height: "100%", fontFamily: fonts.medium, fontSize: 15, color: colors.text },
});
