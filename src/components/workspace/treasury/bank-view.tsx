"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { CircleCheck } from "lucide-react";
import { HelpDone } from "@/components/workspace/help-line/room";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/context";
import { LedgerLoading } from "@/components/workspace/treasury/ledger-view";
import { readFailure } from "@/components/workspace/failure";
import { DateField } from "@/components/workspace/date-field";
import { CountUp, LiveField } from "@/components/workspace/primitives";
import { figureRoll, parseCents, formatCents, formatFigure } from "@/components/workspace/treasury/money";
import { formatDate, type Language } from "@/lib/words";
import { fill } from "@/lib/words/fill";
import {
  amountLine,
  categoryLabel,
  dayLabel,
  dayParts,
  weekDayLabel,
  type Bank,
  type BankEntry,
  type Statement,
  type TreasuryWords,
} from "@/components/workspace/treasury/labels";

/** "$214.60 to Demo Power & Light", the way a statement line reads. */
const line = (words: TreasuryWords, entry: BankEntry, typed?: (typed: string) => string) => amountLine(words, entry, formatFigure(entry.amount), typed);
const under = (words: TreasuryWords, entry: BankEntry, typed?: (typed: string) => string) =>
  [
    entry.checkNumber && words.lines.check(entry.checkNumber),
    entry.reverses ? words.lines.reversal : categoryLabel(words, entry.category, typed),
  ]
    .filter(Boolean)
    .join(" · ");

// The day a statement was matched is a moment, written in the reader's own time zone.
const stamp = (locale: Language, time: number) => formatDate(locale, time, { month: "short", day: "numeric" });

function DateLeaf({ day }: { day: string }) {
  const { words } = useWorkspace();
  const { month, date } = dayParts(words.locale, day);
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
}) {
  const { words, sampleSaid } = useWorkspace();
  const room = words.rooms.treasury;
  const w = room.bank;
  const day = (date: string) => dayLabel(words.locale, date);
  const [statement, setStatement] = useState("");
  // The balance is judged after a pause in typing or on leaving the field, never mid-number.
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(statement), 600);
    return () => clearTimeout(timer);
  }, [statement]);
  const typed = settled.trim();
  // A statement can end at zero, which the money reader does not take.
  const says = /^\$?0(\.0{1,2})?$/.test(typed) ? 0 : parseCents(typed);
  const gap = says === null ? null : says - bank.cleared;
  const onItsWay = bank.onItsWayIn - bank.onItsWayOut;
  // The first statement: nothing has been marked yet, so one step marks it all and the exceptions come after.
  const starting = !bank.lately.length && bank.waitingCount > 1;
  const [confirming, setConfirming] = useState(false);
  const agrees = gap === 0;
  const deposits = bank.deposits ?? [];
  const kept = statements?.some(
    (row) => row.endsOn === bank.asOf && row.balance === says,
  );

  return (
    <>
      <dl className="help-figures treasury-figures">
        <div>
          <dt>{w.figures.cleared}</dt>
          <dd>
            <CountUp value={bank.cleared} format={figureRoll(bank.cleared)} />
            <small>{w.figures.clearedDeck}</small>
          </dd>
        </div>
        <div>
          <dt>{w.figures.onItsWay}</dt>
          <dd>
            {onItsWay < 0 ? "− " : ""}
            <CountUp value={Math.abs(onItsWay)} format={figureRoll(Math.abs(onItsWay))} />
            <small>
              {bank.waitingCount
                ? fill(w.figures.inOut, { in: formatFigure(bank.onItsWayIn), out: formatFigure(bank.onItsWayOut) })
                : w.figures.nothing}
            </small>
          </dd>
        </div>
        <div>
          <dt>{w.figures.books}</dt>
          <dd>
            <CountUp value={bank.books} format={figureRoll(bank.books)} />
            <small>{w.figures.on(weekDayLabel(words.locale, bank.asOf))}</small>
          </dd>
        </div>
      </dl>

      <section
        className={agrees ? "help-sheet paper-fold" : "help-sheet paper-rest"}
        aria-labelledby="treasury-statement-title"
      >
        <p className="help-sheet-label">{w.statement.label}</p>
        <div className="help-sheet-body">
          <div aria-live="polite">
            {gap === null ? (
              <>
                <h2 id="treasury-statement-title">{w.statement.ask}</h2>
                <p>
                  {w.statement.askDeck}
                </p>
              </>
            ) : gap === 0 ? (
              <>
                <h2 id="treasury-statement-title" className="treasury-agree">
                  <CircleCheck size={26} aria-hidden="true" /> {w.statement.agree}
                </h2>
                <p className="help-why">
                  {w.statement.clearedBoth(formatFigure(bank.cleared))}{" "}
                  {w.statement.onTheWay(bank.waitingCount)}
                </p>
                {kept ? (
                  <p>{w.statement.saved(day(bank.asOf))}</p>
                ) : statements && says !== null ? (
                  <div className="help-actions treasury-keep">
                    <Button disabled={busy !== null} onClick={() => onKeep(says)}>
                      {busy === "keep" ? w.statement.keeping : w.statement.keep}
                    </Button>
                  </div>
                ) : (
                  <p>{w.statement.marksSaved(day(bank.asOf))}</p>
                )}
              </>
            ) : (
              <>
                <h2 id="treasury-statement-title" data-waiting>
                  {w.statement.offBy(formatFigure(Math.abs(gap)))}
                </h2>
                <p className="help-why">
                  {(gap > 0 ? w.statement.more : w.statement.less)(formatFigure(Math.abs(gap)))}
                </p>
                <p>
                  {w.statement.look}
                </p>
              </>
            )}
          </div>
          <div className="help-inline treasury-statement">
            <LiveField label={w.statement.ends}>
              <DateField
                name="asOf"
                max={bank.today}
                defaultValue={bank.asOf}
                onChange={(day) => {
                  setConfirming(false);
                  onAsOf(day);
                }}
              />
            </LiveField>
            <label>
              {w.statement.balance}
              <Input
                name="statement"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
                onBlur={() => setSettled(statement)}
              />
            </label>
          </div>
        </div>
      </section>

      {error && (
        <div className="live-error" role="alert">
          <p>{error}</p>
          <p className="live-error-recovery">{w.unchanged}</p>
        </div>
      )}
      {done && <HelpDone className="treasury-notice" focus={false}>{done}</HelpDone>}

      <section className="treasury-waiting treasury-uncleared" aria-labelledby="treasury-uncleared-title">
        <div className="live-section-head">
          <h2 id="treasury-uncleared-title">{w.waiting.title}</h2>
          {/* With nothing waiting the section says so itself, in words; no count of zero stands over it. */}
          {(bank.waitingCount > 0 || deposits.length > 0) && (
            <span className="live-count">
              {bank.waitingCount > bank.waiting.length + deposits.length
                ? fill(w.waiting.oldest, { shown: bank.waiting.length + deposits.length, count: bank.waitingCount })
                : w.entries(bank.waitingCount)}
            </span>
          )}
        </div>
        {bank.waiting.length || deposits.length ? (
          <>
            {starting && (
              <div className="treasury-starter">
                {confirming ? (
                  <>
                    <p role="status">
                      {fill(w.waiting.confirm(bank.waitingCount), { in: formatFigure(bank.onItsWayIn), out: formatFigure(bank.onItsWayOut), day: day(bank.asOf) })}
                    </p>
                    <div className="help-actions">
                      <Button
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => setConfirming(false)}
                      >
                        {room.cancel}
                      </Button>
                      <Button disabled={busy !== null} onClick={onClearAll}>
                        {busy === "all"
                          ? w.waiting.marking
                          : w.waiting.markAll(bank.waitingCount)}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      {w.waiting.first}
                    </p>
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => setConfirming(true)}
                    >
                      {w.waiting.everything(day(bank.asOf))}
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
                    <h3>{w.waiting.deposit(formatFigure(deposit.total))}</h3>
                    <p>
                      <span className="treasury-day">{day(deposit.date)} · </span>
                      {w.waiting.carried(deposit.count)}
                      {deposit.memo && ` · ${deposit.memo}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    aria-label={w.waiting.markLabel(w.waiting.deposit(formatFigure(deposit.total)))}
                    onClick={() => onClearDeposit(deposit)}
                  >
                    {busy === deposit.id ? w.waiting.marking : w.waiting.mark}
                  </Button>
                </div>
              ))}
              {bank.waiting.map((entry) => (
                <div className="help-row" key={entry.id}>
                  <DateLeaf day={entry.date} />
                  <div>
                    <h3>{line(room, entry, sampleSaid)}</h3>
                    <p>
                      <span className="treasury-day">{day(entry.date)} · </span>
                      {under(room, entry, sampleSaid)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    aria-label={w.waiting.markLabel(line(room, entry, sampleSaid))}
                    onClick={() => onClear(entry)}
                  >
                    {busy === entry.id ? w.waiting.marking : w.waiting.mark}
                  </Button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="help-empty">
            <div>
              <h3>{w.waiting.emptyTitle}</h3>
              <p>
                {w.waiting.emptyDeck(day(bank.asOf))}
              </p>
            </div>
          </div>
        )}
      </section>

      {bank.lately.length > 0 && (
        <section className="treasury-lately" aria-labelledby="treasury-lately-title">
          <div className="live-section-head">
            <h2 id="treasury-lately-title">{w.lately.title}</h2>
            <span className="live-count">{w.lately.newest(bank.lately.length)}</span>
          </div>
          <div className="live-list">
            {bank.lately.map((entry) => (
              <div className="help-row" data-quiet="" key={entry.id}>
                <DateLeaf day={entry.date} />
                <div>
                  <h3>{line(room, entry, sampleSaid)}</h3>
                  <p>
                    <span className="treasury-day">{day(entry.date)} · </span>
                    {under(room, entry, sampleSaid)}
                    {entry.clearedOn &&
                      ` · ${w.lately.onStatement(day(entry.clearedOn))}`}
                  </p>
                </div>
                <Button
                  variant="link"
                  className="treasury-take-back"
                  disabled={busy !== null}
                  aria-label={w.lately.undoLabel(line(room, entry, sampleSaid))}
                  onClick={() => onUndo(entry)}
                >
                  {w.lately.undo}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {statements && statements.length > 0 && (
        <section className="treasury-moves" aria-labelledby="treasury-statements-title">
          <div className="live-section-head">
            <h2 id="treasury-statements-title">{w.matched.title}</h2>
            <span className="live-count">{w.lately.newest(statements.length)}</span>
          </div>
          <ul className="treasury-lines">
            {statements.map((row) => (
              <li key={row.id}>
                <span>{day(row.endsOn)}</span>
                <span>{formatCents(row.balance)}</span>
                <span>
                  {fill(w.matched.by, { name: row.agreedBy, day: stamp(words.locale, row.agreedAt) })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}


/** Fetches the bank view and carries its three changes. */
export function BankRoom({
  churchId,
  onBack,
}: {
  churchId: Id<"churches">;
  onBack: () => void;
}) {
  const { setHeading, words, sampleSaid } = useWorkspace();
  const room = words.rooms.treasury;
  const w = room.bank;
  const day = (date: string) => dayLabel(words.locale, date);
  // The head's way back always runs the newest onBack without redrawing the head.
  const back = useRef(onBack);
  useEffect(() => {
    back.current = onBack;
  });
  const [asOf, setAsOf] = useState<string>();
  const bank = useQuery(api.treasury.reconciliation, { churchId, asOf });
  // Asked for in a way that cannot fail the screen if the backend does not have it yet.
  const asked = useMemo(() => ({ kept: { query: api.treasury.statements, args: { churchId } } }), [churchId]);
  const { kept } = useQueries(asked);
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
      title: w.title,
      deck: w.deck,
      back: { label: room.ledgerName, run: () => back.current() },
    });
    return () => setHeading(null);
  }, [setHeading, w.title, w.deck, room.ledgerName]);

  if (!shown) return <LedgerLoading />;

  async function change(key: string, run: () => Promise<string>) {
    setBusy(key);
    setError("");
    setDone("");
    try {
      setDone(await run());
    } catch (cause) {
      setError(readFailure(cause));
    }
    setBusy(null);
  }

  return (
    <BankView
      bank={shown}
      busy={busy}
      done={done}
      error={error}
      onAsOf={setAsOf}
      statements={kept instanceof Error ? undefined : kept}
      onKeep={(balance) =>
        change("keep", async () => {
          await agreeStatement({ churchId, endsOn: shown.asOf, balance });
          return fill(w.done.kept, { day: day(shown.asOf), amount: formatFigure(balance) });
        })
      }
      onClearDeposit={(deposit) =>
        change(deposit.id, async () => {
          await clearDeposit({
            churchId,
            depositId: deposit.id,
            clearedOn: shown.asOf,
          });
          return w.done.deposit(formatFigure(deposit.total));
        })
      }
      onClear={(entry) =>
        change(entry.id, async () => {
          await setCleared({ churchId, entryId: entry.id, clearedOn: shown.asOf });
          return w.done.cleared(line(room, entry, sampleSaid));
        })
      }
      onUndo={(entry) =>
        change(entry.id, async () => {
          await setCleared({ churchId, entryId: entry.id, clearedOn: null });
          return w.done.undone(line(room, entry, sampleSaid));
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
          return fill(w.done.through(marked), { day: day(shown.asOf) });
        })
      }
    />
  );
}
