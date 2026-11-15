"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveField } from "@/components/workspace/primitives";
import {
  centsToInput,
  formatCents,
  parseCents,
} from "@/components/workspace/treasury/money";
import type { Payable } from "@/components/workspace/treasury/labels";

export type Payment = { amount: number; date: string; memo: string };

export function PaymentForm({
  request,
  today,
  onSubmit,
  onCancel,
}: {
  request: Payable;
  today: string;
  /** Resolves to a message when the payment was refused. */
  onSubmit: (payment: Payment) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(centsToInput(request.remaining));
  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const cents = parseCents(amount);
        if (cents === null)
          return setError("Enter the amount in dollars and cents, like 214.60.");
        if (cents > request.remaining)
          return setError(
            `Only ${formatCents(request.remaining)} is left of the approved amount.`,
          );
        setError("");
        setSaving(true);
        const refusal = await onSubmit({ amount: cents, date, memo });
        setSaving(false);
        if (refusal) setError(refusal);
      }}
    >
      <div className="live-form-grid treasury-form-grid">
        <LiveField
          label="Amount"
          help={`${formatCents(request.remaining)} left of ${formatCents(request.amountApproved)} approved.`}
        >
          <Input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            required
          />
        </LiveField>
        <LiveField label="Day paid">
          <Input
            type="date"
            name="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </LiveField>
      </div>
      <LiveField
        label="Check number or note (optional)"
        help="Leave the neighbor’s name out. The payment is already tied to their request."
      >
        <Input
          name="memo"
          maxLength={200}
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
      </LiveField>
      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}
      <div className="live-form-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Recording…" : "Record payment"}
        </Button>
      </div>
    </form>
  );
}
