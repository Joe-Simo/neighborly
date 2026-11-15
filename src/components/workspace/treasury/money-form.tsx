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
  spendingKinds,
  type IncomeSource,
  type SpendingKind,
} from "@/components/workspace/treasury/labels";

export type Money = (
  | { direction: "in"; kind: IncomeSource }
  | { direction: "out"; kind: SpendingKind }
) & { amount: number; date: string; name: string; memo: string };
/** Every choice in the "What is it?" list, keyed "in:collection", "out:pantry". */
const choices = [
  ...incomeSources.map(([kind]) => ({ direction: "in", kind }) as const),
  ...spendingKinds.map(([kind]) => ({ direction: "out", kind }) as const),
];
type Choice = (typeof choices)[number];
const keyOf = (choice: Choice) => `${choice.direction}:${choice.kind}`;

export function MoneyForm({
  today,
  start,
  onSubmit,
  onCancel,
}: {
  today: string;
  start: IncomeSource;
  onSubmit: (money: Money) => Promise<Refusal>;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState<Choice>({ direction: "in", kind: start });
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const out = choice.direction === "out";
  const gift = out && choice.kind === "twinning";
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
        const refusal = await onSubmit({ ...choice, amount: cents, date, name, memo });
        setSaving(false);
        if (refusal) setError(refusal);
      }}
    >
      <LiveField
        label="What is it?"
        help={
          out
            ? "Help for a neighbor is not recorded here. It is paid from their approved request, so it stays tied to it."
            : undefined
        }
      >
        <NativeSelect
          className="w-full"
          name="kind"
          value={keyOf(choice)}
          onChange={(event) => {
            const chosen = choices.find(
              (candidate) => keyOf(candidate) === event.target.value,
            );
            if (chosen) setChoice(chosen);
          }}
        >
          <optgroup label="Money in">
            {incomeSources.map(([kind, label]) => (
              <option key={kind} value={`in:${kind}`}>
                {label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Money out">
            {spendingKinds.map(([kind, label]) => (
              <option key={kind} value={`out:${kind}`}>
                {label}
              </option>
            ))}
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
        <LiveField label={out ? "Day paid" : "Day received"}>
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
      <LiveField label={gift ? "To which conference" : out ? "Paid to" : "From"}>
        <Input
          name="name"
          maxLength={120}
          placeholder={out ? "" : "The parish, the Walk, an anonymous gift"}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </LiveField>
      <LiveField label={out ? "Check number or note (optional)" : "Note (optional)"}>
        <Input
          name="memo"
          maxLength={200}
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
      </LiveField>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onCancel={onCancel}>
        {gift ? "Record gift" : out ? "Record money out" : "Record money in"}
      </FormActions>
    </form>
  );
}
