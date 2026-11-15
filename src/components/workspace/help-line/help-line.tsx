"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Plus } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import {
  CallForm,
  HelpDialog,
  NeighborForm,
  RequestForm,
  ReturnForm,
} from "@/components/workspace/help-line/forms";
import {
  count,
  initials,
  recordHref,
  type Call,
  type Calls,
} from "@/components/workspace/help-line/format";
import {
  HelpDone,
  HelpEmpty,
  HelpLoading,
  HelpRoom,
} from "@/components/workspace/help-line/room";

type Step =
  | { kind: "log" }
  | { kind: "return" | "request" | "neighbor"; call: Call };

const caller = (call: Call) =>
  call.neighborName ?? (call.callerName || "New caller");

export function HelpLineSection() {
  return (
    <HelpRoom loading="Opening the help line">
      <HelpLine />
    </HelpRoom>
  );
}

function HelpLine() {
  const { data, format } = useWorkspace();
  const churchId = data.church.id;
  const calls = useQuery(api.assistance.calls, { churchId });
  const [step, setStep] = useState<Step | null>(null);
  const [done, setDone] = useState("");
  const finish = (message: string) => {
    setStep(null);
    setDone(message);
  };
  const close = () => setStep(null);
  if (!calls) return <HelpLoading label="Opening the help line" />;
  return (
    <>
      {done && <HelpDone>{done}</HelpDone>}
      <HelpLineView
        calls={calls}
        format={format}
        onStep={(next) => {
          setDone("");
          setStep(next);
        }}
      />
      {step?.kind === "log" && (
        <HelpDialog
          title="Log a call"
          description="Write down every call, even a wrong number."
          onClose={close}
        >
          <CallForm
            churchId={churchId}
            onSaved={(matched) =>
              finish(
                matched
                  ? "Call saved, and added to the neighbor’s record."
                  : "Call saved. It is waiting below until someone calls back.",
              )
            }
          />
        </HelpDialog>
      )}
      {step?.kind === "return" && (
        <HelpDialog
          title="Mark returned"
          description={`${caller(step.call)}${step.call.phone ? `, ${step.call.phone}` : ""}`}
          onClose={close}
        >
          <ReturnForm
            churchId={churchId}
            call={step.call}
            onSaved={() =>
              finish(`Marked returned. ${caller(step.call)} has been called back.`)
            }
          />
        </HelpDialog>
      )}
      {step?.kind === "request" && step.call.neighborId && (
        <HelpDialog
          title="Add a request"
          description={`For ${caller(step.call)}. Nothing is paid until it is approved.`}
          onClose={close}
        >
          <RequestForm
            churchId={churchId}
            neighborId={step.call.neighborId}
            callId={step.call.id}
            start={{ summary: step.call.note }}
            onSaved={() =>
              finish(
                `Request saved. It is waiting for a decision on ${caller(step.call)}’s record.`,
              )
            }
          />
        </HelpDialog>
      )}
      {step?.kind === "neighbor" && (
        <HelpDialog
          title="Add a neighbor"
          description="This call will be kept on their record."
          onClose={close}
        >
          <NeighborForm
            churchId={churchId}
            call={step.call}
            onSaved={() =>
              finish("Neighbor added. This call is now on their record.")
            }
          />
        </HelpDialog>
      )}
    </>
  );
}

export function HelpLineView({
  calls,
  format,
  onStep,
  sheet,
}: {
  calls: Calls;
  format: Workspace["format"];
  onStep: (step: Step) => void;
  /** The one thing waiting for a yes, when there is one. */
  sheet?: ReactNode;
}) {
  const leaf = (at: number) => {
    const part = (options: Intl.DateTimeFormatOptions) =>
      format(at, { month: undefined, day: undefined, ...options });
    const [time, half = ""] = part({ hour: "numeric", minute: "2-digit" }).split(/\s/);
    return (
      <div className="live-date-leaf">
        <span>{part({ weekday: "short" })}</span>
        <strong>{time}</strong>
        <span>{half}</span>
      </div>
    );
  };
  const name = (call: Call) =>
    call.neighborId ? (
      <Link className="live-link" href={recordHref(call.neighborId)}>
        {caller(call)}
      </Link>
    ) : (
      caller(call)
    );
  const log = (
    <Button
      variant={sheet ? "outline" : "default"}
      onClick={() => onStep({ kind: "log" })}
    >
      <Plus size={18} aria-hidden="true" /> Log a call
    </Button>
  );
  return (
    <>
      {sheet}
      <section>
        <div className="live-section-head">
          <h2>To call back</h2>
          <div className="help-actions">
            <span className="live-count">
              {count(calls.waiting.length, "message", "messages")}
            </span>
            {calls.waiting.length > 0 && log}
          </div>
        </div>
        {calls.waiting.length ? (
          <div className="live-list">
            {calls.waiting.map((call) => (
              <div className="help-row" key={call.id}>
                {leaf(call.takenAt)}
                <div>
                  <h3>
                    {name(call)}
                    {call.phone && (
                      <span className="help-phone">{call.phone}</span>
                    )}
                  </h3>
                  <p>{call.note}</p>
                </div>
                <div className="live-row-actions">
                  {call.ownerName && (
                    <span className="help-person live-meta">
                      <span className="help-initials" aria-hidden="true">
                        {initials(call.ownerName)}
                      </span>
                      {call.ownerName} is calling back
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() =>
                      onStep({
                        kind: call.neighborId ? "request" : "neighbor",
                        call,
                      })
                    }
                  >
                    {call.neighborId ? "Add a request" : "Add as a neighbor"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => onStep({ kind: "return", call })}
                  >
                    Mark returned
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <HelpEmpty title="A quiet morning." action={log}>
            No one is waiting for a call back. New messages from the help line
            will appear here.
          </HelpEmpty>
        )}
      </section>
      {calls.returned.length > 0 && (
        <section className="live-section">
          <div className="live-section-head">
            <h2>Returned this week</h2>
            <span className="live-count">
              {count(calls.returned.length, "call", "calls")}
            </span>
          </div>
          <div className="live-list">
            {calls.returned.map((call) => (
              <div className="help-row" data-quiet key={call.id}>
                {leaf(call.returnedAt ?? call.takenAt)}
                <div>
                  <h3>{name(call)}</h3>
                  <p>{call.outcome || call.note}</p>
                </div>
                <span className="live-status">
                  Returned
                  {call.returnedByName ? ` by ${call.returnedByName}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
