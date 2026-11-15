"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { CircleCheck } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatCents } from "@/components/workspace/treasury/money";
import type { Refusal } from "@/components/workspace/treasury/form-parts";
import {
  dayLabel,
  entryLines,
  type LedgerEntry,
  type Payable,
} from "@/components/workspace/treasury/labels";

type Open =
  | { is: "payment"; request: Payable }
  | { is: "money" }
  | { is: "entry"; entry: LedgerEntry };

export function TreasurySection() {
  const { data, setHeadAction } = useWorkspace();
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const [month, setMonth] = useState<string>();
  const ledger = useQuery(
    api.treasury.ledger,
    allowed ? { churchId, month } : "skip",
  );
  const payable = useQuery(api.treasury.payable, allowed ? { churchId } : "skip");
  const bank = useQuery(api.treasury.reconciliation, allowed ? { churchId } : "skip");
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
  const recordMoney = useCallback(() => {
    setDone("");
    setOpen({ is: "money" });
  }, []);
  // The month last shown stays on screen while the next one loads.
  const [shown, setShown] = useState(ledger);
  if (ledger && ledger !== shown) setShown(ledger);
  // On first use the room offers one step, the opening balance, so the head button waits for it.
  const firstUse = !shown || isUntouched(shown);
  // A request waiting to be paid holds the one filled button, so the head's goes quiet.
  const quiet = Boolean(payable?.length);
  useLayoutEffect(() => {
    if (!allowed || firstUse || atBank) return;
    setHeadAction({ label: "Record money", run: recordMoney, quiet });
    return () => setHeadAction(null);
  }, [allowed, firstUse, atBank, quiet, recordMoney, setHeadAction]);

  if (allowed === false) return <LedgerPrivate />;
  if (!shown || !payable) return <LedgerLoading />;
  if (atBank)
    return <BankRoom churchId={churchId} onBack={() => setAtBank(false)} />;

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
        uncleared={bank?.waitingCount}
        onBank={() => {
          setDone("");
          setAtBank(true);
        }}
      />
      <Dialog
        open={open !== null}
        onOpenChange={(value) => {
          if (!value) setOpen(null);
        }}
      >
        <DialogContent className="live-dialog treasury-dialog">
          {open?.is === "payment" && (
            <>
              <DialogHeader>
                <DialogTitle>Record a payment</DialogTitle>
                <DialogDescription>
                  {open.request.summary}. Paid to {open.request.payeeName},
                  never to the neighbor.
                </DialogDescription>
              </DialogHeader>
              <PaymentForm
                key={open.request.requestId}
                request={open.request}
                today={shown.today}
                onCancel={() => setOpen(null)}
                onSubmit={(payment) =>
                  settle(
                    () =>
                      recordPayment({
                        churchId,
                        requestId: open.request.requestId,
                        ...payment,
                      }),
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
                onSubmit={({ name, memo, amount, date, ...what }) =>
                  settle(
                    () =>
                      what.direction === "out"
                        ? recordSpending({ churchId, kind: what.kind, to: name, amount, date, memo, checkNumber: what.checkNumber })
                        : recordIncome({ churchId, source: what.kind, from: name, amount, date, memo }),
                    `${formatCents(amount)} ${what.direction === "out" ? "to" : "from"} ${name.trim()} is recorded, and the balance is up to date.`,
                    date,
                  )
                }
              />
            </>
          )}
          {open?.is === "entry" && (
            <>
              <DialogHeader>
                <DialogTitle>{entryLines(open.entry).title}</DialogTitle>
                <DialogDescription>
                  {dayLabel(open.entry.date)} · {entryLines(open.entry).detail}
                </DialogDescription>
              </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </>
  );
}
