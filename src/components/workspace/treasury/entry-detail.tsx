"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/components/workspace/context";
import { LiveField } from "@/components/workspace/primitives";
import { formatFigure } from "@/components/workspace/treasury/money";
import {
  FormError,
  type Refusal,
} from "@/components/workspace/treasury/form-parts";
import type { LedgerEntry } from "@/components/workspace/treasury/labels";
import { treasuryWords } from "@/lib/words/rooms/treasury";

/** One entry, and the only change the ledger allows: taking it back with a new entry. */
export function EntryDetail({
  entry,
  onReverse,
}: {
  entry: LedgerEntry;
  onReverse: (reason: string) => Promise<Refusal>;
}) {
  const w = treasuryWords(useWorkspace().words).entry;
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
          {entry.reversed ? w.takenBack : w.takesBack}
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
        label={w.why}
        help={w.whyHelp}
      >
        <Input
          name="reason"
          maxLength={200}
          placeholder={w.whyExample}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
        />
      </LiveField>
      {error && <FormError message={error} />}
      <div className="live-form-actions">
        <Button type="submit" variant="outline" disabled={saving}>
          {saving ? w.reversing : w.reverse}
        </Button>
      </div>
    </form>
  );
}
