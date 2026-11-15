"use client";

import { useState } from "react";
import { DateTime } from "luxon";
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
import { useWorkspace } from "@/components/workspace/context";
import { DateField, TimeField } from "@/components/workspace/date-field";
import { LiveField } from "@/components/workspace/primitives";
import { count, languageLabels } from "@/components/workspace/help-line/format";
import { LiveFailure, LiveWaiting } from "@/components/workspace/states";
import { useSave } from "@/components/workspace/use-save";
import {
  firstName,
  need,
  type Board,
  type Visit,
  type Visitors,
} from "@/components/workspace/visits/format";

const DAYS_AHEAD = 42;

/**
 * The day and the time of a visit, in the group's own wall clock: the shared date and time fields,
 * bounded to the next six weeks and to the hours people visit. Read them back with whenOf().
 */
function VisitWhen({ defaultValue }: { defaultValue?: string }) {
  const { data, now } = useWorkspace();
  const [day, time] = (defaultValue ?? "").split("T");
  const today = DateTime.fromMillis(now, { zone: data.church.timeZone });
  return (
    <div className="live-form-grid">
      <LiveField label="Day">
        <DateField
          name="day"
          required
          defaultValue={day}
          min={today.toISODate() ?? undefined}
          max={today.plus({ days: DAYS_AHEAD }).toISODate() ?? undefined}
        />
      </LiveField>
      <LiveField label="Time">
        <TimeField name="time" required defaultValue={time} />
      </LiveField>
    </div>
  );
}
/** The chosen day and time as the backend takes them: yyyy-MM-ddTHH:mm. */
const whenOf = (data: FormData) => `${data.get("day")}T${data.get("time")}`;

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
      {error && <LiveFailure message={error} retry />}
      <LiveWaiting when={pending} />
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
  onSaved: (planned: {
    visitId: Id<"visits">;
    neighborName: string;
    pair: [string, string];
  }) => void;
}) {
  const [search, setSearch] = useState("");
  const people = useQuery(api.visits.visitors, { churchId });
  const neighbors = useQuery(api.neighbors.list, { churchId, search });
  const plan = useMutation(api.visits.plan);
  const { pending, error, save } = useSave();
  return (
    <PlanFormView
      board={board}
      requestId={requestId}
      people={people}
      neighbors={neighbors?.rows}
      onSearch={setSearch}
      pending={pending}
      error={error}
      onPlan={async (who, at, first, second) => {
        const outcome = await save(() =>
          plan({
            churchId,
            neighborId: who.neighborId,
            requestId: who.requestId,
            at,
            visitorIds: [first.memberId, second.memberId],
          }),
        );
        if (outcome.saved)
          onSaved({
            visitId: outcome.result,
            neighborName: who.neighborName,
            pair: [first.name, second.name],
          });
      }}
    />
  );
}

/** Who a visit is for: a request waiting on one, or a neighbor visited with no request, as a friend. */
type Visited = {
  neighborId: Id<"neighbors">;
  neighborName: string;
  requestId?: Id<"assistanceRequests">;
};
const withoutRequest = "none";

/** The plan form itself, given the people who may go and the neighbors found: no fetching here. */
export function PlanFormView({
  board,
  requestId,
  people,
  neighbors,
  onSearch,
  pending,
  error,
  onPlan,
}: {
  board: Board;
  requestId?: Id<"assistanceRequests">;
  people: Visitors | undefined;
  /** Neighbors matching the search, for a visit with no request. */
  neighbors:
    { id: Id<"neighbors">; name: string; address: string }[] | undefined;
  onSearch: (text: string) => void;
  pending: boolean;
  error: string;
  onPlan: (
    who: Visited,
    at: string,
    first: Visitors[number],
    second: Visitors[number],
  ) => void;
}) {
  const waiting = [
    ...(board.suggested ? [board.suggested.request] : []),
    ...board.toArrange,
  ];
  const [chosen, setChosen] = useState<string>(
    requestId ?? waiting[0]?.requestId ?? withoutRequest,
  );
  const suggested =
    board.suggested?.request.requestId === chosen ? board.suggested : null;

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
          (candidate) => candidate.requestId === chosen,
        );
        const neighbor = neighbors?.find(
          (candidate) => candidate.id === data.get("neighbor"),
        );
        const who: Visited | undefined =
          request ??
          (neighbor && {
            neighborId: neighbor.id,
            neighborName: neighbor.name,
          });
        const [first, second] = [data.get("first"), data.get("second")].map(
          (id) => people.find((person) => person.memberId === id),
        );
        if (!who || !first || !second) return;
        onPlan(who, whenOf(data), first, second);
      }}
    >
      {waiting.length > 0 && (
        <LiveField label="Visit for">
          <NativeSelect
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            className="w-full"
          >
            <NativeSelectOptGroup
              label={`${count(waiting.length, "request", "requests")} waiting on a visit`}
            >
              {waiting.map((request) => (
                <NativeSelectOption
                  key={request.requestId}
                  value={request.requestId}
                >
                  {request.neighborName} · {need(request.kind, request.amount)}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
            <NativeSelectOption value={withoutRequest}>
              A neighbor with no request, as a follow-up
            </NativeSelectOption>
          </NativeSelect>
        </LiveField>
      )}
      {chosen === withoutRequest && (
        <div className="live-form-grid">
          <LiveField label="Find the neighbor">
            <Input
              type="search"
              autoComplete="off"
              placeholder="Name, phone or street"
              onChange={(event) => onSearch(event.target.value)}
            />
          </LiveField>
          <LiveField label="Neighbor">
            <NativeSelect
              name="neighbor"
              required
              className="w-full"
              key={neighbors?.[0]?.id ?? "none"}
              defaultValue={neighbors?.[0]?.id ?? ""}
            >
              {neighbors?.length ? (
                neighbors.map((neighbor) => (
                  <NativeSelectOption key={neighbor.id} value={neighbor.id}>
                    {neighbor.name} · {neighbor.address}
                  </NativeSelectOption>
                ))
              ) : (
                <NativeSelectOption value="" disabled>
                  {neighbors ? "No one by that name" : "Looking…"}
                </NativeSelectOption>
              )}
            </NativeSelect>
          </LiveField>
        </div>
      )}
      <VisitWhen defaultValue={board.suggested?.at} />
      <div className="live-form-grid" key={chosen}>
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
      <p className="visits-consequence">
        Both are asked for their yes. Nothing is sent to the neighbor.
      </p>
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
  const [problem, setProblem] = useState<"hours" | "miles" | "driver" | null>(
    null,
  );
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
        const drove = String(data.get("drove") ?? "");
        if (miles > 0 && !drove) return setProblem("driver");
        setProblem(null);
        const driver = visit.visitors.find(
          (visitor) => visitor.memberId === drove,
        );
        const written = {
          churchId,
          visitId: visit.id,
          notes: String(data.get("notes") ?? ""),
          hours,
          miles,
        };
        const outcome = await save(async () => {
          if (!driver || miles === 0) return writeUp(written);
          try {
            return await writeUp({ ...written, driverId: driver.memberId });
          } catch (cause) {
            // A backend one step behind the website does not know the driver yet; it still saves the visit.
            if (cause instanceof Error && cause.message.includes("driverId"))
              return writeUp(written);
            throw cause;
          }
        });
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
      <LiveField
        label="Who drove"
        help="The miles go to the driver, so one car is counted once."
      >
        <NativeSelect
          name="drove"
          defaultValue=""
          className="w-full"
          aria-invalid={problem === "driver" || undefined}
        >
          <NativeSelectOption value="" disabled>
            Choose who drove
          </NativeSelectOption>
          {visit.visitors.map((visitor) => (
            <NativeSelectOption key={visitor.memberId} value={visitor.memberId}>
              {visitor.name}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="each">
            Each drove their own car
          </NativeSelectOption>
        </NativeSelect>
      </LiveField>
      <FormEnd
        error={
          problem === "hours"
            ? "Enter the hours the visit took, such as 1.5."
            : problem === "miles"
              ? "Enter the miles driven, or 0."
              : problem === "driver"
                ? "Choose who drove, so the miles go to the right person."
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
        const next = whenOf(new FormData(event.currentTarget));
        const outcome = await save(() =>
          reschedule({ churchId, visitId, at: next }),
        );
        if (outcome.saved) onSaved();
      }}
    >
      <VisitWhen defaultValue={at} />
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
      <LiveField
        label={leaving.removed ? "Second visitor" : `In place of ${firstName(leaving.name)}`}
        help="The new visitor is asked for a yes. The other visitor’s answer stays as it is."
      >
        <VisitorSelect name="joining" people={others} />
      </LiveField>
      <FormEnd error={error} pending={pending} submit="Ask this person" />
    </form>
  );
}
