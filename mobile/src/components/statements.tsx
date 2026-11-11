import { useState } from "react";
import { View } from "react-native";
import { errorText } from "@/api/client";
import { downloadAndShare } from "@/api/files";
import type { PayrollEmployee, StatementType } from "@/api/types";
import { useToast } from "./toast";
import { Segmented } from "./ui/form";
import { IconWell, ListCard, ListRow } from "./ui/primitives";
import { T } from "./ui/text";

/** Payslips (monthly) and pay statements (quarterly / yearly) as PDFs, from the web's payslip endpoint. */
export function Statements({ person }: { person: PayrollEmployee }) {
  const toast = useToast();
  const [type, setType] = useState<StatementType>("MONTHLY");
  const [busy, setBusy] = useState<string | null>(null);
  const list = person.statements[type];

  const download = async (key: string, label: string) => {
    setBusy(key);
    try {
      await downloadAndShare(`/api/payslips/${person.id}/${type}/${encodeURIComponent(key)}`, `${type === "MONTHLY" ? "Payslip" : "Pay statement"} ${person.name} ${label}.pdf`, "application/pdf");
    } catch (e) {
      toast.show(errorText(e), "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View>
      <Segmented<StatementType>
        value={type}
        onChange={setType}
        options={[
          { value: "MONTHLY", label: "Monthly" },
          { value: "QUARTERLY", label: "Quarterly" },
          { value: "YEARLY", label: "Yearly" },
        ]}
      />
      {list.length ? (
        <ListCard style={{ marginTop: 12 }}>
          {list.map((s, i) => (
            <ListRow key={s.key} first={i === 0} onPress={() => void download(s.key, s.label)} left={<IconWell name="file" size={36} />} title={s.label} sub={busy === s.key ? "Preparing PDF…" : "Download PDF"} />
          ))}
        </ListCard>
      ) : (
        <T variant="small" style={{ marginTop: 12 }}>
          No paid payslips yet.
        </T>
      )}
    </View>
  );
}
