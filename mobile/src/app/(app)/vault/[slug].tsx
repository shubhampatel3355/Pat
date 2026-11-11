import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, TextInput, View } from "react-native";
import { errorText } from "@/api/client";
import { deleteStoredFile, formatBytes, openStoredFile, pickDocuments, uploadDocuments } from "@/api/files";
import { useVaultFolder } from "@/api/queries";
import type { FileRow } from "@/api/types";
import { useToast } from "@/components/toast";
import { Select } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Button, EmptyState, ErrorState, IconWell, ListCard, ListRow, Loading } from "@/components/ui/primitives";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { T } from "@/components/ui/text";
import { formatDate, plural } from "@/lib/format";
import { colors, fonts } from "@/theme/tokens";

/** One vault folder: open, upload and (where allowed) delete files — through the web's own file endpoints. */
export default function VaultFolder() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const q = useVaultFolder(slug);
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<FileRow | null>(null);
  const [ownerPick, setOwnerPick] = useState<string | null>(null);
  const d = q.data;
  const isEmployeeFolder = d?.folder.key === "EMPLOYEE_DOCUMENTS";

  const upload = async (ownerUserId: string | null) => {
    if (!d) return;
    const assets = await pickDocuments();
    if (!assets.length) return;
    setBusy("upload");
    try {
      const res = await uploadDocuments({ folder: d.folder.key, ownerUserId }, assets);
      const ok = res.files.length;
      toast.show(res.errors.length ? `${ok ? `${plural(ok, "file")} uploaded · ` : ""}${res.errors.join(" · ")}` : `${plural(ok, "file")} uploaded`, res.errors.length ? "error" : "ok");
      void queryClient.invalidateQueries({ queryKey: ["vault"] });
    } catch (e) {
      toast.show(errorText(e), "error");
    } finally {
      setBusy(null);
      setOwnerPick(null);
    }
  };

  const open = async (f: FileRow) => {
    setBusy(f.id);
    try {
      await openStoredFile(f.id);
    } catch (e) {
      toast.show(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  };

  const files = (d?.files ?? []).filter((f) => !search.trim() || `${f.name} ${f.ownerName ?? ""} ${f.uploadedBy}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <Screen title={d?.folder.name ?? "Folder"} back query={q} sub={d ? plural(d.files.length, "file") : undefined}>
      {d ? (
        <Button
          label={busy === "upload" ? "Uploading…" : "Upload files"}
          icon="upload"
          loading={busy === "upload"}
          style={{ marginTop: 14 }}
          onPress={() => (isEmployeeFolder && d.employees ? setOwnerPick(d.me) : void upload(null))}
        />
      ) : null}
      <View style={styles.search}>
        <Icon name="search" color={colors.muted} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search files" placeholderTextColor={colors.faint} style={styles.input} accessibilityLabel="Search files" />
      </View>
      {q.isPending ? (
        <Loading />
      ) : q.isError || !d ? (
        <ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} />
      ) : files.length ? (
        <ListCard style={{ marginTop: 14 }}>
          {files.map((f, i) => (
            <ListRow
              key={f.id}
              first={i === 0}
              onPress={() => setSelected(f)}
              left={<IconWell name="file" size={40} />}
              title={f.name}
              sub={`${f.ext} · ${formatBytes(f.sizeBytes)} · ${formatDate(f.uploadedAt.slice(0, 10))}${f.ownerName ? ` · ${f.ownerName}` : ""}`}
              right={busy === f.id ? <T variant="caption">Opening…</T> : null}
            />
          ))}
        </ListCard>
      ) : (
        <EmptyState icon="folder" title={search ? "No matching files" : "No files yet"} text={search ? undefined : "Upload a document to this folder."} />
      )}

      {selected ? (
        <Sheet visible onClose={() => setSelected(null)} title={selected.name} sub={`${formatBytes(selected.sizeBytes)} · uploaded by ${selected.uploadedBy}`}>
          <Button
            label="Open / share"
            icon="share"
            onPress={() => {
              const f = selected;
              setSelected(null);
              void open(f);
            }}
          />
          {selected.canDelete ? (
            <Button
              label="Delete"
              icon="trash"
              kind="ghost"
              style={{ marginTop: 10 }}
              onPress={() =>
                Alert.alert(`Delete ${selected.name}?`, "It is removed from the vault for everyone.", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await deleteStoredFile(selected.id);
                        toast.show(`${selected.name} deleted`);
                        setSelected(null);
                        void queryClient.invalidateQueries({ queryKey: ["vault"] });
                      } catch (e) {
                        toast.show(errorText(e), "error");
                      }
                    },
                  },
                ])
              }
            />
          ) : null}
        </Sheet>
      ) : null}

      {ownerPick && d?.employees ? (
        <Sheet visible onClose={() => setOwnerPick(null)} title="Whose documents?" sub="Employee documents are filed under a person">
          <Select label="Employee" value={ownerPick} onChange={setOwnerPick} options={d.employees.map((u) => ({ value: u.id, label: u.id === d.me ? `${u.name} (me)` : u.name }))} />
          <Button label="Choose files" icon="upload" style={{ marginTop: 16 }} onPress={() => void upload(ownerPick)} />
        </Sheet>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { marginTop: 12, height: 48, borderRadius: 16, backgroundColor: "rgba(244,244,244,0.9)", borderWidth: 1, borderColor: colors.chipBorder, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 },
  input: { flex: 1, height: "100%", fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
});
