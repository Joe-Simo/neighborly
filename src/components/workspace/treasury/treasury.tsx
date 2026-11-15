"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueries, useQuery } from "convex/react";
import { CircleCheck } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
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
import { formatCents } from "@/components/workspace/treasury/money";
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
  const { data, setHeadAction } = useWorkspace();
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
  // The request just paid keeps its sheet for a moment, so the folded corner is seen before the next one rises.
  const [paid, setPaid] = useState<{ request: Payable; amount: number } | null>(null);
  useEffect(() => {
    if (!paid) return;
    const timer = setTimeout(() => setPaid(null), 2400);
    return () => clearTimeout(timer);
  }, [paid]);
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
  const [done, setDone] = useState("");
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (done) notice.current?.focus({ preventScroll: true });
  }, [done]);
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
  useLayoutEffect(() => {
    if (!allowed || firstUse || atBank || atShelf) return;
    setHeadAction({
      label: "Record money",
      plus: true,
      run: () => {
        setDone("");
        setMoneyOut(false);
        setOpen({ is: "money" });
      },
      quiet,
    });
    return () => setHeadAction(null);
  }, [allowed, firstUse, atBank, atShelf, quiet, setHeadAction]);

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
      return cause instanceof Error
        ? cause.message.replace(/^.*?Uncaught Error:\s*/, "").split("\n")[0]
        : "That couldn’t be recorded. Please try again.";
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

  const lines = open?.is === "entry" ? entryLines(open.entry) : null;
  const sheet =
    open?.is === "payment"
      ? {
          title: "Record a payment",
          description: `${open.request.summary}. Paid to ${open.request.payeeName}, never to the neighbor.`,
        }
      : open?.is === "money"
        ? moneyOut
          ? {
              title: "Record money out",
              description: "A purchase, dues or a fee the conference paid.",
            }
          : {
              title: "Record money",
              description:
                "A collection, a gift, or what the conference holds today.",
            }
        : open?.is === "deposit"
          ? {
              title: "Record a deposit",
              description:
                "The gifts you carried to the bank together. Nothing about them changes; they become one line to match.",
            }
          : open?.is === "entry" && lines
            ? {
                title: lines.title,
                description: `${dayLabel(open.entry.date)} · ${lines.detail}`,
              }
            : null;

  return (
    <>
      {done && (
        <div
          className="live-success help-done treasury-notice"
          role="status"
          tabIndex={-1}
          ref={notice}
        >
          <CircleCheck size={22} aria-hidden="true" />
          <span>{done}</span>
        </div>
      )}
      <LedgerView
        ledger={shown}
        payable={payable}
        onMonth={setMonth}
        onPay={(request) => show({ is: "payment", request })}
        onRecord={recordMoney}
        onEntry={(entry) => show({ is: "entry", entry })}
        paid={paid}
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
        {open?.is === "payment" && (
          <>
            <PaymentForm
              key={open.request.requestId}
              request={open.request}
              today={shown.today}
              onCancel={() => setOpen(null)}
              onSubmit={({ checkNumber, ...payment }) =>
                settle(
                  () =>
                    recordPayment({
                      churchId,
                      requestId: open.request.requestId,
                      ...payment,
                      ...(checkNumber.trim() && { checkNumber }),
                    }).then(() =>
                      setPaid({
                        request: open.request,
                        amount: payment.amount,
                      }),
                    ),
                  `${formatCents(payment.amount)} to ${open.request.payeeName} is recorded, and the balance is up to date.`,
                  payment.date,
                )
              }
            />
          </>
        )}
        {open?.is === "money" && (
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
                        throw new Error(
                          "This kind is no longer offered. Choose another.",
                        );
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
                  `${formatCents(amount)} ${what.direction === "out" ? "to" : "from"} ${name.trim()} is recorded, and the balance is up to date.`,
                  date,
                )
              }
            />
          </>
        )}
        {open?.is === "deposit" && gifts && (
          <>
            <DepositForm
              gifts={gifts}
              today={shown.today}
              onCancel={() => setOpen(null)}
              onSubmit={(deposit, total) =>
                settle(
                  () => recordDeposit({ churchId, ...deposit }),
                  `A deposit of ${formatCents(total)} is recorded. It will wait in Match the bank until the statement shows it.`,
                )
              }
            />
          </>
        )}
        {open?.is === "entry" && (
          <>
            <EntryDetail
              key={open.entry.id}
              entry={open.entry}
              onClose={() => setOpen(null)}
              onReverse={(reason) =>
                settle(
                  () =>
                    reverseEntry({
                      churchId,
                      entryId: open.entry.id,
                      reason,
                    }),
                  `${formatCents(open.entry.amount)} is taken back with a new entry dated today. The first entry stays in the ledger.`,
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
