"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import { useMutation, useQueries } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { HelpDone } from "@/components/workspace/help-line/room";
import { api } from "../../../../convex/_generated/api";
import { readFailure } from "@/components/workspace/failure";
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

type Open =
  | { is: "payment"; request: Payable }
  | { is: "money" }
  | { is: "deposit" }
  | { is: "entry"; entry: LedgerEntry };

const answered = <T,>(value: T | Error | undefined) =>
  value instanceof Error ? undefined : value;

export function TreasurySection() {
  const { data, setHeadAction, words, sampleSaid } = useWorkspace();
  const w = words.rooms.treasury;
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

  const [open, setOpen] = useState<Open | null>(null);
  // What the dialog last held stays in it while it closes, so it never shows empty or as another form.
  const [held, setHeld] = useState(open);
  if (open && open !== held) setHeld(open);
  const view = open ?? held;
  const [done, setDone] = useState("");
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
  async function settle(
    change: () => Promise<unknown>,
    said: string,
    date?: string,
  ): Promise<Refusal> {
    try {
      await change();
    } catch (cause) {
      return readFailure(cause, w.refused);
    }
    if (date) setMonth(date.slice(0, 7));
    setOpen(null);
    setDone(said);
    return null;
  }
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
          description: `${sentence(view.request.summary)} ${w.sheets.payment.paidTo(view.request.payeeName)}`,
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
      {done && <HelpDone className="treasury-notice">{done}</HelpDone>}
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
        uncleared={bank?.waitingCount}
        onHand={
          gifts && {
            count: gifts.length,
            total: gifts.reduce((sum, gift) => sum + gift.amount, 0),
          }
        }
        onDeposit={() => show({ is: "deposit" })}
        shelf={shelf?.items.reduce(
          (sum, row) => sum + Math.max(row.onHand, 0),
          0,
        )}
        onShelf={() => {
          setDone("");
          setAtShelf(true);
        }}
        onBank={() => {
          setDone("");
          setAtBank(true);
        }}
      />
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
                    return recordPayment({
                      churchId,
                      requestId: view.request.requestId,
                      ...payment,
                      ...(checkNumber.trim() && { checkNumber }),
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
              onRetire={(id) => {
                const kind = kinds?.find((row) => row.id === id);
                if (kind) void retireKind({ churchId, kindId: kind.id });
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
                  fill(what.direction === "out" ? w.done.moneyOut : w.done.moneyIn, { amount: formatFigure(amount), name: name.trim() }),
                  date,
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
