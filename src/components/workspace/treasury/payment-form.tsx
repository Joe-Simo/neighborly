"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/workspace/date-field";
import { useWorkspace } from "@/components/workspace/context";
import { LiveField, markWrong } from "@/components/workspace/primitives";
import { fill } from "@/lib/words/fill";
import { feelYes } from "@/components/workspace/use-save";
import { centsToInput, parseCents, formatFigure } from "@/components/workspace/treasury/money";
import {
  FormActions,
  FormError,
  type Refusal,
} from "@/components/workspace/treasury/form-parts";
import type { Payable } from "@/components/workspace/treasury/labels";
import { treasuryWords } from "@/lib/words/rooms/treasury";

type Payment = {
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
  const room = treasuryWords(useWorkspace().words);
  const w = room.payment;
  const [amount, setAmount] = useState(centsToInput(request.remaining));
  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [checkNumber, setCheckNumber] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const cents = parseCents(amount);
        if (cents === null) markWrong(form, "amount", w.amountWrong);
        else if (cents > request.remaining) markWrong(form, "amount", w.tooMuch(formatFigure(request.remaining)));
        if (!form.checkValidity() || cents === null) return;
        setError("");
        setSaving(true);
        const refusal = await onSubmit({ amount: cents, date, memo, checkNumber });
        setSaving(false);
        if (refusal) setError(refusal);
        else feelYes();
      }}
    >
      <div className="live-form-grid treasury-form-grid">
        <LiveField
          label={room.money.amount}
          help={fill(w.left, { left: formatFigure(request.remaining), approved: formatFigure(request.amountApproved) })}
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
        <LiveField label={room.money.dayPaid}>
          <DateField name="date" max={today} value={date} onChange={setDate} required />
        </LiveField>
      </div>
      <LiveField label={room.money.check}>
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
        label={room.money.note}
        help={w.noteHelp}
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
        {w.submit}
      </FormActions>
    </form>
  );
}
