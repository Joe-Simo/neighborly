"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/workspace/date-field";
import { useWorkspace } from "@/components/workspace/context";
import { formatDate, formatDays } from "@/lib/words";
import { LiveField, LiveLoading } from "@/components/workspace/primitives";
import type { LiveWorkspaceData } from "@/components/workspace/types";

export function LiveTimeOffForm({
  data,
  onSaved,
}: {
  data: LiveWorkspaceData;
  onSaved: () => void;
}) {
  const { words } = useWorkspace();
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
      <LiveLoading label={words.timeOffForm.checking} />
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
          setError(words.timeOffForm.orderError);
          return;
        }
        setError("");
        setReview({ ...draft });
      }}
    >
      <div className="live-form-grid">
        <LiveField label={words.timeOffForm.firstDay}>
          <DateField name="start" value={draft.start} onChange={(start) => setDraft({ ...draft, start })} required />
        </LiveField>
        <LiveField label={words.timeOffForm.lastDay}>
          <DateField name="end" value={draft.end} min={draft.start || undefined} onChange={(end) => setDraft({ ...draft, end })} required />
        </LiveField>
      </div>
      <LiveField
        label={words.timeOffForm.noteLabel}
        help={words.timeOffForm.noteHelp}
      >
        <Textarea name="note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} maxLength={1000} />
      </LiveField>
      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}
      <Button type="submit">{words.timeOffForm.review}</Button>
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
  const { words } = useWorkspace();
  const [snapshot] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirm = useMutation(api.workspace.confirmTimeOff);
  return (
    <div className="live-form">
      <p>
        {formatDays(words.locale, review.start, review.end)}
      </p>
      <h3>
        {words.timeOffForm.affected(snapshot.length)}
      </h3>
      {snapshot.map((item) => (
        <div className="live-note" key={item.id}>
          {item.title} ·{" "}
          {formatDate(words.locale, item.start, { timeZone: data.church.timeZone, dateStyle: "medium" })}
        </div>
      ))}
      <p>
        {words.timeOffForm.explain}
      </p>
      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}
      <div className="live-form-actions">
        <Button variant="outline" disabled={saving} onClick={onBack}>
          {words.timeOffForm.back}
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
                words.timeOffForm.failed,
              );
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? words.timeOffForm.saving : words.timeOffForm.confirm}
        </Button>
      </div>
    </div>
  );
}
