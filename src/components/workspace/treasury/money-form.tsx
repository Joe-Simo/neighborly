"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/workspace/date-field";
import { NativeSelect } from "@/components/ui/native-select";
import { useWorkspace } from "@/components/workspace/context";
import { LiveField, markWrong } from "@/components/workspace/primitives";
import { UndoAct } from "@/components/workspace/undo";
import { fill } from "@/lib/words/fill";
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
import { treasuryWords } from "@/lib/words/rooms/treasury";

/** One of the conference's own kinds, or a new one being named in this form. */
type OwnKind = { id: string; direction: "in" | "out"; name: string };
type Money = (
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
  onRestore,
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
  /** Takes one of the conference's own kinds off the list; the refusal, if any, is said in the form. */
  onRetire: (id: string) => Promise<Refusal>;
  /** Puts a kind just taken off back on the list (its Undo). */
  onRestore: (kind: OwnKind) => Promise<Refusal>;
  onSubmit: (money: Money) => Promise<Refusal>;
  onCancel: () => void;
}) {
  const { words, sampleSaid } = useWorkspace();
  const room = treasuryWords(words);
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
  // The kind just taken off the list, said in the form with its way back until the next change.
  const [stopped, setStopped] = useState<OwnKind | null>(null);
  const [stopping, setStopping] = useState(false);
  const out = choice.direction === "out";
  const gift = out && choice.kind === "twinning";
  // The opening balance comes from no one: it is where the money is held, as of the day it was counted.
  const opening = !out && choice.kind === "opening";
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const cents = parseCents(amount);
        if (cents === null) markWrong(form, "amount", w.amountWrong);
        if (!form.checkValidity() || cents === null) return;
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
              setStopped(null);
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
                  {sampleSaid(kind.name)}
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
                  {sampleSaid(kind.name)}
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
          disabled={stopping}
          onClick={async () => {
            const kind = own?.find((one) => one.id === choice.id);
            if (!kind) return;
            setError("");
            setStopping(true);
            const refusal = await onRetire(kind.id);
            setStopping(false);
            if (refusal) return setError(fill(w.stopRefused, { name: sampleSaid(kind.name) }));
            setStopped(kind);
            setChoice({ direction: "in", kind: start });
            onOut(false);
          }}
        >
          {w.stop}
        </Button>
      )}
      {stopped && (
        <p className="live-detail treasury-stopped" role="status">
          <span>{fill(w.stopped, { name: sampleSaid(stopped.name) })}</span>{" "}
          <UndoAct
            run={async () => {
              const kind = stopped;
              const refusal = await onRestore(kind);
              setStopped(null);
              if (refusal) return setError(fill(w.restoreRefused, { name: sampleSaid(kind.name) }));
              setChoice({ direction: kind.direction, kind: "own", id: kind.id });
              onOut(kind.direction === "out");
            }}
          />
        </p>
      )}
      <div className="live-form-grid treasury-form-grid">
        <LiveField label={w.amount}>
          <Input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </LiveField>
        <LiveField label={opening ? w.dayCounted : out ? w.dayPaid : w.dayReceived}>
          <DateField name="date" max={today} value={date} onChange={setDate} required />
        </LiveField>
      </div>
      <LiveField
        label={gift ? w.toConference : out ? w.paidTo : opening ? w.heldIn : w.from}
      >
        <Input
          name="name"
          list={out && !gift && payees?.length ? "treasury-payees" : undefined}
          maxLength={120}
          placeholder={out ? "" : opening ? w.heldInExample : w.fromExample}
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
        {gift ? w.submit.gift : out ? w.submit.out : opening ? w.submit.opening : w.submit.in}
      </FormActions>
    </form>
  );
}
