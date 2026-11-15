"use client";

import { useState } from "react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

/** One of the conference's own kinds, or a new one being named in this form. */
export type OwnKind = { id: string; direction: "in" | "out"; name: string };
export type Money = (
  | { direction: "in"; kind: IncomeSource }
  | { direction: "out"; kind: SpendingKind }
  | { direction: "in" | "out"; kind: "own"; id: string }
  | { direction: "in" | "out"; kind: "new"; kindName: string }
) & {
  amount: number;
  date: string;
  name: string;
  memo: string;
  checkNumber: string;
};
/** Every choice in the "What is it?" list, keyed "in:collection", "out:pantry". */
const choices = [
  ...incomeSources.map(([kind]) => ({ direction: "in", kind }) as const),
  ...spendingKinds.map(([kind]) => ({ direction: "out", kind }) as const),
];
type Choice =
  | (typeof choices)[number]
  | { direction: "in" | "out"; kind: "own"; id: string }
  | { direction: "in" | "out"; kind: "new" };
const keyOf = (choice: Choice) =>
  choice.kind === "own"
    ? `own:${choice.id}`
    : `${choice.direction}:${choice.kind}`;

export function MoneyForm({
  today,
  start,
  own,
  onRetire,
  onSubmit,
  onCancel,
}: {
  today: string;
  start: IncomeSource;
  /** The conference's own kinds; undefined until the backend offers them, and then none can be added. */
  own?: OwnKind[];
  onRetire: (id: string) => void;
  onSubmit: (money: Money) => Promise<Refusal>;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState<Choice>({ direction: "in", kind: start });
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [name, setName] = useState("");
  const [memo, setMemo] = useState("");
  const [kindName, setKindName] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const out = choice.direction === "out";
  const gift = out && choice.kind === "twinning";
  return (
    <>
      <DialogHeader>
        <DialogTitle>{out ? "Record money out" : "Record money"}</DialogTitle>
        <DialogDescription>
          {out
            ? "A purchase, dues or a fee the conference paid."
            : "A collection, a gift, or what the conference holds today."}
        </DialogDescription>
      </DialogHeader>
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const cents = parseCents(amount);
        if (cents === null)
          return setError("Enter the amount in dollars and cents, like 640.00.");
        setError("");
        setSaving(true);
        const refusal = await onSubmit({
          ...(choice.kind === "new" ? { ...choice, kindName } : choice),
          amount: cents,
          date,
          name,
          memo,
          checkNumber: out ? checkNumber : "",
        });
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
            const key = event.target.value;
            const mine = own?.find((kind) => `own:${kind.id}` === key);
            const chosen: Choice | undefined = mine
              ? { direction: mine.direction, kind: "own", id: mine.id }
              : key === "in:new" || key === "out:new"
                ? { direction: key === "in:new" ? "in" : "out", kind: "new" }
                : choices.find((candidate) => keyOf(candidate) === key);
            if (chosen) setChoice(chosen);
          }}
        >
          <optgroup label="Money in">
            {incomeSources.map(([kind, label]) => (
              <option key={kind} value={`in:${kind}`}>
                {label}
              </option>
            ))}
            {own
              ?.filter((kind) => kind.direction === "in")
              .map((kind) => (
                <option key={kind.id} value={`own:${kind.id}`}>
                  {kind.name}
                </option>
              ))}
            {own && <option value="in:new">Another kind of money in…</option>}
          </optgroup>
          <optgroup label="Money out">
            {spendingKinds.map(([kind, label]) => (
              <option key={kind} value={`out:${kind}`}>
                {label}
              </option>
            ))}
            {own
              ?.filter((kind) => kind.direction === "out")
              .map((kind) => (
                <option key={kind.id} value={`own:${kind.id}`}>
                  {kind.name}
                </option>
              ))}
            {own && <option value="out:new">Another kind of money out…</option>}
          </optgroup>
        </NativeSelect>
      </LiveField>
      {choice.kind === "new" && (
        <LiveField
          label="Name this kind"
          help="It joins the list for next time, for everyone who keeps the ledger."
        >
          <Input
            name="kindName"
            maxLength={120}
            placeholder={out ? "Gas cards" : "Fall raffle"}
            value={kindName}
            onChange={(event) => setKindName(event.target.value)}
            required
          />
        </LiveField>
      )}
      {choice.kind === "own" && (
        <Button
          type="button"
          variant="link"
          className="treasury-take-back treasury-retire"
          onClick={() => {
            onRetire(choice.id);
            setChoice({ direction: "in", kind: start });
          }}
        >
          Stop offering this kind
        </Button>
      )}
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
      {out && (
        <LiveField label="Check number (optional)">
          <Input
            name="checkNumber"
            inputMode="numeric"
            autoComplete="off"
            maxLength={20}
            value={checkNumber}
            onChange={(event) => setCheckNumber(event.target.value)}
          />
        </LiveField>
      )}
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
        {gift ? "Record gift" : out ? "Record money out" : "Record money in"}
      </FormActions>
    </form>
    </>
  );
}
