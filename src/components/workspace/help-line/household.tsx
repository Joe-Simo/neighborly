"use client";

import { useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { Plus, X } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import { fill } from "@/lib/words/fill";
import { LiveField } from "@/components/workspace/primitives";
import { FormEnd } from "@/components/workspace/help-line/forms";
import {
  accountKinds,
  cents,
  livesHere,
  shortMoney,
  total,
  type NeighborRecord,
} from "@/components/workspace/help-line/format";
import { useSave } from "@/components/workspace/help-line/use-save";

type Target = { churchId: Id<"churches">; neighborId: Id<"neighbors"> };
export type HomeStep = "details" | "people" | "money" | "accounts";
/** The kinds of account in the order the form offers them. */
const kinds: (keyof typeof accountKinds)[] = ["landlord", "utility", "other"];
export type Accounts = { kind: keyof typeof accountKinds; name: string; accountNumber: string; phone: string }[];

/**
 * What a visiting pair and a treasurer need about the home: who lives there, what comes in and
 * goes out each month, and where a bill is paid. Account numbers stay covered until asked for.
 */
export function AtHome({
  record,
  format,
  numbers,
  onShowNumbers,
  onStep,
}: {
  record: NeighborRecord;
  format: Workspace["format"];
  numbers: Accounts | null;
  onShowNumbers: () => void;
  onStep: (step: HomeStep) => void;
}) {
  const { words, sampleSaid } = useWorkspace();
  const text = words.rooms.neighbors;
  const at = text.atHome;
  const { household, money, accounts } = record;
  const change = (step: HomeStep, empty: boolean, add: string) => (
    <Button
      type="button"
      variant="link"
      className="help-text-action"
      onClick={() => onStep(step)}
    >
      {empty ? add : at.change}
    </Button>
  );
  const left = money ? total(money.income) - total(money.expenses) : 0;
  return (
    <section className="live-section" aria-labelledby="at-home-title">
      <div className="live-section-head">
        <h2 id="at-home-title">{at.title}</h2>
      </div>
      <dl className="help-home">
        <div>
          <dt>{at.reach}</dt>
          <dd>
            {/* The address and the language stand in the quiet line under the name. */}
            <span className="help-tel">{record.neighbor.phone || at.noPhone}</span>
            {record.neighbor.email && <small>{record.neighbor.email}</small>}
          </dd>
          {change("details", false, "")}
        </div>
        <div>
          <dt>{at.lives}</dt>
          <dd>
            {household.length
              ? livesHere(household, sampleSaid)
              : record.neighbor.children
                ? fill(text.home.adultsAndChildren, {
                    adults: text.home.adults(record.neighbor.adults),
                    children: text.home.children(record.neighbor.children),
                  })
                : text.home.adults(record.neighbor.adults)}
          </dd>
          {change("people", !household.length, at.sayWho)}
        </div>
        <div>
          <dt>{at.month}</dt>
          {money ? (
            <dd>
              {fill(at.flow, { in: shortMoney(total(money.income)), out: shortMoney(total(money.expenses)) })}
              <small data-short={left < 0 ? "" : undefined}>
                {fill(left < 0 ? at.shortAsOf : at.leftAsOf, {
                  amount: shortMoney(Math.abs(left)),
                  date: format(money.updatedAt, { weekday: undefined, year: "numeric" }),
                })}
              </small>
            </dd>
          ) : (
            <dd>{at.noMonth}</dd>
          )}
          {change("money", !money, at.addMonth)}
        </div>
        <div>
          <dt>{at.accounts}</dt>
          {accounts.length ? (
            <dd>
              <ul className="help-accounts">
                {accounts.map((account, index) => (
                  <li key={index}>
                    {account.name}
                    {(numbers?.[index]?.accountNumber || account.ending) && (
                      <span>
                        {numbers?.[index]
                          ? numbers[index].accountNumber
                          : at.ending(account.ending)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </dd>
          ) : (
            <dd>{at.noAccounts}</dd>
          )}
          <span className="help-home-actions">
            {change("accounts", !accounts.length, at.addAccount)}
            {!numbers && accounts.some((account) => account.ending) && (
              <Button
                type="button"
                variant="link"
                className="help-text-action"
                onClick={onShowNumbers}
              >
                {at.showNumbers}
              </Button>
            )}
          </span>
          {numbers && (
            <p className="help-noted" role="status">
              {at.looked}
            </p>
          )}
        </div>
      </dl>
    </section>
  );
}

/** A short list a person adds to and takes from, one line each. */
function Lines<Line>({
  legend,
  shape,
  lines,
  blank,
  add,
  remove,
  onChange,
  children,
}: {
  legend: string;
  /** What the button that takes a line away is called, by the line's number. */
  remove: (line: number) => string;
  /** How a line is laid out: two boxes side by side, three, or four in two rows. */
  shape: "pair" | "three" | "four";
  lines: Line[];
  blank: Line;
  add: string;
  onChange: (lines: Line[]) => void;
  children: (line: Line, set: (next: Partial<Line>) => void, index: number) => ReactNode;
}) {
  return (
    <fieldset className="help-lines" data-shape={shape}>
      <legend>{legend}</legend>
      {lines.map((line, index) => (
        <div className="help-line-row" key={index}>
          {children(
            line,
            (next) =>
              onChange(lines.map((other, at) => (at === index ? { ...other, ...next } : other))),
            index,
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={remove(index + 1)}
            onClick={() => onChange(lines.filter((_, at) => at !== index))}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...lines, blank])}
      >
        <Plus aria-hidden="true" /> {add}
      </Button>
    </fieldset>
  );
}

export function PeopleForm({
  target,
  household,
  onSaved,
}: {
  target: Target;
  household: NeighborRecord["household"];
  onSaved: () => void;
}) {
  const saveHousehold = useMutation(api.neighbors.saveHousehold);
  const { pending, error, save } = useSave();
  const text = useWorkspace().words.rooms.neighbors.people;
  const [people, setPeople] = useState(
    household.length
      ? household.map((person) => ({
          relationship: person.relationship,
          child: person.child,
          born: person.birthYear?.toString() ?? "",
        }))
      : [{ relationship: "", child: false, born: "" }],
  );
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const thisYear = new Date().getFullYear();
        const outcome = await save(() =>
          saveHousehold({
            ...target,
            household: people.map((person) => {
              const birthYear = /^\d{4}$/.test(person.born) ? Number(person.born) : undefined;
              return {
                relationship: person.relationship,
                // A birth year says adult or child by itself; the question is only asked without one.
                child: birthYear === undefined ? person.child : thisYear - birthYear < 18,
                birthYear,
              };
            }),
          }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      <Lines
        legend={text.legend}
        shape="three"
        lines={people}
        blank={{ relationship: "", child: true, born: "" }}
        add={text.add}
        remove={text.removeLine}
        onChange={setPeople}
      >
        {(person, set, index) => (
          <>
            <LiveField label={text.who}>
              <Input
                value={person.relationship}
                placeholder={index ? text.next : text.first}
                required
                onChange={(event) => set({ relationship: event.target.value })}
              />
            </LiveField>
            <LiveField label={text.born}>
              <Input
                value={person.born}
                inputMode="numeric"
                pattern="\d{4}"
                placeholder={text.year}
                onChange={(event) => set({ born: event.target.value })}
              />
            </LiveField>
            {person.born.trim() ? (
              <span />
            ) : (
              <LiveField label={text.age}>
                <NativeSelect
                  className="w-full"
                  value={person.child ? "child" : "adult"}
                  onChange={(event) => set({ child: event.target.value === "child" })}
                >
                  <option value="adult">{text.adult}</option>
                  <option value="child">{text.child}</option>
                </NativeSelect>
              </LiveField>
            )}
          </>
        )}
      </Lines>
      <p className="help-form-note">
        {text.note}
      </p>
      <FormEnd error={error} pending={pending} submit={text.save} />
    </form>
  );
}

const typed = (lines: { label: string; amount: number }[]) =>
  lines.map((line) => ({ label: line.label, amount: (line.amount / 100).toString() }));

export function MoneyForm({
  target,
  money,
  onSaved,
}: {
  target: Target;
  money: NeighborRecord["money"];
  onSaved: () => void;
}) {
  const saveHousehold = useMutation(api.neighbors.saveHousehold);
  const { pending, error, save } = useSave();
  const text = useWorkspace().words.rooms.neighbors.money;
  const [income, setIncome] = useState(
    money ? typed(money.income) : [{ label: text.starts.wages, amount: "" }],
  );
  const [expenses, setExpenses] = useState(
    money
      ? typed(money.expenses)
      : [
          { label: text.starts.rent, amount: "" },
          { label: text.starts.electric, amount: "" },
          { label: text.starts.food, amount: "" },
        ],
  );
  const [amountError, setAmountError] = useState("");
  const read = (lines: typeof income) =>
    lines
      .filter((line) => line.label.trim() || line.amount.trim())
      .map((line) => ({ label: line.label, amount: cents(line.amount) }));
  const sum = (lines: typeof income) =>
    lines.reduce((all, line) => all + (cents(line.amount) ?? 0), 0);
  const left = sum(income) - sum(expenses);
  const rows = (line: (typeof income)[number], set: (next: Partial<typeof line>) => void) => (
    <>
      <LiveField label={text.what}>
        <Input
          value={line.label}
          required
          onChange={(event) => set({ label: event.target.value })}
        />
      </LiveField>
      <LiveField label={text.dollars}>
        <Input
          value={line.amount}
          inputMode="decimal"
          required
          onChange={(event) => set({ amount: event.target.value })}
        />
      </LiveField>
    </>
  );
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const [coming, going] = [read(income), read(expenses)];
        const whole = (lines: typeof coming) =>
          lines.flatMap((line) =>
            line.amount === null ? [] : [{ label: line.label, amount: line.amount }],
          );
        if (whole(coming).length < coming.length || whole(going).length < going.length)
          return setAmountError(text.amountNeeded);
        setAmountError("");
        const outcome = await save(() =>
          saveHousehold({
            ...target,
            money: { income: whole(coming), expenses: whole(going) },
          }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      <Lines
        legend={text.comingIn}
        shape="pair"
        lines={income}
        blank={{ label: "", amount: "" }}
        add={text.addIncome}
        remove={text.removeComingIn}
        onChange={setIncome}
      >
        {rows}
      </Lines>
      <Lines
        legend={text.goingOut}
        shape="pair"
        lines={expenses}
        blank={{ label: "", amount: "" }}
        add={text.addExpense}
        remove={text.removeGoingOut}
        onChange={setExpenses}
      >
        {rows}
      </Lines>
      <p className="help-form-note" aria-live="polite">
        {fill(text.sum.lead, { in: shortMoney(sum(income)), out: shortMoney(sum(expenses)) })}{" "}
        <strong>
          {fill(left < 0 ? text.sum.short : text.sum.left, { amount: shortMoney(Math.abs(left)) })}
        </strong>{" "}
        {text.sum.tail}
      </p>
      <FormEnd error={amountError || error} pending={pending} submit={text.save} />
    </form>
  );
}

/**
 * Opens with numbers covered, like the record: a line keeps the number it has unless a new one is
 * typed. "Show numbers" is the same audited door as on the record.
 */
export function AccountsForm({
  target,
  accounts,
  numbers,
  onShowNumbers,
  onSaved,
}: {
  target: Target;
  accounts: NeighborRecord["accounts"];
  numbers: Accounts | null;
  onShowNumbers: () => void;
  onSaved: () => void;
}) {
  const saveHousehold = useMutation(api.neighbors.saveHousehold);
  const { pending, error, save } = useSave();
  const text = useWorkspace().words.rooms.neighbors.accounts;
  type Line = { kind: keyof typeof accountKinds; name: string; phone: string; from?: number; typedNumber: string | null };
  const blank: Line = { kind: "utility", name: "", phone: "", typedNumber: "" };
  const [lines, setLines] = useState<Line[]>(
    accounts.length
      ? accounts.map((account, from) => ({ kind: account.kind, name: account.name, phone: account.phone, from, typedNumber: null }))
      : [{ ...blank, kind: "landlord" }],
  );
  const onFile = (line: Line) => (line.from === undefined ? undefined : accounts[line.from]);
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const outcome = await save(() =>
          saveHousehold({
            ...target,
            accounts: lines.map(({ from, typedNumber, ...line }) =>
              typedNumber === null ? { ...line, keep: from } : { ...line, accountNumber: typedNumber },
            ),
          }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      <Lines
        legend={text.legend}
        shape="four"
        lines={lines}
        blank={blank}
        add={text.add}
        remove={text.removeLine}
        onChange={setLines}
      >
        {(account, set) => (
          <>
            <LiveField label={text.kind}>
              <NativeSelect
                className="w-full"
                value={account.kind}
                onChange={(event) =>
                  set({
                    kind:
                      event.target.value === "landlord"
                        ? "landlord"
                        : event.target.value === "other"
                          ? "other"
                          : "utility",
                  })
                }
              >
                {kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {text.kinds[kind]}
                  </option>
                ))}
              </NativeSelect>
            </LiveField>
            <LiveField label={text.paid}>
              <Input
                value={account.name}
                required
                onChange={(event) => set({ name: event.target.value })}
              />
            </LiveField>
            <LiveField label={text.number}>
              <Input
                value={
                  account.typedNumber ??
                  (account.from === undefined ? "" : (numbers?.[account.from]?.accountNumber ?? ""))
                }
                placeholder={
                  !numbers && onFile(account)?.ending ? text.ending(onFile(account)?.ending ?? "") : undefined
                }
                autoComplete="off"
                onChange={(event) => set({ typedNumber: event.target.value })}
              />
            </LiveField>
            <LiveField label={text.phone}>
              <Input
                value={account.phone}
                type="tel"
                onChange={(event) => set({ phone: event.target.value })}
              />
            </LiveField>
          </>
        )}
      </Lines>
      <p className="help-form-note">
        {numbers
          ? text.looked
          : text.covered}
      </p>
      <FormEnd error={error} pending={pending} submit={text.save}>
        {!numbers && accounts.some((account) => account.ending) && (
          <Button
            type="button"
            variant="link"
            className="help-text-action"
            onClick={onShowNumbers}
          >
            {text.showNumbers}
          </Button>
        )}
      </FormEnd>
    </form>
  );
}

export function NoteForm({ target, onSaved }: { target: Target; onSaved: (noteId: Id<"neighborNotes">) => void }) {
  const addNote = useMutation(api.neighbors.addNote);
  const { pending, error, save } = useSave();
  const text = useWorkspace().words.rooms.neighbors.note;
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const body = String(new FormData(event.currentTarget).get("body") ?? "");
        const outcome = await save(() => addNote({ ...target, body }));
        if (outcome.saved) onSaved(outcome.result);
      }}
    >
      <LiveField label={text.label}>
        <Textarea name="body" rows={5} required autoFocus />
      </LiveField>
      <p className="help-form-note">
        {text.signed}
      </p>
      <FormEnd error={error} pending={pending} submit={text.save} />
    </form>
  );
}
