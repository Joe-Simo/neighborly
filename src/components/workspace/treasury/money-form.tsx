"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { LiveField } from "@/components/workspace/primitives";
import { parseCents } from "@/components/workspace/treasury/money";
import {
  FormActions,
  FormError,
  type Refusal,
} from "@/components/workspace/treasury/form-parts";
import {
  incomeSources,
  type IncomeSource,
} from "@/components/workspace/treasury/labels";

export type MoneyKind = IncomeSource | "gift";
export type Money = {
  kind: MoneyKind;
  amount: number;
  date: string;
  name: string;
  memo: string;
};

export function MoneyForm({
  today,
  start,
  onSubmit,
  onCancel,
}: {
  today: string;
  start: MoneyKind;
  onSubmit: (money: Money) => Promise<Refusal>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<MoneyKind>(start);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const out = kind === "gift";
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const cents = parseCents(amount);
        if (cents === null)
          return setError("Enter the amount in dollars and cents, like 640.00.");
        setError("");
        setSaving(true);
        const refusal = await onSubmit({ kind, amount: cents, date, name, memo });
        setSaving(false);
        if (refusal) setError(refusal);
      }}
    >
      <LiveField
        label="What is it?"
        help={
          out
            ? "A gift to another conference. Payments for a neighbor are recorded from their approved request."
            : undefined
        }
      >
        <NativeSelect
          className="w-full"
          name="kind"
          value={kind}
          onChange={(event) => {
            const chosen = [...incomeSources.map(([id]) => id), "gift" as const].find(
              (id) => id === event.target.value,
            );
            if (chosen) setKind(chosen);
          }}
        >
          <optgroup label="Money in">
            {incomeSources.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Money out">
            <option value="gift">Twinning gift to another conference</option>
          </optgroup>
        </NativeSelect>
      </LiveField>
      <div className="live-form-grid treasury-form-grid">
        <LiveField label="Amount">
          <Input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </LiveField>
        <LiveField label={out ? "Day sent" : "Day received"}>
          <Input
            type="date"
            name="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </LiveField>
      </div>
      <LiveField label={out ? "To which conference" : "From"}>
        <Input
          name="name"
          maxLength={120}
          placeholder={out ? "" : "The parish, the Walk, an anonymous gift"}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </LiveField>
      <LiveField label="Note (optional)">
        <Input
          name="memo"
          maxLength={200}
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
      </LiveField>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onCancel={onCancel}>
        {out ? "Record gift" : "Record money in"}
      </FormActions>
    </form>
  );
}
