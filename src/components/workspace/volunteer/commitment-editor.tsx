"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import { Button } from "@/components/ui/button";
import { WhenField } from "@/components/workspace/date-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LiveField, markWrong } from "@/components/workspace/primitives";
import { refusals } from "@/lib/refusals";
import { SheetCancel } from "@/components/workspace/live-dialog";
import { LiveWaiting, LiveFailure, SaveLabel } from "@/components/workspace/states";
import type { LiveCommand, LiveCommitment } from "@/components/workspace/types";
import { useWorkspace } from "@/components/workspace/context";
import { formatDate } from "@/lib/words";

export function LiveCommitmentEditor({
  item,
  timeZone,
  pending,
  saving,
  error,
  save,
}: {
  item: LiveCommitment;
  timeZone: string;
  /** Some save is on its way, this editor's or another: the buttons rest. */
  pending: boolean;
  /** This editor's own save is on its way: only then does it say so. */
  saving: boolean;
  error: string;
  save: (
    command: Extract<LiveCommand, { type: "reviseCommitment" }>,
  ) => Promise<void>;
}) {
  const { words } = useWorkspace();
  const text = words.rooms.sheets.edit;
  // The day and hour as the person's language writes them, in the group's own time zone.
  const said = (value: string) =>
    formatDate(words.locale, DateTime.fromISO(value, { zone: timeZone }).toMillis(), { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  const [review, setReview] = useState<Extract<
    LiveCommand,
    { type: "reviseCommitment" }
  > | null>(null);
  const local = (value: number) =>
    DateTime.fromMillis(value, { zone: timeZone }).toFormat(
      "yyyy-MM-dd'T'HH:mm",
    );
  const [draft, setDraft] = useState(() => ({
    title: item.title,
    start: local(item.start),
    end: local(item.end),
    location: item.location,
    preparation: item.preparation,
  }));
  if (review)
    return (
      <div className="live-form">
        <h3>{review.title}</h3>
        <dl className="live-detail">
          <div>
            <dt>{text.starts}</dt>
            <dd>{said(review.start)}</dd>
          </div>
          <div>
            <dt>{text.ends}</dt>
            <dd>{said(review.end)}</dd>
          </div>
          <div>
            <dt>{text.where}</dt>
            <dd>{review.location}</dd>
          </div>
        </dl>
        <p className="live-prep">{review.preparation}</p>
        <div className="live-note">
          {text.releases}
        </div>
        {error && <LiveFailure message={error} />}
        {/* With the connection lost the save is held, not failed: one line says so, above the buttons. */}
        <LiveWaiting when={saving} />
        <div className="live-form-actions">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setReview(null)}
          >
            {text.back}
          </Button>
          <Button disabled={pending} onClick={() => void save(review)}>
            <SaveLabel saving={saving} idle={text.confirm} busy={text.saving} />
          </Button>
        </div>
      </div>
    );
  return (
    <form
      className="live-form"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const f = new FormData(form);
        const value = (name: string) => String(f.get(name) ?? "").trim();
        const next = {
          title: value("title"),
          start: value("start"),
          end: value("end"),
          location: value("location"),
          preparation: value("preparation"),
        };
        // An end at or before its start is said on the end, here, as the add form says it: never only after review, from the server.
        if (next.start && next.end && next.end <= next.start)
          markWrong(form, "end", words.notices.refused[refusals.endAfterStart] ?? refusals.endAfterStart);
        if (!form.checkValidity()) return;
        setDraft(next);
        setReview({
          type: "reviseCommitment",
          commitmentId: item.id,
          expectedVersion: item.version,
          ...next,
        });
      }}
    >
      <LiveField label={text.role}>
        <Input
          name="title"
          defaultValue={draft.title}
          required
          maxLength={180}
        />
      </LiveField>
      <div className="live-form-grid">
        <LiveField label={text.starts}>
          <WhenField name="start" defaultValue={draft.start} required />
        </LiveField>
        <LiveField label={text.ends}>
          <WhenField name="end" defaultValue={draft.end} required />
        </LiveField>
      </div>
      <LiveField label={text.where}>
        <Input
          name="location"
          defaultValue={draft.location}
          required
          maxLength={300}
        />
      </LiveField>
      <LiveField label={text.preparation}>
        <Textarea
          name="preparation"
          defaultValue={draft.preparation}
          maxLength={5000}
          rows={4}
        />
      </LiveField>
      {/* The sheet's own footer, as every other sheet in the room ends: a way out, then the one step forward. */}
      <div className="live-form-actions">
        <SheetCancel disabled={pending} />
        <Button type="submit" disabled={pending}>{text.review}</Button>
      </div>
    </form>
  );
}
