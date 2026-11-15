"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { LiveField } from "@/components/workspace/primitives";
import { count, languageLabels } from "@/components/workspace/help-line/format";
import { useSave } from "@/components/workspace/help-line/use-save";
import {
  firstName,
  need,
  type Board,
  type Visit,
  type Visitors,
  type Waiting,
} from "@/components/workspace/visits/format";

function FormEnd({
  error,
  pending,
  submit,
}: {
  error: string;
  pending: boolean;
  submit: string;
}) {
  return (
    <>
      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}
      <div className="live-form-actions">
        <Button type="submit" disabled={pending}>
          {submit}
        </Button>
      </div>
    </>
  );
}

function VisitorSelect({
  name,
  people,
  defaultValue,
}: {
  name: string;
  people: Visitors;
  defaultValue?: string;
}) {
  const option = (person: Visitors[number]) => (
    <NativeSelectOption key={person.memberId} value={person.memberId}>
      {person.name}
      {person.language === "en" ? "" : ` · ${languageLabels[person.language]}`}
    </NativeSelectOption>
  );
  const team = people.filter((person) => person.homeVisitor);
  const others = people.filter((person) => !person.homeVisitor);
  return (
    <NativeSelect
      name={name}
      required
      defaultValue={defaultValue ?? ""}
      className="w-full"
    >
      <NativeSelectOption value="" disabled>
        Choose a person
      </NativeSelectOption>
      {others.length ? (
        <>
          <NativeSelectOptGroup label="Home visitors">
            {team.map(option)}
          </NativeSelectOptGroup>
          <NativeSelectOptGroup label="Other approved members">
            {others.map(option)}
          </NativeSelectOptGroup>
        </>
      ) : (
        team.map(option)
      )}
    </NativeSelect>
  );
}

/** Choose the request, the time and the two people by hand. */
export function PlanForm({
  churchId,
  board,
  requestId,
  onSaved,
}: {
  churchId: Id<"churches">;
  board: Board;
  requestId?: Id<"assistanceRequests">;
  onSaved: (planned: { neighborName: string; pair: [string, string] }) => void;
}) {
  const people = useQuery(api.visits.visitors, { churchId });
  const plan = useMutation(api.visits.plan);
  const { pending, error, save } = useSave();
  return (
    <PlanFormView
      board={board}
      requestId={requestId}
      people={people}
      pending={pending}
      error={error}
      onPlan={async (request, at, first, second) => {
        const outcome = await save(() =>
          plan({
            churchId,
            neighborId: request.neighborId,
            requestId: request.requestId,
            at,
            visitorIds: [first.memberId, second.memberId],
          }),
        );
        if (outcome.saved)
          onSaved({
            neighborName: request.neighborName,
            pair: [first.name, second.name],
          });
      }}
    />
  );
}

/** The plan form itself, given the people who may go: no fetching here. */
export function PlanFormView({
  board,
  requestId,
  people,
  pending,
  error,
  onPlan,
}: {
  board: Board;
  requestId?: Id<"assistanceRequests">;
  people: Visitors | undefined;
  pending: boolean;
  error: string;
  onPlan: (
    request: Waiting,
    at: string,
    first: Visitors[number],
    second: Visitors[number],
  ) => void;
}) {
  const waiting = [
    ...(board.suggested ? [board.suggested.request] : []),
    ...board.toArrange,
  ];
  const suggested =
    board.suggested?.request.requestId === (requestId ?? waiting[0]?.requestId)
      ? board.suggested
      : null;

  if (!waiting.length)
    return (
      <p className="visits-quiet">
        No request for help is waiting on a visit. Record the request on the
        help line first, and it will appear here.
      </p>
    );
  if (!people)
    return (
      <p className="visits-quiet" role="status">
        Finding who can go…
      </p>
    );
  return (
    <form
      className="live-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const request = waiting.find(
          (candidate) => candidate.requestId === data.get("request"),
        );
        const pair = [data.get("first"), data.get("second")].map((id) =>
          people.find((person) => person.memberId === id),
        );
        const [first, second] = pair;
        if (!request || !first || !second) return;
        onPlan(request, String(data.get("at") ?? ""), first, second);
      }}
    >
      <LiveField
        label="Neighbor"
        help={
          waiting.length > 1
            ? `${count(waiting.length, "request is", "requests are")} waiting on a visit.`
            : undefined
        }
      >
        <NativeSelect
          name="request"
          defaultValue={requestId ?? waiting[0].requestId}
          className="w-full"
        >
          {waiting.map((request) => (
            <NativeSelectOption
              key={request.requestId}
              value={request.requestId}
            >
              {request.neighborName} · {need(request.kind, request.amount)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </LiveField>
      <LiveField label="Day and time">
        <Input
          name="at"
          type="datetime-local"
          required
          step={900}
          defaultValue={(board.suggested ?? undefined)?.at}
        />
      </LiveField>
      <div className="live-form-grid">
        <LiveField label="First visitor">
          <VisitorSelect
            name="first"
            people={people}
            defaultValue={suggested?.pair?.[0].memberId}
          />
        </LiveField>
        <LiveField label="Second visitor">
          <VisitorSelect
            name="second"
            people={people}
            defaultValue={suggested?.pair?.[1].memberId}
          />
        </LiveField>
      </div>
      <FormEnd error={error} pending={pending} submit="Plan this visit" />
    </form>
  );
}

/** What a person typed for hours or miles, as a number; null when it is not one. */
function typedNumber(typed: FormDataEntryValue | null) {
  const cleaned = String(typed ?? "")
    .trim()
    .replace(",", ".");
  return /^\d+(\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
}

/** After the visit: what the pair found, and the hours and miles each of them gave. */
export function WriteUpForm({
  churchId,
  visit,
  onSaved,
}: {
  churchId: Id<"churches">;
  visit: Visit;
  onSaved: () => void;
}) {
  const writeUp = useMutation(api.visits.writeUp);
  const { pending, error, save } = useSave();
  const [problem, setProblem] = useState<"hours" | "miles" | null>(null);
  return (
    <form
      className="live-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const hours = typedNumber(data.get("hours"));
        const miles = typedNumber(data.get("miles"));
        if (hours === null || hours <= 0 || hours > 24)
          return setProblem("hours");
        if (miles === null || miles > 1000) return setProblem("miles");
        setProblem(null);
        const outcome = await save(() =>
          writeUp({
            churchId,
            visitId: visit.id,
            notes: String(data.get("notes") ?? ""),
            hours,
            miles,
          }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      <LiveField
        label="What we found"
        help="A few plain sentences: who was home, what the need is, what you agreed."
      >
        <Textarea name="notes" rows={5} />
      </LiveField>
      <div className="live-form-grid">
        <LiveField
          label="Hours"
          help={`For each of you, ${firstName(visit.visitors[0]?.name ?? "")} and ${firstName(visit.visitors[1]?.name ?? "")}.`}
        >
          <Input
            name="hours"
            inputMode="decimal"
            autoComplete="off"
            placeholder="1.5"
            aria-invalid={problem === "hours" || undefined}
          />
        </LiveField>
        <LiveField label="Miles" help="Driven there and back, or 0.">
          <Input
            name="miles"
            inputMode="decimal"
            autoComplete="off"
            placeholder="12"
            aria-invalid={problem === "miles" || undefined}
          />
        </LiveField>
      </div>
      <FormEnd
        error={
          problem === "hours"
            ? "Enter the hours the visit took, such as 1.5."
            : problem === "miles"
              ? "Enter the miles driven, or 0."
              : error
        }
        pending={pending}
        submit="Save the write-up"
      />
    </form>
  );
}

/** Move a planned visit. The time is the group's own wall clock. */
export function TimeForm({
  churchId,
  visitId,
  at,
  onSaved,
}: {
  churchId: Id<"churches">;
  visitId: Id<"visits">;
  at: string;
  onSaved: () => void;
}) {
  const reschedule = useMutation(api.visits.reschedule);
  const { pending, error, save } = useSave();
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const next = String(new FormData(event.currentTarget).get("at") ?? "");
        const outcome = await save(() =>
          reschedule({ churchId, visitId, at: next }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      <LiveField label="Day and time">
        <Input
          name="at"
          type="datetime-local"
          required
          step={900}
          defaultValue={at}
        />
      </LiveField>
      <FormEnd error={error} pending={pending} submit="Change the time" />
    </form>
  );
}

/** One of the pair cannot go: choose who is asked in their place. */
export function ReplaceForm({
  churchId,
  visit,
  leaving,
  onSaved,
}: {
  churchId: Id<"churches">;
  visit: Visit;
  leaving: Visit["visitors"][number];
  onSaved: (joining: string) => void;
}) {
  const people = useQuery(api.visits.visitors, { churchId });
  const replace = useMutation(api.visits.replaceVisitor);
  const { pending, error, save } = useSave();
  if (!people)
    return (
      <p className="visits-quiet" role="status">
        Finding who can go…
      </p>
    );
  const others = people.filter(
    (person) =>
      !visit.visitors.some((visitor) => visitor.memberId === person.memberId),
  );
  return (
    <form
      className="live-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const joining = others.find(
          (person) =>
            person.memberId ===
            new FormData(event.currentTarget).get("joining"),
        );
        if (!joining) return;
        const outcome = await save(() =>
          replace({
            churchId,
            visitId: visit.id,
            leavingId: leaving.memberId,
            joiningId: joining.memberId,
          }),
        );
        if (outcome.saved) onSaved(joining.name);
      }}
    >
      <LiveField label={`In place of ${firstName(leaving.name)}`}>
        <VisitorSelect name="joining" people={others} />
      </LiveField>
      <FormEnd error={error} pending={pending} submit="Ask this person" />
    </form>
  );
}
