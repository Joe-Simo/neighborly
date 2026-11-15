"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LiveField, LiveLoading } from "@/components/workspace/primitives";
import type { LiveWorkspaceData } from "@/components/workspace/types";

export function LiveTimeOffForm({
  data,
  onSaved,
}: {
  data: LiveWorkspaceData;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState({ start: "", end: "", note: "" });
  const [review, setReview] = useState<typeof draft | null>(null);
  const [error, setError] = useState("");
  const affected = useQuery(
    api.workspace.previewTimeOff,
    review
      ? { churchId: data.church.id, start: review.start, end: review.end }
      : "skip",
  );
  if (review)
    return affected === undefined ? (
      <LiveLoading label="Checking your commitments…" />
    ) : (
      <TimeOffConfirmation
        key={`${review.start}:${review.end}`}
        data={data}
        review={review}
        initial={affected}
        onBack={() => setReview(null)}
        onSaved={onSaved}
      />
    );
  return (
    <form
      className="live-form"
      onSubmit={(event) => {
        event.preventDefault();
        const { start, end } = draft;
        if (end < start) {
          setError("The last day must be on or after the first day.");
          return;
        }
        setError("");
        setReview({ ...draft });
      }}
    >
      <div className="live-form-grid">
        <LiveField label="First day">
          <Input type="date" name="start" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} required />
        </LiveField>
        <LiveField label="Last day">
          <Input type="date" name="end" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} required />
        </LiveField>
      </div>
      <LiveField
        label="Note (optional)"
        help="Only include what your coordinators need to know."
      >
        <Textarea name="note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} maxLength={1000} />
      </LiveField>
      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}
      <Button type="submit">Review affected commitments</Button>
    </form>
  );
}

function TimeOffConfirmation({
  data,
  review,
  initial,
  onBack,
  onSaved,
}: {
  data: LiveWorkspaceData;
  review: { start: string; end: string; note: string };
  initial: FunctionReturnType<typeof api.workspace.previewTimeOff>;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [snapshot] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirm = useMutation(api.workspace.confirmTimeOff);
  return (
    <div className="live-form">
      <p>
        {review.start} — {review.end}
      </p>
      <h3>
        {snapshot.length
          ? `${snapshot.length} ${snapshot.length === 1 ? "commitment" : "commitments"} affected`
          : "No commitments affected"}
      </h3>
      {snapshot.map((item) => (
        <div className="live-note" key={item.id}>
          {item.title} ·{" "}
          {new Intl.DateTimeFormat("en", {
            timeZone: data.church.timeZone,
            dateStyle: "medium",
          }).format(item.start)}
        </div>
      ))}
      <p>
        Confirming will release only these commitments and record your time off.
        Team memberships and other dates stay the same.
      </p>
      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}
      <div className="live-form-actions">
        <Button variant="outline" disabled={saving} onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError("");
            try {
              await confirm({
                churchId: data.church.id,
                ...review,
                reviewed: snapshot.map(({ id, version }) => ({ id, version })),
              });
              onSaved();
            } catch {
              setError(
                "We couldn’t confirm these dates. Your commitments may have changed. Go back to review the current list.",
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Confirm time off"}
        </Button>
      </div>
    </div>
  );
}
