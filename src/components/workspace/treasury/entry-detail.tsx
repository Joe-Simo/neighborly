"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveField } from "@/components/workspace/primitives";
import { formatFigure } from "@/components/workspace/treasury/money";
import {
  FormError,
  type Refusal,
} from "@/components/workspace/treasury/form-parts";
import type { LedgerEntry } from "@/components/workspace/treasury/labels";

/** One entry, and the only change the ledger allows: taking it back with a new entry. */
export function EntryDetail({
  entry,
  onReverse,
}: {
  entry: LedgerEntry;
  onReverse: (reason: string) => Promise<Refusal>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const amount = (
    <p
      className="treasury-entry-amount"
      data-in={entry.kind === "income" ? "" : undefined}
    >
      {entry.kind === "income" ? "+ " : "− "}
      {formatFigure(entry.amount)}
    </p>
  );
  if (entry.reversed || entry.reverses)
    return (
      <div className="live-form">
        {amount}
        <p className="live-detail">
          {entry.reversed
            ? "This entry was taken back by a later one. Both stay in the ledger."
            : "This entry takes back an earlier one. Both stay in the ledger."}
        </p>
      </div>
    );
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        setSaving(true);
        const refusal = await onReverse(reason);
        setSaving(false);
        if (refusal) setError(refusal);
      }}
    >
      {amount}
      <LiveField
        label="Why this entry is being reversed"
        help="Nothing is erased. A new entry for the same amount the other way is added today, and both stay in the ledger."
      >
        <Input
          name="reason"
          maxLength={200}
          placeholder="Entered twice, check never cashed…"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        />
      </LiveField>
      {error && <FormError message={error} />}
      <div className="live-form-actions">
        <Button type="submit" variant="outline" disabled={saving}>
          {saving ? "Reversing…" : "Reverse this entry"}
        </Button>
      </div>
    </form>
  );
}
