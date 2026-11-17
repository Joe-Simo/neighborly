"use client";

import { FOLD_HOLD, foldLeaves, holdThePage, openInPlaceOf, openUp } from "@/components/workspace/fold";
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
import { flushSync } from "react-dom";
import Link from "next/link";
import { useAction, useMutation, useQueries } from "convex/react";
import { useHour, useQuery } from "@/components/workspace/query";
import type { FunctionReturnType } from "convex/server";
import { Sparkles } from "lucide-react";
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
import { OnTheLine, owners, turnsToday } from "@/components/workspace/help-line/on-the-line";
import { LiveDialog } from "@/components/workspace/live-dialog";
import { LiveWaiting } from "@/components/workspace/states";
import {
  count,
  initials,
  recordHref,
  type Call,
  type Calls,
} from "@/components/workspace/help-line/format";
import { useSave } from "@/components/workspace/help-line/use-save";
import { DraftSheet, caller } from "@/components/workspace/help-line/draft-sheet";
import {
  HelpDone,
  dropSheetWords,
  letSheetWordsGo,
  readSealedSheet,
  HelpEmpty,
  HelpLoading,
  HelpRoom,
} from "@/components/workspace/help-line/room";

type Draft = FunctionReturnType<typeof api.drafts.draftRequest>;
type Drafted = { call: Call; draft: Draft };
/** The line that says what changed, and where it leads: a neighbor's record, or a draft of the call just saved. */
type Done = { message: string; record?: Id<"neighbors">; draft?: Call["id"]; filed?: { name: string; asks: string } };
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

const PAPER_EASE = "cubic-bezier(0.2, 0.7, 0.2, 1)";

export function HelpLineSection() {
  return (
    <HelpRoom>
      <HelpLine />
    </HelpRoom>
  );
}

/** A refusal opens its own room as it is laid, so the sheet under it is moved aside and never jumps; it stays while it is true. */
const laidToStay = (notice: HTMLElement | null) => {
  if (notice) openUp(notice, { stays: true });
};

function HelpLine() {
  const { data, format, now, setHeadAction } = useWorkspace();
  const churchId = data.church.id;
  const at = useHour();
  const calls = useQuery(api.assistance.calls, at ? { churchId, at } : "skip");
  const draftRequest = useAction(api.drafts.draftRequest);
  const createRequest = useMutation(api.assistance.createRequest);
  const setUrgency = useMutation(api.assistance.setUrgency);
  const drafting = useSave();
  const approving = useSave("decided");
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
  // The draft whose discard was refused, so the plum notice speaks of the discard and not of a request. It is
  // set in the same breath as the refusal's sentence, and dropped as soon as anything else is being saved, so
  // a later refusal (of a yes, say) is never given the discard's words.
  const [undiscarded, setUndiscarded] = useState<Call["id"] | null>(null);
  if (undiscarded && approving.pending) setUndiscarded(null);
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
  // From the moment the saved draft starts to close, the next one waiting is laid in its place.
  const [handing, setHanding] = useState(false);
  useEffect(() => {
    if (!sealed) return;
    let left = false;
    const after = setTimeout(() => {
      // The sheet's own words, read off it, are what the saved line carries: they travel there as the sheet closes.
      const asks = readSealedSheet();
      // They go from the sheet where they stand, the seal with them, before anything moves (room.tsx).
      void letSheetWordsGo().then(() => {
        if (left) return dropSheetWords();
        // The line opens as the sheet closes, in one move: it is laid first, so the close knows it is there, and the
        // close, the line and the line's words all start on the same frame, so the room only ever gets shorter. The
        // sheet is taken out the moment its close ends, before anything is drawn; for less motion the close is a plain
        // cut, so the line and the cut are one change.
        flushSync(() => {
          setDone({
            message: asks ? "Request saved. It waits for the conference to decide." : `Request saved. It is waiting for a decision on ${caller(sealed.call)}’s record.`,
            record: sealed.neighborId,
            filed: asks ? { name: caller(sealed.call), asks } : undefined,
          });
          setHanding(true);
        });
        // A next draft is laid under the closing sheet, and its room opens as the other's closes, so what is under
        // them moves once and never jumps. It is drawn, whole, once the saved sheet has gone.
        const next = document.querySelector<HTMLElement>(".help-sheet[data-arriving]");
        const going = document.querySelector<HTMLElement>(".help-sheet.help-sealed");
        if (next && going) openInPlaceOf(next, going);
        void foldLeaves().then(() =>
          flushSync(() => {
            setSealed(null);
            setHanding(false);
          }),
        );
      });
    }, FOLD_HOLD);
    return () => {
      left = true;
      clearTimeout(after);
    };
  }, [sealed]);
  const onSheet = sealed ?? drafted;
  // The draft that waits next, laid under the saved one while it closes.
  const next = sealed && handing && drafted && drafted.call.id !== sealed.call.id ? drafted : null;
  const sheetOpen = onSheet !== null;
  const log = useCallback(() => {
    setDone(null);
    setStep({ kind: "log" });
  }, []);
  const draftsUnknown = answer === undefined;
  useLayoutEffect(() => {
    setHeadAction({
      label: "Log a call",
      run: log,
      quiet: sheetOpen,
      // Until the drafts have arrived the room cannot know whether a sheet will hold the filled button.
      unsettled: draftsUnknown,
      plus: true,
    });
    return () => setHeadAction(null);
  }, [setHeadAction, log, sheetOpen, draftsUnknown]);
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
    // The button that was pressed rests while the request is saved and sealed, and a resting button lets focus fall to
    // the page. The sheet takes it, so the next key starts from here; the saved line takes it from the sheet.
    document.querySelector<HTMLElement>(".help-sheet:not([data-arriving])")?.focus({ preventScroll: true });
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
    // The sheet is sealed as the call now stands: a caller just added as a neighbor is on file, so the sealed sheet
    // (and the card it hands over) never goes back to "Add neighbor and save" or "Not yet on file".
    const now = latest.current?.waiting.find((one) => one.id === call.id) ?? call;
    setSealed({ ...asked, call: { ...now, neighborId }, neighborId });
  }
  const changeFor =
    step?.kind === "change"
      ? (step.neighborId ?? step.drafted.call.neighborId)
      : null;
  if (!calls) return <HelpLoading />;
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
          // A filed draft is a new line each time, so its words set off from their own sheet.
          key={done.filed ? `${done.record}:${done.filed.asks}` : "said"}
          filed={done.filed}
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
        <div className="live-error" role="alert" ref={laidToStay}>
          <p>
            {approving.error && undiscarded
              ? "The draft couldn’t be discarded."
              : approving.error ||
                "The assistant couldn’t draft this request. Nothing was saved."}
          </p>
          <p className="live-error-recovery">
            {approving.error && undiscarded
              ? // The reason as the backend gave it, then what is true now: the draft was not thrown away.
                `${approving.error} The draft is still on its sheet.`
              : approving.error
                ? "The draft is still here. Choose Change to correct it."
                : "You can write the request yourself in the form."}
          </p>
        </div>
      )}
      <OnTheLine turns={turnsToday({ data, now, format })} calling={owners(calls.waiting)} />
      <HelpLineView
        calls={calls}
        at={at}
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
            [onSheet, next].map(
              (one) =>
                one && (
                  <DraftSheet
                    key={one.call.id}
                    drafted={one}
                    sealed={one === sealed}
                    arriving={one === next}
                    waiting={drafts.length}
                    format={format}
                    // Once saved, its buttons stay as they were while saving and fade from there with the seal,
                    // never back to full ink first.
                    pending={approving.pending || one === sealed}
                    toDo={
                      <>
                        <DraftToDo notes={one.draft.notes} />
                        {/* A discard (or a yes) held by a lost connection: one quiet line above the resting buttons. */}
                        <LiveWaiting when={approving.pending && one === onSheet} />
                      </>
                    }
                    limits={
                      <AssistantLimits
                        callId={one.call.id}
                        verification={one.draft.verification}
                        notes={one.draft.notes}
                      />
                    }
                    onApprove={() => void approve(one)}
                    onChange={() =>
                      setStep(
                        one.call.neighborId
                          ? { kind: "change", drafted: one }
                          : { kind: "join", drafted: one, then: "change" },
                      )
                    }
                    onDiscard={async () => {
                      // An earlier green line would stand beside this draft's own answer; it is taken down first.
                      setDone(null);
                      // A draft the group keeps is only gone once the backend says so. Until then it stays on its
                      // sheet, its buttons resting (the sheet's `pending`), and nothing is said to be done. If the
                      // discard is refused the draft is left where it is and the notice says so in plum.
                      if (kept) {
                        const outcome = await approving.save(async () => {
                          try {
                            await discardDraft({ churchId, callId: one.call.id });
                          } catch (cause) {
                            setUndiscarded(one.call.id);
                            throw cause;
                          }
                        });
                        if (!outcome.saved) return;
                      }
                      // A draft kept on this page only has nothing to wait for.
                      settle(one.call);
                      setDone({ message: "Draft discarded. Nothing was saved." });
                    }}
                  />
                ),
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
  at,
}: {
  /** The whole hour the room was asked at, for how long a call has waited. */
  at?: number;
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
  // How long a call has waited, from the room's hour: "5 hours", "2 days". Two days and more is old.
  const DAY = 24 * 60 * 60 * 1000;
  const waited = (call: Call) => (at === undefined ? 0 : Math.max(0, at - call.takenAt));
  const ageLabel = (ms: number) =>
    ms >= DAY ? count(Math.floor(ms / DAY), "day", "days") : ms >= 3600000 ? count(Math.floor(ms / 3600000), "hour", "hours") : "under an hour";
  const oldest = calls.waiting.reduce<Call | undefined>((old, call) => (!old || call.takenAt < old.takenAt ? call : old), undefined);
  // A call marked returned leaves where it waited and is laid into "Returned this week". Everything else in
  // the lists that the change moves (the rows under it, the next heading) glides to its new place in the same
  // move, and the page keeps its place: nothing the person is looking at jumps.
  const lists = useRef<HTMLDivElement>(null);
  const before = useRef(new Map<string, { top: number; waiting: boolean }>());
  const others = useRef(new Map<Element, number>());
  useLayoutEffect(() => {
    const now = new Map<string, { top: number; waiting: boolean }>();
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A row gliding under a resting pointer is not being pointed at: it takes no hover wash until it has landed.
    const travel = (piece: HTMLElement, by: number) => {
      piece.style.pointerEvents = "none";
      const move = piece.animate([{ transform: `translateY(${by}px)` }, { transform: "none" }], { duration: 480, easing: PAPER_EASE });
      const land = () => void (piece.style.pointerEvents = "");
      move.addEventListener("finish", land);
      move.addEventListener("cancel", land);
    };
    const stayed: [HTMLElement, number][] = [];
    let travelled = false;
    lists.current
      ?.querySelectorAll<HTMLElement>("[data-call]")
      .forEach((row) => {
        const id = row.dataset.call ?? "";
        const waiting = !("quiet" in row.dataset);
        const top = row.getBoundingClientRect().top + window.scrollY;
        now.set(id, { top, waiting });
        const was = before.current.get(id);
        if (was && was.waiting === waiting) stayed.push([row, was.top - top]);
        if (!was?.waiting || waiting) return;
        travelled = true;
        row.dataset.arrived = "";
        if (still) return;
        row.style.animation = "none";
        // Its place is already kept in "Returned this week". It is drawn there only when the heading and the
        // rows around it have landed (their move is 480ms), so it never lies under or across any of them.
        row.animate(
          [
            { opacity: 0, transform: "translateY(10px)", easing: "linear" },
            { opacity: 0, transform: "translateY(10px)", offset: 480 / 700, easing: "ease-out" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 700 },
        );
      });
    const heads = new Map<Element, number>();
    lists.current?.querySelectorAll<HTMLElement>(".live-section-head").forEach((head) => {
      heads.set(head, head.getBoundingClientRect().top + window.scrollY);
      const was = others.current.get(head);
      if (was !== undefined) stayed.push([head, was - (heads.get(head) ?? was)]);
    });
    if (travelled) {
      holdThePage();
      if (!still) stayed.forEach(([piece, by]) => Math.abs(by) > 1 && travel(piece, by));
    }
    before.current = now;
    others.current = heads;
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
            {oldest && at !== undefined && (
              <>
                {" · "}
                <span className="help-oldest">oldest waiting {ageLabel(waited(oldest))}</span>
              </>
            )}
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
              <div
                className="help-row"
                data-call={call.id}
                data-old={waited(call) >= 2 * DAY ? "" : undefined}
                key={call.id}
              >
                {leaf(call.takenAt)}
                <div>
                  <h3>
                    {call.neighborId ? (
                      // The whole row opens the record, through its one link, the name.
                      <Link className="help-row-open" href={recordHref(call.neighborId)}>
                        {caller(call)}
                      </Link>
                    ) : (
                      caller(call)
                    )}
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
                    {/* Offered once, on the call that has waited longest, and on a call already put first. */}
                    {onFirst && (isFirst(call) || (call === oldest && !calls.waiting.some(isFirst))) && (
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
                    aria-label={`Mark returned: ${caller(call)}`}
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
          <p className="help-reading-title">Reading what was written.</p>
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
