"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import { useMutation } from "convex/react";
import { useQuery, useSearchAsked } from "@/components/workspace/query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { SheetCancel } from "@/components/workspace/live-dialog";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/components/workspace/context";
import { DateField, TimeField } from "@/components/workspace/date-field";
import { LiveField, markWrong } from "@/components/workspace/primitives";
import { LiveFailure, LiveWaiting } from "@/components/workspace/states";
import { useSave } from "@/components/workspace/use-save";
import { fileAway } from "@/components/workspace/visits/file-away";
import { fill } from "@/lib/words/fill";
import {
  firstName,
  need,
  type Board,
  type Visit,
  type Visitors,
} from "@/components/workspace/visits/format";
import { visitsWords } from "@/lib/words/rooms/visits";

const DAYS_AHEAD = 42;

/**
 * The day and the time of a visit, in the group's own wall clock: the shared date and time fields,
 * bounded to the next six weeks and to the hours people visit. Read them back with whenOf().
 */
function VisitWhen({ defaultValue }: { defaultValue?: string }) {
  const { data, now, words } = useWorkspace();
  const text = visitsWords(words).forms;
  const [day, time] = (defaultValue ?? "").split("T");
  const today = DateTime.fromMillis(now, { zone: data.church.timeZone });
  return (
    <div className="live-form-grid">
      <LiveField label={text.day}>
        <DateField
          name="day"
          required
          defaultValue={day}
          min={today.toISODate() ?? undefined}
          max={today.plus({ days: DAYS_AHEAD }).toISODate() ?? undefined}
        />
      </LiveField>
      <LiveField label={text.time} said={{ neededChoice: text.chooseTime }}>
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
        <SheetCancel disabled={pending} />
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
  const { words } = useWorkspace();
  const room = visitsWords(words);
  const text = room.forms;
  const option = (person: Visitors[number]) => (
    <NativeSelectOption key={person.memberId} value={person.memberId}>
      {person.language === "en"
        ? person.name
        : room.speakers[person.language](person.name)}
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
        {text.choosePerson}
      </NativeSelectOption>
      {others.length ? (
        <>
          <NativeSelectOptGroup label={text.homeVisitors}>
            {team.map(option)}
          </NativeSelectOptGroup>
          <NativeSelectOptGroup label={text.otherMembers}>
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
  const neighbors = useQuery(api.neighbors.list, { churchId, search: useSearchAsked(search) });
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
function PlanFormView({
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
  const { words } = useWorkspace();
  const text = visitsWords(words).forms;
  const [chosen, setChosen] = useState<string>(
    requestId ?? waiting[0]?.requestId ?? withoutRequest,
  );
  const suggested =
    board.suggested?.request.requestId === chosen ? board.suggested : null;

  if (!people)
    return (
      <p className="visits-quiet" role="status">
        {text.finding}
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
        <LiveField label={text.visitFor}>
          <NativeSelect
            value={chosen}
            onChange={(event) => setChosen(event.target.value)}
            className="w-full"
          >
            <NativeSelectOptGroup
              label={text.waiting(waiting.length)}
            >
              {waiting.map((request) => (
                <NativeSelectOption
                  key={request.requestId}
                  value={request.requestId}
                >
                  {request.neighborName} · {need(words, request.kind, request.amount)}
                </NativeSelectOption>
              ))}
            </NativeSelectOptGroup>
            <NativeSelectOption value={withoutRequest}>
              {text.noRequest}
            </NativeSelectOption>
          </NativeSelect>
        </LiveField>
      )}
      {chosen === withoutRequest && (
        <div className="live-form-grid">
          <LiveField label={text.findNeighbor}>
            <Input
              type="search"
              autoComplete="off"
              placeholder={text.searchPlaceholder}
              onChange={(event) => onSearch(event.target.value)}
            />
          </LiveField>
          <LiveField label={text.neighbor} said={{ neededChoice: text.chooseNeighbor }}>
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
                  {neighbors ? text.noOne : text.looking}
                </NativeSelectOption>
              )}
            </NativeSelect>
          </LiveField>
        </div>
      )}
      <VisitWhen defaultValue={board.suggested?.at} />
      <div className="live-form-grid" key={chosen}>
        <LiveField label={text.first} said={{ neededChoice: text.chooseFirst }}>
          <VisitorSelect
            name="first"
            people={people}
            defaultValue={suggested?.pair?.[0].memberId}
          />
        </LiveField>
        <LiveField label={text.second} said={{ neededChoice: text.chooseSecond }}>
          <VisitorSelect
            name="second"
            people={people}
            defaultValue={suggested?.pair?.[1].memberId}
          />
        </LiveField>
      </div>
      <p className="visits-consequence">
        {text.consequence}
      </p>
      <FormEnd error={error} pending={pending} submit={text.plan} />
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
const places = ["home", "prison", "hospital", "eldercare", "other"] as const;
const placeOf = (value: FormDataEntryValue | null) => places.find((place) => place === value) ?? "home";

export function WriteUpForm({
  churchId,
  visit,
  onSaved,
}: {
  churchId: Id<"churches">;
  visit: Visit;
  onSaved: () => void;
}) {
  const { words } = useWorkspace();
  const text = visitsWords(words).forms;
  const writeUp = useMutation(api.visits.writeUp);
  const { pending, error, save } = useSave();
  return (
    <form
      className="live-form"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        const hours = typedNumber(data.get("hours"));
        const miles = typedNumber(data.get("miles"));
        const drove = String(data.get("drove") ?? "");
        const guestTyped = String(data.get("guestHours") ?? "").trim();
        const guestHours = guestTyped ? typedNumber(guestTyped) : 0;
        if (guestHours === null || guestHours > 200) markWrong(form, "guestHours", text.problems.hours);
        // A field that can't be taken is said under that field, and the first one is put in focus (LiveField):
        // the box that says nothing was saved is kept for a save that truly failed.
        if (hours === null || hours <= 0 || hours > 24) markWrong(form, "hours", text.problems.hours);
        if (miles === null || miles > 1000) markWrong(form, "miles", text.problems.miles);
        else if (miles > 0 && !drove) markWrong(form, "drove", text.problems.driver);
        if (!form.checkValidity()) return;
        if (hours === null || miles === null) return;
        const driver = visit.visitors.find(
          (visitor) => visitor.memberId === drove,
        );
        const written = {
          churchId,
          visitId: visit.id,
          notes: String(data.get("notes") ?? ""),
          hours,
          miles,
          place: placeOf(data.get("place")),
          ...(guestHours && { guestHours }),
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
        // Only once the save has committed is the sheet folded into the household's file; a refusal leaves it flat.
        if (!outcome.saved) return;
        await fileAway(form.closest<HTMLElement>(".live-dialog"), visit.neighborName);
        onSaved();
      }}
      data-refused={error ? "" : undefined}
    >
      <LiveField
        label={text.found}
        help={text.foundHelp}
      >
        <Textarea name="notes" rows={5} />
      </LiveField>
      <div className="live-form-grid">
        <LiveField
          label={text.hours}
          said={{ needed: text.problems.hours, neededCheck: text.problems.hours }}
          help={fill(text.hoursHelp, { first: firstName(visit.visitors[0]?.name ?? ""), second: firstName(visit.visitors[1]?.name ?? "") })}
        >
          <Input
            name="hours"
            inputMode="decimal"
            autoComplete="off"
          />
        </LiveField>
        <LiveField label={text.miles} help={text.milesHelp} said={{ needed: text.problems.miles, neededCheck: text.problems.miles }}>
          <Input
            name="miles"
            inputMode="decimal"
            autoComplete="off"
          />
        </LiveField>
      </div>
      <div className="live-form-grid">
        <LiveField label={text.place}>
          <NativeSelect name="place" defaultValue="home" className="w-full">
            {places.map((place) => (
              <NativeSelectOption key={place} value={place}>{text.places[place]}</NativeSelectOption>
            ))}
          </NativeSelect>
        </LiveField>
        <LiveField label={text.guestHours} help={text.guestHoursHelp}>
          <Input name="guestHours" inputMode="decimal" autoComplete="off" />
        </LiveField>
      </div>
      <LiveField
        label={text.drove}
        help={text.droveHelp}
        said={{ neededChoice: text.problems.driver, neededCheck: text.problems.driver }}
      >
        <NativeSelect
          name="drove"
          defaultValue=""
          className="w-full"
        >
          <NativeSelectOption value="" disabled>
            {text.chooseDrove}
          </NativeSelectOption>
          {visit.visitors.map((visitor) => (
            <NativeSelectOption key={visitor.memberId} value={visitor.memberId}>
              {visitor.name}
            </NativeSelectOption>
          ))}
          <NativeSelectOption value="each">
            {text.each}
          </NativeSelectOption>
        </NativeSelect>
      </LiveField>
      <FormEnd
        error={error}
        pending={pending}
        submit={text.saveWriteUp}
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
  const { words } = useWorkspace();
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
      <FormEnd error={error} pending={pending} submit={visitsWords(words).forms.changeTime} />
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
  const { words } = useWorkspace();
  const text = visitsWords(words).forms;
  const people = useQuery(api.visits.visitors, { churchId });
  const replace = useMutation(api.visits.replaceVisitor);
  const { pending, error, save } = useSave();
  if (!people)
    return (
      <p className="visits-quiet" role="status">
        {text.finding}
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
        label={leaving.removed ? text.second : text.inPlaceOf(firstName(leaving.name))}
        help={text.replaceHelp}
        said={{ neededChoice: text.chooseWho }}
      >
        <VisitorSelect name="joining" people={others} />
      </LiveField>
      <FormEnd error={error} pending={pending} submit={text.askPerson} />
    </form>
  );
}
