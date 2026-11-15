"use client";

import {
  useCallback,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { words } from "@/lib/words";
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
  kindLabels,
  recordHref,
  shortMoney,
  type Call,
  type Calls,
} from "@/components/workspace/help-line/format";
import { useSave } from "@/components/workspace/help-line/use-save";
import {
  HelpDone,
  HelpEmpty,
  HelpLoading,
  HelpRoom,
} from "@/components/workspace/help-line/room";

type Draft = FunctionReturnType<typeof api.drafts.draftRequest>;
type Drafted = { call: Call; draft: Draft };
type Step =
  | { kind: "log" }
  | { kind: "return" | "request" | "neighbor" | "draft"; call: Call }
  | { kind: "change"; drafted: Drafted };

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
  const { data, format, setHeadAction } = useWorkspace();
  const churchId = data.church.id;
  const calls = useQuery(api.assistance.calls, { churchId });
  const draftRequest = useAction(api.drafts.draftRequest);
  const createRequest = useMutation(api.assistance.createRequest);
  const setUrgency = useMutation(api.assistance.setUrgency);
  const drafting = useSave();
  const approving = useSave();
  const [drafted, setDrafted] = useState<Drafted | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [done, setDone] = useState("");
  const finish = (message: string) => {
    setStep(null);
    setDone(message);
  };
  const close = () => setStep(null);
  const sheetOpen = drafted !== null;
  const log = useCallback(() => {
    setDone("");
    setStep({ kind: "log" });
  }, []);
  useLayoutEffect(() => {
    setHeadAction({ label: "Log a call", run: log, quiet: sheetOpen });
    return () => setHeadAction(null);
  }, [setHeadAction, log, sheetOpen]);
  const saved = (call: Call) => {
    setDrafted(null);
    finish(
      `Request saved. It is waiting for a decision on ${caller(call)}’s record.`,
    );
  };
  async function onStep(next: Step) {
    setDone("");
    approving.clear();
    if (next.kind !== "draft") return setStep(next);
    const outcome = await drafting.save(() =>
      draftRequest({ churchId, callId: next.call.id }),
    );
    // If the assistant cannot help, the person writes the request themselves.
    if (outcome.saved) setDrafted({ call: next.call, draft: outcome.result });
    else setStep({ kind: "request", call: next.call });
  }
  async function approve({ call, draft }: Drafted) {
    const { kind, amountRequested, payeeKind, payeeName } = draft;
    if (!call.neighborId || !kind || amountRequested === null || !payeeKind || !payeeName)
      return;
    const neighborId = call.neighborId;
    const outcome = await approving.save(() =>
      createRequest({
        churchId,
        neighborId,
        callId: call.id,
        kind,
        summary: call.note,
        amountRequested,
        payeeKind,
        payeeName,
        source: "ai_draft",
      }),
    );
    if (outcome.saved) saved(call);
  }
  if (!calls) return <HelpLoading label="Opening the help line" />;
  return (
    <>
      {done && <HelpDone>{done}</HelpDone>}
      {(approving.error || drafting.error) && (
        <div className="live-error" role="alert">
          <p>
            {approving.error ||
              "The assistant couldn’t draft this request. Nothing was saved."}
          </p>
          <p className="live-error-recovery">
            {approving.error
              ? "The draft is still here. Choose Change to correct it."
              : "You can write the request yourself in the form."}
          </p>
        </div>
      )}
      <HelpLineView
        calls={calls}
        format={format}
        busy={drafting.pending}
        draftedCallId={drafted?.call.id}
        onFirst={
          // An older backend sends no "urgent" on a call and cannot keep one.
          [...calls.waiting, ...calls.returned].some((call) => call.urgent !== undefined)
            ? (call, first) =>
                void approving.save(() =>
                  setUrgency({
                    churchId,
                    callId: call.id,
                    reasons: first ? ["marked"] : [],
                    by: "person",
                  }),
                )
            : undefined
        }
        onStep={(next) => void onStep(next)}
        sheet={
          drafted && (
            <DraftSheet
              drafted={drafted}
              format={format}
              pending={approving.pending}
              onApprove={() => void approve(drafted)}
              onChange={() => setStep({ kind: "change", drafted })}
              onDiscard={() => {
                setDrafted(null);
                setDone("Draft discarded. Nothing was saved.");
              }}
            />
          )
        }
      />
      {step?.kind === "change" && step.drafted.call.neighborId && (
        <HelpDialog
          title="Change the draft"
          description={`For ${caller(step.drafted.call)}. Nothing is saved until you save it here.`}
          onClose={close}
        >
          <RequestForm
            churchId={churchId}
            neighborId={step.drafted.call.neighborId}
            callId={step.drafted.call.id}
            start={{
              ...step.drafted.draft,
              kind: step.drafted.draft.kind ?? undefined,
              summary: step.drafted.call.note,
              source: "ai_draft",
            }}
            onSaved={() => saved(step.drafted.call)}
          />
        </HelpDialog>
      )}
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
            onSaved={() => saved(step.call)}
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

/** Why a call is first, in the reader's language. An unknown reason from a newer backend is left out. */
function whyFirst(urgent: NonNullable<Call["urgent"]>) {
  const text = words().urgent;
  const day = urgent.day ?? 0;
  return urgent.reasons.flatMap((reason) =>
    reason === "shutoff" || reason === "eviction"
      ? [text[reason](day)]
      : reason === "noFood" || reason === "child" || reason === "elder" || reason === "medical"
        ? [text[reason]]
        : [],
  );
}

export function HelpLineView({
  calls,
  format,
  onStep,
  sheet,
  busy = false,
  draftedCallId,
  onFirst,
}: {
  /** Moves a call to the front or back again. Left out while the backend cannot keep it. */
  onFirst?: (call: Call, first: boolean) => void;
  /** The call whose draft is on the sheet, which is not offered a second draft. */
  draftedCallId?: Call["id"];
  calls: Calls;
  format: Workspace["format"];
  onStep: (step: Step) => void;
  /** True while the assistant is drafting, so a second draft cannot start. */
  busy?: boolean;
  /** The one thing waiting for a yes, when there is one. */
  sheet?: ReactNode;
}) {
  const isFirst = (call: Call) => !!call.urgent?.reasons.length;
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
  return (
    <>
      {sheet}
      <section>
        <div className="live-section-head">
          <h2>To call back</h2>
          <span className="live-count">
            {count(calls.waiting.length, "message", "messages")}
          </span>
        </div>
        {calls.waiting.some((call) => isFirst(call) && call.urgent?.by === "assistant") && (
          <p className="help-assistant help-first-origin">
            <Sparkles size={15} aria-hidden="true" /> {words().urgent.origin}
          </p>
        )}
        {calls.waiting.length ? (
          <div className="live-list">
            {calls.waiting.map((call) => (
              <div className="help-row" key={call.id}>
                {leaf(call.takenAt)}
                <div>
                  <h3>
                    {caller(call)}
                    {call.phone && (
                      <span className="help-phone">{call.phone}</span>
                    )}
                  </h3>
                  <p>{call.note}</p>
                  {isFirst(call) && (
                    <p className="help-assistant help-first">
                      {call.urgent?.by === "assistant" && (
                        <Sparkles size={15} aria-hidden="true" />
                      )}
                      <strong>
                        {(call.urgent && whyFirst(call.urgent).join(" · ")) ||
                          words().urgent.label}
                      </strong>
                    </p>
                  )}
                  <p className="help-facts help-row-more">
                    {call.ownerName && (
                      <span className="help-person">
                        <span className="help-initials" aria-hidden="true">
                          {initials(call.ownerName)}
                        </span>
                        {call.ownerName} is calling back
                      </span>
                    )}
                    {call.neighborId ? (
                      <>
                        <Link className="live-link" href={recordHref(call.neighborId)}>
                          Open record
                        </Link>
                        {!call.openRequest && call.id !== draftedCallId && (
                          <Button
                            variant="link"
                            className="help-text-action"
                            disabled={busy}
                            onClick={() => onStep({ kind: "draft", call })}
                          >
                            {busy ? "Drafting…" : "Draft a request"}
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        variant="link"
                        className="help-text-action"
                        onClick={() => onStep({ kind: "neighbor", call })}
                      >
                        Add as a neighbor
                      </Button>
                    )}
                    {onFirst && (
                      <Button
                        variant="link"
                        className="help-text-action"
                        onClick={() => onFirst(call, !isFirst(call))}
                      >
                        {isFirst(call) ? words().urgent.notUrgent : words().urgent.label}
                      </Button>
                    )}
                  </p>
                </div>
                <div className="live-row-actions">
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
          <HelpEmpty
            title="A quiet morning."
            action={
              <Button variant="outline" onClick={() => onStep({ kind: "log" })}>
                Log a call
              </Button>
            }
          >
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
                  <h3>{caller(call)}</h3>
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

/** The one thing waiting for a yes: what the assistant drafted from a call note. Plum marks its words. */
export function DraftSheet({
  drafted: { call, draft },
  format,
  pending,
  onApprove,
  onChange,
  onDiscard,
}: {
  drafted: Drafted;
  format: Workspace["format"];
  pending: boolean;
  onApprove: () => void;
  onChange: () => void;
  onDiscard: () => void;
}) {
  const text = words().assistant;
  const complete =
    !!draft.kind &&
    draft.amountRequested !== null &&
    !!draft.payeeKind &&
    !!draft.payeeName;
  const title = [
    draft.kind ? kindLabels[draft.kind] : "Kind of help not stated",
    draft.amountRequested !== null
      ? shortMoney(draft.amountRequested)
      : "amount not stated",
  ].join(", ");
  return (
    <section className="help-sheet" aria-labelledby="draft-title">
      <p className="help-sheet-label">{text.waiting(1)}</p>
      <div className="help-sheet-body">
        <div>
          <h2 id="draft-title">
            {title}
            {draft.payeeName && ` to ${draft.payeeName}`}
          </h2>
          <p className="help-quote">“{draft.quote || call.note}”</p>
          <p className="help-why">
            For {caller(call)}, from the message on{" "}
            {format(call.takenAt, {
              month: undefined,
              day: undefined,
              weekday: "long",
              hour: "numeric",
              minute: "2-digit",
            })}
            .
          </p>
        </div>
        <div className="help-actions">
          {complete ? (
            <>
              <Button disabled={pending} onClick={onApprove}>
                <Check size={18} aria-hidden="true" /> {text.approve}
              </Button>
              <Button variant="outline" disabled={pending} onClick={onChange}>
                {text.change}
              </Button>
            </>
          ) : (
            <Button onClick={onChange}>Fill in what is missing</Button>
          )}
          <Button
            variant="link"
            className="help-text-action"
            disabled={pending}
            onClick={onDiscard}
          >
            {text.discard}
          </Button>
        </div>
      </div>
      <p className="help-assistant help-assistant-line">
        <Sparkles size={16} aria-hidden="true" />
        <span>
          {draft.verification === "checked"
            ? "Written by the assistant from the call note and checked against it."
            : "Written by the assistant from the call note. It could not be checked, so please read each detail against the note."}{" "}
          {!complete && `${text.blank} `}
          {draft.notes.length > 0 && `${draft.notes.join(" ")} `}
          Nothing is saved until you approve it.
        </span>
      </p>
    </section>
  );
}
