import { router } from "expo-router";
import { errorText } from "@/api/client";
import { formatBytes } from "@/api/files";
import { useVault } from "@/api/queries";
import { Card, EmptyState, ErrorState, IconWell, ListCard, ListRow, Loading } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { T } from "@/components/ui/text";
import { formatDate, plural } from "@/lib/format";

/** Contracts & Vault: the folders this person may open (the web's /vault). */
export default function Vault() {
  const q = useVault();
  const d = q.data;
  return (
    <Screen title="Contracts & Vault" back query={q} sub={d ? `${plural(d.folders.reduce((a, f) => a + f.count, 0), "document")}${d.encrypted ? " · encrypted at rest" : ""}` : undefined}>
      {q.isPending ? (
        <Loading />
      ) : q.isError || !d ? (
        <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
      ) : d.folders.length ? (
        <>
          <ListCard style={{ marginTop: 16 }}>
            {d.folders.map((f, i) => (
              <ListRow
                key={f.key}
                first={i === 0}
                onPress={() => router.push(`/vault/${f.slug}`)}
                left={<IconWell name="folder" size={44} />}
                title={f.name}
                sub={`${plural(f.count, "file")} · ${formatBytes(f.sizeBytes)}${f.updated ? ` · updated ${formatDate(f.updated)}` : ""}`}
              />
            ))}
          </ListCard>
          <Card style={{ marginTop: 14 }}>
            <T variant="small">
              Uploads up to {d.limits.maxMb} MB: PDF, images and Office documents{d.limits.scanned ? ", virus-scanned before they are stored" : ""}. Downloads use links that expire after a minute.
            </T>
          </Card>
        </>
      ) : (
        <EmptyState icon="lock" title="No folders" text="You don't have access to any vault folder." />
      )}
    </Screen>
  );
}
