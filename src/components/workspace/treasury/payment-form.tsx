"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/workspace/date-field";
import { LiveField } from "@/components/workspace/primitives";
import { centsToInput, parseCents, formatFigure } from "@/components/workspace/treasury/money";
import {
  FormActions,
  FormError,
  type Refusal,
} from "@/components/workspace/treasury/form-parts";
import type { Payable } from "@/components/workspace/treasury/labels";

export type Payment = {
  amount: number;
  date: string;
  memo: string;
  checkNumber: string;
};

export function PaymentForm({
  request,
  today,
  onSubmit,
  onCancel,
}: {
  request: Payable;
  today: string;
  onSubmit: (payment: Payment) => Promise<Refusal>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState(centsToInput(request.remaining));
  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [error, setError] = useState("");
  const [amountWrong, setAmountWrong] = useState(false);
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const cents = parseCents(amount);
        setAmountWrong(cents === null || cents > request.remaining);
        if (cents === null)
          return setError("Enter the amount in dollars and cents, like 214.60.");
        if (cents > request.remaining)
          return setError(
            `Enter ${formatFigure(request.remaining)} or less. That is what is left of the approved amount.`,
          );
        setError("");
        setSaving(true);
        const refusal = await onSubmit({ amount: cents, date, memo, checkNumber });
        setSaving(false);
        if (refusal) setError(refusal);
      }}
    >
      <div className="live-form-grid treasury-form-grid">
        <LiveField
          label="Amount"
          help={`${formatFigure(request.remaining)} left of ${formatFigure(request.amountApproved)} approved.`}
        >
          <Input
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amount}
            aria-invalid={amountWrong || undefined}
            onChange={(event) => {
              setAmount(event.target.value);
              setAmountWrong(false);
            }}
            required
          />
        </LiveField>
        <LiveField label="Day paid">
          <DateField name="date" max={today} value={date} onChange={setDate} required />
        </LiveField>
      </div>
      <LiveField label="Check number (optional)">
        <Input
          name="checkNumber"
          inputMode="numeric"
          autoComplete="off"
          maxLength={20}
          value={checkNumber}
          onChange={(event) => setCheckNumber(event.target.value)}
        />
      </LiveField>
      <LiveField
        label="Note (optional)"
        help="Leave the neighbor’s name out. The payment is already tied to their request."
      >
        <Input
          name="memo"
          maxLength={200}
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
      </LiveField>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onCancel={onCancel}>
        Record payment
      </FormActions>
    </form>
  );
}
