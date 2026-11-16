"use client";

import { FOLD_HOLD, foldLeaves, useSavedLine } from "@/components/workspace/fold";
import "./visits.css";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation } from "convex/react";
import { useHour, useQuery } from "@/components/workspace/query";
import { CircleCheck, Printer } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { RoomAside } from "@/components/workspace/aside";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { count, initials } from "@/components/workspace/help-line/format";
import {
  HelpEmpty,
  HelpLoading,
  HelpRoom,
} from "@/components/workspace/help-line/room";
import { LiveFailure } from "@/components/workspace/states";
import { useSave } from "@/components/workspace/use-save";
import {
  PlanForm,
  ReplaceForm,
  WriteUpForm,
} from "@/components/workspace/visits/forms";
import {
  firstName,
  need,
  requestHref,
  sheetHref,
  standing,
  type Board,
  type Suggestion,
  type Visit,
  useEnglishDates,
} from "@/components/workspace/visits/format";
import { VisitSheet } from "@/components/workspace/visits/visit-sheet";

const WEEK = 7 * 24 * 3600000;
type Step =
  | { kind: "plan"; requestId?: Id<"assistanceRequests"> }
  | { kind: "writeUp"; visit: Visit }
  | { kind: "replace"; visit: Visit; leaving: Visit["visitors"][number] };

export function VisitsSection() {
  return (
    <HelpRoom loading="Opening home visits">
      <Visits />
    </HelpRoom>
  );
}

function Visits() {
  const { data, now, setHeadAction } = useWorkspace();
  const format = useEnglishDates();
  const churchId = data.church.id;
  const sheetId = useSearchParams().get("sheet");
  const at = useHour();
  const board = useQuery(api.visits.board, at ? { churchId, at } : "skip");
  const plan = useMutation(api.visits.plan);
  const { pending, error, save, clear } = useSave();
  const [step, setStep] = useState<Step | null>(null);
  const [done, setDone] = useState("");
  // The visit just planned or written up, so its row can show the paper moving into place.
  const [fresh, setFresh] = useState<Fresh | null>(null);
  // The pair sheet whose yes was just given: it stays a beat with its corner turned green, then leaves.
  const [asked, setAsked] = useState<Suggestion | null>(null);
  const start = (next: Step) => {
    setDone("");
    clear();
    setStep(next);
  };
  const planVisit = useCallback(() => {
    setDone("");
    setStep({ kind: "plan" });
  }, []);
  const waitingOnYes = Boolean(board?.suggested);
  const boardUnknown = board === undefined;
  useLayoutEffect(() => {
    if (sheetId) return;
    // The pair sheet has the screen's one filled button, so the head button goes quiet beside it.
    setHeadAction({
      label: "Plan a visit",
      run: planVisit,
      quiet: waitingOnYes,
      // Until the board has arrived the room cannot know whether a suggestion will hold the filled button.
      unsettled: boardUnknown,
      plus: true,
    });
    return () => setHeadAction(null);
  }, [sheetId, setHeadAction, planVisit, waitingOnYes, boardUnknown]);
  const finish = (message: string, moved: Fresh | null = null) => {
    setStep(null);
    setFresh(moved);
    setDone(message);
  };
  // A weekday alone names a day of this week; a visit further off is given its date.
  const day = (at: number) =>
    Math.abs(at - now) < WEEK
      ? format(at, { weekday: "long", month: undefined, day: undefined })
      : format(at, { weekday: "long", month: "long", day: "numeric" });
  const time = (at: number) =>
    format(at, {
      month: undefined,
      day: undefined,
      hour: "numeric",
      minute: "2-digit",
    });

  if (sheetId) return <VisitSheet visitId={sheetId as Id<"visits">} />;
  if (!board) return <HelpLoading label="Opening home visits" />;
  return (
    <div className="visits-room">
      {done && (
        <VisitsDone key={done} pair={fresh?.pair}>
          {done}
        </VisitsDone>
      )}
      {error && (
        <LiveFailure message={error} kept="Nothing was changed. Try again, or choose the pair yourself." />
      )}
      <VisitsView
        board={board}
        now={now}
        format={format}
        busy={pending}
        fresh={fresh?.id}
        asked={asked}
        onPlan={(requestId) => start({ kind: "plan", requestId })}
        onAsk={async (suggested, pair) => {
          setDone("");
          setAsked(suggested);
          const beat = new Promise((settle) => setTimeout(settle, FOLD_HOLD));
          const outcome = await save(() =>
            plan({
              churchId,
              neighborId: suggested.request.neighborId,
              requestId: suggested.request.requestId,
              at: suggested.at,
              visitorIds: pair.map((person) => person.memberId),
            }),
          );
          await beat;
          if (outcome.saved) await foldLeaves();
          setAsked(null);
          if (outcome.saved)
            finish(
              `${firstName(pair[0].name)} and ${firstName(pair[1].name)} have been asked to visit ${suggested.request.neighborName} on ${day(suggested.scheduledAt)} at ${time(suggested.scheduledAt)}.`,
              { id: outcome.result, pair: pair.map((person) => person.name) },
            );
        }}
        onWriteUp={(visit) => start({ kind: "writeUp", visit })}
        onReplace={(visit, leaving) =>
          start({ kind: "replace", visit, leaving })
        }
      />
      {step?.kind === "plan" && (
        <LiveDialog
          title="Plan a visit"
          description="Two people go together, always."
          onClose={() => setStep(null)}
        >
          <PlanForm
            churchId={churchId}
            board={board}
            requestId={step.requestId}
            onSaved={(planned) =>
              finish(
                `${firstName(planned.pair[0])} and ${firstName(planned.pair[1])} have been asked to visit ${planned.neighborName}. The visit is under Coming up.`,
                { id: planned.visitId, pair: planned.pair },
              )
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "replace" && (
        <LiveDialog
          title={step.leaving.removed ? "A second visitor" : `${firstName(step.leaving.name)} can’t go`}
          description={`Choose who goes to ${step.visit.neighborName} with ${step.visit.visitors.find((visitor) => visitor.memberId !== step.leaving.memberId)?.name ?? "the other visitor"}.`}
          onClose={() => setStep(null)}
        >
          <ReplaceForm
            churchId={churchId}
            visit={step.visit}
            leaving={step.leaving}
            onSaved={(joining) =>
              finish(
                step.leaving.removed
                  ? `${firstName(joining)} has been asked to visit ${step.visit.neighborName}.`
                  : `${firstName(joining)} has been asked to visit ${step.visit.neighborName} in place of ${firstName(step.leaving.name)}.`,
              )
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "writeUp" && (
        <LiveDialog
          title={`The visit to ${step.visit.neighborName}`}
          description={`${day(step.visit.scheduledAt)} at ${time(step.visit.scheduledAt)}, ${step.visit.visitors.map((visitor) => visitor.name).join(" and ")}.`}
          onClose={() => setStep(null)}
        >
          <WriteUpForm
            churchId={churchId}
            visit={step.visit}
            onSaved={() =>
              finish(
                `Written up. The visit to ${step.visit.neighborName} now counts toward the year’s hours and miles.`,
                { id: step.visit.id },
              )
            }
          />
        </LiveDialog>
      )}
    </div>
  );
}

type Fresh = { id: Id<"visits">; pair?: string[] };

/** Two people as one pair. joining plays the two sets of initials sliding together, once. */
function Pair({
  names,
  joining,
  bare,
}: {
  names: string[];
  joining?: boolean;
  bare?: boolean;
}) {
  return (
    <span className={joining ? "help-person visits-join" : "help-person"}>
      {names.map((name) => (
        <span className="help-initials" key={name} aria-hidden="true">
          {initials(name)}
        </span>
      ))}
      {!bare && (
        <span>
          {names.map((name, index) => (
            <Fragment key={name}>
              {index > 0 && " and "}
              <span className="visits-name">{name}</span>
            </Fragment>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * The line after a step is taken. It is seen for six seconds, then leaves the page and
 * stays as a message for screen readers. After a pair is asked, their initials come
 * together beside the words.
 */
export function VisitsDone({
  pair,
  children,
}: {
  pair?: string[];
  children: string;
}) {
  const line = useRef<HTMLDivElement>(null);
  const seen = useSavedLine(line);
  useEffect(() => line.current?.focus({ preventScroll: true }), []);
  return (
    <div
      className={seen ? "live-success help-done visits-done paper-settle" : "sr-only"}
      role="status"
      tabIndex={-1}
      ref={line}
    >
      {seen && (pair ? (
        <Pair names={pair} joining bare />
      ) : (
        <CircleCheck size={22} aria-hidden="true" />
      ))}
      {seen ? <span>{children}</span> : children}
    </div>
  );
}

/** The screen itself, given its records: no fetching here, so it can be shown with made-up data. */
export function VisitsView({
  board,
  now,
  format,
  busy,
  fresh,
  asked,
  onPlan,
  onAsk,
  onWriteUp,
  onReplace,
}: {
  board: Board;
  now: number;
  format: Workspace["format"];
  busy: boolean;
  /** The visit just planned or written up: its pair joins, or its row settles into Written up. */
  fresh?: Id<"visits">;
  /** The suggestion whose pair was just asked: shown a beat longer with its corner green. */
  asked?: Suggestion | null;
  onPlan: (requestId?: Id<"assistanceRequests">) => void;
  onAsk: (suggested: Suggestion, pair: NonNullable<Suggestion["pair"]>) => void;
  onWriteUp: (visit: Visit) => void;
  onReplace: (visit: Visit, leaving: Visit["visitors"][number]) => void;
}) {
  const suggested = asked ?? board.suggested;
  const coming = board.scheduled.filter((visit) => visit.scheduledAt >= now);
  const toWriteUp = board.scheduled.filter((visit) => visit.scheduledAt < now);
  const short = coming.filter((visit) =>
    visit.visitors.some((visitor) => visitor.removed),
  ).length;
  const thisWeek = coming.filter(
    (visit) => visit.scheduledAt < now + WEEK,
  ).length;
  const part = (at: number, options: Intl.DateTimeFormatOptions) =>
    format(at, { month: undefined, day: undefined, ...options });
  const weekday = (at: number) => part(at, { weekday: "long" });
  const leaf = (at: number) => {
    const [time, half = ""] = part(at, {
      hour: "numeric",
      minute: "2-digit",
    }).split(/\s/);
    const near = Math.abs(at - now) < WEEK;
    return (
      <div className="live-date-leaf">
        <span>
          {near
            ? part(at, { weekday: "short" })
            : format(at, { month: "short", day: "numeric" })}
        </span>
        <strong>{time}</strong>
        <span>{half}</span>
      </div>
    );
  };
  // The side column on a wide screen: the week's visits by day. Only while the pair sheet holds the
  // top of the room; without it, Coming up is the first thing on screen and says the same.
  const goingOut = new Map<string, Visit[]>();
  for (const visit of suggested ? coming : []) {
    if (visit.scheduledAt >= now + WEEK) continue;
    const day = format(visit.scheduledAt, { weekday: "long", month: "long", day: "numeric" });
    goingOut.set(day, [...(goingOut.get(day) ?? []), visit]);
  }
  const nothing =
    !suggested &&
    !coming.length &&
    !toWriteUp.length &&
    !board.writtenUp.length;

  return (
    <>
      {suggested && (
        <section
          // Each request is its own sheet, so the next one rises as the last one leaves.
          key={suggested.request.requestId}
          className={asked ? "help-sheet paper-fold" : "help-sheet"}
          data-fold-leaves={asked ? "" : undefined}
          aria-label={`Visit to arrange for ${suggested.request.neighborName}`}
        >
          <p className="help-sheet-label">
            {asked
              ? `Asked for ${weekday(suggested.scheduledAt)}`
              : suggested.pair
                ? `A pair for ${weekday(suggested.scheduledAt)}`
                : "Waiting for a pair"}
          </p>
          <div className="help-sheet-body">
            <div>
              <h2>{suggested.request.neighborName}</h2>
              <p>
                {suggested.request.address} ·{" "}
                {need(suggested.request.kind, suggested.request.amount)}
              </p>
              {suggested.pair && (
                <p className="help-why visits-pair visits-who">
                  <Pair names={suggested.pair.map((person) => person.name)} />
                </p>
              )}
              <p>{suggested.reason}</p>
            </div>
            <div className="help-actions">
              {asked ? (
                <span className="live-status">Both asked</span>
              ) : suggested.pair ? (
                <>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      suggested.pair && onAsk(suggested, suggested.pair)
                    }
                  >
                    Ask this pair
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onPlan(suggested.request.requestId)}
                  >
                    Choose others
                  </Button>
                </>
              ) : (
                <Button onClick={() => onPlan(suggested.request.requestId)}>
                  Choose a pair
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {goingOut.size > 0 && (
        <RoomAside title="Going out this week">
          {[...goingOut].map(([day, visits]) => (
            <section className="visits-aside-day" key={day}>
              <h3>{day}</h3>
              <ul>
                {visits.map((visit) => {
                  const going = visit.visitors.filter((visitor) => !visitor.removed);
                  return (
                    <li key={visit.id}>
                      <span>{part(visit.scheduledAt, { hour: "numeric", minute: "2-digit" })}</span>
                      <span>
                        {going.map((visitor) => (
                          <strong key={visitor.memberId}>{visitor.name}</strong>
                        ))}
                        {going.length < 2 && <em>{standing(visit).text}</em>}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </RoomAside>
      )}
      {nothing ? (
        <HelpEmpty title="No one is waiting on a visit.">
          When a request for help comes in on the help line, it appears here
          with two people who are free to go.
        </HelpEmpty>
      ) : (
        <section>
          <div className="live-section-head">
            <h2>Coming up</h2>
            <span className="live-count">
              {[
                coming.length ? `${thisWeek} this week` : "",
                short ? `${count(short, "is", "are")} short of a visitor` : "",
                board.toArrange.length
                  ? `${count(board.toArrange.length, "more needs", "more need")} a pair`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </div>
          {coming.length ? (
            <div className="live-list">
              {coming.map((visit) => {
                const pair = standing(visit);
                return (
                  <div className="help-row" key={visit.id}>
                    {leaf(visit.scheduledAt)}
                    <div>
                      <p className="visits-who">
                        <Pair
                          names={visit.visitors.filter((visitor) => !visitor.removed).map((visitor) => visitor.name)}
                          joining={visit.id === fresh}
                        />
                      </p>
                      <h3>{visit.neighborName}</h3>
                      <p>{visit.address}</p>
                    </div>
                    <div className="live-row-actions">
                      {/* Keyed by its words, so an answer arriving from a visitor's phone rises into place. */}
                      <span
                        key={pair.text}
                        className="live-status paper-rise"
                        data-state={
                          pair.state === "accepted" ? undefined : "waiting"
                        }
                      >
                        {pair.text}
                      </span>
                      {pair.state === "short" && (
                        <Button onClick={() => onReplace(visit, pair.who)}>
                          Ask a second visitor
                        </Button>
                      )}
                      {pair.state === "declined" && (
                        <Button
                          variant="outline"
                          onClick={() => onReplace(visit, pair.who)}
                        >
                          Ask someone else
                        </Button>
                      )}
                      <Button variant="outline" asChild>
                        <Link href={sheetHref(visit.id)}>
                          <Printer size={17} aria-hidden="true" /> Visit sheet
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="visits-quiet">
              No visits are planned for the days ahead.
            </p>
          )}
        </section>
      )}

      {toWriteUp.length > 0 && (
        <section className="live-section">
          <div className="live-section-head">
            <h2>Done, to write up</h2>
            <span className="live-count">
              {count(toWriteUp.length, "visit", "visits")}
            </span>
          </div>
          <div className="live-list">
            {toWriteUp.map((visit) => (
              <div className="help-row" key={visit.id}>
                {leaf(visit.scheduledAt)}
                <div>
                  <p className="visits-who">
                    <Pair
                      names={visit.visitors.map((visitor) => visitor.name)}
                    />
                  </p>
                  <h3>{visit.neighborName}</h3>
                </div>
                <div className="live-row-actions">
                  <Button variant="outline" onClick={() => onWriteUp(visit)}>
                    Write up
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {board.writtenUp.length > 0 && (
        <section className="live-section">
          <div className="live-section-head">
            <h2>Written up</h2>
            <span className="live-count">The latest visits</span>
          </div>
          <div className="live-list">
            {board.writtenUp.map((visit) => (
              <div
                className={
                  visit.id === fresh ? "help-row visits-filed" : "help-row"
                }
                data-quiet
                key={visit.id}
              >
                {leaf(visit.scheduledAt)}
                <div>
                  <p className="visits-who">
                    <Pair
                      names={visit.visitors.map((visitor) => visitor.name)}
                    />
                  </p>
                  <h3>{visit.neighborName}</h3>
                  {visit.notes && <p className="visits-found">{visit.notes}</p>}
                </div>
                <div className="live-row-actions">
                  <span className="live-status visits-given">
                    {count(visit.visitors[0]?.hours ?? 0, "hour", "hours")} ·{" "}
                    {count(
                      Math.max(
                        ...visit.visitors.map((visitor) => visitor.miles),
                      ),
                      "mile",
                      "miles",
                    )}
                  </span>
                  {visit.requestId && (
                    <Button variant="outline" asChild>
                      <Link
                        href={requestHref(visit.neighborId, visit.requestId)}
                      >
                        Open the request
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
