"use client";

import { AssistantLimits, DraftToDo } from "@/components/workspace/week-note/assistant-limits";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useAction, useMutation, useQueries } from "convex/react";
import { useQuery } from "convex-helpers/react/cache/hooks";
import type { FunctionReturnType } from "convex/server";
import { Check, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { words } from "@/lib/words";
import { useWorkspace, type Workspace } from "@/components/workspace/context";
import {
  CallForm,
  NeighborForm,
  RequestForm,
  ReturnForm,
} from "@/components/workspace/help-line/forms";
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
/** The line that says what changed, and where it leads: a neighbor's record, or a draft of the call just saved. */
type Done = { message: string; record?: Id<"neighbors">; draft?: Call["id"] };
type Step =
  | { kind: "log" }
  | {
      kind: "return" | "request" | "neighbor" | "draft";
      call: Call;
      /** The assistant was asked for a draft and could not give one. */
      undrafted?: boolean;
    }
  | { kind: "change"; drafted: Drafted; neighborId?: Id<"neighbors"> }
  // The caller is not on file yet: the neighbor is added first, then the draft goes on.
  | { kind: "join"; drafted: Drafted; then: "approve" | "change" };

/** How long a saved draft stays on the page, folded, before the next one rises. */
const SEAL_MS = 1400;
const PAPER_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

const caller = (call: Call) =>
  call.neighborName ?? (call.callerName || "New caller");

export function HelpLineSection() {
  return (
    <HelpRoom>
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
  // The group keeps them, so they are still here after leaving the page. Until the backend can
  // keep them they stay on this page only.
  const asked = useMemo(() => {
    const kept: Parameters<typeof useQueries>[0] = {
      kept: { query: api.assistance.drafts, args: { churchId } },
    };
    return kept;
  }, [churchId]);
  const answer:
    FunctionReturnType<typeof api.assistance.drafts> | Error | undefined =
    useQueries(asked).kept;
  const kept = answer instanceof Error ? undefined : answer;
  const keepDraft = useMutation(api.assistance.keepDraft);
  const discardDraft = useMutation(api.assistance.discardDraft);
  const [here, setDrafts] = useState<Drafted[]>([]);
  const drafts = kept ?? here;
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
  const [done, setDone] = useState<Done | null>(null);
  const finish = (message: string, more: Omit<Done, "message"> = {}) => {
    setStep(null);
    setDone({ message, ...more });
  };
  // The calls as they stand now, for work that finishes after the list has moved on.
  const latest = useRef(calls);
  useEffect(() => {
    latest.current = calls;
  }, [calls]);
  // The call whose note the assistant is reading.
  const [reading, setReading] = useState<Call["id"] | null>(null);
  const close = () => setStep(null);
  // The saved draft stays a moment with its corner folded, then the next one rises.
  const [sealed, setSealed] = useState<
    (Drafted & { neighborId: Id<"neighbors"> }) | null
  >(null);
  useEffect(() => {
    if (!sealed) return;
    const after = setTimeout(() => {
      setSealed(null);
      setDone({
        message: `Request saved. It is waiting for a decision on ${caller(sealed.call)}’s record.`,
        record: sealed.neighborId,
      });
    }, SEAL_MS);
    return () => clearTimeout(after);
  }, [sealed]);
  const onSheet = sealed ?? drafted;
  const sheetOpen = onSheet !== null;
  const log = useCallback(() => {
    setDone(null);
    setStep({ kind: "log" });
  }, []);
  useLayoutEffect(() => {
    setHeadAction({
      label: "Log a call",
      run: log,
      quiet: sheetOpen,
      plus: true,
    });
    return () => setHeadAction(null);
  }, [setHeadAction, log, sheetOpen]);
  const saved = (call: Call) => {
    settle(call);
    finish(
      `Request saved. It is waiting for a decision on ${caller(call)}’s record.`,
    );
  };
  function onStep(next: Step) {
    setDone(null);
    approving.clear();
    if (next.kind === "draft") void draftFor(next.call.id);
    else setStep(next);
  }
  /** Asks the assistant to draft a request from one call's note. The sheet shows it reading meanwhile. */
  async function draftFor(callId: Call["id"]) {
    setDone(null);
    approving.clear();
    setStep(null);
    setReading(callId);
    const outcome = await drafting.save(async () => {
      const draft = await draftRequest({ churchId, callId });
      if (kept) await keepDraft({ churchId, callId, draft });
      return draft;
    });
    setReading(null);
    const call = latest.current?.waiting.find((one) => one.id === callId);
    if (!call) return;
    // If the assistant cannot help, the person writes the request themselves.
    if (outcome.saved)
      setDrafts((all) => [
        { call, draft: outcome.result },
        ...all.filter((one) => one.call.id !== callId),
      ]);
    else
      setStep({
        kind: call.neighborId ? "request" : "neighbor",
        call,
        undrafted: true,
      });
  }
  async function approve(asked: Drafted, neighborId = asked.call.neighborId) {
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
    if (!outcome.saved) return;
    settle(call);
    setSealed({ ...asked, neighborId });
  }
  const changeFor =
    step?.kind === "change"
      ? (step.neighborId ?? step.drafted.call.neighborId)
      : null;
  if (!calls) return <HelpLoading label="Opening the help line" />;
  const read = calls.waiting.find((call) => call.id === reading);
  // A call just saved can go straight on to its draft.
  const offer = calls.waiting.find(
    (call) =>
      call.id === done?.draft &&
      !call.openRequest &&
      !drafts.some((one) => one.call.id === call.id),
  );
  return (
    <>
      {done && (
        <HelpDone
          action={
            done.record ? (
              <Link className="live-link" href={recordHref(done.record)}>
                Open the record
              </Link>
            ) : offer ? (
              <Button
                variant="link"
                className="help-text-action"
                disabled={drafting.pending}
                onClick={() => void draftFor(offer.id)}
              >
                <Sparkles size={15} aria-hidden="true" /> Draft a request
              </Button>
            ) : undefined
          }
        >
          {done.message}
        </HelpDone>
      )}
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
        reading={reading}
        draftedCallIds={drafts.map((one) => one.call.id)}
        onFirst={
          // An older backend sends no "urgent" on a call and cannot keep one.
          [...calls.waiting, ...calls.returned].some(
            (call) => call.urgent !== undefined,
          )
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
        onStep={onStep}
        sheet={
          drafting.pending && !sealed ? (
            <ReadingSheet note={read?.note} />
          ) : (
            onSheet && (
            <DraftSheet
              key={onSheet.call.id}
              drafted={onSheet}
              sealed={onSheet === sealed}
              waiting={drafts.length + (sealed ? 1 : 0)}
              format={format}
              pending={approving.pending}
              onApprove={() => void approve(onSheet)}
              onChange={() =>
                setStep(
                  onSheet.call.neighborId
                    ? { kind: "change", drafted: onSheet }
                    : { kind: "join", drafted: onSheet, then: "change" },
                )
              }
              onDiscard={() => {
                settle(onSheet.call);
                if (kept)
                  void approving.save(() =>
                    discardDraft({ churchId, callId: onSheet.call.id }),
                  );
                setDone({ message: "Draft discarded. Nothing was saved." });
              }}
            />
            )
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
            submitNew={
              step.then === "approve"
                ? "Save as new neighbor and request"
                : "Save as new neighbor and continue"
            }
            useLabel={
              step.then === "approve"
                ? "Use this neighbor and save"
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
            draftable
            onSaved={(matched, callId, draft) =>
              draft
                ? void draftFor(callId)
                : finish(
                    matched
                      ? "Call saved, and added to the neighbor’s record."
                      : "Call saved. It is waiting below until someone calls back.",
                    { draft: callId },
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
              finish(
                `Marked returned. ${caller(step.call)} has been called back.`,
              )
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
          description={
            step.undrafted
              ? "The assistant could not draft from this note. Add the neighbor, then write the request yourself."
              : "This call will be kept on their record."
          }
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
  const known = new Map<string, string | ((day: number) => string)>(
    Object.entries(text),
  );
  return urgent.reasons.flatMap((reason) => {
    const say = ["label", "origin", "notUrgent"].includes(reason)
      ? undefined
      : known.get(reason);
    return say === undefined ? [] : [typeof say === "string" ? say : say(day)];
  });
}

export function HelpLineView({
  calls,
  format,
  onStep,
  sheet,
  busy = false,
  reading = null,
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
  /** The call the assistant is reading now. */
  reading?: Call["id"] | null;
  /** The one thing waiting for a yes, when there is one. */
  sheet?: ReactNode;
}) {
  const isFirst = (call: Call) => !!call.urgent?.reasons.length;
  // A call marked returned travels down from where it waited into "Returned this week".
  const lists = useRef<HTMLDivElement>(null);
  const before = useRef(new Map<string, { top: number; waiting: boolean }>());
  useLayoutEffect(() => {
    const now = new Map<string, { top: number; waiting: boolean }>();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    lists.current
      ?.querySelectorAll<HTMLElement>("[data-call]")
      .forEach((row) => {
        const id = row.dataset.call ?? "";
        const waiting = !("quiet" in row.dataset);
        const top = row.getBoundingClientRect().top + window.scrollY;
        now.set(id, { top, waiting });
        const was = before.current.get(id);
        if (!was?.waiting || waiting) return;
        row.dataset.arrived = "";
        if (still) return;
        row.style.animation = "none";
        row.animate(
          [
            { transform: `translateY(${was.top - top}px)` },
            { transform: "none" },
          ],
          { duration: 480, easing: PAPER_EASE },
        );
      });
    before.current = now;
  });
  const leaf = (at: number) => {
    const part = (options: Intl.DateTimeFormatOptions) =>
      format(at, { month: undefined, day: undefined, ...options });
    const [time, half = ""] = part({
      hour: "numeric",
      minute: "2-digit",
    }).split(/\s/);
    return (
      <div className="live-date-leaf">
        <span>{part({ weekday: "short" })}</span>
        <strong>{time}</strong>
        <span>{half}</span>
      </div>
    );
  };
  return (
    <div className="help-lists" ref={lists}>
      {sheet}
      <section>
        <div className="live-section-head">
          <h2>To call back</h2>
          <span className="live-count">
            {count(calls.waiting.length, "message", "messages")}
          </span>
        </div>
        {calls.waiting.some(
          (call) => isFirst(call) && call.urgent?.by === "assistant",
        ) && (
          <p className="help-assistant help-first-origin">
            <Sparkles size={15} aria-hidden="true" /> {words().urgent.origin}
          </p>
        )}
        {calls.waiting.length ? (
          <div className="live-list">
            {calls.waiting.map((call) => (
              <div className="help-row" data-call={call.id} key={call.id}>
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
                    <p className="help-assistant help-first paper-rise">
                      <Sparkles size={15} aria-hidden="true" />
                      <strong>
                        {whyFirst(call.urgent).join(" · ") ||
                          words().urgent.label}
                      </strong>
                    </p>
                  )}
                  {call.urgent?.by === "person" && call.urgent.byName && (
                    <p className="help-first help-moved paper-rise">
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
                      <Link
                        className="live-link"
                        href={recordHref(call.neighborId)}
                      >
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
                        {reading === call.id ? "Drafting…" : "Draft a request"}
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
                        {isFirst(call)
                          ? words().urgent.notUrgent
                          : words().urgent.label}
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
              <div
                className="help-row"
                data-quiet
                data-call={call.id}
                key={call.id}
              >
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
    </div>
  );
}

/** While the assistant reads: the sheet is already laid down with the caller's words on it, and the rest arrives. */
function ReadingSheet({ note }: { note?: string }) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    sheet.current?.scrollIntoView({
      block: "nearest",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, []);
  return (
    <section
      className="help-sheet paper-rest help-reading"
      role="status"
      ref={sheet}
    >
      <p className="help-sheet-label">The assistant is reading the note</p>
      <div className="help-sheet-body">
        <div>
          <div className="help-reading-title" aria-hidden="true" />
          {note && <p className="help-quote">“{note}”</p>}
        </div>
      </div>
      <p className="help-assistant help-assistant-line">
        <Sparkles size={16} aria-hidden="true" />
        <span>
          It fills in only what the note says, and leaves blank what it does
          not. Nothing is saved until you say so.
        </span>
      </p>
    </section>
  );
}

/** The one thing waiting for a yes: what the assistant drafted from a call note. Plum marks its words. */
export function DraftSheet({
  drafted: { call, draft },
  waiting = 1,
  sealed = false,
  format,
  pending,
  onApprove,
  onChange,
  onDiscard,
}: {
  drafted: Drafted;
  /** How many drafts wait for a yes, this one included. */
  waiting?: number;
  /** The yes was given and the request is on the record: the corner folds to green. */
  sealed?: boolean;
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
  // What the note did not say stays blank, and the sheet says so in plain words.
  const missing = [
    !draft.kind && "the kind of help",
    draft.amountRequested === null && "the amount",
    (!draft.payeeKind || !draft.payeeName) && "who is paid",
  ].filter((part) => part !== false);
  const empty =
    !draft.kind && draft.amountRequested === null && !draft.payeeName;
  const title = empty
    ? "Nothing to draft from this note yet"
    : [
        draft.kind ? kindLabels[draft.kind] : "A request",
        draft.amountRequested !== null && shortMoney(draft.amountRequested),
      ]
        .filter((part) => part !== false)
        .join(", ");
  return (
    <section
      className={sealed ? "help-sheet paper-fold help-sealed" : "help-sheet"}
      aria-labelledby="draft-title"
      data-blank={complete ? undefined : ""}
    >
      <p className="help-sheet-label">
        {sealed
          ? "Saved, waiting for a decision"
          : complete
            ? text.waiting(waiting)
            : "A draft with blanks"}
      </p>
      <div className="help-sheet-body">
        <div>
          <h2 id="draft-title">
            {title}
            {draft.payeeName && ` to ${draft.payeeName}`}
          </h2>
          {!complete && (
            <p className="help-assistant help-blank">
              The note does not say{" "}
              {missing.length > 1
                ? `${missing.slice(0, -1).join(", ")} or ${missing.at(-1)}`
                : missing[0]}
              . That is yours to add.
            </p>
          )}
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
          {/* What to do about a blank reads with the text, at its measure, never beside the buttons. */}
          <DraftToDo notes={draft.notes} />
        </div>
        <div className="help-actions" inert={sealed}>
          {complete ? (
            <>
              <Button disabled={pending} onClick={onApprove}>
                <Check size={18} aria-hidden="true" />{" "}
                {call.neighborId ? "Save this request" : "Add neighbor and save"}
              </Button>
              <Button variant="outline" disabled={pending} onClick={onChange}>
                {text.change}
              </Button>
            </>
          ) : (
            <Button onClick={onChange}>
              {empty ? "Write the request" : "Fill in what is missing"}
            </Button>
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
        {sealed && (
          <p className="help-seal" role="status">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 12.5l5 5L19.5 7" pathLength={1} />
            </svg>
            {text.saved}
          </p>
        )}
      </div>
      <p className="help-assistant help-assistant-line">
        <Sparkles size={16} aria-hidden="true" />
        <AssistantLimits callId={call.id} verification={draft.verification} notes={draft.notes} sealed={sealed} />
      </p>
    </section>
  );
}
