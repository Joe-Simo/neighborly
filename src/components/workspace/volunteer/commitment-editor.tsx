"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LiveField } from "@/components/workspace/primitives";
import type { LiveCommand, LiveCommitment } from "@/components/workspace/types";

export function LiveCommitmentEditor({
  item,
  timeZone,
  pending,
  error,
  save,
}: {
  item: LiveCommitment;
  timeZone: string;
  pending: boolean;
  error: string;
  save: (
    command: Extract<LiveCommand, { type: "reviseCommitment" }>,
  ) => Promise<void>;
}) {
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
            <dt>Starts</dt>
            <dd>{review.start.replace("T", " ")}</dd>
          </div>
          <div>
            <dt>Ends</dt>
            <dd>{review.end.replace("T", " ")}</dd>
          </div>
          <div>
            <dt>Where</dt>
            <dd>{review.location}</dd>
          </div>
        </dl>
        <p className="live-prep">{review.preparation}</p>
        <div className="live-note">
          Changing the date, time, role, location or preparation releases an
          accepted person and withdraws pending cover requests. Someone must
          explicitly accept the updated commitment. Saving unchanged details
          preserves acceptance.
        </div>
        {error && (
          <div className="live-error" role="alert">
            {error}
          </div>
        )}
        <div className="live-form-actions">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => setReview(null)}
          >
            Back
          </Button>
          <Button disabled={pending} onClick={() => void save(review)}>
            {pending ? "Saving…" : "Confirm changes"}
          </Button>
        </div>
      </div>
    );
  return (
    <form
      className="live-form"
      onSubmit={(event) => {
        event.preventDefault();
        const f = new FormData(event.currentTarget);
        const value = (name: string) => String(f.get(name) ?? "").trim();
        const next = {
          title: value("title"),
          start: value("start"),
          end: value("end"),
          location: value("location"),
          preparation: value("preparation"),
        };
        setDraft(next);
        setReview({
          type: "reviseCommitment",
          commitmentId: item.id,
          expectedVersion: item.version,
          ...next,
        });
      }}
    >
      <LiveField label="Role / title">
        <Input
          name="title"
          defaultValue={draft.title}
          required
          maxLength={180}
        />
      </LiveField>
      <div className="live-form-grid">
        <LiveField label="Starts">
          <Input
            type="datetime-local"
            name="start"
            defaultValue={draft.start}
            required
          />
        </LiveField>
        <LiveField label="Ends">
          <Input
            type="datetime-local"
            name="end"
            defaultValue={draft.end}
            required
          />
        </LiveField>
      </div>
      <LiveField label="Where">
        <Input
          name="location"
          defaultValue={draft.location}
          required
          maxLength={300}
        />
      </LiveField>
      <LiveField label="Preparation">
        <Textarea
          name="preparation"
          defaultValue={draft.preparation}
          maxLength={5000}
          rows={4}
        />
      </LiveField>
      <Button type="submit">Review changes</Button>
    </form>
  );
}
