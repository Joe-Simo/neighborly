"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/workspace/date-field";
import { NativeSelect } from "@/components/ui/native-select";
import { useWorkspace } from "@/components/workspace/context";
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
/** Every choice in the "Kind of money" list, keyed "in:collection", "out:pantry". */
const choices = [
  ...incomeSources.map((kind) => ({ direction: "in", kind }) as const),
  ...spendingKinds.map((kind) => ({ direction: "out", kind }) as const),
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
  payees,
  onOut,
  onRetire,
  onSubmit,
  onCancel,
}: {
  today: string;
  start: IncomeSource;
  /** The conference's own kinds; undefined until the backend offers them, and then none can be added. */
  own?: OwnKind[];
  /** Who the conference pays, offered as suggestions under "Paid to"; a typed name is always allowed. */
  payees?: string[];
  /** Tells the sheet whether its title should name money out. */
  onOut: (out: boolean) => void;
  onRetire: (id: string) => void;
  onSubmit: (money: Money) => Promise<Refusal>;
  onCancel: () => void;
}) {
  const room = useWorkspace().words.rooms.treasury;
  const w = room.money;
  const [choice, setChoice] = useState<Choice>({
    direction: "in",
    kind: start,
  });
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
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const cents = parseCents(amount);
        if (cents === null)
          return setError(w.amountWrong);
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
        label={w.kind}
        help={out ? w.outHelp : undefined}
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
            if (chosen) {
              setChoice(chosen);
              onOut(chosen.direction === "out");
            }
          }}
        >
          <optgroup label={w.in}>
            {incomeSources.map((kind) => (
              <option key={kind} value={`in:${kind}`}>
                {room.sources[kind]}
              </option>
            ))}
            {own
              ?.filter((kind) => kind.direction === "in")
              .map((kind) => (
                <option key={kind.id} value={`own:${kind.id}`}>
                  {kind.name}
                </option>
              ))}
            {own && <option value="in:new">{w.anotherIn}</option>}
          </optgroup>
          <optgroup label={w.out}>
            {spendingKinds.map((kind) => (
              <option key={kind} value={`out:${kind}`}>
                {room.spending[kind]}
              </option>
            ))}
            {own
              ?.filter((kind) => kind.direction === "out")
              .map((kind) => (
                <option key={kind.id} value={`own:${kind.id}`}>
                  {kind.name}
                </option>
              ))}
            {own && <option value="out:new">{w.anotherOut}</option>}
          </optgroup>
        </NativeSelect>
      </LiveField>
      {choice.kind === "new" && (
        <LiveField
          label={w.nameKind}
          help={w.nameKindHelp}
        >
          <Input
            name="kindName"
            maxLength={120}
            placeholder={out ? w.kindExampleOut : w.kindExampleIn}
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
            onOut(false);
          }}
        >
          {w.stop}
        </Button>
      )}
      <div className="live-form-grid treasury-form-grid">
        <LiveField label={w.amount}>
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
        <LiveField label={out ? w.dayPaid : w.dayReceived}>
          <DateField name="date" max={today} value={date} onChange={setDate} required />
        </LiveField>
      </div>
      <LiveField
        label={gift ? w.toConference : out ? w.paidTo : w.from}
      >
        <Input
          name="name"
          list={out && !gift && payees?.length ? "treasury-payees" : undefined}
          maxLength={120}
          placeholder={out ? "" : w.fromExample}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        {out && !gift && payees && payees.length > 0 && (
          <datalist id="treasury-payees">
            {payees.map((payee) => (
              <option key={payee} value={payee} />
            ))}
          </datalist>
        )}
      </LiveField>
      {out && (
        <LiveField label={w.check}>
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
      <LiveField label={w.note}>
        <Input
          name="memo"
          maxLength={200}
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
      </LiveField>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onCancel={onCancel}>
        {gift ? w.submit.gift : out ? w.submit.out : w.submit.in}
      </FormActions>
    </form>
  );
}
