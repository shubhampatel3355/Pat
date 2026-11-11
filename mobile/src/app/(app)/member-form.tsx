import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { errorText } from "@/api/client";
import { runAction, useAction, useTeams } from "@/api/queries";
import type { Role } from "@/api/prisma-enums";
import type { Member, TeamsResponse } from "@/api/types";
import { AmountField, DateField, Field, Segmented, Select, SwitchRow } from "@/components/ui/form";
import { Card, ErrorState, Loading } from "@/components/ui/primitives";
import { FormScreen, Screen } from "@/components/ui/screen";
import { fieldErrors, param } from "@/lib/forms";
import { paiseToInput, parseRupeesToPaise } from "@/lib/format";

/** Invite or edit a team member (the web's member drawer and rules). New members get an emailed invite. */
export default function MemberForm() {
  const params = useLocalSearchParams<{ id?: string }>();
  const q = useTeams();
  if (q.isPending) return <Screen title="Member" back><Loading /></Screen>;
  if (!q.data) return <Screen title="Member" back><ErrorState message={errorText(q.error)} onRetry={() => void q.refetch()} /></Screen>;
  const id = param(params.id);
  const member = id ? q.data.members.find((m) => m.id === id) : undefined;
  return <Form key={member?.id ?? "new"} data={q.data} member={member} />;
}

function Form({ data, member }: { data: TeamsResponse; member?: Member }) {
  const invite = useAction("team.invite");
  const update = useAction("team.update");
  const [name, setName] = useState(member?.name ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [title, setTitle] = useState(member?.title ?? "");
  const [role, setRole] = useState<Role>(member?.role ?? "EMPLOYEE");
  const [partner, setPartner] = useState<string>(member?.partnerId ?? "none");
  const [joined, setJoined] = useState<string | null>(member?.dateOfJoining ?? null);
  const [ctc, setCtc] = useState(member?.ctcAnnualPaise != null ? paiseToInput(member.ctcAnnualPaise) : "");
  const [active, setActive] = useState(member ? member.status !== "INACTIVE" : true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save() {
    const input = {
      name,
      phone,
      email,
      title,
      role,
      partnerId: role === "OWNER" || partner === "none" ? null : partner,
      dateOfJoining: joined,
      // People who can't see payroll leave CTC untouched (null), as on the web.
      ctcAnnualPaise: data.canSeeCtc && ctc ? (parseRupeesToPaise(ctc) ?? null) : null,
    };
    const res = member ? await runAction(update, { id: member.id, data: input, active }) : await runAction(invite, input);
    if (res.ok) router.back();
    else setErrors(fieldErrors(res, member ? "data." : ""));
  }

  const roles: { value: Role; label: string }[] = [
    { value: "EMPLOYEE", label: "Employee" },
    { value: "ADMIN", label: "Admin" },
    ...(data.canMakeOwner ? [{ value: "OWNER" as const, label: "Owner" }] : []),
  ];
  return (
    <FormScreen title={member ? "Edit member" : "Invite a member"} sub={member ? member.email : "They'll get an email to set a password"} onSubmit={save} saving={invite.isPending || update.isPending} submitLabel={member ? "Save" : "Send invite"}>
      <Field label="Full name" value={name} onChangeText={setName} error={errors.name} autoCapitalize="words" />
      <Field label="Work email" value={email} onChangeText={setEmail} error={errors.email} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Mobile" value={phone} onChangeText={setPhone} error={errors.phone} keyboardType="phone-pad" placeholder="10-digit mobile" />
      <Field label="Title" value={title} onChangeText={setTitle} error={errors.title} placeholder="e.g. Sales manager" autoCapitalize="words" />
      <Segmented<Role> label="Access" value={role} onChange={setRole} options={roles} />
      {role !== "OWNER" ? <Select label="Partner (reports to)" value={partner} onChange={setPartner} options={[{ value: "none", label: "None" }, ...data.partners.map((p) => ({ value: p.id, label: p.name }))]} error={errors.partnerId} /> : null}
      <DateField label="Date of joining" value={joined} onChange={setJoined} clearable placeholder="Not set" error={errors.dateOfJoining} />
      {data.canSeeCtc ? <AmountField label="Annual CTC" value={ctc} onChange={setCtc} error={errors.ctcAnnualPaise} decimals={false} /> : null}
      {member ? (
        <Card style={{ marginTop: 18, paddingVertical: 6 }}>
          <SwitchRow label="Active" sub="Deactivating signs them out everywhere" value={active} onChange={setActive} />
        </Card>
      ) : null}
    </FormScreen>
  );
}
