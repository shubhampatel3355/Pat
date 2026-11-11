import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@shared/finance";
import { PAYMENT_MODES } from "@shared/invoice";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { runAction, useAction } from "@/api/queries";
import type { LedgerType, PaymentMode } from "@/api/prisma-enums";
import { useMe } from "@/auth/session";
import { AmountField, DateField, Field, FieldError, FieldLabel, Segmented, Select } from "@/components/ui/form";
import { Chip } from "@/components/ui/primitives";
import { FormScreen } from "@/components/ui/screen";
import { fieldErrors, param } from "@/lib/forms";
import { parseRupeesToPaise } from "@/lib/format";

/** Record income or an expense in the ledger (same categories and checks as the web). */
export default function LedgerForm() {
  const params = useLocalSearchParams<{ type?: string }>();
  const me = useMe();
  const add = useAction("finance.addEntry");
  const [type, setType] = useState<LedgerType>(param(params.type) === "INCOME" ? "INCOME" : "EXPENSE");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [party, setParty] = useState("");
  const [mode, setMode] = useState<PaymentMode>("NEFT");
  const [date, setDate] = useState<string | null>(me.today);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const categories: readonly string[] = type === "INCOME" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  async function save() {
    const res = await runAction(add, { type, amountPaise: parseRupeesToPaise(amount) ?? 0, party, description, category, mode, entryDate: date ?? "" });
    if (res.ok) router.back();
    else setErrors(fieldErrors(res));
  }

  return (
    <FormScreen title={type === "INCOME" ? "Record income" : "Record expense"} onSubmit={save} saving={add.isPending}>
      <Segmented<LedgerType>
        label="Type"
        value={type}
        onChange={(t) => {
          setType(t);
          setCategory("");
        }}
        options={[
          { value: "EXPENSE", label: "Expense" },
          { value: "INCOME", label: "Income" },
        ]}
      />
      <AmountField label="Amount" value={amount} onChange={setAmount} error={errors.amountPaise} />
      <FieldLabel>Category</FieldLabel>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {categories.map((c) => (
          <Chip key={c} label={c} small active={category === c} onPress={() => setCategory(c)} />
        ))}
      </View>
      <FieldError message={errors.category} />
      <Field label="Description" value={description} onChangeText={setDescription} error={errors.description} placeholder="What it was for" />
      <Field label={type === "INCOME" ? "Received from" : "Paid to"} value={party} onChangeText={setParty} error={errors.party} placeholder="Optional" autoCapitalize="words" />
      <Select<PaymentMode> label="Mode" value={mode} onChange={setMode} options={PAYMENT_MODES.map((m) => ({ value: m.value, label: m.label }))} />
      <DateField label="Date" value={date} onChange={setDate} error={errors.entryDate} />
    </FormScreen>
  );
}
