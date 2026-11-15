"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, Lock } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import {
  CallForm,
  DecideForm,
  HelpDialog,
  NeighborForm,
  RequestForm,
} from "@/components/workspace/help-line/forms";
import {
  count,
  household,
  householdDetail,
  kindLabels,
  languageLabels,
  money,
  requestTitle,
  shortMoney,
  type HelpRequest,
  type NeighborRecord as Record,
} from "@/components/workspace/help-line/format";
import {
  HelpDone,
  HelpEmpty,
  HelpLoading,
} from "@/components/workspace/help-line/room";

type Step =
  | { kind: "call" | "request" | "details" }
  | { kind: "decide" | "change"; request: HelpRequest };

const back = (
  <Link className="help-back" href="/app/neighbors">
    <ArrowLeft size={16} aria-hidden="true" /> All neighbors
  </Link>
);

/** Opens one record: the opening is written down first, and only then is the record read. */
export function NeighborRecord({ neighborId }: { neighborId: Id<"neighbors"> }) {
  const { data, format } = useWorkspace();
  const churchId = data.church.id;
  const open = useMutation(api.neighbors.open);
  const asked = useRef(false);
  const [opened, setOpened] = useState<"waiting" | "yes" | "missing">("waiting");
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    open({ churchId, neighborId }).then(
      () => setOpened("yes"),
      () => setOpened("missing"),
    );
  }, [open, churchId, neighborId]);
  const record = useQuery(
    api.neighbors.record,
    opened === "yes" ? { churchId, neighborId } : "skip",
  );
  const [step, setStep] = useState<Step | null>(null);
  const [done, setDone] = useState("");
  const finish = (message: string) => {
    setStep(null);
    setDone(message);
  };
  const close = () => setStep(null);
  if (opened === "missing")
    return (
      <HelpEmpty
        title="We couldn’t find that record."
        action={
          <Button variant="outline" asChild>
            <Link href="/app/neighbors">All neighbors</Link>
          </Button>
        }
      >
        It may belong to another group, or the link may be incomplete. Nothing
        was opened.
      </HelpEmpty>
    );
  if (!record) return <HelpLoading label="Opening the record" />;
  const { neighbor } = record;
  return (
    <>
      {done && <HelpDone>{done}</HelpDone>}
      <NeighborRecordView
        record={record}
        format={format}
        onStep={(next) => {
          setDone("");
          setStep(next);
        }}
      />
      {step?.kind === "call" && (
        <HelpDialog
          title="Log a call"
          description={`A call with ${neighbor.name}, kept on this record.`}
          onClose={close}
        >
          <CallForm
            churchId={churchId}
            neighbor={neighbor}
            onSaved={() => finish("Call saved on this record.")}
          />
        </HelpDialog>
      )}
      {step?.kind === "request" && (
        <HelpDialog
          title="Add a request"
          description={`For ${neighbor.name}. Nothing is paid until it is approved.`}
          onClose={close}
        >
          <RequestForm
            churchId={churchId}
            neighborId={neighbor.id}
            onSaved={() => finish("Request saved. It is waiting for a decision.")}
          />
        </HelpDialog>
      )}
      {step?.kind === "change" && (
        <HelpDialog
          title="Change the request"
          description="You can change a request until it is decided."
          onClose={close}
        >
          <RequestForm
            churchId={churchId}
            neighborId={neighbor.id}
            request={step.request}
            onSaved={() => finish("Request changed.")}
          />
        </HelpDialog>
      )}
      {step?.kind === "decide" && (
        <HelpDialog
          title={requestTitle(step.request)}
          description={step.request.summary}
          onClose={close}
        >
          <DecideForm
            churchId={churchId}
            request={step.request}
            onSaved={() =>
              finish(
                `Decision saved. ${neighbor.name}’s record is up to date.`,
              )
            }
          />
        </HelpDialog>
      )}
      {step?.kind === "details" && (
        <HelpDialog
          title="Change details"
          description={`What we keep about ${neighbor.name}.`}
          onClose={close}
        >
          <NeighborForm
            churchId={churchId}
            neighbor={neighbor}
            onSaved={() => finish("Details saved.")}
          />
        </HelpDialog>
      )}
    </>
  );
}

function happened(event: Record["history"][number]) {
  switch (event.type) {
    case "payment":
      return {
        kind: "money",
        what: `${event.category in kindLabels ? kindLabels[event.category as keyof typeof kindLabels] : event.category} paid to ${event.payee}`,
        who: `Recorded by ${event.who}`,
        paid: shortMoney(event.amount),
      };
    case "visit":
      return {
        kind: "visit",
        what: "Home visit",
        who: event.who.join(" and "),
      };
    case "call":
      return {
        kind: "call",
        what: event.note || "Called the help line",
        who: `Call taken by ${event.who}`,
      };
    case "decision":
      return {
        kind: "call",
        what: `${kindLabels[event.kind]} request ${event.status}`,
        who: [event.note, `Decided by ${event.who}`].filter(Boolean).join(" "),
      };
  }
}

export function NeighborRecordView({
  record,
  format,
  onStep,
}: {
  record: Record;
  format: Workspace["format"];
  onStep: (step: Step) => void;
}) {
  const { neighbor, open } = record;
  const [first, ...alsoOpen] = open;
  const year = (at: number) =>
    format(at, { month: undefined, day: undefined, year: "numeric" });
  const landlord = record.requests.find(
    (request) => request.payeeKind === "landlord" && request.payeeName,
  )?.payeeName;
  const asked = (request: HelpRequest) =>
    `Asked ${format(request.createdAt, { weekday: "long" })}. Taken by ${request.createdByName}.`;
  const years = [...new Set(record.history.map((event) => year(event.at)))];
  return (
    <>
      <div className="help-record-head">
        <div>
          {back}
          <h2>{neighbor.name}</h2>
          <p>
            {[
              neighbor.address,
              household(neighbor.adults, neighbor.children).toLowerCase(),
              `on file since ${format(record.since, { day: undefined, month: "long", year: "numeric" })}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="help-actions">
          <Button variant="outline" onClick={() => onStep({ kind: "call" })}>
            Log a call
          </Button>
          <Button variant="outline" onClick={() => onStep({ kind: "request" })}>
            Add a request
          </Button>
          <Button variant="ghost" onClick={() => onStep({ kind: "details" })}>
            Change details
          </Button>
        </div>
      </div>

      <dl className="help-figures">
        <div>
          <dt>Help this year</dt>
          <dd>
            {shortMoney(record.paidThisYear)}
            <small>
              {count(record.requestsThisYear, "request", "requests")}, paid
              direct
            </small>
          </dd>
        </div>
        <div>
          <dt>Home visits</dt>
          <dd>
            {record.visitsDone}
            <small>
              {record.lastVisitAt
                ? `Last on ${format(record.lastVisitAt)}`
                : "None yet"}
            </small>
          </dd>
        </div>
        <div>
          <dt>Open now</dt>
          <dd>
            {open.length}
            <small>
              {first
                ? `${kindLabels[first.kind]}, ${shortMoney(first.amountApproved ?? first.amountRequested)}`
                : "Nothing waiting"}
            </small>
          </dd>
        </div>
      </dl>

      <dl className="help-record-facts">
        <div>
          <dt>Phone</dt>
          <dd>{neighbor.phone || "None on file"}</dd>
        </div>
        <div>
          <dt>Speaks</dt>
          <dd>{languageLabels[neighbor.language]}</dd>
        </div>
        <div>
          <dt>Household</dt>
          <dd>{householdDetail(neighbor.adults, neighbor.children)}</dd>
        </div>
        <div>
          <dt>{landlord ? "Landlord" : "Email"}</dt>
          <dd>{landlord ?? (neighbor.email || "None on file")}</dd>
        </div>
      </dl>
      {neighbor.notes && <p className="help-note">{neighbor.notes}</p>}

      {first && (
        <section className="help-sheet" aria-labelledby="open-title">
          <p className="help-sheet-label">
            {first.status === "open" ? "Open request" : "Approved, to be paid"}
          </p>
          <div className="help-sheet-body">
            <div>
              <h2 id="open-title">{requestTitle(first)}</h2>
              <p className="help-why">{first.summary}</p>
              <p>
                {asked(first)}
                {first.status === "approved" &&
                  ` Approved by ${first.decidedByName} for ${money(first.amountApproved ?? 0)}. The treasurer pays ${first.payeeName} directly.`}
              </p>
            </div>
            {first.status === "open" && (
              <div className="help-actions">
                <Button onClick={() => onStep({ kind: "decide", request: first })}>
                  Approve or decline
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onStep({ kind: "change", request: first })}
                >
                  Change
                </Button>
              </div>
            )}
          </div>
        </section>
      )}
      {alsoOpen.length > 0 && (
        <section className="live-section">
          <div className="live-section-head">
            <h2>Also open</h2>
            <span className="live-count">
              {count(alsoOpen.length, "request", "requests")}
            </span>
          </div>
          <div className="live-list">
            {alsoOpen.map((request) => (
              <div className="help-row" key={request.id}>
                <div className="live-date-leaf">
                  <span>
                    {format(request.createdAt, { day: undefined })}
                  </span>
                  <strong>
                    {format(request.createdAt, { month: undefined })}
                  </strong>
                </div>
                <div>
                  <h3>{requestTitle(request)}</h3>
                  <p>{request.summary}</p>
                </div>
                <div className="live-row-actions">
                  {request.status === "open" ? (
                    <Button
                      variant="outline"
                      onClick={() => onStep({ kind: "decide", request })}
                    >
                      Approve or decline
                    </Button>
                  ) : (
                    <span className="live-status">Approved, to be paid</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className={first || alsoOpen.length ? "live-section" : undefined}>
        <div className="live-section-head">
          <h2>History</h2>
          <span className="live-count">
            Since{" "}
            {format(record.since, { day: undefined, month: "long", year: "numeric" })}
          </span>
        </div>
        {record.history.length ? (
          years.map((label) => (
            <div key={label}>
              <p className="help-year">{label}</p>
              <ol className="help-timeline">
                {record.history
                  .filter((event) => year(event.at) === label)
                  .map((event, index) => {
                    const line = happened(event);
                    return (
                      <li key={`${event.at}-${index}`} data-kind={line.kind}>
                        <time>{format(event.at)}</time>
                        <i aria-hidden="true" />
                        <div>
                          <h3>{line.what}</h3>
                          <p>{line.who}</p>
                        </div>
                        {line.paid && (
                          <span className="help-amount">{line.paid}</span>
                        )}
                      </li>
                    );
                  })}
              </ol>
            </div>
          ))
        ) : (
          <HelpEmpty title="Nothing here yet.">
            Calls, home visits and payments will gather here as they happen.
          </HelpEmpty>
        )}
      </section>

      <section className="live-section">
        <div className="live-section-head">
          <h2>Who has opened this record</h2>
          <span className="live-count help-private">
            <Lock size={14} aria-hidden="true" /> Coordinators and owners only
          </span>
        </div>
        <div className="help-opened">
          {record.openings.map((opening, index) => (
            <span key={`${opening.at}-${index}`}>
              <strong>{opening.who}</strong> ·{" "}
              {format(opening.at, {
                weekday: "short",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
