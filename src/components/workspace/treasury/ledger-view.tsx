"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { CountUp, LiveLoading } from "@/components/workspace/primitives";
import { openUp, useGrowsSmoothly } from "@/components/workspace/fold";
import { LiveState } from "@/components/workspace/states";
import { sentence } from "@/lib/utils";
import { figureRoll, formatCents, formatFigure } from "@/components/workspace/treasury/money";
import {
  categoryLabel,
  dayLabel,
  entryLines,
  monthLabel,
  TWINNING_GIFT,
  weekDayLabel,
  type Ledger,
  type LedgerEntry,
  type Payable,
} from "@/components/workspace/treasury/labels";
import type { Paid } from "@/components/workspace/treasury/paid-moment";
import "./treasury.css";

const neighborHref = (id: string) =>
  `/app/neighbors?neighbor=${encodeURIComponent(id)}`;
const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;
const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
const art = { backgroundImage: "url(/assets/painted-world/meal.webp)" };

function NeighborLink({ id, name }: { id: string; name: string }) {
  return (
    <Link className="live-link" href={neighborHref(id)}>
      {name}
    </Link>
  );
}

/** A ledger nobody has written in yet. */
export const isUntouched = (ledger: Ledger) =>
  ledger.months.length === 1 && !ledger.entries.length;

export function LedgerView({
  ledger,
  payable,
  onMonth,
  onPay,
  onRecord,
  onEntry,
  uncleared,
  onBank,
  onHand,
  onDeposit,
  shelf,
  onShelf,
  paid,
  landed,
  paying,
}: {
  ledger: Ledger;
  payable: Payable[];
  onMonth: (month: string) => void;
  onPay: (request: Payable) => void;
  onRecord: () => void;
  onEntry: (entry: LedgerEntry) => void;
  /** How many entries the bank has not shown yet; undefined while that is loading. */
  uncleared?: number;
  onBank: () => void;
  /** Gifts on hand that are in no deposit yet; undefined until the backend answers. */
  onHand?: { count: number; total: number };
  onDeposit: () => void;
  /** Vouchers on hand across every kind; undefined until the backend answers. */
  shelf?: number;
  onShelf: () => void;
  /** The request a payment was just recorded for. Its sheet stays a moment, corner folded, before the next one rises. */
  paid?: Paid | null;
  /** The entry a paid sheet has just settled into; its row holds a highlight for a moment. */
  landed?: string | null;
  /** The request whose payment is being sent; its sheet holds its place until the answer comes. */
  paying?: Payable | null;
}) {
  // A new row lands in the ledger by growing into it; the request after a paid one opens its own room, once.
  const table = useRef<HTMLDivElement>(null);
  useGrowsSmoothly(table);
  const risen = useRef<string>(undefined);
  const rise = (sheet: HTMLElement | null) => {
    if (!sheet || risen.current === sheet.dataset.request) return;
    risen.current = sheet.dataset.request;
    openUp(sheet);
  };
  const month = monthLabel(ledger.month, ledger.today);
  const position = ledger.months.indexOf(ledger.month);
  // Months are listed newest first.
  const earlier = ledger.months[position + 1];
  const later = position > 0 ? ledger.months[position - 1] : undefined;
  const gifts = ledger.entries.filter(
    (entry) =>
      entry.category === TWINNING_GIFT && !entry.reverses && !entry.reversed,
  ).length;
  const other = ledger.entries.filter(
    (entry) =>
      entry.kind === "expense" &&
      !entry.neighbor &&
      entry.category !== TWINNING_GIFT &&
      !entry.reverses &&
      !entry.reversed,
  ).length;
  const paidFor = [
    ledger.neighborsHelped > 0 &&
      count(ledger.neighborsHelped, "neighbor", "neighbors"),
    gifts > 0 && count(gifts, "twinning gift", "twinning gifts"),
    other > 0 && count(other, "other payment", "other payments"),
  ].filter(Boolean);
  // The sheet stays on the request being paid, then on the paid one, whatever the list says meanwhile.
  const kept = paid?.request ?? paying;
  const others = kept
    ? payable.filter((row) => row.requestId !== kept.requestId)
    : payable;
  const [first, ...waiting] = kept ? [kept, ...others] : others;
  const left = paid ? paid.request.remaining - paid.amount : 0;
  const untouched = isUntouched(ledger) && !payable.length;

  if (untouched)
    return (
      <div className="help-empty" data-first>
        <div className="help-empty-art" style={art} aria-hidden="true" />
        <div>
          <h3>Start with what you have.</h3>
          <p>
            Record the balance your conference holds today. Every gift and
            every payment after it will add up from there.
          </p>
          <Button onClick={onRecord}>
            <Plus size={18} aria-hidden="true" /> Record the opening balance
          </Button>
        </div>
      </div>
    );

  return (
    <>
      <dl className="help-figures treasury-figures">
        <div>
          <dt>Balance today</dt>
          <dd>
            <CountUp value={ledger.balance} format={figureRoll(ledger.balance)} />
            <small>As of {weekDayLabel(ledger.today)}</small>
          </dd>
        </div>
        <div>
          <dt>In, {month}</dt>
          <dd>
            <CountUp value={ledger.moneyIn} format={figureRoll(ledger.moneyIn)} />
            <small>
              {ledger.incomeSources.join(", ") || "Nothing received yet"}
            </small>
          </dd>
        </div>
        <div>
          <dt>Out, {month}</dt>
          <dd>
            <CountUp value={ledger.moneyOut} format={figureRoll(ledger.moneyOut)} />
            <small>{paidFor.join(", ") || "Nothing paid yet"}</small>
          </dd>
        </div>
      </dl>

      {first && (
        <section
          key={first.requestId}
          ref={landed && !paid ? rise : undefined}
          data-request={first.requestId}
          className={paid ? "help-sheet treasury-sheet paper-fold" : "help-sheet treasury-sheet"}
          data-fold-leaves={paid ? "" : undefined}
          aria-labelledby="treasury-waiting-title"
        >
          <p className="help-sheet-label" data-paid={paid ? "" : undefined}>
            {paid ? "Paid" : "Approved, waiting to be paid"}
          </p>
          <div className="help-sheet-body">
            <div>
              <h2 id="treasury-waiting-title">
                {categoryLabel(first.kind)}, {formatFigure(first.remaining)} to{" "}
                {first.payeeName}
              </h2>
              <p className="help-why">
                For <NeighborLink id={first.neighborId} name={first.neighborName} />
                . {sentence(first.summary)}
              </p>
              {paid ? (
                <p>
                  {formatFigure(paid.amount)} is in the ledger.{" "}
                  {left > 0
                    ? `${formatFigure(left)} of the approved amount is still to pay.`
                    : "This request is paid in full."}
                </p>
              ) : (
                <p>
                  {first.paid > 0
                    ? `${formatFigure(first.paid)} of the ${formatFigure(first.amountApproved)} approved is already paid. `
                    : ""}
                  The payment goes to {first.payeeName}, never to the neighbor.
                </p>
              )}
            </div>
            {!paid && (
              <div className="help-actions">
                <Button onClick={() => onPay(first)}>Record payment</Button>
              </div>
            )}
          </div>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="treasury-waiting" aria-labelledby="treasury-also-title">
          <div className="live-section-head">
            <h2 id="treasury-also-title">Also waiting</h2>
            <span className="live-count">
              {count(waiting.length, "request", "requests")},{" "}
              {formatFigure(waiting.reduce((sum, row) => sum + row.remaining, 0))}
            </span>
          </div>
          <div className="live-list">
            {waiting.map((request) => (
              <div className="help-row" key={request.requestId}>
                <div className="help-avatar" aria-hidden="true">
                  {initials(request.neighborName)}
                </div>
                <div>
                  <h3>
                    {formatFigure(request.remaining)} to {request.payeeName}
                  </h3>
                  <p>
                    {categoryLabel(request.kind)} for{" "}
                    <NeighborLink
                      id={request.neighborId}
                      name={request.neighborName}
                    />
                    . {request.summary}
                    {request.paid > 0 &&
                      `. ${formatFigure(request.paid)} already paid`}
                  </p>
                </div>
                <Button variant="outline" onClick={() => onPay(request)}>
                  Record payment
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="live-section-head">
        <div className="treasury-month">
          <h2 aria-live="polite">{month}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Earlier month"
            disabled={!earlier}
            onClick={() => earlier && onMonth(earlier)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Later month"
            disabled={!later}
            onClick={() => later && onMonth(later)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <span className="live-count">Every payment for a neighbor is tied to a request</span>
      </div>
      {ledger.entries.length ? (
        <div className="live-table-scroll" ref={table}>
          <table className="help-ledger">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">What</th>
                <th scope="col">For</th>
                <th scope="col" className="help-money">In</th>
                <th scope="col" className="help-money">Out</th>
                <th scope="col" className="help-money">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.entries.map((entry) => {
                const { title, detail } = entryLines(entry);
                return (
                  <tr
                    key={entry.id}
                    data-reversed={entry.reversed ? "" : undefined}
                    data-quiet={entry.reverses ? "" : undefined}
                    data-landed={entry.id === landed ? "" : undefined}
                  >
                    <td>{dayLabel(entry.date)}</td>
                    <td className="help-what">
                      <Button variant="ghost" onClick={() => onEntry(entry)}>
                        {title}
                      </Button>
                      <small>
                        {entry.reversed ? `Reversed · ${detail}` : detail}
                      </small>
                    </td>
                    <td data-for>
                      {entry.neighbor && (
                        <NeighborLink
                          id={entry.neighbor.id}
                          name={entry.neighbor.name}
                        />
                      )}
                    </td>
                    <td className="help-money" data-in>
                      {entry.kind === "income" &&
                        `+ ${formatCents(entry.amount)}`}
                    </td>
                    <td className="help-money">
                      {entry.kind === "expense" && formatCents(entry.amount)}
                    </td>
                    <td className="help-money" data-balance>
                      {formatCents(entry.balance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td />
                <td>
                  {ledger.month === ledger.today.slice(0, 7)
                    ? `${month} so far`
                    : month}
                </td>
                <td />
                <td className="help-money" data-in>
                  + {formatCents(ledger.moneyIn)}
                </td>
                <td className="help-money">{formatCents(ledger.moneyOut)}</td>
                <td className="help-money" data-total>
                  <span>Balance </span>
                  {formatCents(ledger.opening + ledger.moneyIn - ledger.moneyOut)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="help-empty">
          <div className="help-empty-art" style={art} aria-hidden="true" />
          <div>
            <h3>A quiet month so far.</h3>
            <p>
              Nothing is recorded in {month} yet. {formatFigure(ledger.opening)}{" "}
              was carried in.
            </p>
          </div>
        </div>
      )}

      {(uncleared !== undefined || onHand || shelf !== undefined) && (
        <section className="treasury-foot" aria-label="More of the treasury">
          {onHand && onHand.count > 0 && (
            <div>
              <div>
                <h2>
                  {count(onHand.count, "gift is", "gifts are")} not deposited
                  yet
                </h2>
                <p>
                  {formatFigure(onHand.total)} on hand. Record the trip to the
                  bank as one deposit, the way the statement will show it.
                </p>
              </div>
              <Button variant="outline" onClick={onDeposit}>
                Record a deposit
              </Button>
            </div>
          )}
          {uncleared !== undefined && (
            <div>
              <div>
                <h2>
                  {uncleared
                    ? `${count(uncleared, "entry has", "entries have")} not cleared the bank yet`
                    : "Everything has cleared the bank"}
                </h2>
                <p>
                  Set the ledger beside your bank statement and see that they
                  agree.
                </p>
              </div>
              <Button variant="outline" onClick={onBank}>
                Match the bank
              </Button>
            </div>
          )}
          {shelf !== undefined && (
            <div>
              <div>
                <h2>
                  {shelf
                    ? `${count(shelf, "voucher", "vouchers")} on the shelf`
                    : "The voucher shelf"}
                </h2>
                <p>
                  Thrift store vouchers on hand. A count, kept apart from the
                  money.
                </p>
              </div>
              <Button variant="outline" onClick={onShelf}>
                Open the shelf
              </Button>
            </div>
          )}
        </section>
      )}
    </>
  );
}

/** The ledger is on its way: the one quiet line every room waits with. */
export function LedgerLoading() {
  return <LiveLoading />;
}

export function LedgerPrivate() {
  const { words } = useWorkspace();
  return (
    <LiveState
      kind="private"
      title={words.states.privateTitle}
      action={
        <Button variant="outline" asChild>
          <Link href="/app/mine">{words.states.privateAction}</Link>
        </Button>
      }
    >
      {words.states.privateDeck}
    </LiveState>
  );
}
