"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LiveLoading } from "@/components/workspace/primitives";
import { useWorkspace } from "@/components/workspace/context";
import { LedgerView } from "@/components/workspace/treasury/ledger-view";
import { PaymentForm } from "@/components/workspace/treasury/payment-form";
import { formatCents } from "@/components/workspace/treasury/money";
import type { Payable } from "@/components/workspace/treasury/labels";

export function TreasurySection() {
  const { data } = useWorkspace();
  const churchId = data.church.id;
  const [month, setMonth] = useState<string>();
  const [paying, setPaying] = useState<Payable | null>(null);
  const [notice, setNotice] = useState("");
  const ledger = useQuery(api.treasury.ledger, { churchId, month });
  const payable = useQuery(api.treasury.payable, { churchId });
  const recordPayment = useMutation(api.treasury.recordPayment);
  // The month last shown stays on screen while the next one loads.
  const [shown, setShown] = useState(ledger);
  if (ledger && ledger !== shown) setShown(ledger);

  if (!shown || !payable) return <LiveLoading label="Opening the ledger…" />;
  return (
    <>
      {notice && (
        <div className="live-success" role="status">
          {notice}
        </div>
      )}
      <LedgerView
        ledger={shown}
        payable={payable}
        onMonth={setMonth}
        onPay={(request) => {
          setNotice("");
          setPaying(request);
        }}
      />
      <Dialog
        open={paying !== null}
        onOpenChange={(open) => {
          if (!open) setPaying(null);
        }}
      >
        <DialogContent className="live-dialog">
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {paying &&
                `${paying.summary}. Paid to ${paying.payeeName}, never to the neighbor.`}
            </DialogDescription>
          </DialogHeader>
          {paying && (
            <PaymentForm
              key={paying.requestId}
              request={paying}
              today={shown.today}
              onCancel={() => setPaying(null)}
              onSubmit={async (payment) => {
                try {
                  await recordPayment({
                    churchId,
                    requestId: paying.requestId,
                    ...payment,
                  });
                } catch (cause) {
                  return cause instanceof Error
                    ? cause.message
                        .replace(/^.*?Uncaught Error:\s*/, "")
                        .split("\n")[0]
                    : "That payment couldn’t be recorded. Please try again.";
                }
                setNotice(
                  `${formatCents(payment.amount)} to ${paying.payeeName} recorded.`,
                );
                setMonth(payment.date.slice(0, 7));
                setPaying(null);
                return null;
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
