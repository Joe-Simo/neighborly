"use client";

import { useState } from "react";
import { LiveFailure, SaveLabel } from "@/components/workspace/states";
import { useMutation } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DateField } from "@/components/workspace/date-field";
import { useWorkspace } from "@/components/workspace/context";
import { formatDate } from "@/lib/words";
import { readDays } from "@/components/workspace/volunteer/days";
import { LiveField, LiveLoading, markWrong } from "@/components/workspace/primitives";
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
      // Offline, the check waits for the link; Back returns to the days as they were typed.
      <div className="live-form">
        <LiveLoading label={words.timeOffForm.checking} />
        <div className="live-form-actions">
          <Button variant="outline" onClick={() => setReview(null)}>
            {words.timeOffForm.back}
          </Button>
        </div>
      </div>
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
        const form = event.currentTarget;
        const { start, end } = draft;
        if (end < start) markWrong(form, "end", words.timeOffForm.orderError);
        if (!form.checkValidity()) return;
        setError("");
        setReview({ ...draft });
      }}
    >
      <div className="live-form-grid">
        <LiveField label={words.timeOffForm.firstDay}>
          <DateField short name="start" value={draft.start} onChange={(start) => setDraft({ ...draft, start })} required />
        </LiveField>
        <LiveField label={words.timeOffForm.lastDay}>
          <DateField short name="end" value={draft.end} min={draft.start || undefined} onChange={(end) => setDraft({ ...draft, end })} required />
        </LiveField>
      </div>
      <LiveField
        label={words.timeOffForm.noteLabel}
        help={words.timeOffForm.noteHelp}
      >
        <Textarea name="note" value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} maxLength={1000} />
      </LiveField>
      {error && <LiveFailure message={error} />}
      <div className="live-form-actions">
        <Button type="submit">{words.timeOffForm.review}</Button>
      </div>
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
  const { words, sampleSaid, keepNames } = useWorkspace();
  const [snapshot] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const confirm = useMutation(api.workspace.confirmTimeOff);
  return (
    <div className="live-form">
      <p>
        {readDays(words, review.start, review.end)}
      </p>
      <h3>
        {words.timeOffForm.affected(snapshot.length)}
      </h3>
      {snapshot.map((item) => (
        <div className="live-note" key={item.id}>
          {keepNames(sampleSaid(item.title))} ·{" "}
          {formatDate(words.locale, item.start, { timeZone: data.church.timeZone, dateStyle: "medium" })}
        </div>
      ))}
      <p>
        {words.timeOffForm.explain}
      </p>
      {error && <LiveFailure message={error} kept="" />}
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
          <SaveLabel saving={saving} idle={words.timeOffForm.confirm} busy={words.timeOffForm.saving} />
        </Button>
      </div>
    </div>
  );
}
