"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/workspace/date-field";
import { Toggle } from "@/components/ui/toggle";
import { useWorkspace } from "@/components/workspace/context";
import { LiveField } from "@/components/workspace/primitives";
import { fill } from "@/lib/words/fill";
import { formatCents, formatFigure } from "@/components/workspace/treasury/money";
import {
  FormActions,
  FormError,
  type Refusal,
} from "@/components/workspace/treasury/form-parts";
import { categoryLabel, dayLabel, type Gift } from "@/components/workspace/treasury/labels";

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
  const { words, sampleSaid } = useWorkspace();
  const room = words.rooms.treasury;
  const w = room.deposit;
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
          return setError(w.none);
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
      <div className="treasury-gifts" role="group" aria-label={w.group}>
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
              <strong>{sampleSaid(gift.memo) || categoryLabel(room, gift.category, sampleSaid)}</strong>
              <small>
                {dayLabel(words.locale, gift.date)} · {room.lines.from(gift.from)}
              </small>
            </span>
            <span className="treasury-gift-amount">{formatCents(gift.amount)}</span>
          </Toggle>
        ))}
      </div>
      <p className="treasury-gift-total" aria-live="polite">
        <span>
          {fill(w.going, { going: going.length, count: gifts.length })}
        </span>
        <strong>{formatFigure(total)}</strong>
      </p>
      <div className="live-form-grid treasury-form-grid">
        <LiveField label={w.day}>
          <DateField name="date" max={today} value={date} onChange={setDate} required />
        </LiveField>
        <LiveField label={room.money.note}>
          <Input
            name="memo"
            maxLength={200}
            placeholder={w.noteExample}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </LiveField>
      </div>
      {error && <FormError message={error} />}
      <FormActions saving={saving} onCancel={onCancel}>
        {going.length ? w.submitOf(formatFigure(total)) : w.submit}
      </FormActions>
    </form>
  );
}
