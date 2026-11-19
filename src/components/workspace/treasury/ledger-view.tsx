"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace/context";
import { RoomAside, useFarScreen } from "@/components/workspace/aside";
import { LiveLoading, PaperScene } from "@/components/workspace/primitives";
import { openUp, useFocusOnce, useGrowsSmoothly, useSavedLine } from "@/components/workspace/fold";
import { SavedWords } from "@/components/workspace/saved-words";
import { LiveState } from "@/components/workspace/states";
import { sentence } from "@/lib/utils";
import { fill } from "@/lib/words/fill";
import { formatList } from "@/lib/words/numbers";
import { formatCents, formatDollars, formatFigure } from "@/components/workspace/treasury/money";
import {
  categoryLabel,
  dayLabel,
  entryLines,
  monthLabel,
  monthTitle,
  TWINNING_GIFT,
  weekDayLabel,
  type Ledger,
  type LedgerEntry,
  type Payable,
} from "@/components/workspace/treasury/labels";
import { handOver, type Paid } from "@/components/workspace/treasury/paid-moment";
import { nameKeeper } from "@/components/workspace/keep-names";
import "./treasury.css";

const neighborHref = (id: string) =>
  `/app/neighbors?neighbor=${encodeURIComponent(id)}`;

/** A name link; `after` is the punctuation that follows it, kept on the name's line. */
function NeighborLink({ id, name, after }: { id: string; name: string; after?: string }) {
  const link = (
    <Link className="live-link live-name" href={neighborHref(id)}>
      {name}
    </Link>
  );
  return after ? <span className="live-glue">{link}{after}</span> : link;
}

/**
 * A paid request, as the ledger line its sheet became. It stays as the room's saved line, with the tick, then
 * closes up and is kept for screen readers.
 */
function PaidLine({ paid }: { paid: Paid }) {
  const { words, sampleSaid } = useWorkspace();
  const room = words.rooms.treasury;
  const w = room.ledger.paid;
  const line = useRef<HTMLDivElement>(null);
  const left = paid.request.remaining - paid.amount;
  const said = left > 0 ? w.saidLeft(formatFigure(left)) : w.said;
  const kind = categoryLabel(room, paid.request.kind);
  const day = dayLabel(words.locale, paid.date);
  const to = [sampleSaid(paid.request.payeeName), paid.checkNumber && room.lines.check(paid.checkNumber)].filter(Boolean).join(" · ");
  // What a screen reader hears, the same from first to last: given as the line's words, so it is said once and the id never is.
  const read = `${fill(w.read, { day, kind, name: paid.request.neighborName, to, amount: formatFigure(paid.amount) })} ${said}`;
  // Asked for before the line is said, so a line that takes focus is read by that and not said twice.
  useFocusOnce(line, paid.entryId);
  const seen = useSavedLine(line, { of: read });
  // After the saved line's own opening is set up, so the hand-over takes its place.
  useLayoutEffect(() => {
    if (line.current) handOver(line.current);
  }, []);
  return (
    <div
      ref={line}
      className={seen ? "live-success help-done treasury-paid" : "sr-only"}
      tabIndex={-1}
    >
      {/* Not a status region of its own: said once in the page's polite region (fold.ts), so closing up says nothing again. */}
      <span className="sr-only">{read}</span>
      {seen && <CircleCheck size={22} aria-hidden="true" />}
      {seen ? (
        <span className="treasury-paid-words" aria-hidden="true">
          <span className="treasury-paid-line">
            <span>
              {day} · <span className="treasury-paid-kind">{room.lines.kindFor(kind)}{" "}</span>
              {paid.request.neighborName}
            </span>
            <strong>{formatFigure(paid.amount)}</strong>
            <span>{to}</span>
          </span>
          <SavedWords>{said}</SavedWords>
        </span>
      ) : null}
    </div>
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
  /** The request a payment was just recorded for. Its sheet becomes its ledger line, then the next one rises. */
  paid?: Paid | null;
  /** The entry a paid sheet has just settled into; its row holds a highlight for a moment. */
  landed?: string | null;
  /** The request whose payment is being sent; its sheet holds its place until the answer comes. */
  paying?: Payable | null;
}) {
  const { words, sampleSaid } = useWorkspace();
  const far = useFarScreen();
  const room = words.rooms.treasury;
  const w = room.ledger;
  // A new row lands in the ledger by growing into it; the request after a paid one opens its own room, once.
  const table = useRef<HTMLDivElement>(null);
  useGrowsSmoothly(table);
  const risen = useRef<string>(undefined);
  const rise = (sheet: HTMLElement | null) => {
    if (!sheet || risen.current === sheet.dataset.request) return;
    risen.current = sheet.dataset.request;
    openUp(sheet);
  };
  const month = monthLabel(words.locale, ledger.month, ledger.today);
  const monthAlone = monthTitle(words.locale, ledger.month, ledger.today);
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
    ledger.neighborsHelped > 0 && w.figures.neighbors(ledger.neighborsHelped),
    gifts > 0 && w.figures.gifts(gifts),
    other > 0 && w.figures.others(other),
  ].filter((said) => said !== false);
  // The sheet stays on the request being paid, whatever the list says meanwhile. Once paid, it is its ledger
  // line; while it becomes that line no other sheet is laid, and the next request rises after.
  const gone = paying?.requestId ?? paid?.request.requestId;
  const others = gone ? payable.filter((row) => row.requestId !== gone) : payable;
  const [first, ...rest] = paying ? [paying, ...others] : others;
  const handing = Boolean(paid?.handing && !paying);
  const waiting = handing ? others : rest;
  const untouched = isUntouched(ledger) && !payable.length;

  if (untouched)
    return (
      <div className="help-empty" data-first>
        <PaperScene kind="empty" />
        <div>
          <h2>{w.first.title}</h2>
          <p>
            {w.first.deck}
          </p>
          <Button variant="outline" onClick={onRecord}>
            <Plus size={18} aria-hidden="true" /> {w.first.action}
          </Button>
        </div>
      </div>
    );

  return (
    <>
      <dl className="help-figures treasury-figures">
        <div>
          <dt>{w.figures.balance}</dt>
          <dd>
            <span className="count-up">{formatDollars(ledger.balance)}</span>
            <small>{w.figures.asOf(weekDayLabel(words.locale, ledger.today))}</small>
          </dd>
        </div>
        <div>
          <dt>{w.figures.in(month)}</dt>
          <dd>
            <span className="count-up">{formatDollars(ledger.moneyIn)}</span>
            <small>
              {formatList(midSentence(ledger.incomeSources.map((source) => categoryLabel(room, source, sampleSaid))), words.locale) || w.figures.nothingIn}
            </small>
          </dd>
        </div>
        <div>
          <dt>{w.figures.out(month)}</dt>
          <dd>
            <span className="count-up">{formatDollars(ledger.moneyOut)}</span>
            <small>{formatList(midSentence(paidFor), words.locale) || w.figures.nothingOut}</small>
          </dd>
        </div>
      </dl>

      {paid && !paying && <PaidLine key={paid.entryId} paid={paid} />}

      {first && !handing && (
        <section
          key={first.requestId}
          ref={(node) => {
            if (landed) rise(node);
          }}
          data-request={first.requestId}
          className="help-sheet treasury-sheet"
          aria-labelledby="treasury-waiting-title"
        >
          <p className="help-sheet-label">{w.sheet.label}</p>
          <div className="help-sheet-body">
            <div>
              <h2 id="treasury-waiting-title">
                {fill(w.sheet.title, { kind: categoryLabel(room, first.kind), amount: formatFigure(first.remaining), payee: sampleSaid(first.payeeName) })}
              </h2>
              <p className="help-why">
                {w.sheet.for} <NeighborLink id={first.neighborId} name={first.neighborName} after="." />{" "}
                {sentence(sampleSaid(first.summary))}
              </p>
              <p>
                {first.paid > 0
                  ? `${fill(w.sheet.partPaid, { paid: formatFigure(first.paid), approved: formatFigure(first.amountApproved) })} `
                  : ""}
                {fill(w.sheet.goesTo, { payee: sampleSaid(first.payeeName) })}
              </p>
            </div>
            <div className="help-actions">
              <Button onClick={() => onPay(first)}>{w.sheet.pay}</Button>
            </div>
          </div>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="treasury-waiting" aria-labelledby="treasury-also-title">
          <div className="live-section-head">
            <h2 id="treasury-also-title">{w.also.title}</h2>
            <span className="live-count">
              {w.also.requests(waiting.length)},{" "}
              {formatFigure(waiting.reduce((sum, row) => sum + row.remaining, 0))}
            </span>
          </div>
          <div className="live-list">
            {waiting.map((request) => (
              <div className="help-row" key={request.requestId}>
                <div>
                  <h3>
                    {nameKeeper([sampleSaid(request.payeeName)])(
                      fill(room.lines.amountTo, { amount: formatFigure(request.remaining), name: sampleSaid(request.payeeName) }),
                    )}
                  </h3>
                  <p>
                    {room.lines.kindFor(categoryLabel(room, request.kind))}{" "}
                    <NeighborLink
                      id={request.neighborId}
                      name={request.neighborName}
                      after="."
                    />{" "}
                    {sentence(sampleSaid(request.summary))}
                    {request.paid > 0 &&
                      ` ${sentence(w.also.alreadyPaid(formatFigure(request.paid)))}`}
                  </p>
                </div>
                <Button variant="outline" aria-label={fill(w.sheet.payLabel, { amount: formatFigure(request.remaining), payee: sampleSaid(request.payeeName) })} onClick={() => onPay(request)}>
                  {w.sheet.pay}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="live-section-head">
        <div className="treasury-month">
          <h2 aria-live="polite">{monthAlone}</h2>
          <Button
            variant="ghost"
            size="icon"
            aria-label={w.earlier}
            disabled={!earlier}
            onClick={() => earlier && onMonth(earlier)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={w.later}
            disabled={!later}
            onClick={() => later && onMonth(later)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <span className="live-count">{w.tied}</span>
      </div>
      {ledger.entries.length ? (
        <div className="live-table-scroll" ref={table}>
          <table className="help-ledger">
            <thead>
              <tr>
                <th scope="col">{w.columns.date}</th>
                <th scope="col">{w.columns.what}</th>
                <th scope="col">{w.columns.for}</th>
                <th scope="col" className="help-money">{w.columns.in}</th>
                <th scope="col" className="help-money">{w.columns.out}</th>
                <th scope="col" className="help-money">{w.columns.balance}</th>
              </tr>
            </thead>
            <tbody>
              {ledger.entries.map((entry) => {
                const { title, detail } = entryLines(room, entry, sampleSaid);
                return (
                  <tr
                    key={entry.id}
                    data-reversed={entry.reversed ? "" : undefined}
                    data-quiet={entry.reverses ? "" : undefined}
                    data-landed={entry.id === landed ? "" : undefined}
                  >
                    <td>{dayLabel(words.locale, entry.date)}</td>
                    <td className="help-what">
                      <Button variant="ghost" onClick={() => onEntry(entry)}>
                        {title}
                      </Button>
                      <small>
                        {entry.reversed ? room.lines.reversed(detail) : detail}
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
                    ? w.soFar(monthAlone)
                    : monthAlone}
                </td>
                <td />
                <td className="help-money" data-in>
                  + {formatCents(ledger.moneyIn)}
                </td>
                <td className="help-money" data-out={ledger.moneyOut > 0 || undefined}>{formatCents(ledger.moneyOut)}</td>
                <td className="help-money" data-total>
                  <span>{w.columns.balance} </span>
                  {formatCents(ledger.opening + ledger.moneyIn - ledger.moneyOut)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="help-empty">
          <PaperScene kind="empty" />
          <div>
            <h3>{w.quiet.title}</h3>
            <p>
              {fill(w.quiet.deck, { month, amount: formatFigure(ledger.opening) })}
            </p>
          </div>
        </div>
      )}

      {(uncleared !== undefined || (onHand && onHand.count > 0) || shelf !== undefined) && (() => {
        const also = (
          <>
          {onHand && onHand.count > 0 && (
            <div>
              <div>
                <h2>
                  {w.foot.gifts(onHand.count)}
                </h2>
                <p className="treasury-on-hand">
                  {w.foot.onHand(formatFigure(onHand.total))}
                </p>
              </div>
              <Button variant="outline" onClick={onDeposit}>
                {w.foot.deposit}
              </Button>
            </div>
          )}
          {uncleared !== undefined && (
            <div>
              <div>
                <h2>
                  {w.foot.uncleared(uncleared)}
                </h2>
                <p>
                  {w.foot.bankDeck}
                </p>
              </div>
              <Button variant="outline" onClick={onBank}>
                {w.foot.bank}
              </Button>
            </div>
          )}
          {shelf !== undefined && (
            <div>
              <div>
                <h2>
                  {w.foot.shelf(shelf)}
                </h2>
                <p>
                  {room.shelf.deck}
                </p>
              </div>
              <Button variant="outline" onClick={onShelf}>
                {w.foot.openShelf}
              </Button>
            </div>
          )}
          </>
        );
        // From 1728px the ways on from the ledger stand beside it, under the picture, instead of after its last line.
        return far ? (
          <RoomAside title={w.foot.label}><div className="treasury-foot" data-beside="">{also}</div></RoomAside>
        ) : (
          <section className="treasury-foot" aria-label={w.foot.label}>{also}</section>
        );
      })()}
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
      {words.states.privateDeckTreasury}
    </LiveState>
  );
}

/**
 * A list of kinds read as one sentence: the first keeps its capital, and a later one in sentence case
 * ("Donation", "Opening balance") takes a small letter. A name with capitals of its own ("Friends of the Poor Walk") keeps them.
 */
function midSentence(items: readonly string[]) {
  return items.map((item, index) => (index > 0 && !/[A-ZÀ-Þ]/.test(item.slice(1)) ? item.charAt(0).toLocaleLowerCase() + item.slice(1) : item));
}
