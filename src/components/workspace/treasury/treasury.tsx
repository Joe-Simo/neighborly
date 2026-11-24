"use client";

import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueries } from "convex/react";
import { ConvexError } from "convex/values";
import { sayRefused } from "@/lib/refusals";
import { useQuery } from "@/components/workspace/query";
import { HelpDone } from "@/components/workspace/help-line/room";
import { UndoAct } from "@/components/workspace/undo";
import { takeLine, useKeptLine } from "@/components/workspace/fold";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { sayFailure } from "@/components/workspace/failure";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { useWorkspace } from "@/components/workspace/context";
import {
  isUntouched,
  LedgerLoading,
  LedgerPrivate,
  LedgerView,
} from "@/components/workspace/treasury/ledger-view";
import { PaymentForm } from "@/components/workspace/treasury/payment-form";
import { MoneyForm } from "@/components/workspace/treasury/money-form";
import { EntryDetail } from "@/components/workspace/treasury/entry-detail";
import { BankRoom } from "@/components/workspace/treasury/bank-view";
import { ShelfRoom } from "@/components/workspace/treasury/shelf-view";
import { DepositForm } from "@/components/workspace/treasury/deposit-form";

import { MonthCheck } from "@/components/workspace/treasury/month-check";
import { usePaidMoment } from "@/components/workspace/treasury/paid-moment";
import { formatFigure } from "@/components/workspace/treasury/money";
import { sentence } from "@/lib/utils";
import { fill } from "@/lib/words/fill";
import type { Refusal } from "@/components/workspace/treasury/form-parts";
import {
  dayLabel,
  entryLines,
  type Bank,
  type Gift,
  type Kind,
  type LedgerEntry,
  type Payable,
  type Shelf,
} from "@/components/workspace/treasury/labels";
import { treasuryWords } from "@/lib/words/rooms/treasury";

type Open =
  | { is: "payment"; request: Payable }
  | { is: "money" }
  | { is: "deposit" }
  | { is: "entry"; entry: LedgerEntry };

/** The refusal for a payment recorded since the sheet was shown: who recorded what, and the paid total now. */
function recordedSince(cause: unknown): { message: string; paid: number; last: { amount: number; by: string } | null } | null {
  if (!(cause instanceof ConvexError) || typeof cause.data !== "object" || cause.data === null) return null;
  const data = cause.data as { message?: unknown; paid?: unknown; last?: { amount: number; by: string } | null };
  return typeof data.message === "string" && typeof data.paid === "number" ? { message: data.message, paid: data.paid, last: data.last ?? null } : null;
}

/** The monthly budget line comes with its own words, after the ledger, so the room's first load does not carry them. */
const BudgetLine = lazy(() => import("@/components/workspace/treasury/budget"));

const answered = <T,>(value: T | Error | undefined) =>
  value instanceof Error ? undefined : value;

export function TreasurySection() {
  const { data, setHeadAction, words, sampleSaid } = useWorkspace();
  const w = treasuryWords(words);
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const [month, setMonth] = useState<string>();
  const ledger = useQuery(
    api.treasury.ledger,
    allowed ? { churchId, month } : "skip",
  );
  const payable = useQuery(
    api.treasury.payable,
    allowed ? { churchId } : "skip",
  );
  // Asked for in a way that cannot fail the room: whatever the backend does not answer yet stays hidden.
  const asked = useMemo(() => {
    const all: Parameters<typeof useQueries>[0] = {
      bank: { query: api.treasury.reconciliation, args: { churchId } },
      gifts: { query: api.treasury.undeposited, args: { churchId } },
      shelf: { query: api.treasury.voucherShelf, args: { churchId } },
      kinds: { query: api.treasury.kinds, args: { churchId } },
      payees: { query: api.importExport.payees, args: { churchId } },
    };
    return allowed ? all : {};
  }, [allowed, churchId]);
  const extra = useQueries(asked);
  const bank = answered<Bank>(extra.bank);
  const gifts = answered<Gift[]>(extra.gifts);
  const shelf = answered<Shelf>(extra.shelf);
  const kinds = answered<Kind[]>(extra.kinds);
  const payees = answered<{ name: string }[]>(extra.payees);
  const [moneyOut, setMoneyOut] = useState(false);
  const { paid, landed, pay } = usePaidMoment();
  // The request being paid keeps its sheet from the moment the form is sent: the ledger answers before the
  // payment's own yes does, and without this the next request would show in its place for one frame.
  const [paying, setPaying] = useState<Payable | null>(null);
  const recordDeposit = useMutation(api.treasury.recordDeposit);
  const addKind = useMutation(api.treasury.addKind);
  const retireKind = useMutation(api.treasury.retireKind);
  const recordOwnKind = useMutation(api.treasury.recordOwnKind);
  const [atShelf, setAtShelf] = useState(false);
  const [atBank, setAtBank] = useState(false);
  const recordPayment = useMutation(api.treasury.recordPayment);
  const recordIncome = useMutation(api.treasury.recordIncome);
  const recordSpending = useMutation(api.treasury.recordSpending);
  const reverseEntry = useMutation(api.treasury.reverseEntry);
  const undoDeposit = useMutation(api.treasury.undoDeposit);

  const [open, setOpen] = useState<Open | null>(null);
  // What the dialog last held stays in it while it closes, so it never shows empty or as another form.
  const [held, setHeld] = useState(open);
  if (open && open !== held) setHeld(open);
  const view = open ?? held;
  // The paid total a payment sheet was shown, once a refusal has said what changed since.
  const [paidSeen, setPaidSeen] = useState<{ requestId: string; paid: number } | null>(null);
  // Arriving from a yes just given (`?pay=`), that request's payment sheet is open on arrival: once, and only for
  // a request still waiting to be paid. The address is then put back as the room's own.
  const askedToPay = useSearchParams().get("pay");
  const [payAsked, setPayAsked] = useState<string | null>(null);
  if (askedToPay && payable && payAsked !== askedToPay) {
    setPayAsked(askedToPay);
    const request = payable.find((one) => one.requestId === askedToPay);
    if (request) setOpen({ is: "payment", request });
  }
  useEffect(() => {
    if (payAsked) window.history.replaceState(window.history.state, "", window.location.pathname);
  }, [payAsked]);
  type Back = { run: () => Promise<unknown>; said: string };
  // A line with its way back is kept while the person steps into another room, and is here again on return in its time.
  const [returned] = useState(() => takeLine<{ done: string; back: Back }>("treasury"));
  const [done, setDone] = useState(returned?.value.done ?? "");
  // The reverse of the step just taken, offered on its line until the line goes.
  const [back, setBack] = useState<Back | undefined>(returned?.value.back);
  const line = useMemo(() => (done && back ? { done, back } : undefined), [done, back]);
  useKeptLine("treasury", line, returned);
  // An undo the server would not take: said in plum, and the entry stands.
  const [undoRefused, setUndoRefused] = useState("");
  const recordMoney = () => {
    setDone("");
    setMoneyOut(false);
    setOpen({ is: "money" });
  };
  // The month last shown stays on screen while the next one loads.
  const [shown, setShown] = useState(ledger);
  if (ledger && ledger !== shown) setShown(ledger);
  // On first use the room offers one step, the opening balance, so the head button waits for it.
  const firstUse = !shown || isUntouched(shown);
  // A request waiting to be paid holds the one filled button, so the head's goes quiet.
  const quiet = Boolean(payable?.length);
  const payableUnknown = payable === undefined;
  useLayoutEffect(() => {
    if (!allowed || firstUse || atBank || atShelf) return;
    setHeadAction({
      label: w.record,
      plus: true,
      run: () => {
        setDone("");
        setMoneyOut(false);
        setOpen({ is: "money" });
      },
      quiet,
      // Until the requests to pay have arrived the room cannot know which style the button takes.
      unsettled: payableUnknown,
    });
    return () => setHeadAction(null);
  }, [allowed, firstUse, atBank, atShelf, quiet, payableUnknown, setHeadAction, w.record]);

  if (allowed === false) return <LedgerPrivate />;
  if (!shown || !payable) return <LedgerLoading />;
  if (atBank)
    return <BankRoom churchId={churchId} onBack={() => setAtBank(false)} />;
  if (atShelf)
    return (
      <ShelfRoom
        churchId={churchId}
        today={shown.today}
        onBack={() => setAtShelf(false)}
      />
    );

  /** Runs one change; on success closes the dialog and says what changed, on refusal hands the reason back to the form. */
  async function settle<Made>(
    change: () => Promise<Made>,
    said: string,
    date?: string,
    undo?: (made: Made) => { run: () => Promise<unknown>; said: string },
  ): Promise<Refusal> {
    let made: Made;
    try {
      made = await change();
    } catch (cause) {
      return sayFailure(words.notices,cause, w.refused);
    }
    if (date) setMonth(date.slice(0, 7));
    setOpen(null);
    setDone(said);
    setUndoRefused("");
    setBack(undo?.(made));
    return null;
  }
  /** Money recorded a moment ago is taken back the ledger's way: a reversing entry, the first one kept. */
  const takeBack = (amount: number) => (entryId: Id<"ledgerEntries">) => ({
    run: () => reverseEntry({ churchId, entryId, reason: w.done.undoneReason }),
    said: w.done.reversed(formatFigure(amount)),
  });
  const show = (next: Open) => {
    setDone("");
    setOpen(next);
  };
  const empty = isUntouched(shown);

  const lines = view?.is === "entry" ? entryLines(w, view.entry, sampleSaid) : null;
  const sheet =
    view?.is === "payment"
      ? {
          title: w.sheets.payment.title,
          description: `${sentence(sampleSaid(view.request.summary))} ${w.sheets.payment.paidTo(sampleSaid(view.request.payeeName))}`,
        }
      : view?.is === "money"
        ? moneyOut
          ? { title: w.sheets.moneyOut.title, description: w.sheets.moneyOut.deck }
          : { title: w.sheets.money.title, description: w.sheets.money.deck }
        : view?.is === "deposit"
          ? { title: w.sheets.deposit.title, description: w.sheets.deposit.deck }
          : view?.is === "entry" && lines
            ? {
                title: lines.title,
                description: `${dayLabel(words.locale, view.entry.date)} · ${lines.detail}`,
              }
            : null;

  return (
    <>
      {undoRefused && !done && (
        <div className="live-error treasury-notice" role="alert">
          <p>{undoRefused}</p>
        </div>
      )}
      {done && (
        <HelpDone
          key={done}
          className="treasury-notice"
          remaining={returned && back === returned.value.back ? returned.remaining : undefined}
          action={back && (
            <UndoAct
              run={async () => {
                try {
                  await back.run();
                  setBack(undefined);
                  setDone(back.said);
                } catch (cause) {
                  setBack(undefined);
                  setDone("");
                  setUndoRefused(sayFailure(words.notices,cause, w.undoRefused));
                }
              }}
            />
          )}
        >
          {done}
        </HelpDone>
      )}
      <LedgerView
        ledger={shown}
        payable={payable}
        onMonth={setMonth}
        onPay={(request) => show({ is: "payment", request })}
        onRecord={recordMoney}
        onEntry={(entry) => show({ is: "entry", entry })}
        paid={paid}
        landed={landed}
        paying={paying}
        // Matching the bank and the voucher shelf are offered once there is money or stock for them to hold;
        // until then the head's "Record money" is the one thing to do.
        uncleared={bank && (bank.books !== 0 || bank.waiting.length || bank.lately.length || bank.deposits.length) ? bank.waitingCount : undefined}
        onHand={
          gifts && {
            count: gifts.length,
            total: gifts.reduce((sum, gift) => sum + gift.amount, 0),
          }
        }
        onDeposit={() => show({ is: "deposit" })}
        shelf={shelf && (shelf.lately.length || shelf.items.some((row) => row.onHand > 0)) ? shelf.items.reduce(
          (sum, row) => sum + Math.max(row.onHand, 0),
          0,
        ) : undefined}
        onShelf={() => {
          setDone("");
          setAtShelf(true);
        }}
        onBank={() => {
          setDone("");
          setAtBank(true);
        }}
      />
      <Suspense fallback={null}>
        <BudgetLine churchId={churchId} today={shown.today} />
      </Suspense>
      {!empty && (
        <MonthCheck
          key={shown.month}
          churchId={churchId}
          month={shown.month}
          entries={shown.entries}
          onEntry={(entry) => show({ is: "entry", entry })}
        />
      )}
      <LiveDialog
        open={open !== null}
        onClose={() => setOpen(null)}
        className="treasury-dialog"
        title={sheet?.title ?? ""}
        description={sheet?.description}
      >
        {view?.is === "payment" && (
          <>
            <PaymentForm
              key={view.request.requestId}
              request={view.request}
              today={shown.today}
              onCancel={() => setOpen(null)}
              onSubmit={({ checkNumber, ...payment }) =>
                settle(
                  () => {
                    setPaying(view.request);
                    const seen = paidSeen?.requestId === view.request.requestId ? paidSeen.paid : view.request.paid;
                    return recordPayment({
                      churchId,
                      requestId: view.request.requestId,
                      ...payment,
                      ...(checkNumber.trim() && { checkNumber }),
                      paidSeen: seen,
                    })
                      .catch((cause: unknown) => {
                        // Someone recorded a payment here since this sheet showed it: named, with what they recorded.
                        // Recording again sends the total the refusal gave, which is the person choosing a second payment.
                        const recorded = recordedSince(cause);
                        if (!recorded) throw cause;
                        setPaidSeen({ requestId: view.request.requestId, paid: recorded.paid });
                        const named = recorded.last ? ` ${fill(w.recordedBy, { amount: formatFigure(recorded.last.amount), name: recorded.last.by })}` : "";
                        throw new ConvexError(`${sayRefused(words.notices, recorded.message)}${named}`);
                      })
                      .then((entryId) =>
                        pay(view.request, payment.amount, entryId, payment.date, checkNumber.trim() || undefined),
                      )
                      .finally(() => setPaying(null));
                  },
                  // The sheet becomes its ledger line, which says so itself.
                  "",
                  payment.date,
                )
              }
            />
          </>
        )}
        {view?.is === "money" && (
          <>
            <MoneyForm
              today={shown.today}
              start={empty ? "opening" : "collection"}
              onCancel={() => setOpen(null)}
              payees={payees?.map((payee) => payee.name)}
              onOut={setMoneyOut}
              own={kinds?.map((kind) => ({
                id: kind.id,
                name: kind.name,
                direction: kind.direction === "income" ? "in" : "out",
              }))}
              onRetire={async (id) => {
                const kind = kinds?.find((row) => row.id === id);
                if (!kind) return null;
                try {
                  await retireKind({ churchId, kindId: kind.id });
                  return null;
                } catch (cause) {
                  return sayFailure(words.notices, cause, w.refused);
                }
              }}
              onRestore={async (kind) => {
                // A kind named again comes back under its old id (addKind), so the form can choose it again.
                try {
                  await addKind({ churchId, direction: kind.direction === "in" ? "income" : "expense", name: kind.name });
                  return null;
                } catch (cause) {
                  return sayFailure(words.notices, cause, w.refused);
                }
              }}
              onSubmit={({ name, memo, amount, date, checkNumber, ...what }) =>
                settle(
                  async () => {
                    const sent = checkNumber.trim() && { checkNumber };
                    if (what.kind === "own" || what.kind === "new") {
                      const kindId =
                        what.kind === "new"
                          ? await addKind({
                              churchId,
                              direction:
                                what.direction === "in" ? "income" : "expense",
                              name: what.kindName,
                            })
                          : kinds?.find((row) => row.id === what.id)?.id;
                      if (!kindId)
                        throw new Error(w.kindGone);
                      return recordOwnKind({
                        churchId,
                        kindId,
                        name,
                        amount,
                        date,
                        memo,
                        ...sent,
                      });
                    }
                    return what.direction === "out"
                      ? recordSpending({
                          churchId,
                          kind: what.kind,
                          to: name,
                          amount,
                          date,
                          memo,
                          ...sent,
                        })
                      : recordIncome({
                          churchId,
                          source: what.kind,
                          from: name,
                          amount,
                          date,
                          memo,
                        });
                  },
                  fill(what.direction === "out" ? w.done.moneyOut : what.kind === "opening" ? w.done.opening : w.done.moneyIn, { amount: formatFigure(amount), name: name.trim() }),
                  date,
                  takeBack(amount),
                )
              }
            />
          </>
        )}
        {view?.is === "deposit" && gifts && (
          <>
            <DepositForm
              gifts={gifts}
              today={shown.today}
              onCancel={() => setOpen(null)}
              onSubmit={(deposit, total) =>
                settle(
                  () => recordDeposit({ churchId, ...deposit }),
                  w.done.deposit(formatFigure(total)),
                  undefined,
                  (depositId) => ({ run: () => undoDeposit({ churchId, depositId }), said: w.done.depositUndone }),
                )
              }
            />
          </>
        )}
        {view?.is === "entry" && (
          <>
            <EntryDetail
              key={view.entry.id}
              entry={view.entry}
              onCancel={() => setOpen(null)}
              onReverse={(reason) =>
                settle(
                  () =>
                    reverseEntry({
                      churchId,
                      entryId: view.entry.id,
                      reason,
                    }),
                  w.done.reversed(formatFigure(view.entry.amount)),
                  shown.today,
                )
              }
            />
          </>
        )}
      </LiveDialog>
    </>
  );
}
