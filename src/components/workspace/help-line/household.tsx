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
import type { Workspace } from "@/components/workspace/context";
import { LiveField } from "@/components/workspace/primitives";
import { FormEnd } from "@/components/workspace/help-line/forms";
import {
  accountKinds,
  cents,
  householdDetail,
  livesHere,
  shortMoney,
  total,
  type NeighborRecord,
} from "@/components/workspace/help-line/format";
import { useSave } from "@/components/workspace/help-line/use-save";

type Target = { churchId: Id<"churches">; neighborId: Id<"neighbors"> };
export type HomeStep = "people" | "money" | "accounts";
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
  const { household, money, accounts } = record;
  const change = (step: HomeStep, empty: boolean, add: string) => (
    <Button
      type="button"
      variant="link"
      className="help-text-action"
      onClick={() => onStep(step)}
    >
      {empty ? add : "Change"}
    </Button>
  );
  const left = money ? total(money.income) - total(money.expenses) : 0;
  return (
    <section className="live-section" aria-labelledby="at-home-title">
      <div className="live-section-head">
        <h2 id="at-home-title">At home</h2>
      </div>
      <dl className="help-home">
        <div>
          <dt>Lives here</dt>
          <dd>
            {household.length
              ? livesHere(household)
              : householdDetail(record.neighbor.adults, record.neighbor.children)}
          </dd>
          {change("people", !household.length, "Say who lives here")}
        </div>
        <div>
          <dt>Each month</dt>
          {money ? (
            <dd>
              {shortMoney(total(money.income))} in, {shortMoney(total(money.expenses))} out
              <small data-short={left < 0 ? "" : undefined}>
                {left < 0
                  ? `${shortMoney(-left)} short`
                  : `${shortMoney(left)} left over`}
                , as of {format(money.updatedAt, { weekday: undefined, year: "numeric" })}
              </small>
            </dd>
          ) : (
            <dd>Not written down yet.</dd>
          )}
          {change("money", !money, "Add income and expenses")}
        </div>
        <div>
          <dt>Accounts</dt>
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
                          : `ending ${account.ending}`}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </dd>
          ) : (
            <dd>None on file.</dd>
          )}
          <span className="help-home-actions">
            {change("accounts", !accounts.length, "Add an account")}
            {!numbers && accounts.some((account) => account.ending) && (
              <Button
                type="button"
                variant="link"
                className="help-text-action"
                onClick={onShowNumbers}
              >
                Show numbers
              </Button>
            )}
          </span>
          {numbers && (
            <p className="help-noted" role="status">
              Noted on the record that you looked.
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
  onChange,
  children,
}: {
  legend: string;
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
            aria-label={`Remove line ${index + 1} of ${legend.toLowerCase()}`}
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
        legend="People"
        shape="three"
        lines={people}
        blank={{ relationship: "", child: true, born: "" }}
        add="Add a person"
        onChange={setPeople}
      >
        {(person, set, index) => (
          <>
            <LiveField label="Who">
              <Input
                value={person.relationship}
                placeholder={index ? "Son" : "Mother"}
                required
                onChange={(event) => set({ relationship: event.target.value })}
              />
            </LiveField>
            <LiveField label="Born">
              <Input
                value={person.born}
                inputMode="numeric"
                pattern="\d{4}"
                placeholder="Year"
                onChange={(event) => set({ born: event.target.value })}
              />
            </LiveField>
            {person.born.trim() ? (
              <span />
            ) : (
              <LiveField label="Adult or child">
                <NativeSelect
                  className="w-full"
                  value={person.child ? "child" : "adult"}
                  onChange={(event) => set({ child: event.target.value === "child" })}
                >
                  <option value="adult">Adult</option>
                  <option value="child">Child</option>
                </NativeSelect>
              </LiveField>
            )}
          </>
        )}
      </Lines>
      <p className="help-form-note">
        No names are kept for the rest of the household, and a birth year is enough to know an age.
      </p>
      <FormEnd error={error} pending={pending} submit="Save household" />
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
  const [income, setIncome] = useState(
    money ? typed(money.income) : [{ label: "Wages", amount: "" }],
  );
  const [expenses, setExpenses] = useState(
    money
      ? typed(money.expenses)
      : [
          { label: "Rent", amount: "" },
          { label: "Electric", amount: "" },
          { label: "Food", amount: "" },
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
      <LiveField label="What">
        <Input
          value={line.label}
          required
          onChange={(event) => set({ label: event.target.value })}
        />
      </LiveField>
      <LiveField label="Dollars a month">
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
          return setAmountError("Enter each amount in dollars, such as 450.");
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
        legend="Coming in"
        shape="pair"
        lines={income}
        blank={{ label: "", amount: "" }}
        add="Add income"
        onChange={setIncome}
      >
        {rows}
      </Lines>
      <Lines
        legend="Going out"
        shape="pair"
        lines={expenses}
        blank={{ label: "", amount: "" }}
        add="Add an expense"
        onChange={setExpenses}
      >
        {rows}
      </Lines>
      <p className="help-form-note" aria-live="polite">
        {shortMoney(sum(income))} in, {shortMoney(sum(expenses))} out:{" "}
        <strong>
          {left < 0 ? `${shortMoney(-left)} short` : `${shortMoney(left)} left over`}
        </strong>{" "}
        each month.
      </p>
      <FormEnd error={amountError || error} pending={pending} submit="Save the month" />
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
        legend="Accounts"
        shape="four"
        lines={lines}
        blank={blank}
        add="Add an account"
        onChange={setLines}
      >
        {(account, set) => (
          <>
            <LiveField label="Kind">
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
                {Object.entries(accountKinds).map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </NativeSelect>
            </LiveField>
            <LiveField label="Who is paid">
              <Input
                value={account.name}
                required
                onChange={(event) => set({ name: event.target.value })}
              />
            </LiveField>
            <LiveField label="Account number">
              <Input
                value={
                  account.typedNumber ??
                  (account.from === undefined ? "" : (numbers?.[account.from]?.accountNumber ?? ""))
                }
                placeholder={
                  !numbers && onFile(account)?.ending ? `Ending ${onFile(account)?.ending}` : undefined
                }
                autoComplete="off"
                onChange={(event) => set({ typedNumber: event.target.value })}
              />
            </LiveField>
            <LiveField label="Their phone">
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
          ? "Noted on the record that you looked."
          : "Numbers on file stay covered and are kept as they are unless you type a new one."}
      </p>
      <FormEnd error={error} pending={pending} submit="Save accounts">
        {!numbers && accounts.some((account) => account.ending) && (
          <Button
            type="button"
            variant="link"
            className="help-text-action"
            onClick={onShowNumbers}
          >
            Show numbers
          </Button>
        )}
      </FormEnd>
    </form>
  );
}

export function NoteForm({ target, onSaved }: { target: Target; onSaved: () => void }) {
  const addNote = useMutation(api.neighbors.addNote);
  const { pending, error, save } = useSave();
  return (
    <form
      className="live-form help-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const body = String(new FormData(event.currentTarget).get("body") ?? "");
        const outcome = await save(() => addNote({ ...target, body }));
        if (outcome.saved) onSaved();
      }}
    >
      <LiveField label="Note">
        <Textarea name="body" rows={5} required autoFocus />
      </LiveField>
      <p className="help-form-note">
        It is signed with your name and today’s date, and it cannot be changed afterwards.
      </p>
      <FormEnd error={error} pending={pending} submit="Add note" />
    </form>
  );
}
