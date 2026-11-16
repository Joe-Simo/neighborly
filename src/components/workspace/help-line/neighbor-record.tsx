"use client";

import "@/components/workspace/for-good.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { useQuery } from "@/components/workspace/query";
import { ArrowLeft, Lock, TriangleAlert } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import {
  CloseForm,
  takingBack,
  DecideForm,
  NeighborForm,
  RemoveForm,
  RequestForm,
} from "@/components/workspace/help-line/forms";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { LiveState } from "@/components/workspace/states";
import { CountUp } from "@/components/workspace/primitives";
import {
  AccountsForm,
  AtHome,
  MoneyForm,
  NoteForm,
  PeopleForm,
  type Accounts,
  type HomeStep,
} from "@/components/workspace/help-line/household";
import {
  count,
  household,
  householdDetail,
  kindLabels,
  languageLabels,
  money,
  requestTitle,
  vouchers,
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
  | { kind: "request" | "details" | "note" | "remove" | HomeStep }
  | { kind: "approve" | "decline" | "change" | "close"; request: HelpRequest };

const back = (
  <Link className="help-back" href="/app/neighbors">
    <ArrowLeft size={16} aria-hidden="true" /> All neighbors
  </Link>
);

/** Opens one record: the opening is written down first, and only then is the record read. */
export function NeighborRecord({
  neighborId,
  requestId,
}: {
  neighborId: Id<"neighbors">;
  /** From a link to one request: that request is the one on the sheet. */
  requestId?: string | null;
}) {
  const { data, format, setHeading } = useWorkspace();
  const churchId = data.church.id;
  const open = useMutation(api.neighbors.open);
  const asked = useRef(false);
  const [opened, setOpened] = useState<"waiting" | "yes" | "missing">(
    "waiting",
  );
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    open({ churchId, neighborId }).then(
      () => setOpened("yes"),
      () => setOpened("missing"),
    );
  }, [open, churchId, neighborId]);
  // While a removal is on its way the record is no longer read, so the screen never asks for
  // one that has just gone; it shows the record as it last was. If the removal is refused,
  // that last reading stays on the screen until the fresh one arrives, so the sheet and what
  // it says are never taken down.
  const [held, setHeld] = useState<Record | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removed, setRemoved] = useState(false);
  const live = useQuery(
    api.neighbors.record,
    opened === "yes" && !removing && !removed
      ? { churchId, neighborId }
      : "skip",
  );
  const read = removed ? undefined : (live ?? held ?? undefined);
  // The website goes live before the backend does. Until the backend knows about the home,
  // the record shows without it instead of failing.
  const homeReady = Array.isArray(read?.household);
  const record = read && {
    ...read,
    household: homeReady ? read.household : [],
    accounts: homeReady ? read.accounts : [],
    money: homeReady ? read.money : null,
    open: [...read.open].sort(
      (a, b) => Number(b.id === requestId) - Number(a.id === requestId),
    ),
  };
  const title = record?.neighbor.name;
  const deck =
    record &&
    [
      record.neighbor.address,
      household(record.neighbor.adults, record.neighbor.children).toLowerCase(),
      `on file since ${format(record.since, { day: undefined, month: "long", year: "numeric" })}`,
    ]
      .filter(Boolean)
      .join(" · ");
  // The record's page head is the neighbor's name, with no painting: private and plain.
  useLayoutEffect(() => {
    if (!title || !deck) return;
    setHeading({ title, deck });
    return () => setHeading(null);
  }, [setHeading, title, deck]);
  const [step, setStep] = useState<Step | null>(null);
  const [done, setDone] = useState("");
  const finish = (message: string) => {
    setStep(null);
    setDone(message);
  };
  const close = () => setStep(null);
  const showAccounts = useMutation(api.neighbors.showAccounts);
  const [numbers, setNumbers] = useState<Accounts | null>(null);
  const reveal = () =>
    showAccounts({ churchId, neighborId }).then(setNumbers, () =>
      setDone("The account numbers couldn’t be shown. Please try again."),
    );
  const target = { churchId, neighborId };
  if (opened === "missing")
    return (
      <HelpEmpty
        first
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
  if (removed)
    return (
      <LiveState
        kind="empty"
        title="The record is removed."
        action={
          <Button variant="outline" asChild>
            <Link href="/app/neighbors">All neighbors</Link>
          </Button>
        }
      >
        The year’s totals stay as they were, with no name. Everything that
        said who this household was is gone.
      </LiveState>
    );
  if (!record) return <HelpLoading label="Opening the record" />;
  const { neighbor } = record;
  return (
    <>
      {done && <HelpDone>{done}</HelpDone>}
      <NeighborRecordView
        record={record}
        format={format}
        home={homeReady}
        numbers={numbers}
        onShowNumbers={() => void reveal()}
        onStep={(next) => {
          setDone("");
          setStep(next);
        }}
      />
      {step?.kind === "people" && (
        <LiveDialog
          title="Who lives here"
          description={`${neighbor.name}’s household, as they told us.`}
          onClose={close}
        >
          <PeopleForm
            target={target}
            household={record.household}
            onSaved={() => finish("Household saved.")}
          />
        </LiveDialog>
      )}
      {step?.kind === "money" && (
        <LiveDialog
          title="Money each month"
          description="What comes in and what goes out, in round numbers."
          onClose={close}
        >
          <MoneyForm
            target={target}
            money={record.money}
            onSaved={() => finish("The month is saved.")}
          />
        </LiveDialog>
      )}
      {step?.kind === "accounts" && (
        <LiveDialog
          title="Accounts"
          description="Where a bill is paid, so the treasurer does not have to ask twice."
          onClose={close}
        >
          <AccountsForm
            target={target}
            accounts={record.accounts}
            numbers={numbers}
            onShowNumbers={() => void reveal()}
            onSaved={() => {
              setNumbers(null);
              finish("Accounts saved.");
            }}
          />
        </LiveDialog>
      )}
      {step?.kind === "note" && (
        <LiveDialog
          title="Add a note"
          description={`On ${neighbor.name}’s record, for whoever helps next.`}
          onClose={close}
        >
          <NoteForm target={target} onSaved={() => finish("Note added.")} />
        </LiveDialog>
      )}
      {step?.kind === "request" && (
        <LiveDialog
          title="Add a request"
          description={`For ${neighbor.name}. Nothing is paid or given until it is approved.`}
          onClose={close}
        >
          <RequestForm
            churchId={churchId}
            neighborId={neighbor.id}
            onSaved={() =>
              finish("Request saved. It is waiting for a decision.")
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "change" && (
        <LiveDialog
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
        </LiveDialog>
      )}
      {(step?.kind === "approve" || step?.kind === "decline") && (
        <LiveDialog
          title={
            step.kind === "approve" ? "Approve request" : "Decline request"
          }
          description={`${requestTitle(step.request)}. ${step.request.summary}`}
          onClose={close}
        >
          <DecideForm
            churchId={churchId}
            request={step.request}
            decision={step.kind === "approve" ? "approved" : "declined"}
            onSaved={() =>
              finish(
                `Request ${step.kind === "approve" ? "approved" : "declined"}. ${neighbor.name}’s record is up to date.`,
              )
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "close" && (
        <LiveDialog
          title={
            takingBack(step.request) ? "Take back voucher" : "Close request"
          }
          description={`${requestTitle(step.request)}. ${step.request.summary}`}
          onClose={close}
        >
          <CloseForm
            churchId={churchId}
            request={step.request}
            onSaved={() =>
              finish(
                `${takingBack(step.request) ? "Voucher taken back" : "Request closed"}. ${neighbor.name}’s record is up to date.`,
              )
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "remove" && (
        <LiveDialog
          title="Remove this record"
          description={`Everything we keep about ${neighbor.name}, for good.`}
          onClose={close}
        >
          <RemoveForm
            churchId={churchId}
            neighbor={neighbor}
            onBegin={() => {
              setHeld(read ?? null);
              setRemoving(true);
            }}
            onRefused={() => setRemoving(false)}
            onRemoved={() => {
              setStep(null);
              setRemoved(true);
            }}
          />
        </LiveDialog>
      )}
      {step?.kind === "details" && (
        <LiveDialog
          title="Change details"
          description={`What we keep about ${neighbor.name}.`}
          onClose={close}
        >
          <NeighborForm
            churchId={churchId}
            neighbor={neighbor}
            onSaved={() => finish("Details saved.")}
          />
        </LiveDialog>
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
        found: event.note,
      };
    case "call":
      return {
        kind: "call",
        what: event.note || "Called the help line",
        who: `Call taken by ${event.who}`,
      };
    case "note":
      return { kind: "note", what: event.note, who: `Note by ${event.who}` };
    case "brought":
      return {
        kind: "money",
        what: `${kindLabels[event.kind]}${event.payee ? ` paid to ${event.payee}` : ""}`,
        who: "Brought over from earlier records",
        paid: event.amount ? shortMoney(event.amount) : undefined,
      };
    case "voucher":
      return {
        kind: event.takenBack ? "closed" : "money",
        what: `${vouchers(event)} ${event.takenBack ? "taken back" : "given"}`,
        who: [
          event.closedBy && `Taken back by ${event.closedBy}`,
          `Approved by ${event.who}`,
        ]
          .filter(Boolean)
          .join(" · "),
        found: event.note,
        // An older backend does not say; then the link stays away.
        takeBack: event.canTakeBack ? event.requestId : undefined,
      };
    case "decision":
      if (event.status === "closed")
        return {
          kind: "closed",
          // Never "without help" once money went out; each payment keeps its own line.
          what: `${kindLabels[event.kind]} request closed ${event.paid ? `after ${shortMoney(event.paid)} of ${shortMoney(event.approved)}` : "without help"}`,
          who: [
            event.who && `Closed by ${event.who}`,
            event.approvedBy && `Approved by ${event.approvedBy}`,
          ]
            .filter(Boolean)
            .join(" · "),
          found: event.note,
        };
      return {
        kind: "call",
        what: `${kindLabels[event.kind]} request declined`,
        who: [event.note, `Decided by ${event.who}`].filter(Boolean).join(" "),
      };
  }
}

export function NeighborRecordView({
  record,
  format,
  home = true,
  numbers = null,
  onShowNumbers = () => {},
  onStep,
}: {
  record: Record;
  format: Workspace["format"];
  home?: boolean;
  numbers?: Accounts | null;
  onShowNumbers?: () => void;
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
    request.source === "import"
      ? `Brought over from earlier records, asked on ${format(request.createdAt, { weekday: undefined, year: "numeric" })}.`
      : `Asked ${format(request.createdAt, { weekday: "long", month: "long", day: "numeric" })}. Taken by ${request.createdByName}.`;
  const years = [...new Set(record.history.map((event) => year(event.at)))];
  return (
    <>
      <p className="help-record-head">{back}</p>
      {neighbor.alert && (
        <p className="help-alert" role="note">
          <TriangleAlert size={18} aria-hidden="true" /> {neighbor.alert}
        </p>
      )}

      <dl className="help-figures">
        <div>
          <dt>Help this year</dt>
          <dd>
            <CountUp
              value={record.paidThisYear}
              format={(cents) => shortMoney(Math.round(cents / 100) * 100)}
            />
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

      <dl className="help-record-facts" data-few={home ? "" : undefined}>
        <div>
          <dt>Phone</dt>
          <dd>{neighbor.phone || "None on file"}</dd>
        </div>
        <div>
          <dt>Speaks</dt>
          <dd>{languageLabels[neighbor.language]}</dd>
        </div>
        {home ? (
          neighbor.email && (
            <div>
              <dt>Email</dt>
              <dd>{neighbor.email}</dd>
            </div>
          )
        ) : (
          <>
            <div>
              <dt>Household</dt>
              <dd>{householdDetail(neighbor.adults, neighbor.children)}</dd>
            </div>
            <div>
              <dt>{landlord ? "Landlord" : "Email"}</dt>
              <dd>{landlord ?? (neighbor.email || "None on file")}</dd>
            </div>
          </>
        )}
      </dl>
      <p className="help-note">
        {neighbor.notes && <>{neighbor.notes} </>}
        <Button
          variant="link"
          className="help-text-action"
          onClick={() => onStep({ kind: "details" })}
        >
          Change details
        </Button>
      </p>

      {home && (
        <AtHome
          record={record}
          format={format}
          numbers={numbers}
          onShowNumbers={onShowNumbers}
          onStep={(kind) => onStep({ kind })}
        />
      )}

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
            {first.status === "approved" && (
              <div className="help-actions">
                <Button
                  variant="link"
                  className="help-text-action"
                  onClick={() => onStep({ kind: "close", request: first })}
                >
                  Close this request
                </Button>
              </div>
            )}
            {first.status === "open" && (
              <div className="help-actions">
                <Button
                  onClick={() => onStep({ kind: "approve", request: first })}
                >
                  Approve request
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onStep({ kind: "decline", request: first })}
                >
                  Decline
                </Button>
                <Button
                  variant="link"
                  className="help-text-action"
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
                  <span>{format(request.createdAt, { day: undefined })}</span>
                  <strong>
                    {format(request.createdAt, { month: undefined })}
                  </strong>
                </div>
                <div>
                  <h3>{requestTitle(request)}</h3>
                  <p>
                    {request.summary}
                    {request.source === "import" &&
                      " Brought over from earlier records."}
                  </p>
                </div>
                <div className="live-row-actions">
                  {request.status === "open" ? (
                    <Button
                      variant="outline"
                      onClick={() => onStep({ kind: "approve", request })}
                    >
                      Approve request
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

      <section
        className={first || alsoOpen.length ? "live-section" : undefined}
      >
        <div className="live-section-head">
          <h2>History</h2>
          <span className="help-head-actions">
            {home && (
              <Button
                variant="link"
                className="help-text-action"
                onClick={() => onStep({ kind: "note" })}
              >
                Add a note
              </Button>
            )}
            {!first && (
              <Button
                variant="outline"
                onClick={() => onStep({ kind: "request" })}
              >
                Add a request
              </Button>
            )}
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
                    const given =
                      "takeBack" in line &&
                      record.requests.find(
                        (request) => request.id === line.takeBack,
                      );
                    return (
                      <li key={`${event.at}-${index}`} data-kind={line.kind}>
                        <time>{format(event.at)}</time>
                        <i aria-hidden="true" />
                        <div>
                          <h3>{line.what}</h3>
                          {"found" in line && line.found && (
                            <p className="help-found">{line.found}</p>
                          )}
                          <p>
                            {line.who}
                            {given && (
                              <>
                                <span className="help-sep"> · </span>
                                <Button
                                  variant="link"
                                  className="help-text-action"
                                  onClick={() =>
                                    onStep({ kind: "close", request: given })
                                  }
                                >
                                  Take it back
                                </Button>
                              </>
                            )}
                          </p>
                        </div>
                        {"paid" in line && line.paid && (
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

      {record.mayRemove && (
        <p className="for-good">
          <Button
            variant="ghost"
            className="for-good-open"
            onClick={() => onStep({ kind: "remove" })}
          >
            Remove this record
          </Button>
          <span className="live-count help-private">
            <Lock size={14} aria-hidden="true" /> Owners only
          </span>
        </p>
      )}
    </>
  );
}
