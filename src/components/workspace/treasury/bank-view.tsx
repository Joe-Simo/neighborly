"use client";

import { useLayoutEffect, useState } from "react";
import { useMutation, useQueries, useQuery } from "convex/react";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/context";
import { LedgerLoading } from "@/components/workspace/treasury/ledger-view";
import { CountUp } from "@/components/workspace/primitives";
import {
  centsRoll,
  figureRoll,
  formatCents,
  parseCents,
} from "@/components/workspace/treasury/money";
import {
  categoryLabel,
  dayLabel,
  weekDayLabel,
  type Bank,
  type BankEntry,
  type Statement,
} from "@/components/workspace/treasury/labels";

const count = (n: number) => `${n} ${n === 1 ? "entry" : "entries"}`;
const art = { backgroundImage: "url(/assets/painted-world/meal.webp)" };
/** "$214.60 to Demo Power & Light", the way a statement line reads. */
const line = (entry: BankEntry) =>
  `${formatCents(entry.amount)} ${entry.kind === "income" ? "from" : "to"} ${entry.payee}`;
const under = (entry: BankEntry) =>
  [
    entry.checkNumber && `Check ${entry.checkNumber}`,
    entry.reverses ? "Reversal" : categoryLabel(entry.category),
  ]
    .filter(Boolean)
    .join(" · ");

const stamp = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

function DateLeaf({ day }: { day: string }) {
  const [month, date] = dayLabel(day).split(" ");
  return (
    <div className="live-date-leaf">
      <span>{month}</span>
      <strong>{date}</strong>
    </div>
  );
}

/** The statement beside the ledger: what has cleared, what is still on its way, and whether the two agree. */
export function BankView({
  bank,
  busy,
  done,
  error,
  onAsOf,
  onClear,
  onUndo,
  onClearAll,
  onBack,
  statements,
  onKeep,
  onClearDeposit,
}: {
  /** Statements kept so far; undefined until the backend offers them, and then none can be kept. */
  statements?: Statement[];
  onKeep: (balance: number) => void;
  onClearDeposit: (deposit: Bank["deposits"][number]) => void;
  bank: Bank;
  /** The entry being changed, or "all". */
  busy: string | null;
  done: string;
  error: string;
  onAsOf: (day: string) => void;
  onClear: (entry: BankEntry) => void;
  onUndo: (entry: BankEntry) => void;
  onClearAll: () => void;
  onBack: () => void;
}) {
  const [statement, setStatement] = useState("");
  const typed = statement.trim();
  // A statement can end at zero, which the money reader does not take.
  const says = /^\$?0(\.0{1,2})?$/.test(typed) ? 0 : parseCents(typed);
  const gap = says === null ? null : says - bank.cleared;
  const onItsWay = bank.onItsWayIn - bank.onItsWayOut;
  // The first statement: nothing has been marked yet, so one step marks it all and the exceptions come after.
  const starting = !bank.lately.length && bank.waitingCount > 1;
  const [confirming, setConfirming] = useState(false);
  const [lateDay, setLateDay] = useState(false);
  const agrees = gap === 0;
  const deposits = bank.deposits ?? [];
  const kept = statements?.some(
    (row) => row.endsOn === bank.asOf && row.balance === says,
  );

  return (
    <>
      <Button variant="link" className="treasury-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Ledger
      </Button>
      <dl className="help-figures treasury-figures">
        <div>
          <dt>Cleared the bank</dt>
          <dd>
            <CountUp value={bank.cleared} format={centsRoll} />
            <small>Your statement should say the same</small>
          </dd>
        </div>
        <div>
          <dt>Still on its way</dt>
          <dd>
            {onItsWay < 0 ? "− " : ""}
            <CountUp value={Math.abs(onItsWay)} format={figureRoll(Math.abs(onItsWay))} />
            <small>
              {bank.waitingCount
                ? `${formatCents(bank.onItsWayIn)} in, ${formatCents(bank.onItsWayOut)} out`
                : "Nothing is waiting"}
            </small>
          </dd>
        </div>
        <div>
          <dt>In the ledger</dt>
          <dd>
            <CountUp value={bank.books} format={figureRoll(bank.books)} />
            <small>On {weekDayLabel(bank.asOf)}</small>
          </dd>
        </div>
      </dl>

      <section
        className={agrees ? "help-sheet paper-fold" : "help-sheet"}
        aria-labelledby="treasury-statement-title"
      >
        <p className="help-sheet-label">Your bank statement</p>
        <div className="help-sheet-body">
          <div aria-live="polite">
            {gap === null ? (
              <>
                <h2 id="treasury-statement-title">What does the statement say?</h2>
                <p>
                  Enter the day it ends and its ending balance. It should equal
                  what has cleared here.
                </p>
              </>
            ) : gap === 0 ? (
              <>
                <h2 id="treasury-statement-title" className="treasury-agree">
                  <CircleCheck size={26} aria-hidden="true" /> The statement and
                  the ledger agree.
                </h2>
                <p className="help-why">
                  {formatCents(bank.cleared)} has cleared on both.{" "}
                  {bank.waitingCount
                    ? `${count(bank.waitingCount)} still on the way.`
                    : "Nothing is waiting."}
                </p>
                {kept ? (
                  <p>Saved for the {dayLabel(bank.asOf)} statement.</p>
                ) : statements && says !== null ? (
                  <div className="help-actions treasury-keep">
                    <Button disabled={busy !== null} onClick={() => onKeep(says)}>
                      {busy === "keep" ? "Keeping…" : "Keep this statement"}
                    </Button>
                  </div>
                ) : (
                  <p>Your marks are saved for the {dayLabel(bank.asOf)} statement.</p>
                )}
              </>
            ) : (
              <>
                <h2 id="treasury-statement-title" data-waiting>
                  Off by {formatCents(Math.abs(gap))}.
                </h2>
                <p className="help-why">
                  The statement shows {formatCents(Math.abs(gap))}{" "}
                  {gap > 0 ? "more" : "less"} than what has cleared here.
                </p>
                <p>
                  Mark each entry below that the statement lists. If they are
                  all marked, look for a bank fee or a deposit that is not in
                  the ledger yet.
                </p>
              </>
            )}
          </div>
          <div className="help-inline treasury-statement">
            <label>
              Statement ends
              <Input
                type="date"
                name="asOf"
                max={bank.today}
                defaultValue={bank.asOf}
                aria-invalid={lateDay || undefined}
                aria-describedby={lateDay ? "treasury-late-day" : undefined}
                onChange={(event) => {
                  const day = event.target.value;
                  setLateDay(day > bank.today);
                  setConfirming(false);
                  if (day && day <= bank.today) onAsOf(day);
                }}
              />
              {lateDay && (
                <small id="treasury-late-day" role="alert">
                  Choose today or an earlier day.
                </small>
              )}
            </label>
            <label>
              Ending balance
              <Input
                name="statement"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
              />
            </label>
          </div>
        </div>
      </section>

      {error && (
        <div className="live-error" role="alert">
          <p>{error}</p>
          <p className="live-error-recovery">Nothing was changed.</p>
        </div>
      )}
      {done && (
        <div className="live-success help-done treasury-notice" role="status">
          <CircleCheck size={22} aria-hidden="true" />
          <span>{done}</span>
        </div>
      )}

      <section className="treasury-waiting treasury-uncleared" aria-labelledby="treasury-uncleared-title">
        <div className="live-section-head">
          <h2 id="treasury-uncleared-title">Not cleared yet</h2>
          <span className="live-count">
            {bank.waitingCount > bank.waiting.length + deposits.length
              ? `The oldest ${bank.waiting.length + deposits.length} of ${bank.waitingCount}`
              : count(bank.waitingCount)}
          </span>
        </div>
        {bank.waiting.length || deposits.length ? (
          <>
            {starting && (
              <div className="treasury-starter">
                {confirming ? (
                  <>
                    <p role="status">
                      Mark {count(bank.waitingCount)} cleared:{" "}
                      {formatCents(bank.onItsWayIn)} in and{" "}
                      {formatCents(bank.onItsWayOut)} out, through{" "}
                      {dayLabel(bank.asOf)}. You can take any of them back
                      after.
                    </p>
                    <div className="help-actions">
                      <Button
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => setConfirming(false)}
                      >
                        Cancel
                      </Button>
                      <Button disabled={busy !== null} onClick={onClearAll}>
                        {busy === "all"
                          ? "Marking…"
                          : `Mark ${count(bank.waitingCount)} cleared`}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      Your first statement? Start with everything, then take
                      back the few the bank has not shown.
                    </p>
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => setConfirming(true)}
                    >
                      Everything through {dayLabel(bank.asOf)} has cleared
                    </Button>
                  </>
                )}
              </div>
            )}
            <div className="live-list">
              {deposits.map((deposit) => (
                <div className="help-row" key={deposit.id}>
                  <DateLeaf day={deposit.date} />
                  <div>
                    <h3>{formatCents(deposit.total)} deposit</h3>
                    <p>
                      <span className="treasury-day">{dayLabel(deposit.date)} · </span>
                      {deposit.count} {deposit.count === 1 ? "gift" : "gifts"} carried
                      to the bank together
                      {deposit.memo && ` · ${deposit.memo}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    aria-label={`Mark cleared: ${formatCents(deposit.total)} deposit`}
                    onClick={() => onClearDeposit(deposit)}
                  >
                    {busy === deposit.id ? "Marking…" : "Mark cleared"}
                  </Button>
                </div>
              ))}
              {bank.waiting.map((entry) => (
                <div className="help-row" key={entry.id}>
                  <DateLeaf day={entry.date} />
                  <div>
                    <h3>{line(entry)}</h3>
                    <p>
                      <span className="treasury-day">{dayLabel(entry.date)} · </span>
                      {under(entry)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    aria-label={`Mark cleared: ${line(entry)}`}
                    onClick={() => onClear(entry)}
                  >
                    {busy === entry.id ? "Marking…" : "Mark cleared"}
                  </Button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="help-empty">
            <div className="help-empty-art" style={art} aria-hidden="true" />
            <div>
              <h3>Everything has cleared.</h3>
              <p>
                Every entry through {dayLabel(bank.asOf)} is marked against a
                statement. New entries will wait here until the bank shows
                them.
              </p>
            </div>
          </div>
        )}
      </section>

      {bank.lately.length > 0 && (
        <section className="treasury-lately" aria-labelledby="treasury-lately-title">
          <div className="live-section-head">
            <h2 id="treasury-lately-title">Cleared lately</h2>
            <span className="live-count">The newest {bank.lately.length}</span>
          </div>
          <div className="live-list">
            {bank.lately.map((entry) => (
              <div className="help-row" data-quiet="" key={entry.id}>
                <DateLeaf day={entry.date} />
                <div>
                  <h3>{line(entry)}</h3>
                  <p>
                    <span className="treasury-day">{dayLabel(entry.date)} · </span>
                    {under(entry)}
                    {entry.clearedOn &&
                      ` · On the ${dayLabel(entry.clearedOn)} statement`}
                  </p>
                </div>
                <Button
                  variant="link"
                  className="treasury-take-back"
                  disabled={busy !== null}
                  aria-label={`Take it back: ${line(entry)}`}
                  onClick={() => onUndo(entry)}
                >
                  Take it back
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {statements && statements.length > 0 && (
        <section className="treasury-moves" aria-labelledby="treasury-statements-title">
          <div className="live-section-head">
            <h2 id="treasury-statements-title">Statements matched</h2>
            <span className="live-count">The newest {statements.length}</span>
          </div>
          <ul className="treasury-lines">
            {statements.map((row) => (
              <li key={row.id}>
                <span>{dayLabel(row.endsOn)}</span>
                <span>{formatCents(row.balance)}</span>
                <span>
                  Matched by {row.agreedBy} on {stamp.format(row.agreedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

const reason = (cause: unknown) =>
  cause instanceof Error
    ? cause.message.replace(/^.*?Uncaught Error:\s*/, "").split("\n")[0]
    : "That couldn’t be saved. Please try again.";

/** Fetches the bank view and carries its three changes. */
export function BankRoom({
  churchId,
  onBack,
}: {
  churchId: Id<"churches">;
  onBack: () => void;
}) {
  const { setHeading } = useWorkspace();
  const [asOf, setAsOf] = useState<string>();
  const bank = useQuery(api.treasury.reconciliation, { churchId, asOf });
  // Asked for in a way that cannot fail the screen if the backend does not have it yet.
  const { kept } = useQueries({
    kept: { query: api.treasury.statements, args: { churchId } },
  });
  const agreeStatement = useMutation(api.treasury.agreeStatement);
  const clearDeposit = useMutation(api.treasury.clearDeposit);
  const setCleared = useMutation(api.treasury.setCleared);
  const clearThrough = useMutation(api.treasury.clearThrough);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  // The day last shown stays on screen while another statement day loads.
  const [shown, setShown] = useState(bank);
  if (bank && bank !== shown) setShown(bank);
  useLayoutEffect(() => {
    setHeading({
      title: "Match the bank",
      deck: "Mark each entry your statement shows. What is left is still on its way.",
    });
    return () => setHeading(null);
  }, [setHeading]);

  if (!shown) return <LedgerLoading />;

  async function change(key: string, run: () => Promise<string>) {
    setBusy(key);
    setError("");
    setDone("");
    try {
      setDone(await run());
    } catch (cause) {
      setError(reason(cause));
    }
    setBusy(null);
  }

  return (
    <BankView
      bank={shown}
      busy={busy}
      done={done}
      error={error}
      onBack={onBack}
      onAsOf={setAsOf}
      statements={kept instanceof Error ? undefined : kept}
      onKeep={(balance) =>
        change("keep", async () => {
          await agreeStatement({ churchId, endsOn: shown.asOf, balance });
          return `The ${dayLabel(shown.asOf)} statement is kept at ${formatCents(balance)}.`;
        })
      }
      onClearDeposit={(deposit) =>
        change(deposit.id, async () => {
          await clearDeposit({
            churchId,
            depositId: deposit.id,
            clearedOn: shown.asOf,
          });
          return `The ${formatCents(deposit.total)} deposit is marked cleared.`;
        })
      }
      onClear={(entry) =>
        change(entry.id, async () => {
          await setCleared({ churchId, entryId: entry.id, clearedOn: shown.asOf });
          return `${line(entry)} is marked cleared.`;
        })
      }
      onUndo={(entry) =>
        change(entry.id, async () => {
          await setCleared({ churchId, entryId: entry.id, clearedOn: null });
          return `${line(entry)} is back with the entries not cleared yet.`;
        })
      }
      onClearAll={() =>
        change("all", async () => {
          let marked = 0;
          for (;;) {
            const step = await clearThrough({ churchId, through: shown.asOf });
            marked += step.marked;
            if (!step.more) break;
          }
          return `${count(marked)} through ${dayLabel(shown.asOf)} marked cleared.`;
        })
      }
    />
  );
}
