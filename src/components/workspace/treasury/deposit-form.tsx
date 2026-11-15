"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { LiveField } from "@/components/workspace/primitives";
import { formatCents } from "@/components/workspace/treasury/money";
import {
  FormActions,
  FormError,
  type Refusal,
} from "@/components/workspace/treasury/form-parts";
import { dayLabel, type Gift } from "@/components/workspace/treasury/labels";

export type Deposit = { entryIds: Gift["id"][]; date: string; memo: string };

/** The gifts on hand, all chosen to begin with: most trips to the bank carry everything. */
export function DepositForm({
  gifts,
  today,
  onSubmit,
  onCancel,
}: {
  gifts: Gift[];
  today: string;
  onSubmit: (deposit: Deposit, total: number) => Promise<Refusal>;
  onCancel: () => void;
}) {
  const [left, setLeft] = useState<Gift["id"][]>([]);
  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const going = gifts.filter((gift) => !left.includes(gift.id));
  const total = going.reduce((sum, gift) => sum + gift.amount, 0);
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!going.length)
          return setError("Choose at least one gift that went to the bank.");
        setError("");
        setSaving(true);
        const refusal = await onSubmit(
          { entryIds: going.map((gift) => gift.id), date, memo },
          total,
        );
        setSaving(false);
        if (refusal) setError(refusal);
      }}
    >
      <div className="treasury-gifts" role="group" aria-label="Gifts in this deposit">
        {gifts.map((gift) => (
          <Toggle
            key={gift.id}
            pressed={!left.includes(gift.id)}
            onPressedChange={(pressed) =>
              setLeft((now) =>
                pressed
                  ? now.filter((id) => id !== gift.id)
                  : [...now, gift.id],
              )
            }
          >
            <span className="treasury-gift-mark" aria-hidden="true">
              <Check size={16} />
            </span>
            <span>
              <strong>{gift.memo || gift.category}</strong>
              <small>
                {dayLabel(gift.date)} · From {gift.from}
              </small>
            </span>
            <span className="treasury-gift-amount">{formatCents(gift.amount)}</span>
          </Toggle>
        ))}
      </div>
      <p className="treasury-gift-total" aria-live="polite">
        <span>
          {going.length} of {gifts.length} going to the bank
        </span>
        <strong>{formatCents(total)}</strong>
      </p>
      <div className="live-form-grid treasury-form-grid">
        <LiveField label="Day deposited">
          <Input
            type="date"
            name="date"
            max={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </LiveField>
        <LiveField label="Note (optional)">
          <Input
            name="memo"
            maxLength={200}
            placeholder="Night drop, teller…"
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </LiveField>
      </div>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onCancel={onCancel}>
        Record deposit{going.length ? ` of ${formatCents(total)}` : ""}
      </FormActions>
    </form>
  );
}
