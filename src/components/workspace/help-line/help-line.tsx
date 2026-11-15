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
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { words } from "@/lib/words";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import { CallForm, NeighborForm, RequestForm, ReturnForm } from "@/components/workspace/help-line/forms";
import { LiveDialog } from "@/components/workspace/live-dialog";
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
  | { kind: "change"; drafted: Drafted; neighborId?: Id<"neighbors"> }
  // The caller is not on file yet: the neighbor is added first, then the draft goes on.
  | { kind: "join"; drafted: Drafted; then: "approve" | "change" };

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
  // Every draft waits for its own yes; asking for another never drops one. The newest is on the sheet.
  const [drafts, setDrafts] = useState<Drafted[]>([]);
  const newest = drafts.at(0) ?? null;
  // The call as it stands now, so a draft knows once its caller is on file.
  const drafted = newest && {
    ...newest,
    call:
      calls?.waiting.find((call) => call.id === newest.call.id) ?? newest.call,
  };
  const settle = (call: Call) =>
    setDrafts((all) => all.filter((one) => one.call.id !== call.id));
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
    setHeadAction({ label: "Log a call", run: log, quiet: sheetOpen, plus: true });
    return () => setHeadAction(null);
  }, [setHeadAction, log, sheetOpen]);
  const saved = (call: Call) => {
    settle(call);
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
    if (outcome.saved)
      setDrafts((all) => [
        { call: next.call, draft: outcome.result },
        ...all.filter((one) => one.call.id !== next.call.id),
      ]);
    else
      setStep({
        kind: next.call.neighborId ? "request" : "neighbor",
        call: next.call,
      });
  }
  async function approve(
    asked: Drafted,
    neighborId = asked.call.neighborId,
  ) {
    const { call, draft } = asked;
    const { kind, amountRequested, payeeKind, payeeName } = draft;
    if (!kind || amountRequested === null || !payeeKind || !payeeName) return;
    if (!neighborId)
      return setStep({ kind: "join", drafted: asked, then: "approve" });
    setStep(null);
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
  const changeFor =
    step?.kind === "change"
      ? (step.neighborId ?? step.drafted.call.neighborId)
      : null;
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
        draftedCallIds={drafts.map((one) => one.call.id)}
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
              waiting={drafts.length}
              format={format}
              pending={approving.pending}
              onApprove={() => void approve(drafted)}
              onChange={() =>
                setStep(
                  drafted.call.neighborId
                    ? { kind: "change", drafted }
                    : { kind: "join", drafted, then: "change" },
                )
              }
              onDiscard={() => {
                settle(drafted.call);
                setDone("Draft discarded. Nothing was saved.");
              }}
            />
          )
        }
      />
      {step?.kind === "join" && (
        <LiveDialog
          title="Add a neighbor"
          description="This call and its request will be kept on their record."
          onClose={close}
        >
          <NeighborForm
            churchId={churchId}
            call={step.drafted.call}
            submit={
              step.then === "approve"
                ? "Save neighbor and request"
                : "Save neighbor and continue"
            }
            useLabel={
              step.then === "approve"
                ? "Use this neighbor and approve"
                : "Use this neighbor"
            }
            onSaved={(neighborId) =>
              step.then === "approve"
                ? void approve(step.drafted, neighborId)
                : setStep({ kind: "change", drafted: step.drafted, neighborId })
            }
          />
        </LiveDialog>
      )}
      {step?.kind === "change" && changeFor && (
        <LiveDialog
          title="Change the draft"
          description={`For ${caller(step.drafted.call)}. Nothing is saved until you save it here.`}
          onClose={close}
        >
          <RequestForm
            churchId={churchId}
            neighborId={changeFor}
            callId={step.drafted.call.id}
            start={{
              ...step.drafted.draft,
              kind: step.drafted.draft.kind ?? undefined,
              summary: step.drafted.call.note,
              source: "ai_draft",
            }}
            onSaved={() => saved(step.drafted.call)}
          />
        </LiveDialog>
      )}
      {step?.kind === "log" && (
        <LiveDialog
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
        </LiveDialog>
      )}
      {step?.kind === "return" && (
        <LiveDialog
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
        </LiveDialog>
      )}
      {step?.kind === "request" && step.call.neighborId && (
        <LiveDialog
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
        </LiveDialog>
      )}
      {step?.kind === "neighbor" && (
        <LiveDialog
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
        </LiveDialog>
      )}
    </>
  );
}

/** Why a call is first, in the reader's language. An unknown reason from a newer backend is left out. */
function whyFirst(urgent: NonNullable<Call["urgent"]>) {
  const text = words().urgent;
  const day = urgent.day ?? 0;
  const known = new Map<string, string | ((day: number) => string)>(Object.entries(text));
  return urgent.reasons.flatMap((reason) => {
    const say = ["label", "origin", "notUrgent"].includes(reason) ? undefined : known.get(reason);
    return say === undefined ? [] : [typeof say === "string" ? say : say(day)];
  });
}

export function HelpLineView({
  calls,
  format,
  onStep,
  sheet,
  busy = false,
  draftedCallIds = [],
  onFirst,
}: {
  /** Moves a call to the front or back again. Left out while the backend cannot keep it. */
  onFirst?: (call: Call, first: boolean) => void;
  /** Calls with a draft waiting for a yes, which are not offered a second draft. */
  draftedCallIds?: Call["id"][];
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
                  {call.urgent?.by === "assistant" && isFirst(call) && (
                    <p className="help-assistant help-first">
                      <Sparkles size={15} aria-hidden="true" />
                      <strong>
                        {whyFirst(call.urgent).join(" · ") || words().urgent.label}
                      </strong>
                    </p>
                  )}
                  {call.urgent?.by === "person" && call.urgent.byName && (
                    <p className="help-first help-moved">
                      {isFirst(call) ? "Put first" : "Marked not urgent"} by{" "}
                      {call.urgent.byName}
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
                    {call.neighborId && (
                      <Link className="live-link" href={recordHref(call.neighborId)}>
                        Open record
                      </Link>
                    )}
                    {!call.openRequest && !draftedCallIds.includes(call.id) && (
                      <Button
                        variant="link"
                        className="help-text-action"
                        disabled={busy}
                        onClick={() => onStep({ kind: "draft", call })}
                      >
                        {busy ? "Drafting…" : "Draft a request"}
                      </Button>
                    )}
                    {!call.neighborId && (
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
  waiting = 1,
  format,
  pending,
  onApprove,
  onChange,
  onDiscard,
}: {
  drafted: Drafted;
  /** How many drafts wait for a yes, this one included. */
  waiting?: number;
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
      <p className="help-sheet-label">{text.waiting(waiting)}</p>
      <div className="help-sheet-body">
        <div>
          <h2 id="draft-title">
            {title}
            {draft.payeeName && ` to ${draft.payeeName}`}
          </h2>
          <p className="help-quote">“{draft.quote || call.note}”</p>
          <p className="help-why">
            For {call.neighborId ? caller(call) : "a new caller"}, from the
            message on{" "}
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
                <Check size={18} aria-hidden="true" />{" "}
                {call.neighborId ? text.approve : "Add neighbor and approve"}
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
