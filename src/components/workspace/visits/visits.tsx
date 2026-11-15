"use client";

import "./visits.css";
import { useCallback, useLayoutEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Check, Printer } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import { HelpDialog } from "@/components/workspace/help-line/forms";
import { count, initials } from "@/components/workspace/help-line/format";
import {
  HelpDone,
  HelpEmpty,
  HelpLoading,
  HelpRoom,
} from "@/components/workspace/help-line/room";
import { useSave } from "@/components/workspace/help-line/use-save";
import {
  PlanForm,
  ReplaceForm,
  WriteUpForm,
} from "@/components/workspace/visits/forms";
import {
  amount,
  firstName,
  need,
  sheetHref,
  standing,
  type Board,
  type Suggestion,
  type Visit,
} from "@/components/workspace/visits/format";
import { VisitSheet } from "@/components/workspace/visits/visit-sheet";

const WEEK = 7 * 24 * 3600000;
type Step =
  | { kind: "plan"; requestId?: Id<"assistanceRequests"> }
  | { kind: "writeUp"; visit: Visit; hours: number; miles: number }
  | { kind: "replace"; visit: Visit; leaving: Visit["visitors"][number] };

export function VisitsSection() {
  return (
    <HelpRoom loading="Opening home visits">
      <Visits />
    </HelpRoom>
  );
}

function Visits() {
  const { data, format, now, setHeadAction } = useWorkspace();
  const churchId = data.church.id;
  const sheetId = useSearchParams().get("sheet");
  const board = useQuery(api.visits.board, { churchId });
  const plan = useMutation(api.visits.plan);
  const { pending, error, save, clear } = useSave();
  const [step, setStep] = useState<Step | null>(null);
  const [done, setDone] = useState("");
  const start = (next: Step) => {
    setDone("");
    clear();
    setStep(next);
  };
  const planVisit = useCallback(() => {
    setDone("");
    setStep({ kind: "plan" });
  }, []);
  useLayoutEffect(() => {
    if (sheetId) return;
    setHeadAction({ label: "Plan a visit", run: planVisit });
    return () => setHeadAction(null);
  }, [sheetId, setHeadAction, planVisit]);
  const finish = (message: string) => {
    setStep(null);
    setDone(message);
  };
  const day = (at: number) =>
    format(at, { weekday: "long", month: undefined, day: undefined });
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
    <>
      {done && <HelpDone>{done}</HelpDone>}
      {error && (
        <div className="live-error" role="alert">
          <p>{error}</p>
          <p className="live-error-recovery">
            Nothing was changed. Try again, or choose the pair yourself.
          </p>
        </div>
      )}
      <VisitsView
        board={board}
        now={now}
        format={format}
        busy={pending}
        onPlan={(requestId) => start({ kind: "plan", requestId })}
        onAsk={async (suggested, pair) => {
          setDone("");
          const outcome = await save(() =>
            plan({
              churchId,
              neighborId: suggested.request.neighborId,
              requestId: suggested.request.requestId,
              at: suggested.at,
              visitorIds: pair.map((person) => person.memberId),
            }),
          );
          if (outcome.saved)
            finish(
              `${firstName(pair[0].name)} and ${firstName(pair[1].name)} have been asked to visit ${suggested.request.neighborName} on ${day(suggested.scheduledAt)} at ${time(suggested.scheduledAt)}.`,
            );
        }}
        onWriteUp={(visit, hours, miles) =>
          start({ kind: "writeUp", visit, hours, miles })
        }
        onReplace={(visit, leaving) =>
          start({ kind: "replace", visit, leaving })
        }
      />
      {step?.kind === "plan" && (
        <HelpDialog
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
              )
            }
          />
        </HelpDialog>
      )}
      {step?.kind === "replace" && (
        <HelpDialog
          title={`${firstName(step.leaving.name)} can’t go`}
          description={`Choose who goes to ${step.visit.neighborName} with ${step.visit.visitors.find((visitor) => visitor.memberId !== step.leaving.memberId)?.name ?? "the other visitor"}.`}
          onClose={() => setStep(null)}
        >
          <ReplaceForm
            churchId={churchId}
            visit={step.visit}
            leaving={step.leaving}
            onSaved={(joining) =>
              finish(
                `${firstName(joining)} has been asked to visit ${step.visit.neighborName} in place of ${firstName(step.leaving.name)}.`,
              )
            }
          />
        </HelpDialog>
      )}
      {step?.kind === "writeUp" && (
        <HelpDialog
          title={`The visit to ${step.visit.neighborName}`}
          description={`${day(step.visit.scheduledAt)} at ${time(step.visit.scheduledAt)}, ${step.visit.visitors.map((visitor) => visitor.name).join(" and ")}.`}
          onClose={() => setStep(null)}
        >
          <WriteUpForm
            churchId={churchId}
            visit={step.visit}
            hours={step.hours}
            miles={step.miles}
            onSaved={() =>
              finish(
                `Written up. The visit to ${step.visit.neighborName} now counts toward the year’s hours and miles.`,
              )
            }
          />
        </HelpDialog>
      )}
    </>
  );
}

function Pair({ names }: { names: string[] }) {
  return (
    <span className="help-person">
      {names.map((name) => (
        <span className="help-initials" key={name} aria-hidden="true">
          {initials(name)}
        </span>
      ))}
      {names.join(" and ")}
    </span>
  );
}

/** The screen itself, given its records: no fetching here, so it can be shown with made-up data. */
export function VisitsView({
  board,
  now,
  format,
  busy,
  onPlan,
  onAsk,
  onWriteUp,
  onReplace,
}: {
  board: Board;
  now: number;
  format: Workspace["format"];
  busy: boolean;
  onPlan: (requestId?: Id<"assistanceRequests">) => void;
  onAsk: (suggested: Suggestion, pair: NonNullable<Suggestion["pair"]>) => void;
  onWriteUp: (visit: Visit, hours: number, miles: number) => void;
  onReplace: (visit: Visit, leaving: Visit["visitors"][number]) => void;
}) {
  const { suggested } = board;
  const coming = board.scheduled.filter((visit) => visit.scheduledAt >= now);
  const toWriteUp = board.scheduled.filter((visit) => visit.scheduledAt < now);
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
  const nothing =
    !suggested &&
    !coming.length &&
    !toWriteUp.length &&
    !board.writtenUp.length;

  return (
    <>
      {suggested && (
        <section
          className="help-sheet"
          aria-label={`Visit to arrange for ${suggested.request.neighborName}`}
        >
          <p className="help-sheet-label">
            {suggested.pair
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
                <p className="help-why visits-pair">
                  <Pair names={suggested.pair.map((person) => person.name)} />
                </p>
              )}
              <p>{suggested.reason}</p>
            </div>
            <div className="help-actions">
              {suggested.pair ? (
                <>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      suggested.pair && onAsk(suggested, suggested.pair)
                    }
                  >
                    <Check size={18} aria-hidden="true" /> Ask this pair
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

      {nothing ? (
        <HelpEmpty
          title="No one is waiting on a visit."
          art="/assets/painted-world/visit-mobile.webp"
        >
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
                      <h3>{visit.neighborName}</h3>
                      <p className="help-facts">
                        <span>{visit.address}</span>
                        <Pair
                          names={visit.visitors.map((visitor) => visitor.name)}
                        />
                      </p>
                    </div>
                    <div className="live-row-actions">
                      <span
                        className="live-status"
                        data-state={
                          pair.state === "accepted" ? undefined : "waiting"
                        }
                      >
                        {pair.text}
                      </span>
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
              <WriteUpRow
                key={visit.id}
                visit={visit}
                leaf={leaf(visit.scheduledAt)}
                onWriteUp={onWriteUp}
              />
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
              <div className="help-row" data-quiet key={visit.id}>
                {leaf(visit.scheduledAt)}
                <div>
                  <h3>{visit.neighborName}</h3>
                  <p className="visits-found">{visit.notes}</p>
                  <p>
                    <Pair
                      names={visit.visitors.map((visitor) => visitor.name)}
                    />
                  </p>
                </div>
                <span className="live-status visits-given">
                  {count(visit.visitors[0]?.hours ?? 0, "hour", "hours")} ·{" "}
                  {count(visit.visitors[0]?.miles ?? 0, "mile", "miles")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** A visit that has happened: the hours and miles go in on the row, the words in the dialog that follows. */
function WriteUpRow({
  visit,
  leaf,
  onWriteUp,
}: {
  visit: Visit;
  leaf: ReactNode;
  onWriteUp: (visit: Visit, hours: number, miles: number) => void;
}) {
  const [problem, setProblem] = useState("");
  return (
    <div className="help-row">
      {leaf}
      <div>
        <h3>{visit.neighborName}</h3>
        <p>
          <Pair names={visit.visitors.map((visitor) => visitor.name)} />
        </p>
      </div>
      <form
        className="help-inline"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const hours = amount(String(data.get("hours") ?? ""));
          const miles = amount(String(data.get("miles") ?? ""));
          if (hours === null || hours <= 0 || hours > 24)
            return setProblem("Enter the hours the visit took, such as 1.5.");
          if (miles === null || miles > 1000)
            return setProblem("Enter the miles driven, or 0.");
          setProblem("");
          onWriteUp(visit, hours, miles);
        }}
      >
        <label>
          Hours
          <Input
            name="hours"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={problem.includes("hours") || undefined}
          />
        </label>
        <label>
          Miles
          <Input
            name="miles"
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={problem.includes("miles") || undefined}
          />
        </label>
        <Button variant="outline" type="submit">
          Write up
        </Button>
        {problem && (
          <p className="visits-problem" role="alert">
            {problem}
          </p>
        )}
      </form>
    </div>
  );
}
