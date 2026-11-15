"use client";

import { useEffect, useRef, useState } from "react";
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
  LedgerLoading,
  LedgerPrivate,
  LedgerView,
} from "@/components/workspace/treasury/ledger-view";
import { PaymentForm } from "@/components/workspace/treasury/payment-form";
import { MoneyForm } from "@/components/workspace/treasury/money-form";
import { EntryDetail } from "@/components/workspace/treasury/entry-detail";
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
  const { data } = useWorkspace();
  const churchId = data.church.id;
  const allowed = useQuery(api.access.canOpenNeighborRecords, { churchId });
  const [month, setMonth] = useState<string>();
  const ledger = useQuery(
    api.treasury.ledger,
    allowed ? { churchId, month } : "skip",
  );
  const payable = useQuery(api.treasury.payable, allowed ? { churchId } : "skip");
  const recordPayment = useMutation(api.treasury.recordPayment);
  const recordIncome = useMutation(api.treasury.recordIncome);
  const recordTwinningGift = useMutation(api.treasury.recordTwinningGift);
  const reverseEntry = useMutation(api.treasury.reverseEntry);

  const [open, setOpen] = useState<Open | null>(null);
  const [done, setDone] = useState("");
  const notice = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (done) notice.current?.focus({ preventScroll: true });
  }, [done]);
  // The month last shown stays on screen while the next one loads.
  const [shown, setShown] = useState(ledger);
  if (ledger && ledger !== shown) setShown(ledger);

  if (allowed === false) return <LedgerPrivate />;
  if (!shown || !payable) return <LedgerLoading />;

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
  const empty = !shown.entries.length && shown.months.length === 1;

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
        onRecord={() => show({ is: "money" })}
        onEntry={(entry) => show({ is: "entry", entry })}
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
              <DialogHeader>
                <DialogTitle>Record money</DialogTitle>
                <DialogDescription>
                  A collection, a gift, or what the conference holds today.
                </DialogDescription>
              </DialogHeader>
              <MoneyForm
                today={shown.today}
                start={empty ? "opening" : "collection"}
                onCancel={() => setOpen(null)}
                onSubmit={({ kind, name, ...money }) =>
                  settle(
                    () =>
                      kind === "gift"
                        ? recordTwinningGift({ churchId, to: name, ...money })
                        : recordIncome({
                            churchId,
                            source: kind,
                            from: name,
                            ...money,
                          }),
                    kind === "gift"
                      ? `A twinning gift of ${formatCents(money.amount)} to ${name.trim()} is recorded.`
                      : `${formatCents(money.amount)} from ${name.trim()} is recorded, and the balance is up to date.`,
                    money.date,
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
